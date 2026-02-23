"""EventBus — система трансляции событий движка.

Реализация по ТЗ v3.0, §5.
Паттерн Observer: компоненты подписываются на типы событий,
EventBus вызывает подписчиков при эмите события.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from typing import Any

from schemas.events import EngineEvent, EventType

logger = logging.getLogger(__name__)

# Тип подписчика: async-функция, принимающая EngineEvent
Subscriber = Callable[[EngineEvent], Coroutine[Any, Any, None]]


class EventBus:
    """Асинхронная шина событий.

    Позволяет компонентам подписываться на определённые типы событий
    и получать уведомления при их возникновении.

    Пример использования::

        bus = EventBus()
        bus.subscribe(EventType.STEP_STARTED, my_handler)
        await bus.emit(EngineEvent(
            event_type=EventType.STEP_STARTED,
            trace_id="abc-123",
            component="RuntimeAgent",
            message="Начат шаг 1"
        ))
    """

    def __init__(self) -> None:
        self._subscribers: dict[EventType, list[Subscriber]] = defaultdict(list)

    def subscribe(self, event_type: EventType, subscriber: Subscriber) -> None:
        """Подписать обработчик на тип события.

        Args:
            event_type: Тип события для подписки.
            subscriber: Асинхронная функция-обработчик.
        """
        self._subscribers[event_type].append(subscriber)
        logger.debug("Подписчик добавлен для %s", event_type.value)

    def unsubscribe(self, event_type: EventType, subscriber: Subscriber) -> None:
        """Отписать обработчик от типа события.

        Args:
            event_type: Тип события.
            subscriber: Обработчик для удаления.
        """
        try:
            self._subscribers[event_type].remove(subscriber)
            logger.debug("Подписчик удалён для %s", event_type.value)
        except ValueError:
            logger.warning("Подписчик не найден для %s", event_type.value)

    async def emit(self, event: EngineEvent) -> None:
        """Эмитировать событие всем подписчикам.

        Args:
            event: Событие для трансляции.
        """
        subscribers = self._subscribers.get(event.event_type, [])
        logger.info(
            "[%s] %s: %s",
            event.trace_id,
            event.component,
            event.message,
        )
        for subscriber in subscribers:
            try:
                await subscriber(event)
            except Exception:
                logger.exception(
                    "Ошибка в подписчике для %s",
                    event.event_type.value,
                )

    def clear(self) -> None:
        """Удалить всех подписчиков."""
        self._subscribers.clear()
