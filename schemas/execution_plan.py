"""ExecutionPlanSchema — структура плана, генерируемого S0_PlannerNode.

Реализация по ТЗ v3.0, §8.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator


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


# Regex для парсинга строковых шагов от Gemini
# Формат: "default_api.S1_ContextAnalyzer(step_id=1, reason='...')"
_STEP_STRING_PATTERN = re.compile(
    r"(?:default_api\.)?(?P<node>S\d+_\w+)\("
    r"(?:step_id\s*=\s*(?P<step_id>\d+))?"
    r".*?"
    r"reason\s*=\s*['\"](?P<reason>[^'\"]*)['\"]"
    r".*?\)",
    re.DOTALL,
)


def _parse_step_string(step_str: str, fallback_id: int) -> PlanStep:
    """Попытаться распарсить строковое представление шага в PlanStep.

    Gemini через OpenAI-compatible API иногда возвращает шаги как строки
    вида: "default_api.S1_ContextAnalyzer(step_id=1, reason='...')"
    вместо JSON-объектов.

    Args:
        step_str: Строковое представление шага.
        fallback_id: ID шага по умолчанию, если не удалось извлечь.

    Returns:
        Распарсенный PlanStep.

    Raises:
        ValueError: Если строку невозможно распарсить.
    """
    match = _STEP_STRING_PATTERN.search(step_str)
    if match:
        node = match.group("node")
        step_id_str = match.group("step_id")
        reason = match.group("reason")
        return PlanStep(
            step_id=int(step_id_str) if step_id_str else fallback_id,
            node=node,
            reason=reason or f"Шаг {fallback_id}",
        )

    # Fallback: попытка извлечь хотя бы имя узла
    node_match = re.search(r"(S\d+_\w+)", step_str)
    if node_match:
        return PlanStep(
            step_id=fallback_id,
            node=node_match.group(1),
            reason=f"Шаг {fallback_id}",
        )

    raise ValueError(f"Невозможно распарсить строку шага: {step_str!r}")


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

    @field_validator("steps", mode="before")
    @classmethod
    def _coerce_string_steps(cls, v: Any) -> Any:
        """Преобразовать строковые шаги в PlanStep-объекты.

        Gemini через OpenAI-compatible API иногда возвращает steps как
        массив строк вместо массива объектов. Этот валидатор перехватывает
        такой случай и парсит строки в PlanStep.
        """
        if not isinstance(v, list):
            return v

        result: list[PlanStep | dict[str, Any]] = []
        for idx, item in enumerate(v, start=1):
            if isinstance(item, str):
                try:
                    result.append(_parse_step_string(item, fallback_id=idx))
                except ValueError:
                    # Не удалось распарсить — создаём PlanStep с дефолтами
                    result.append(
                        PlanStep(
                            step_id=idx,
                            node=item[:50],
                            reason=f"Parsed from string: {item}",
                        )
                    )
            elif isinstance(item, dict | PlanStep):
                result.append(item)
            else:
                result.append(item)
        return result
