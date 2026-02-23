"""ExecutionPlanSchema — структура плана, генерируемого S0_PlannerNode.

Реализация по ТЗ v3.0, §8.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PlanStep(BaseModel):
    """Один шаг в плане выполнения.

    Attributes:
        step_id: Порядковый номер шага.
        node: Имя вызываемого ToolNode (например, "S1_ContextAnalyzer").
        params: Параметры, передаваемые узлу.
        reason: Объяснение, почему этот шаг необходим (генерируется LLM).
    """

    step_id: int
    node: str = Field(..., description="Имя вызываемого ToolNode")
    params: dict[str, Any] = Field(default_factory=dict)
    reason: str = Field(..., description="Объяснение, почему этот шаг необходим")


class ExecutionPlanSchema(BaseModel):
    """Полный план выполнения задачи.

    Генерируется S0_PlannerNode через Instructor. Содержит рассуждение LLM
    и упорядоченный список шагов для RuntimeAgent.

    Attributes:
        thought: Пошаговое рассуждение LLM перед составлением плана.
        steps: Упорядоченный список шагов для выполнения.
    """

    thought: str = Field(..., description="Пошаговое рассуждение LLM")
    steps: list[PlanStep]
