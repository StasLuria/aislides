"""Unit-тесты для engine/event_bus.py."""

from __future__ import annotations

import pytest

from engine.event_bus import EventBus
from schemas.events import EngineEvent, EventType

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_event(
    event_type: EventType = EventType.STEP_STARTED,
    trace_id: str = "test-trace",
    component: str = "TestComponent",
    message: str = "Test message",
) -> EngineEvent:
    """Создать тестовое событие."""
    return EngineEvent(
        event_type=event_type,
        trace_id=trace_id,
        component=component,
        message=message,
    )


# ---------------------------------------------------------------------------
# Tests: Subscribe & Emit
# ---------------------------------------------------------------------------


class TestEventBusSubscribeEmit:
    """Тесты подписки и эмита событий."""

    @pytest.mark.asyncio()
    async def test_subscriber_receives_event(self) -> None:
        """Подписчик получает событие при эмите."""
        bus = EventBus()
        received: list[EngineEvent] = []

        async def handler(event: EngineEvent) -> None:
            received.append(event)

        bus.subscribe(EventType.STEP_STARTED, handler)
        event = make_event(EventType.STEP_STARTED)
        await bus.emit(event)

        assert len(received) == 1
        assert received[0].trace_id == "test-trace"

    @pytest.mark.asyncio()
    async def test_multiple_subscribers(self) -> None:
        """Несколько подписчиков получают одно событие."""
        bus = EventBus()
        received_a: list[EngineEvent] = []
        received_b: list[EngineEvent] = []

        async def handler_a(event: EngineEvent) -> None:
            received_a.append(event)

        async def handler_b(event: EngineEvent) -> None:
            received_b.append(event)

        bus.subscribe(EventType.STEP_COMPLETED, handler_a)
        bus.subscribe(EventType.STEP_COMPLETED, handler_b)
        await bus.emit(make_event(EventType.STEP_COMPLETED))

        assert len(received_a) == 1
        assert len(received_b) == 1

    @pytest.mark.asyncio()
    async def test_subscriber_only_receives_matching_events(self) -> None:
        """Подписчик получает только события своего типа."""
        bus = EventBus()
        received: list[EngineEvent] = []

        async def handler(event: EngineEvent) -> None:
            received.append(event)

        bus.subscribe(EventType.ERROR, handler)
        await bus.emit(make_event(EventType.STEP_STARTED))
        await bus.emit(make_event(EventType.ERROR))

        assert len(received) == 1
        assert received[0].event_type == EventType.ERROR

    @pytest.mark.asyncio()
    async def test_emit_without_subscribers(self) -> None:
        """Эмит без подписчиков не вызывает ошибку."""
        bus = EventBus()
        await bus.emit(make_event(EventType.PLAN_STARTED))
        # Не должно быть исключения


# ---------------------------------------------------------------------------
# Tests: Unsubscribe
# ---------------------------------------------------------------------------


class TestEventBusUnsubscribe:
    """Тесты отписки."""

    @pytest.mark.asyncio()
    async def test_unsubscribe_stops_delivery(self) -> None:
        """После отписки подписчик не получает события."""
        bus = EventBus()
        received: list[EngineEvent] = []

        async def handler(event: EngineEvent) -> None:
            received.append(event)

        bus.subscribe(EventType.STEP_STARTED, handler)
        await bus.emit(make_event(EventType.STEP_STARTED))
        assert len(received) == 1

        bus.unsubscribe(EventType.STEP_STARTED, handler)
        await bus.emit(make_event(EventType.STEP_STARTED))
        assert len(received) == 1  # Не изменилось

    def test_unsubscribe_nonexistent_no_error(self) -> None:
        """Отписка несуществующего подписчика не вызывает ошибку."""
        bus = EventBus()

        async def handler(event: EngineEvent) -> None:
            pass

        bus.unsubscribe(EventType.STEP_STARTED, handler)
        # Не должно быть исключения


# ---------------------------------------------------------------------------
# Tests: Clear
# ---------------------------------------------------------------------------


class TestEventBusClear:
    """Тесты очистки."""

    @pytest.mark.asyncio()
    async def test_clear_removes_all_subscribers(self) -> None:
        """clear() удаляет всех подписчиков."""
        bus = EventBus()
        received: list[EngineEvent] = []

        async def handler(event: EngineEvent) -> None:
            received.append(event)

        bus.subscribe(EventType.STEP_STARTED, handler)
        bus.subscribe(EventType.ERROR, handler)
        bus.clear()

        await bus.emit(make_event(EventType.STEP_STARTED))
        await bus.emit(make_event(EventType.ERROR))
        assert len(received) == 0


# ---------------------------------------------------------------------------
# Tests: Error Handling
# ---------------------------------------------------------------------------


class TestEventBusErrorHandling:
    """Тесты обработки ошибок в подписчиках."""

    @pytest.mark.asyncio()
    async def test_failing_subscriber_does_not_break_others(self) -> None:
        """Ошибка в одном подписчике не блокирует остальных."""
        bus = EventBus()
        received: list[EngineEvent] = []

        async def failing_handler(event: EngineEvent) -> None:
            msg = "Intentional error"
            raise RuntimeError(msg)

        async def good_handler(event: EngineEvent) -> None:
            received.append(event)

        bus.subscribe(EventType.STEP_STARTED, failing_handler)
        bus.subscribe(EventType.STEP_STARTED, good_handler)
        await bus.emit(make_event(EventType.STEP_STARTED))

        assert len(received) == 1


# ---------------------------------------------------------------------------
# Tests: EngineEvent model
# ---------------------------------------------------------------------------


class TestEngineEvent:
    """Тесты модели EngineEvent."""

    def test_creation(self) -> None:
        """EngineEvent создаётся корректно."""
        event = EngineEvent(
            event_type=EventType.AI_MESSAGE,
            trace_id="t-123",
            component="S0_PlannerNode",
            message="План сгенерирован",
            data={"steps_count": 5},
        )
        assert event.event_type == EventType.AI_MESSAGE
        assert event.data == {"steps_count": 5}

    def test_data_optional(self) -> None:
        """data — опциональное поле."""
        event = EngineEvent(
            event_type=EventType.PLAN_STARTED,
            trace_id="t-123",
            component="EngineAPI",
            message="Начало",
        )
        assert event.data is None

    def test_all_event_types(self) -> None:
        """Все 7 типов событий определены."""
        types = [e.value for e in EventType]
        assert len(types) == 7
        assert "ai_message" in types
        assert "artifact_created" in types
        assert "plan_completed" in types
