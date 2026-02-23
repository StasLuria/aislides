"""Unit-тесты для schemas/execution_plan.py."""

from __future__ import annotations

import json

import pytest

from schemas.execution_plan import ExecutionPlanSchema, PlanStep

# ---------------------------------------------------------------------------
# Tests: PlanStep
# ---------------------------------------------------------------------------


class TestPlanStep:
    """Тесты для PlanStep."""

    def test_creation_minimal(self) -> None:
        """PlanStep создаётся с обязательными полями."""
        step = PlanStep(
            step_id=1,
            node="S1_ContextAnalyzer",
            reason="Анализ контекста пользователя",
        )
        assert step.step_id == 1
        assert step.node == "S1_ContextAnalyzer"
        assert step.params == {}
        assert step.reason == "Анализ контекста пользователя"

    def test_creation_with_params(self) -> None:
        """PlanStep создаётся с параметрами."""
        step = PlanStep(
            step_id=2,
            node="S3_DesignArchitect",
            params={"preset": "corporate_classic"},
            reason="Создание дизайн-системы",
        )
        assert step.params["preset"] == "corporate_classic"

    def test_missing_required_raises(self) -> None:
        """Отсутствие обязательных полей вызывает ошибку."""
        with pytest.raises(Exception):  # noqa: B017
            PlanStep(step_id=1)  # type: ignore[call-arg]

    def test_serialization(self) -> None:
        """PlanStep сериализуется в JSON."""
        step = PlanStep(
            step_id=1,
            node="S1_ContextAnalyzer",
            reason="Анализ",
        )
        data = json.loads(step.model_dump_json())
        assert data["step_id"] == 1
        assert data["node"] == "S1_ContextAnalyzer"


# ---------------------------------------------------------------------------
# Tests: ExecutionPlanSchema
# ---------------------------------------------------------------------------


class TestExecutionPlanSchema:
    """Тесты для ExecutionPlanSchema."""

    def test_creation(self) -> None:
        """ExecutionPlanSchema создаётся корректно."""
        plan = ExecutionPlanSchema(
            thought="Нужно проанализировать контекст, затем построить нарратив.",
            steps=[
                PlanStep(step_id=1, node="S1_ContextAnalyzer", reason="Анализ контекста"),
                PlanStep(step_id=2, node="S2_NarrativeArchitect", reason="Построение нарратива"),
            ],
        )
        assert len(plan.steps) == 2
        assert plan.thought.startswith("Нужно")

    def test_empty_steps(self) -> None:
        """План с пустым списком шагов валиден."""
        plan = ExecutionPlanSchema(
            thought="Нет шагов для выполнения.",
            steps=[],
        )
        assert len(plan.steps) == 0

    def test_full_pipeline_plan(self) -> None:
        """План с полным конвейером S1-S5."""
        steps = [
            PlanStep(step_id=i, node=f"S{i}_{name}", reason=f"Шаг {i}")
            for i, name in enumerate(
                [
                    "S1_ContextAnalyzer",
                    "S2_NarrativeArchitect",
                    "S3_DesignArchitect",
                    "S4_SlideGenerator",
                    "S5_QualityValidator",
                ],
                start=1,
            )
        ]
        plan = ExecutionPlanSchema(
            thought="Полный конвейер генерации.",
            steps=steps,
        )
        assert len(plan.steps) == 5
        assert plan.steps[0].node == "S1_S1_ContextAnalyzer"
        assert plan.steps[-1].node == "S5_S5_QualityValidator"

    def test_serialization_roundtrip(self) -> None:
        """Roundtrip сериализация ExecutionPlanSchema."""
        plan = ExecutionPlanSchema(
            thought="Тестовый план.",
            steps=[
                PlanStep(step_id=1, node="S1_ContextAnalyzer", reason="Тест"),
            ],
        )
        json_str = plan.model_dump_json()
        restored = ExecutionPlanSchema.model_validate_json(json_str)
        assert restored.thought == plan.thought
        assert len(restored.steps) == len(plan.steps)
        assert restored.steps[0].node == plan.steps[0].node

    def test_missing_thought_raises(self) -> None:
        """Отсутствие thought вызывает ошибку."""
        with pytest.raises(Exception):  # noqa: B017
            ExecutionPlanSchema(steps=[])  # type: ignore[call-arg]
