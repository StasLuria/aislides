"""Unit-тесты для engine/runtime.py и engine/registry.py."""

from __future__ import annotations

import asyncio

import pytest

from engine.base_node import BaseNode
from engine.event_bus import EventBus
from engine.registry import ToolRegistry
from engine.runtime import RuntimeAgent
from schemas.events import EngineEvent, EventType
from schemas.shared_store import ProjectStatus, SharedStore

# ---------------------------------------------------------------------------
# Helpers: Mock nodes
# ---------------------------------------------------------------------------


class MockNode(BaseNode):
    """Мок-узел, который записывает результат в SharedStore.results."""

    def __init__(self, node_name: str, result_key: str = "mock_result") -> None:
        self._name = node_name
        self._result_key = result_key

    @property
    def name(self) -> str:
        return self._name

    async def execute(self, store: SharedStore) -> SharedStore:
        store.results[self._name] = {self._result_key: "done"}
        return store


class FailingNode(BaseNode):
    """Мок-узел, который выбрасывает исключение."""

    def __init__(self, node_name: str = "FailingNode") -> None:
        self._name = node_name

    @property
    def name(self) -> str:
        return self._name

    async def execute(self, store: SharedStore) -> SharedStore:
        msg = "Intentional failure"
        raise RuntimeError(msg)


def make_store(steps: list[dict[str, object]] | None = None) -> SharedStore:
    """Создать SharedStore с планом."""
    return SharedStore(
        project_id="test-runtime",
        user_input={"prompt": "Test"},
        config={},
        execution_plan={"steps": steps or []},
    )


# ---------------------------------------------------------------------------
# Tests: ToolRegistry
# ---------------------------------------------------------------------------


class TestToolRegistry:
    """Тесты для ToolRegistry."""

    def test_register_and_get(self) -> None:
        """Регистрация и получение узла."""
        registry = ToolRegistry()
        node = MockNode("S1_ContextAnalyzer")
        registry.register(node)
        assert registry.get("S1_ContextAnalyzer") is node

    def test_register_duplicate_raises(self) -> None:
        """Повторная регистрация вызывает ValueError."""
        registry = ToolRegistry()
        registry.register(MockNode("S1_ContextAnalyzer"))
        with pytest.raises(ValueError, match="уже зарегистрирован"):
            registry.register(MockNode("S1_ContextAnalyzer"))

    def test_get_nonexistent_raises(self) -> None:
        """Получение несуществующего узла вызывает KeyError."""
        registry = ToolRegistry()
        with pytest.raises(KeyError, match="не найден"):
            registry.get("NonExistent")

    def test_has(self) -> None:
        """has() возвращает True/False."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        assert registry.has("S1") is True
        assert registry.has("S2") is False

    def test_available_nodes(self) -> None:
        """available_nodes возвращает список имён."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        registry.register(MockNode("S2"))
        assert sorted(registry.available_nodes) == ["S1", "S2"]

    def test_len(self) -> None:
        """len() возвращает количество узлов."""
        registry = ToolRegistry()
        assert len(registry) == 0
        registry.register(MockNode("S1"))
        assert len(registry) == 1


# ---------------------------------------------------------------------------
# Tests: RuntimeAgent — Happy Path
# ---------------------------------------------------------------------------


class TestRuntimeAgentHappyPath:
    """Тесты успешного выполнения."""

    @pytest.mark.asyncio()
    async def test_execute_single_step(self) -> None:
        """Выполнение одного шага."""
        registry = ToolRegistry()
        registry.register(MockNode("S1_ContextAnalyzer"))
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = make_store([{"step_id": 1, "node": "S1_ContextAnalyzer"}])
        result = await agent.execute(store)

        assert result.status == ProjectStatus.SUCCESS
        assert "S1_ContextAnalyzer" in result.results
        assert result.errors == []

    @pytest.mark.asyncio()
    async def test_execute_multiple_steps(self) -> None:
        """Выполнение нескольких шагов последовательно."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        registry.register(MockNode("S2"))
        registry.register(MockNode("S3"))
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = make_store(
            [
                {"step_id": 1, "node": "S1"},
                {"step_id": 2, "node": "S2"},
                {"step_id": 3, "node": "S3"},
            ]
        )
        result = await agent.execute(store)

        assert result.status == ProjectStatus.SUCCESS
        assert len(result.results) == 3

    @pytest.mark.asyncio()
    async def test_execute_empty_plan(self) -> None:
        """Пустой план — статус SUCCESS."""
        registry = ToolRegistry()
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = make_store([])
        result = await agent.execute(store)

        assert result.status == ProjectStatus.SUCCESS

    @pytest.mark.asyncio()
    async def test_events_emitted(self) -> None:
        """STEP_STARTED и STEP_COMPLETED эмитируются для каждого шага."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        bus = EventBus()
        events: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            events.append(event)

        bus.subscribe(EventType.STEP_STARTED, collector)
        bus.subscribe(EventType.STEP_COMPLETED, collector)

        agent = RuntimeAgent(registry=registry, event_bus=bus)
        store = make_store([{"step_id": 1, "node": "S1"}])
        await agent.execute(store)

        assert len(events) == 2
        assert events[0].event_type == EventType.STEP_STARTED
        assert events[1].event_type == EventType.STEP_COMPLETED


# ---------------------------------------------------------------------------
# Tests: RuntimeAgent — Error Handling
# ---------------------------------------------------------------------------


class TestRuntimeAgentErrors:
    """Тесты обработки ошибок."""

    @pytest.mark.asyncio()
    async def test_missing_node_sets_failed(self) -> None:
        """Несуществующий узел — статус FAILED."""
        registry = ToolRegistry()
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = make_store([{"step_id": 1, "node": "NonExistent"}])
        result = await agent.execute(store)

        assert result.status == ProjectStatus.FAILED
        assert len(result.errors) == 1
        assert "не найден" in result.errors[0]["error"]

    @pytest.mark.asyncio()
    async def test_failing_node_sets_failed(self) -> None:
        """Исключение в узле — статус FAILED."""
        registry = ToolRegistry()
        registry.register(FailingNode("S1"))
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = make_store([{"step_id": 1, "node": "S1"}])
        result = await agent.execute(store)

        assert result.status == ProjectStatus.FAILED
        assert len(result.errors) == 1
        assert "Intentional failure" in result.errors[0]["error"]

    @pytest.mark.asyncio()
    async def test_error_emits_error_event(self) -> None:
        """При ошибке эмитируется событие ERROR."""
        registry = ToolRegistry()
        registry.register(FailingNode("S1"))
        bus = EventBus()
        errors: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            errors.append(event)

        bus.subscribe(EventType.ERROR, collector)

        agent = RuntimeAgent(registry=registry, event_bus=bus)
        store = make_store([{"step_id": 1, "node": "S1"}])
        await agent.execute(store)

        assert len(errors) == 1
        assert errors[0].event_type == EventType.ERROR

    @pytest.mark.asyncio()
    async def test_no_execution_plan_raises(self) -> None:
        """Отсутствие execution_plan вызывает ValueError."""
        registry = ToolRegistry()
        bus = EventBus()
        agent = RuntimeAgent(registry=registry, event_bus=bus)

        store = SharedStore(
            project_id="test",
            user_input={},
            config={},
            execution_plan=None,
        )
        with pytest.raises(ValueError, match="execution_plan"):
            await agent.execute(store)


# ---------------------------------------------------------------------------
# Tests: RuntimeAgent — Cancellation
# ---------------------------------------------------------------------------


class TestRuntimeAgentCancellation:
    """Тесты отмены выполнения."""

    @pytest.mark.asyncio()
    async def test_cancel_before_execution(self) -> None:
        """Отмена до начала — статус CANCELLED."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        bus = EventBus()
        cancel_token = asyncio.Event()
        cancel_token.set()  # Уже отменён

        agent = RuntimeAgent(registry=registry, event_bus=bus, cancel_token=cancel_token)
        store = make_store([{"step_id": 1, "node": "S1"}])
        result = await agent.execute(store)

        assert result.status == ProjectStatus.CANCELLED
        assert "S1" not in result.results

    @pytest.mark.asyncio()
    async def test_cancel_emits_ai_message(self) -> None:
        """При отмене эмитируется AI_MESSAGE."""
        registry = ToolRegistry()
        registry.register(MockNode("S1"))
        bus = EventBus()
        messages: list[EngineEvent] = []

        async def collector(event: EngineEvent) -> None:
            messages.append(event)

        bus.subscribe(EventType.AI_MESSAGE, collector)
        cancel_token = asyncio.Event()
        cancel_token.set()

        agent = RuntimeAgent(registry=registry, event_bus=bus, cancel_token=cancel_token)
        store = make_store([{"step_id": 1, "node": "S1"}])
        await agent.execute(store)

        assert len(messages) == 1
        assert "отменено" in messages[0].message
