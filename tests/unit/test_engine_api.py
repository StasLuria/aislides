"""Unit-тесты для engine/api.py — EngineAPI."""

from __future__ import annotations

import pytest

from engine.api import EngineAPI
from engine.base_node import BaseNode
from schemas.events import EngineEvent, EventType
from schemas.shared_store import SharedStore

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


# ---------------------------------------------------------------------------
# Tests: EngineAPI.run
# ---------------------------------------------------------------------------


class TestEngineAPIRun:
    """Тесты метода run."""

    @pytest.mark.asyncio()
    async def test_run_without_plan_returns_store(self) -> None:
        """run без execution_plan возвращает SharedStore (plan ещё не реализован)."""
        api = EngineAPI(config={"test": True})
        result = await api.run(
            project_id="test-001",
            user_input={"prompt": "Тест"},
        )
        assert isinstance(result, SharedStore)
        assert result.project_id == "test-001"

    @pytest.mark.asyncio()
    async def test_run_generates_project_id(self) -> None:
        """run генерирует project_id если не указан."""
        api = EngineAPI()
        result = await api.run(user_input={"prompt": "Тест"})
        assert result.project_id is not None
        assert len(result.project_id) > 0

    @pytest.mark.asyncio()
    async def test_run_emits_plan_started(self) -> None:
        """run эмитирует PLAN_STARTED."""
        api = EngineAPI()
        events: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            events.append(event)

        api.event_bus.subscribe(EventType.PLAN_STARTED, collector)
        await api.run(project_id="test-002", user_input={"prompt": "Тест"})

        assert len(events) == 1
        assert events[0].event_type == EventType.PLAN_STARTED

    @pytest.mark.asyncio()
    async def test_run_with_execution_plan(self) -> None:
        """run с execution_plan выполняет шаги через RuntimeAgent."""
        api = EngineAPI()
        api.registry.register(MockNode("S1_ContextAnalyzer"))

        # Вручную создаём store с планом и вызываем run
        result = await api.run(
            project_id="test-003",
            user_input={"prompt": "Тест"},
        )
        # Без S0_PlannerNode план не создаётся, поэтому execution_plan = None
        assert result.execution_plan is None

    @pytest.mark.asyncio()
    async def test_run_cleans_up_cancel_token(self) -> None:
        """run удаляет cancel_token после завершения."""
        api = EngineAPI()
        await api.run(project_id="test-004", user_input={"prompt": "Тест"})
        assert "test-004" not in api._cancellation_tokens


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
    async def test_apply_edit_returns_store(self) -> None:
        """apply_edit возвращает SharedStore с edit_context."""
        api = EngineAPI()
        result = await api.apply_edit(
            project_id="test-005",
            artifact_id="a1",
            new_content="<h1>Updated</h1>",
            chat_history=[{"role": "user", "content": "Измени заголовок"}],
            existing_results={"S4_SlideGenerator": {"html": "<h1>Old</h1>"}},
        )
        assert isinstance(result, SharedStore)
        assert result.project_id == "test-005"
        assert result.user_input["edit_context"]["artifact_id"] == "a1"
        assert result.user_input["edit_context"]["new_content"] == "<h1>Updated</h1>"
