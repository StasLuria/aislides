"""Схемы событий для EventBus.

Реализация по ТЗ v3.0, §5.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


class EventType(str, Enum):
    """Типы событий, транслируемых через EventBus."""

    PLAN_STARTED = "plan_started"
    STEP_STARTED = "step_started"
    STEP_COMPLETED = "step_completed"
    ARTIFACT_CREATED = "artifact_created"
    ERROR = "error"
    PLAN_COMPLETED = "plan_completed"
    AI_MESSAGE = "ai_message"


class EngineEvent(BaseModel):
    """Событие движка, транслируемое через EventBus.

    Attributes:
        event_type: Тип события.
        trace_id: Уникальный идентификатор трассировки (для логирования).
        component: Компонент, сгенерировавший событие (например, "S0_PlannerNode").
        message: Человекочитаемое описание события.
        data: Дополнительные данные события (опционально).
    """

    event_type: EventType
    trace_id: str
    component: str
    message: str
    data: dict[str, Any] | None = None
