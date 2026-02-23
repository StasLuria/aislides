"""Unit-тесты для S0_PlannerNode.

Все вызовы LLM замокированы — тесты не требуют API-ключа.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.nodes.planner_node import S0PlannerNode, _build_user_prompt
from schemas.execution_plan import ExecutionPlanSchema, PlanStep
from schemas.shared_store import ChatMessage, SharedStore

# ---------------------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------------------


@pytest.fixture()
def store() -> SharedStore:
    """Создать SharedStore с минимальным запросом."""
    return SharedStore(
        project_id="test-project-001",
        user_input={"prompt": "Создай питч-презентацию для инвесторов на 10 слайдов"},
        config={"llm": {"model": "test-model"}},
    )


@pytest.fixture()
def mock_plan() -> ExecutionPlanSchema:
    """Создать типичный план из 5 шагов."""
    return ExecutionPlanSchema(
        thought="Пользователь хочет питч-презентацию. Нужны все 5 шагов.",
        steps=[
            PlanStep(step_id=1, node="S1_ContextAnalyzer", reason="Анализ запроса"),
            PlanStep(step_id=2, node="S2_NarrativeArchitect", reason="Структура"),
            PlanStep(step_id=3, node="S3_DesignArchitect", reason="Дизайн"),
            PlanStep(step_id=4, node="S4_SlideGenerator", reason="Генерация"),
            PlanStep(step_id=5, node="S5_QualityValidator", reason="Проверка"),
        ],
    )


def _make_mock_client(plan: ExecutionPlanSchema) -> MagicMock:
    """Создать мок Instructor-клиента, возвращающего заданный план."""
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=plan)
    return mock_client


# ---------------------------------------------------------------------------
# Тесты _build_user_prompt
# ---------------------------------------------------------------------------


class TestBuildUserPrompt:
    """Тесты формирования пользовательского промпта."""

    def test_basic_prompt(self, store: SharedStore) -> None:
        """Промпт содержит запрос пользователя."""
        result = _build_user_prompt(store)
        assert "питч-презентацию" in result
        assert "## Запрос пользователя" in result

    def test_empty_prompt(self) -> None:
        """Пустой запрос возвращает дефолтное сообщение."""
        s = SharedStore(
            project_id="test-empty",
            user_input={},
            config={},
        )
        result = _build_user_prompt(s)
        assert result == "Создай презентацию."

    def test_with_chat_history(self, store: SharedStore) -> None:
        """Промпт включает историю чата."""
        store.chat_history = [
            ChatMessage(role="user", content="Привет"),
            ChatMessage(role="assistant", content="Здравствуйте!"),
        ]
        result = _build_user_prompt(store)
        assert "## История чата" in result
        assert "Привет" in result

    def test_with_existing_results(self, store: SharedStore) -> None:
        """Промпт включает информацию о выполненных шагах."""
        store.results = {"S1_ContextAnalyzer": {"audience": "investors"}}
        result = _build_user_prompt(store)
        assert "## Уже выполненные шаги" in result
        assert "S1_ContextAnalyzer" in result

    def test_with_edit_context(self, store: SharedStore) -> None:
        """Промпт включает контекст ручной правки."""
        store.user_input["edit_context"] = {
            "artifact_id": "slide_03",
            "new_content": "Новый текст слайда",
        }
        result = _build_user_prompt(store)
        assert "Контекст ручной правки" in result
        assert "slide_03" in result

    def test_with_attached_files(self, store: SharedStore) -> None:
        """Промпт включает информацию о прикреплённых файлах."""
        from schemas.shared_store import AttachedFile

        store.attached_files = [
            AttachedFile(file_id="f1", filename="data.xlsx", path="/tmp/data.xlsx"),
        ]
        result = _build_user_prompt(store)
        assert "## Прикреплённые файлы" in result
        assert "data.xlsx" in result


# ---------------------------------------------------------------------------
# Тесты S0PlannerNode
# ---------------------------------------------------------------------------


class TestS0PlannerNode:
    """Тесты для S0PlannerNode."""

    def test_name(self) -> None:
        """Имя узла корректно."""
        node = S0PlannerNode()
        assert node.name == "S0_PlannerNode"

    @pytest.mark.asyncio()
    async def test_execute_success(self, store: SharedStore, mock_plan: ExecutionPlanSchema) -> None:
        """Успешная генерация плана."""
        node = S0PlannerNode(model="test-model")
        mock_client = _make_mock_client(mock_plan)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store)

        # Проверяем, что план записан в SharedStore
        assert result.execution_plan is not None
        assert result.execution_plan["thought"] == mock_plan.thought
        assert len(result.execution_plan["steps"]) == 5

        # Проверяем результаты
        assert "S0_PlannerNode" in result.results
        assert result.results["S0_PlannerNode"]["steps_count"] == 5
        assert result.results["S0_PlannerNode"]["steps"] == [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]

    @pytest.mark.asyncio()
    async def test_execute_llm_failure(self, store: SharedStore) -> None:
        """RuntimeError при ошибке LLM."""
        node = S0PlannerNode(model="test-model")
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        with (
            patch.object(node, "_create_client", return_value=mock_client),
            pytest.raises(RuntimeError, match="LLM не вернул валидный план"),
        ):
            await node.execute(store)

    @pytest.mark.asyncio()
    async def test_execute_preserves_store_data(self, store: SharedStore, mock_plan: ExecutionPlanSchema) -> None:
        """Выполнение не затирает существующие данные в store."""
        store.results["existing_key"] = {"data": "value"}
        node = S0PlannerNode(model="test-model")
        mock_client = _make_mock_client(mock_plan)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store)

        # Существующие данные сохранены
        assert "existing_key" in result.results
        assert "S0_PlannerNode" in result.results

    @pytest.mark.asyncio()
    async def test_execute_edit_context(self, store: SharedStore, mock_plan: ExecutionPlanSchema) -> None:
        """Планирование с контекстом ручной правки."""
        store.user_input["edit_context"] = {
            "artifact_id": "slide_03",
            "new_content": "Новый текст",
        }
        node = S0PlannerNode(model="test-model")
        mock_client = _make_mock_client(mock_plan)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store)

        assert result.execution_plan is not None

    def test_create_client(self) -> None:
        """_create_client создаёт Instructor-клиент."""
        node = S0PlannerNode(
            model="test-model",
            api_key="test-key",
            base_url="https://test.api.com",
        )
        client = node._create_client()
        assert client is not None

    @pytest.mark.asyncio()
    async def test_llm_called_with_correct_messages(self, store: SharedStore, mock_plan: ExecutionPlanSchema) -> None:
        """LLM вызывается с правильными параметрами."""
        node = S0PlannerNode(model="test-model", max_retries=2)
        mock_client = _make_mock_client(mock_plan)

        with patch.object(node, "_create_client", return_value=mock_client):
            await node.execute(store)

        # Проверяем аргументы вызова
        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "test-model"
        assert call_kwargs.kwargs["max_retries"] == 2
        assert call_kwargs.kwargs["response_model"] == ExecutionPlanSchema
        messages = call_kwargs.kwargs["messages"]
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
