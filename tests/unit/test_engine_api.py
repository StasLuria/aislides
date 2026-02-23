"""Unit-тесты для engine/api.py — EngineAPI.

Все вызовы LLM замокированы через patch S0PlannerNode.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from engine.api import MAX_REPLAN_ATTEMPTS, EngineAPI
from engine.base_node import BaseNode
from schemas.events import EngineEvent, EventType
from schemas.execution_plan import ExecutionPlanSchema, PlanStep
from schemas.shared_store import ProjectStatus, SharedStore

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class MockNode(BaseNode):
    """Мок-узел для тестирования EngineAPI."""

    def __init__(self, node_name: str) -> None:
        self._name = node_name

    @property
    def name(self) -> str:
        return self._name

    async def execute(self, store: SharedStore) -> SharedStore:
        store.results[self._name] = {"status": "done"}
        return store


def _valid_plan_dict() -> dict[str, Any]:
    """Валидный план из 5 шагов (dict)."""
    return ExecutionPlanSchema(
        thought="Нужны все 5 шагов.",
        steps=[
            PlanStep(step_id=1, node="S1_ContextAnalyzer", reason="Анализ"),
            PlanStep(step_id=2, node="S2_NarrativeArchitect", reason="Структура"),
            PlanStep(step_id=3, node="S3_DesignArchitect", reason="Дизайн"),
            PlanStep(step_id=4, node="S4_SlideGenerator", reason="Генерация"),
            PlanStep(step_id=5, node="S5_QualityValidator", reason="Проверка"),
        ],
    ).model_dump()


async def _mock_planner_execute(store: SharedStore) -> SharedStore:
    """Мок S0PlannerNode.execute — записывает валидный план."""
    plan = _valid_plan_dict()
    store.execution_plan = plan
    store.results["S0_PlannerNode"] = {
        "thought": plan["thought"],
        "steps_count": len(plan["steps"]),
        "steps": [s["node"] for s in plan["steps"]],
    }
    return store


async def _mock_planner_execute_invalid(store: SharedStore) -> SharedStore:
    """Мок S0PlannerNode.execute — записывает невалидный план (неизвестный узел)."""
    store.execution_plan = {
        "thought": "test",
        "steps": [
            {"step_id": 1, "node": "S99_Unknown", "reason": "bad"},
        ],
    }
    return store


async def _mock_planner_execute_failure(store: SharedStore) -> SharedStore:
    """Мок S0PlannerNode.execute — выбрасывает исключение."""
    msg = "LLM не вернул валидный план: API Error"
    raise RuntimeError(msg)


# ---------------------------------------------------------------------------
# Tests: EngineAPI.run — успешный цикл
# ---------------------------------------------------------------------------


class TestEngineAPIRunSuccess:
    """Тесты успешного цикла run."""

    @pytest.mark.asyncio()
    async def test_run_full_cycle(self) -> None:
        """run выполняет полный цикл: plan → validate → execute."""
        api = EngineAPI(config={"llm": {"model": "test"}})

        # Регистрируем мок-узлы для RuntimeAgent
        for node_name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(node_name))

        # Мокаем PlannerNode
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute)

        result = await api.run(
            project_id="test-001",
            user_input={"prompt": "Тест"},
        )

        assert isinstance(result, SharedStore)
        assert result.project_id == "test-001"
        assert result.execution_plan is not None
        assert result.plan_validation_errors is None
        assert result.status == ProjectStatus.SUCCESS
        # Все 5 узлов + S0_PlannerNode выполнены
        assert "S0_PlannerNode" in result.results
        assert "S1_ContextAnalyzer" in result.results

    @pytest.mark.asyncio()
    async def test_run_generates_project_id(self) -> None:
        """run генерирует project_id если не указан."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute)

        # Регистрируем узлы
        for name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(name))

        result = await api.run(user_input={"prompt": "Тест"})
        assert result.project_id is not None
        assert len(result.project_id) > 0

    @pytest.mark.asyncio()
    async def test_run_emits_plan_started_and_completed(self) -> None:
        """run эмитирует PLAN_STARTED и PLAN_COMPLETED."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute)

        for name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(name))

        events: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            events.append(event)

        api.event_bus.subscribe(EventType.PLAN_STARTED, collector)
        api.event_bus.subscribe(EventType.PLAN_COMPLETED, collector)

        await api.run(project_id="test-events", user_input={"prompt": "Тест"})

        event_types = [e.event_type for e in events]
        assert EventType.PLAN_STARTED in event_types
        assert EventType.PLAN_COMPLETED in event_types

    @pytest.mark.asyncio()
    async def test_run_cleans_up_cancel_token(self) -> None:
        """run удаляет cancel_token после завершения."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute)

        for name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(name))

        await api.run(project_id="test-cleanup", user_input={"prompt": "Тест"})
        assert "test-cleanup" not in api._cancellation_tokens


# ---------------------------------------------------------------------------
# Tests: EngineAPI.run — ошибки валидации и перепланирование
# ---------------------------------------------------------------------------


class TestEngineAPIRunValidation:
    """Тесты валидации и перепланирования."""

    @pytest.mark.asyncio()
    async def test_run_invalid_plan_retries(self) -> None:
        """run перепланирует при невалидном плане."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute_invalid)

        result = await api.run(
            project_id="test-invalid",
            user_input={"prompt": "Тест"},
        )

        # После MAX_REPLAN_ATTEMPTS попыток — FAILED
        assert result.status == ProjectStatus.FAILED
        assert result.plan_validation_errors is not None
        assert api._planner.execute.call_count == MAX_REPLAN_ATTEMPTS

    @pytest.mark.asyncio()
    async def test_run_invalid_then_valid(self) -> None:
        """run: первая попытка невалидна, вторая — валидна."""
        api = EngineAPI()

        for name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(name))

        call_count = 0

        async def planner_side_effect(store: SharedStore) -> SharedStore:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return await _mock_planner_execute_invalid(store)
            return await _mock_planner_execute(store)

        api._planner.execute = AsyncMock(side_effect=planner_side_effect)

        result = await api.run(
            project_id="test-retry-success",
            user_input={"prompt": "Тест"},
        )

        assert result.plan_validation_errors is None
        assert result.status == ProjectStatus.SUCCESS


# ---------------------------------------------------------------------------
# Tests: EngineAPI.run — критические ошибки
# ---------------------------------------------------------------------------


class TestEngineAPIRunErrors:
    """Тесты обработки критических ошибок."""

    @pytest.mark.asyncio()
    async def test_run_planner_exception(self) -> None:
        """run обрабатывает исключение от PlannerNode."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute_failure)

        result = await api.run(
            project_id="test-error",
            user_input={"prompt": "Тест"},
        )

        assert result.status == ProjectStatus.FAILED
        assert len(result.errors) > 0
        assert "EngineAPI" in result.errors[0]["component"]

    @pytest.mark.asyncio()
    async def test_run_emits_error_event(self) -> None:
        """run эмитирует ERROR при исключении."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute_failure)

        errors: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            errors.append(event)

        api.event_bus.subscribe(EventType.ERROR, collector)

        await api.run(project_id="test-error-event", user_input={"prompt": "Тест"})

        assert len(errors) >= 1
        assert errors[0].event_type == EventType.ERROR


# ---------------------------------------------------------------------------
# Tests: EngineAPI.cancel
# ---------------------------------------------------------------------------


class TestEngineAPICancel:
    """Тесты метода cancel."""

    @pytest.mark.asyncio()
    async def test_cancel_nonexistent_returns_false(self) -> None:
        """cancel для несуществующего проекта возвращает False."""
        api = EngineAPI()
        result = await api.cancel("nonexistent")
        assert result is False


# ---------------------------------------------------------------------------
# Tests: EngineAPI.apply_edit
# ---------------------------------------------------------------------------


class TestEngineAPIApplyEdit:
    """Тесты метода apply_edit."""

    @pytest.mark.asyncio()
    async def test_apply_edit_calls_run(self) -> None:
        """apply_edit вызывает run с edit_context."""
        api = EngineAPI()
        api._planner.execute = AsyncMock(side_effect=_mock_planner_execute)

        for name in [
            "S1_ContextAnalyzer",
            "S2_NarrativeArchitect",
            "S3_DesignArchitect",
            "S4_SlideGenerator",
            "S5_QualityValidator",
        ]:
            api.registry.register(MockNode(name))

        result = await api.apply_edit(
            project_id="test-edit",
            artifact_id="a1",
            new_content="<h1>Updated</h1>",
            chat_history=[{"role": "user", "content": "Измени заголовок"}],
            existing_results={"S4_SlideGenerator": {"html": "<h1>Old</h1>"}},
        )

        assert isinstance(result, SharedStore)
        assert result.project_id == "test-edit"
        assert result.user_input["edit_context"]["artifact_id"] == "a1"


# ---------------------------------------------------------------------------
# Tests: EngineAPI.__init__
# ---------------------------------------------------------------------------


class TestEngineAPIInit:
    """Тесты инициализации."""

    def test_default_config(self) -> None:
        """Инициализация с пустой конфигурацией."""
        api = EngineAPI()
        assert api._llm_model == "gemini-2.5-flash"
        assert api._llm_max_retries == 3

    def test_custom_config(self) -> None:
        """Инициализация с пользовательской конфигурацией."""
        api = EngineAPI(
            config={
                "llm": {
                    "model": "gpt-4.1-mini",
                    "max_retries": 5,
                    "api_key": "test-key",
                    "base_url": "https://test.api.com",
                }
            }
        )
        assert api._llm_model == "gpt-4.1-mini"
        assert api._llm_max_retries == 5
        assert api._llm_api_key == "test-key"
        assert api._llm_base_url == "https://test.api.com"

    def test_max_replan_attempts_constant(self) -> None:
        """Константа MAX_REPLAN_ATTEMPTS определена."""
        assert MAX_REPLAN_ATTEMPTS >= 1
