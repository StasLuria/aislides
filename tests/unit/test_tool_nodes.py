"""Unit-тесты для инструментальных узлов S1, S2, S3.

Все вызовы LLM замокированы — тесты не требуют API-ключа.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas.shared_store import AttachedFile, ChatMessage, SharedStore
from schemas.tool_schemas import (
    ColorPalette,
    S1ContextResult,
    S2NarrativeResult,
    S3DesignResult,
    SlideBlueprint,
    SlideLayoutMapping,
    TypographyScale,
)
from tools.s1_context_analyzer import S1ContextAnalyzerNode
from tools.s1_context_analyzer import _build_user_prompt as s1_build_prompt
from tools.s2_narrative_architect import S2NarrativeArchitectNode
from tools.s2_narrative_architect import _build_user_prompt as s2_build_prompt
from tools.s3_design_architect import S3DesignArchitectNode
from tools.s3_design_architect import _build_user_prompt as s3_build_prompt

# ---------------------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------------------


@pytest.fixture()
def store() -> SharedStore:
    """Создать SharedStore с минимальным запросом."""
    return SharedStore(
        project_id="test-tools",
        user_input={"prompt": "Создай питч-презентацию для инвесторов на 10 слайдов"},
        config={"llm": {"model": "test-model"}},
    )


@pytest.fixture()
def store_with_s1(store: SharedStore) -> SharedStore:
    """SharedStore с результатами S1."""
    store.results["S1_ContextAnalyzer"] = {
        "audience": "Инвесторы",
        "purpose": "Привлечение инвестиций",
        "presentation_type": "pitch",
        "duration": "10 минут",
        "tone": "professional",
        "key_messages": ["Рынок растёт", "Наше решение уникально"],
        "preferred_theme": None,
        "slide_count": 10,
        "content_mode": "auto",
        "confidence_score": 0.92,
        "clarification_questions": [],
    }
    return store


@pytest.fixture()
def store_with_s1_s2(store_with_s1: SharedStore) -> SharedStore:
    """SharedStore с результатами S1 и S2."""
    store_with_s1.results["S2_NarrativeArchitect"] = {
        "selected_framework": "Problem → Solution",
        "framework_rationale": "Подходит для питча",
        "narrative_structure": [
            {
                "slide_number": 1,
                "title": "Проблема",
                "content_type": "hero_title",
                "narrative_beat": "opening",
                "key_message": "Рынок неэффективен",
                "speaker_notes": "",
            },
            {
                "slide_number": 2,
                "title": "Решение",
                "content_type": "key_point",
                "narrative_beat": "climax",
                "key_message": "Наше решение",
                "speaker_notes": "",
            },
        ],
        "narrative_score": 0.88,
    }
    return store_with_s1


@pytest.fixture()
def mock_s1_result() -> S1ContextResult:
    """Мок-результат S1."""
    return S1ContextResult(
        audience="Инвесторы",
        purpose="Привлечение инвестиций",
        presentation_type="pitch",
        duration="10 минут",
        tone="professional",
        key_messages=["Рынок растёт", "Наше решение уникально", "Команда опытная"],
        preferred_theme=None,
        slide_count=10,
        content_mode="auto",
        confidence_score=0.92,
        clarification_questions=[],
    )


@pytest.fixture()
def mock_s2_result() -> S2NarrativeResult:
    """Мок-результат S2."""
    return S2NarrativeResult(
        selected_framework="Problem → Solution",
        framework_rationale="Подходит для питча инвесторам",
        narrative_structure=[
            SlideBlueprint(
                slide_number=1,
                title="Проблема",
                content_type="hero_title",
                narrative_beat="opening",
                key_message="Рынок неэффективен",
                speaker_notes="Начните с боли клиента",
            ),
            SlideBlueprint(
                slide_number=2,
                title="Решение",
                content_type="key_point",
                narrative_beat="climax",
                key_message="Наше решение",
                speaker_notes="Покажите продукт",
            ),
        ],
        narrative_score=0.88,
    )


@pytest.fixture()
def mock_s3_result() -> S3DesignResult:
    """Мок-результат S3."""
    return S3DesignResult(
        aesthetic_direction="corporate_classic",
        layout_family="corporate",
        color_palette=ColorPalette(
            background="#FFFFFF",
            text_primary="#1A1A2E",
            text_secondary="#4A4A6A",
            accent="#C9A84C",
            accent_secondary="#1A3A5C",
            surface="#F5F5F0",
        ),
        typography=TypographyScale(
            font_family_heading="Inter",
            font_family_body="Inter",
        ),
        spacing_unit=4,
        slide_layouts=[
            SlideLayoutMapping(slide_number=1, content_type="hero_title", layout_template="corp_hero"),
            SlideLayoutMapping(slide_number=2, content_type="key_point", layout_template="corp_key_point"),
        ],
        design_score=0.90,
    )


def _make_mock_client(result: object) -> MagicMock:
    """Создать мок Instructor-клиента."""
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=result)
    return mock_client


# ===========================================================================
# S1_ContextAnalyzer
# ===========================================================================


class TestS1ContextAnalyzerNode:
    """Тесты для S1_ContextAnalyzerNode."""

    def test_name(self) -> None:
        """Имя узла корректно."""
        node = S1ContextAnalyzerNode()
        assert node.name == "S1_ContextAnalyzer"

    @pytest.mark.asyncio()
    async def test_execute_success(self, store: SharedStore, mock_s1_result: S1ContextResult) -> None:
        """Успешный анализ контекста."""
        node = S1ContextAnalyzerNode(model="test-model")
        mock_client = _make_mock_client(mock_s1_result)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store)

        assert "S1_ContextAnalyzer" in result.results
        assert result.results["S1_ContextAnalyzer"]["audience"] == "Инвесторы"
        assert result.results["S1_ContextAnalyzer"]["confidence_score"] == 0.92

    @pytest.mark.asyncio()
    async def test_execute_llm_failure(self, store: SharedStore) -> None:
        """RuntimeError при ошибке LLM."""
        node = S1ContextAnalyzerNode(model="test-model")
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        with (
            patch.object(node, "_create_client", return_value=mock_client),
            pytest.raises(RuntimeError, match="LLM не вернул валидный результат"),
        ):
            await node.execute(store)

    @pytest.mark.asyncio()
    async def test_low_confidence_logged(self, store: SharedStore) -> None:
        """Низкий confidence логируется как предупреждение."""
        low_conf_result = S1ContextResult(
            audience="Неизвестно",
            purpose="Неизвестно",
            presentation_type="unknown",
            confidence_score=0.65,
            clarification_questions=["Кто аудитория?", "Какова цель?"],
        )
        node = S1ContextAnalyzerNode(model="test-model")
        mock_client = _make_mock_client(low_conf_result)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store)

        assert result.results["S1_ContextAnalyzer"]["confidence_score"] == 0.65
        assert len(result.results["S1_ContextAnalyzer"]["clarification_questions"]) == 2


class TestS1BuildPrompt:
    """Тесты формирования промпта S1."""

    def test_basic_prompt(self, store: SharedStore) -> None:
        """Промпт содержит запрос пользователя."""
        result = s1_build_prompt(store)
        assert "питч-презентацию" in result

    def test_empty_prompt(self) -> None:
        """Пустой запрос возвращает дефолт."""
        s = SharedStore(project_id="t", user_input={}, config={})
        result = s1_build_prompt(s)
        assert result == "Создай презентацию."

    def test_with_chat_history(self, store: SharedStore) -> None:
        """Промпт включает историю чата."""
        store.chat_history = [
            ChatMessage(role="user", content="Привет"),
        ]
        result = s1_build_prompt(store)
        assert "Привет" in result

    def test_with_context(self, store: SharedStore) -> None:
        """Промпт включает дополнительный контекст."""
        store.user_input["context"] = "Компания занимается AI"
        result = s1_build_prompt(store)
        assert "AI" in result

    def test_with_attached_files(self, store: SharedStore) -> None:
        """Промпт включает информацию о файлах."""
        store.attached_files = [
            AttachedFile(file_id="f1", filename="report.pdf", path="/tmp/report.pdf"),
        ]
        result = s1_build_prompt(store)
        assert "report.pdf" in result


# ===========================================================================
# S2_NarrativeArchitect
# ===========================================================================


class TestS2NarrativeArchitectNode:
    """Тесты для S2_NarrativeArchitectNode."""

    def test_name(self) -> None:
        """Имя узла корректно."""
        node = S2NarrativeArchitectNode()
        assert node.name == "S2_NarrativeArchitect"

    @pytest.mark.asyncio()
    async def test_execute_success(self, store_with_s1: SharedStore, mock_s2_result: S2NarrativeResult) -> None:
        """Успешное проектирование нарратива."""
        node = S2NarrativeArchitectNode(model="test-model")
        mock_client = _make_mock_client(mock_s2_result)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store_with_s1)

        assert "S2_NarrativeArchitect" in result.results
        assert result.results["S2_NarrativeArchitect"]["selected_framework"] == "Problem → Solution"
        assert len(result.results["S2_NarrativeArchitect"]["narrative_structure"]) == 2

    @pytest.mark.asyncio()
    async def test_execute_without_s1(self, store: SharedStore) -> None:
        """RuntimeError если S1 не выполнен."""
        node = S2NarrativeArchitectNode(model="test-model")
        with pytest.raises(RuntimeError, match="S1_ContextAnalyzer отсутствуют"):
            await node.execute(store)

    @pytest.mark.asyncio()
    async def test_execute_llm_failure(self, store_with_s1: SharedStore) -> None:
        """RuntimeError при ошибке LLM."""
        node = S2NarrativeArchitectNode(model="test-model")
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        with (
            patch.object(node, "_create_client", return_value=mock_client),
            pytest.raises(RuntimeError, match="LLM не вернул валидный результат"),
        ):
            await node.execute(store_with_s1)


class TestS2BuildPrompt:
    """Тесты формирования промпта S2."""

    def test_includes_s1_data(self, store_with_s1: SharedStore) -> None:
        """Промпт включает данные из S1."""
        result = s2_build_prompt(store_with_s1)
        assert "Инвесторы" in result
        assert "pitch" in result

    def test_includes_original_prompt(self, store_with_s1: SharedStore) -> None:
        """Промпт включает оригинальный запрос."""
        result = s2_build_prompt(store_with_s1)
        assert "питч-презентацию" in result

    def test_without_s1(self) -> None:
        """Промпт без S1 и без prompt возвращает дефолт."""
        s = SharedStore(project_id="t", user_input={}, config={})
        result = s2_build_prompt(s)
        assert "Создай структуру" in result


# ===========================================================================
# S3_DesignArchitect
# ===========================================================================


class TestS3DesignArchitectNode:
    """Тесты для S3_DesignArchitectNode."""

    def test_name(self) -> None:
        """Имя узла корректно."""
        node = S3DesignArchitectNode()
        assert node.name == "S3_DesignArchitect"

    @pytest.mark.asyncio()
    async def test_execute_success(self, store_with_s1_s2: SharedStore, mock_s3_result: S3DesignResult) -> None:
        """Успешное создание дизайн-системы."""
        node = S3DesignArchitectNode(model="test-model")
        mock_client = _make_mock_client(mock_s3_result)

        with patch.object(node, "_create_client", return_value=mock_client):
            result = await node.execute(store_with_s1_s2)

        assert "S3_DesignArchitect" in result.results
        assert result.results["S3_DesignArchitect"]["aesthetic_direction"] == "corporate_classic"
        assert result.results["S3_DesignArchitect"]["layout_family"] == "corporate"

    @pytest.mark.asyncio()
    async def test_execute_without_s1(self, store: SharedStore) -> None:
        """RuntimeError если S1 не выполнен."""
        node = S3DesignArchitectNode(model="test-model")
        with pytest.raises(RuntimeError, match="S1_ContextAnalyzer отсутствуют"):
            await node.execute(store)

    @pytest.mark.asyncio()
    async def test_execute_llm_failure(self, store_with_s1_s2: SharedStore) -> None:
        """RuntimeError при ошибке LLM."""
        node = S3DesignArchitectNode(model="test-model")
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        with (
            patch.object(node, "_create_client", return_value=mock_client),
            pytest.raises(RuntimeError, match="LLM не вернул валидный результат"),
        ):
            await node.execute(store_with_s1_s2)


class TestS3BuildPrompt:
    """Тесты формирования промпта S3."""

    def test_includes_s1_data(self, store_with_s1_s2: SharedStore) -> None:
        """Промпт включает данные из S1."""
        result = s3_build_prompt(store_with_s1_s2)
        assert "Инвесторы" in result

    def test_includes_s2_data(self, store_with_s1_s2: SharedStore) -> None:
        """Промпт включает данные из S2."""
        result = s3_build_prompt(store_with_s1_s2)
        assert "Problem" in result

    def test_without_s1(self, store: SharedStore) -> None:
        """Промпт без S1 возвращает дефолт."""
        result = s3_build_prompt(store)
        assert "Создай дизайн-систему" in result
