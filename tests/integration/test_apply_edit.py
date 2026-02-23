"""Integration-тесты для EngineAPI.apply_edit().

Тестируем полный цикл apply_edit:
- Валидация входных данных.
- Передача edit_context в S0_PlannerNode.
- Перегенерация зависимых артефактов.
- Обработка ошибок.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from engine.api import EngineAPI
from schemas.events import EventType
from schemas.shared_store import ProjectStatus
from schemas.tool_schemas import (
    GeneratedSlide,
    QualityDimension,
    S4GenerationResult,
    S5QualityResult,
)

# ---------------------------------------------------------------------------
# Мок-данные
# ---------------------------------------------------------------------------

# Существующие результаты (как будто первая генерация уже прошла)
EXISTING_RESULTS: dict[str, Any] = {
    "S1_ContextAnalyzer": {
        "audience": "Инвесторы",
        "purpose": "Привлечение инвестиций",
        "presentation_type": "pitch",
        "tone": "professional",
        "slide_count": 5,
        "confidence_score": 0.95,
    },
    "S2_NarrativeArchitect": {
        "selected_framework": "problem_solution",
        "narrative_structure": [
            {"slide_number": 1, "title": "Заголовок", "content_type": "hero_title"},
            {"slide_number": 2, "title": "Проблема", "content_type": "title_content"},
        ],
        "narrative_score": 0.9,
    },
    "S3_DesignArchitect": {
        "aesthetic_direction": "corporate_classic",
        "color_palette": {"background": "#FFFFFF", "text_primary": "#1A1A2E"},
    },
    "S4_SlideGenerator": {
        "slides": [
            {
                "slide_number": 1,
                "filename": "slide_01.html",
                "layout_template_used": "hero_title",
                "generation_success": True,
            },
        ],
        "total_slides": 1,
        "generation_success": True,
    },
}

# План для apply_edit — перегенерация только S4 и S5
EDIT_PLAN: dict[str, Any] = {
    "steps": [
        {"step_id": "1", "node": "S4_SlideGenerator", "depends_on": []},
        {"step_id": "2", "node": "S5_QualityValidator", "depends_on": ["1"]},
    ],
    "total_steps": 2,
}


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------


def _make_mock_planner_for_edit(plan: dict[str, Any]) -> AsyncMock:
    """Мок-планировщик, который проверяет наличие edit_context."""

    async def mock_execute(store: Any) -> Any:
        # Проверяем, что edit_context передан
        assert "edit_context" in store.user_input, "edit_context должен быть в user_input"
        store.execution_plan = plan
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S0_PlannerNode"
    return mock


def _make_mock_validator_pass() -> AsyncMock:
    """Мок-валидатор, который всегда проходит."""

    async def mock_execute(store: Any) -> Any:
        store.plan_validation_errors = None
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "PlanValidatorNode"
    return mock


def _make_mock_s4_regen(output_dir: str) -> AsyncMock:
    """Мок S4, который перегенерирует слайды."""

    async def mock_execute(store: Any) -> Any:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        html = "<html><body><h1>Regenerated Slide</h1></body></html>"
        (output_path / "slide_01.html").write_text(html, encoding="utf-8")
        (output_path / "presentation.html").write_text(html, encoding="utf-8")

        result = S4GenerationResult(
            slides=[
                GeneratedSlide(
                    slide_number=1,
                    filename="slide_01.html",
                    layout_template_used="hero_title",
                    generation_success=True,
                ),
            ],
            index_html_path=str(output_path / "index.html"),
            presentation_html_path=str(output_path / "presentation.html"),
            total_slides=1,
            generation_success=True,
        )
        store.results["S4_SlideGenerator"] = result.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S4_SlideGenerator"
    return mock


def _make_mock_s5_pass() -> AsyncMock:
    """Мок S5, который проходит валидацию."""

    async def mock_execute(store: Any) -> Any:
        result = S5QualityResult(
            dimensions=[
                QualityDimension(dimension="narrative", score=0.9, issues=[], recommendations=[]),
                QualityDimension(dimension="design", score=0.88, issues=[], recommendations=[]),
                QualityDimension(dimension="content", score=0.92, issues=[], recommendations=[]),
                QualityDimension(dimension="technical", score=0.95, issues=[], recommendations=[]),
            ],
            overall_quality_score=0.9125,
            blocking_issues=[],
            warnings=[],
            passed=True,
        )
        store.results["S5_QualityValidator"] = result.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S5_QualityValidator"
    return mock


# ---------------------------------------------------------------------------
# Тесты
# ---------------------------------------------------------------------------


class TestApplyEditValidation:
    """Тесты валидации входных данных apply_edit."""

    @pytest.mark.asyncio()
    async def test_empty_artifact_id_raises(self) -> None:
        engine = EngineAPI()
        with pytest.raises(ValueError, match="artifact_id"):
            await engine.apply_edit(
                project_id="test-001",
                artifact_id="",
                new_content="<html>New</html>",
            )

    @pytest.mark.asyncio()
    async def test_whitespace_artifact_id_raises(self) -> None:
        engine = EngineAPI()
        with pytest.raises(ValueError, match="artifact_id"):
            await engine.apply_edit(
                project_id="test-001",
                artifact_id="   ",
                new_content="<html>New</html>",
            )

    @pytest.mark.asyncio()
    async def test_empty_content_raises(self) -> None:
        engine = EngineAPI()
        with pytest.raises(ValueError, match="new_content"):
            await engine.apply_edit(
                project_id="test-001",
                artifact_id="slide_01",
                new_content="",
            )


class TestApplyEditIntegration:
    """Integration-тесты apply_edit с моками."""

    @pytest.mark.asyncio()
    async def test_edit_triggers_partial_regeneration(self) -> None:
        """apply_edit перегенерирует только S4 и S5 (зависимые от правки)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            engine._planner = _make_mock_planner_for_edit(EDIT_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s4_regen(tmpdir))
            engine.registry.register(_make_mock_s5_pass())

            result = await engine.apply_edit(
                project_id="edit-test-001",
                artifact_id="slide_01",
                new_content="<html><body><h1>Updated Title</h1></body></html>",
                existing_results=EXISTING_RESULTS,
            )

            # Статус — SUCCESS
            assert result.status == ProjectStatus.SUCCESS

            # Нет ошибок
            assert len(result.errors) == 0

            # S4 перегенерирован
            assert "S4_SlideGenerator" in result.results
            assert result.results["S4_SlideGenerator"]["generation_success"] is True

            # S5 перегенерирован
            assert "S5_QualityValidator" in result.results
            assert result.results["S5_QualityValidator"]["passed"] is True

            # Existing results (S1, S2, S3) сохранены
            assert "S1_ContextAnalyzer" in result.results
            assert "S2_NarrativeArchitect" in result.results
            assert "S3_DesignArchitect" in result.results

    @pytest.mark.asyncio()
    async def test_edit_context_passed_to_planner(self) -> None:
        """edit_context корректно передаётся в S0_PlannerNode."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            # Планировщик проверяет наличие edit_context (assert внутри)
            engine._planner = _make_mock_planner_for_edit(EDIT_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s4_regen(tmpdir))
            engine.registry.register(_make_mock_s5_pass())

            result = await engine.apply_edit(
                project_id="edit-test-002",
                artifact_id="slide_02",
                new_content="<html>New slide 2</html>",
                existing_results=EXISTING_RESULTS,
            )

            # Если assert внутри planner не сработал — тест прошёл
            assert result.status == ProjectStatus.SUCCESS

            # Проверяем, что user_input содержит edit_context
            assert "edit_context" in result.user_input
            assert result.user_input["edit_context"]["artifact_id"] == "slide_02"

    @pytest.mark.asyncio()
    async def test_edit_emits_ai_message_event(self) -> None:
        """apply_edit эмитирует AI_MESSAGE событие."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            engine._planner = _make_mock_planner_for_edit(EDIT_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s4_regen(tmpdir))
            engine.registry.register(_make_mock_s5_pass())

            received_events: list[Any] = []

            async def handler(event: Any) -> None:
                received_events.append(event)

            engine.event_bus.subscribe(EventType.AI_MESSAGE, handler)

            await engine.apply_edit(
                project_id="edit-test-003",
                artifact_id="slide_01",
                new_content="<html>Updated</html>",
                existing_results=EXISTING_RESULTS,
            )

            # Должно быть хотя бы одно AI_MESSAGE событие
            assert len(received_events) >= 1
            assert any("slide_01" in e.message for e in received_events)

    @pytest.mark.asyncio()
    async def test_edit_with_no_existing_results(self) -> None:
        """apply_edit работает даже без existing_results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            engine._planner = _make_mock_planner_for_edit(EDIT_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s4_regen(tmpdir))
            engine.registry.register(_make_mock_s5_pass())

            result = await engine.apply_edit(
                project_id="edit-test-004",
                artifact_id="slide_01",
                new_content="<html>New</html>",
            )

            assert result.status == ProjectStatus.SUCCESS

    @pytest.mark.asyncio()
    async def test_edit_with_chat_history(self) -> None:
        """apply_edit корректно передаёт chat_history."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            engine._planner = _make_mock_planner_for_edit(EDIT_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s4_regen(tmpdir))
            engine.registry.register(_make_mock_s5_pass())

            result = await engine.apply_edit(
                project_id="edit-test-005",
                artifact_id="slide_01",
                new_content="<html>New</html>",
                chat_history=[
                    {"role": "user", "content": "Измени заголовок на слайде 1"},
                    {"role": "assistant", "content": "Готово, обновляю слайд 1"},
                ],
                existing_results=EXISTING_RESULTS,
            )

            assert result.status == ProjectStatus.SUCCESS
            assert len(result.chat_history) == 2
