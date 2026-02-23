"""Unit-тесты для PlanValidatorNode.

Тесты не требуют LLM — PlanValidatorNode работает без вызовов API.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from engine.nodes.validator_node import (
    NODE_DEPENDENCIES,
    VALID_NODES,
    PlanValidatorNode,
)
from schemas.shared_store import SharedStore

# ---------------------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------------------


def _make_store(
    plan: dict[str, Any] | None = None,
    results: dict[str, Any] | None = None,
) -> SharedStore:
    """Создать SharedStore с заданным планом."""
    return SharedStore(
        project_id="test-validator",
        user_input={"prompt": "test"},
        config={},
        execution_plan=plan,
        results=results or {},
    )


def _full_plan() -> dict[str, Any]:
    """Полный корректный план из 5 шагов."""
    return {
        "thought": "Нужны все 5 шагов.",
        "steps": [
            {"step_id": 1, "node": "S1_ContextAnalyzer", "reason": "Анализ"},
            {"step_id": 2, "node": "S2_NarrativeArchitect", "reason": "Структура"},
            {"step_id": 3, "node": "S3_DesignArchitect", "reason": "Дизайн"},
            {"step_id": 4, "node": "S4_SlideGenerator", "reason": "Генерация"},
            {"step_id": 5, "node": "S5_QualityValidator", "reason": "Проверка"},
        ],
    }


# ---------------------------------------------------------------------------
# Тесты
# ---------------------------------------------------------------------------


class TestPlanValidatorNode:
    """Тесты для PlanValidatorNode."""

    def test_name(self) -> None:
        """Имя узла корректно."""
        node = PlanValidatorNode()
        assert node.name == "PlanValidatorNode"

    @pytest.mark.asyncio()
    async def test_valid_full_plan(self) -> None:
        """Полный корректный план проходит валидацию."""
        store = _make_store(plan=_full_plan())
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is None

    @pytest.mark.asyncio()
    async def test_missing_plan(self) -> None:
        """Отсутствие плана — ошибка."""
        store = _make_store(plan=None)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("отсутствует" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_invalid_structure(self) -> None:
        """Невалидная структура плана — ошибка."""
        store = _make_store(plan={"invalid": "data"})
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("Невалидная структура" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_empty_steps(self) -> None:
        """Пустой список шагов — ошибка."""
        store = _make_store(plan={"thought": "test", "steps": []})
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("не содержит шагов" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_duplicate_step_ids(self) -> None:
        """Дублирующиеся step_id — ошибка."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S1_ContextAnalyzer", "reason": "a"},
                {"step_id": 1, "node": "S2_NarrativeArchitect", "reason": "b"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("Дублирующиеся" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_non_sequential_step_ids(self) -> None:
        """Непоследовательные step_id — ошибка."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S1_ContextAnalyzer", "reason": "a"},
                {"step_id": 3, "node": "S2_NarrativeArchitect", "reason": "b"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("последовательными" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_unknown_node(self) -> None:
        """Неизвестный узел — ошибка."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S99_Unknown", "reason": "a"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("неизвестный узел" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_dependency_violation(self) -> None:
        """Нарушение зависимостей — ошибка (S4 без S2 и S3)."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S1_ContextAnalyzer", "reason": "a"},
                {"step_id": 2, "node": "S4_SlideGenerator", "reason": "b"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("зависимость" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_dependency_satisfied_by_results(self) -> None:
        """Зависимости удовлетворены через store.results (частичная перегенерация)."""
        plan = {
            "thought": "Только перегенерировать S4 и S5.",
            "steps": [
                {"step_id": 1, "node": "S4_SlideGenerator", "reason": "Перегенерация"},
                {"step_id": 2, "node": "S5_QualityValidator", "reason": "Проверка"},
            ],
        }
        # S1, S2, S3 уже выполнены
        results = {
            "S1_ContextAnalyzer": {"audience": "investors"},
            "S2_NarrativeArchitect": {"framework": "Problem → Solution"},
            "S3_DesignArchitect": {"direction": "corporate_classic"},
        }
        store = _make_store(plan=plan, results=results)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is None

    @pytest.mark.asyncio()
    async def test_registry_check_node_exists(self) -> None:
        """Проверка через ToolRegistry — узел зарегистрирован."""
        mock_registry = MagicMock()
        mock_registry.has.return_value = True

        store = _make_store(plan=_full_plan())
        node = PlanValidatorNode(registry=mock_registry)
        result = await node.execute(store)
        assert result.plan_validation_errors is None

    @pytest.mark.asyncio()
    async def test_registry_check_node_missing(self) -> None:
        """Проверка через ToolRegistry — узел не зарегистрирован."""
        mock_registry = MagicMock()
        mock_registry.has.return_value = False

        store = _make_store(plan=_full_plan())
        node = PlanValidatorNode(registry=mock_registry)
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("не зарегистрирован" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_s2_requires_s1(self) -> None:
        """S2 без S1 — ошибка зависимости."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S2_NarrativeArchitect", "reason": "a"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("S1_ContextAnalyzer" in e for e in result.plan_validation_errors)

    @pytest.mark.asyncio()
    async def test_s5_requires_s4(self) -> None:
        """S5 без S4 — ошибка зависимости."""
        plan = {
            "thought": "test",
            "steps": [
                {"step_id": 1, "node": "S1_ContextAnalyzer", "reason": "a"},
                {"step_id": 2, "node": "S5_QualityValidator", "reason": "b"},
            ],
        }
        store = _make_store(plan=plan)
        node = PlanValidatorNode()
        result = await node.execute(store)
        assert result.plan_validation_errors is not None
        assert any("S4_SlideGenerator" in e for e in result.plan_validation_errors)


class TestValidNodesAndDependencies:
    """Тесты для констант VALID_NODES и NODE_DEPENDENCIES."""

    def test_valid_nodes_count(self) -> None:
        """5 допустимых узлов."""
        assert len(VALID_NODES) == 5

    def test_all_nodes_have_dependencies(self) -> None:
        """Каждый допустимый узел имеет запись в NODE_DEPENDENCIES."""
        for node in VALID_NODES:
            assert node in NODE_DEPENDENCIES

    def test_s1_has_no_dependencies(self) -> None:
        """S1 не имеет зависимостей."""
        assert NODE_DEPENDENCIES["S1_ContextAnalyzer"] == []

    def test_s4_depends_on_s2_and_s3(self) -> None:
        """S4 зависит от S2 и S3."""
        deps = NODE_DEPENDENCIES["S4_SlideGenerator"]
        assert "S2_NarrativeArchitect" in deps
        assert "S3_DesignArchitect" in deps
