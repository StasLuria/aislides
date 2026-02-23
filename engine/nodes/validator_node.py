"""PlanValidatorNode — не-LLM узел, валидирующий сгенерированный план.

Реализация по ТЗ v3.0, §6.1.
Проверяет:
1. Наличие execution_plan в SharedStore.
2. Корректность структуры плана (парсинг через ExecutionPlanSchema).
3. Существование вызываемых узлов в ToolRegistry.
4. Корректность зависимостей (порядок шагов).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from engine.base_node import BaseNode
from schemas.execution_plan import ExecutionPlanSchema

if TYPE_CHECKING:
    from engine.registry import ToolRegistry
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# Допустимые имена узлов (S1-S5) и их обязательный порядок
VALID_NODES = [
    "S1_ContextAnalyzer",
    "S2_NarrativeArchitect",
    "S3_DesignArchitect",
    "S4_SlideGenerator",
    "S5_QualityValidator",
]

# Зависимости: каждый узел требует, чтобы указанные узлы были выполнены ранее
NODE_DEPENDENCIES: dict[str, list[str]] = {
    "S1_ContextAnalyzer": [],
    "S2_NarrativeArchitect": ["S1_ContextAnalyzer"],
    "S3_DesignArchitect": ["S1_ContextAnalyzer"],
    "S4_SlideGenerator": ["S2_NarrativeArchitect", "S3_DesignArchitect"],
    "S5_QualityValidator": ["S4_SlideGenerator"],
}


class PlanValidatorNode(BaseNode):
    """Валидатор плана выполнения.

    Проверяет план, сгенерированный S0_PlannerNode, на корректность:
    - Все вызываемые узлы существуют в реестре.
    - Зависимости между шагами соблюдены.
    - step_id уникальны и последовательны.

    При обнаружении ошибок записывает их в store.plan_validation_errors.
    Если ошибок нет — plan_validation_errors остаётся None.

    Args:
        registry: Реестр инструментальных узлов для проверки существования.
    """

    def __init__(self, registry: ToolRegistry | None = None) -> None:
        self._registry = registry

    @property
    def name(self) -> str:
        return "PlanValidatorNode"

    async def execute(self, store: SharedStore) -> SharedStore:
        """Валидировать execution_plan в SharedStore.

        Args:
            store: SharedStore с execution_plan.

        Returns:
            SharedStore с plan_validation_errors (None если план валиден).
        """
        errors: list[str] = []

        # 1. Проверка наличия плана
        if store.execution_plan is None:
            errors.append("execution_plan отсутствует в SharedStore")
            store.plan_validation_errors = errors
            logger.error("[%s] PlanValidatorNode: план отсутствует", store.project_id)
            return store

        # 2. Парсинг через Pydantic
        try:
            plan = ExecutionPlanSchema.model_validate(store.execution_plan)
        except Exception as exc:
            errors.append(f"Невалидная структура плана: {exc}")
            store.plan_validation_errors = errors
            logger.error("[%s] PlanValidatorNode: невалидная структура: %s", store.project_id, exc)
            return store

        # 3. Проверка пустого плана
        if not plan.steps:
            errors.append("План не содержит шагов")

        # 4. Проверка уникальности step_id
        step_ids = [s.step_id for s in plan.steps]
        if len(step_ids) != len(set(step_ids)):
            errors.append(f"Дублирующиеся step_id: {step_ids}")

        # 5. Проверка последовательности step_id
        expected_ids = list(range(1, len(plan.steps) + 1))
        if step_ids != expected_ids:
            errors.append(f"step_id должны быть последовательными (1, 2, ...): получено {step_ids}")

        # 6. Проверка существования узлов
        for step in plan.steps:
            if step.node not in VALID_NODES:
                errors.append(f"Шаг {step.step_id}: неизвестный узел '{step.node}'")

            # Проверка в реестре (если реестр доступен)
            if self._registry is not None and step.node in VALID_NODES and not self._registry.has(step.node):
                errors.append(f"Шаг {step.step_id}: узел '{step.node}' не зарегистрирован в ToolRegistry")

        # 7. Проверка зависимостей
        executed_nodes: set[str] = set()
        # Учитываем уже выполненные шаги из results
        if store.results:
            executed_nodes.update(store.results.keys())

        for step in plan.steps:
            deps = NODE_DEPENDENCIES.get(step.node, [])
            for dep in deps:
                if dep not in executed_nodes:
                    errors.append(
                        f"Шаг {step.step_id} ({step.node}): зависимость '{dep}' "
                        f"не выполнена ранее в плане и отсутствует в results"
                    )
            executed_nodes.add(step.node)

        # 8. Записываем результат
        if errors:
            store.plan_validation_errors = errors
            logger.warning(
                "[%s] PlanValidatorNode: найдено %d ошибок: %s",
                store.project_id,
                len(errors),
                "; ".join(errors),
            )
        else:
            store.plan_validation_errors = None
            logger.info("[%s] PlanValidatorNode: план валиден (%d шагов)", store.project_id, len(plan.steps))

        return store
