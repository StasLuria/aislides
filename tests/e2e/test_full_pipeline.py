"""E2E-тест полного цикла генерации презентации.

Тестирует полный pipeline: S0 (Plan) → S1 → S2 → S3 → S4 → S5.
Все LLM-вызовы замокированы. Проверяем, что EngineAPI корректно
оркестрирует все узлы и создаёт финальные артефакты.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from engine.api import EngineAPI
from schemas.shared_store import ProjectStatus
from schemas.tool_schemas import (
    ColorPalette,
    GeneratedSlide,
    QualityDimension,
    S1ContextResult,
    S2NarrativeResult,
    S3DesignResult,
    S4GenerationResult,
    S5QualityResult,
    SlideBlueprint,
    SlideLayoutMapping,
    TypographyScale,
)

# ---------------------------------------------------------------------------
# Мок-данные для каждого узла
# ---------------------------------------------------------------------------

MOCK_PLAN: dict[str, Any] = {
    "steps": [
        {"step_id": "1", "node": "S1_ContextAnalyzer", "depends_on": []},
        {"step_id": "2", "node": "S2_NarrativeArchitect", "depends_on": ["1"]},
        {"step_id": "3", "node": "S3_DesignArchitect", "depends_on": ["1"]},
        {"step_id": "4", "node": "S4_SlideGenerator", "depends_on": ["2", "3"]},
        {"step_id": "5", "node": "S5_QualityValidator", "depends_on": ["4"]},
    ],
    "total_steps": 5,
}

MOCK_S1_RESULT = S1ContextResult(
    audience="Инвесторы",
    purpose="Привлечение инвестиций",
    presentation_type="pitch",
    duration="10 минут",
    tone="professional",
    key_messages=["AI-платформа", "Рост 300%", "Команда экспертов"],
    preferred_theme="corporate_classic",
    slide_count=5,
    content_mode="auto",
    confidence_score=0.95,
    clarification_questions=[],
)

MOCK_S2_RESULT = S2NarrativeResult(
    selected_framework="problem_solution",
    framework_rationale="Подходит для pitch-презентации",
    narrative_structure=[
        SlideBlueprint(
            slide_number=1,
            title="AI-платформа нового поколения",
            content_type="hero_title",
            narrative_beat="opening",
            key_message="Мы меняем правила игры",
            speaker_notes="",
        ),
        SlideBlueprint(
            slide_number=2,
            title="Проблема рынка",
            content_type="title_content",
            narrative_beat="build",
            key_message="80% компаний теряют время на рутину",
            speaker_notes="Привести статистику",
        ),
        SlideBlueprint(
            slide_number=3,
            title="Наше решение",
            content_type="key_point",
            narrative_beat="climax",
            key_message="AI автоматизирует 90% задач",
            speaker_notes="Демо",
        ),
        SlideBlueprint(
            slide_number=4,
            title="Результаты",
            content_type="data_table",
            narrative_beat="resolution",
            key_message="Рост 300% за год",
            speaker_notes="",
        ),
        SlideBlueprint(
            slide_number=5,
            title="Инвестируйте в будущее",
            content_type="closing",
            narrative_beat="call_to_action",
            key_message="Присоединяйтесь к нам",
            speaker_notes="",
        ),
    ],
    narrative_score=0.92,
)

MOCK_S3_RESULT = S3DesignResult(
    aesthetic_direction="corporate_classic",
    layout_family="corporate",
    color_palette=ColorPalette(
        background="#FFFFFF",
        text_primary="#1A1A2E",
        text_secondary="#6B7280",
        accent="#0066CC",
        accent_secondary="#00B4D8",
        surface="#F8F9FA",
    ),
    typography=TypographyScale(
        font_family_heading="Inter",
        font_family_body="Inter",
    ),
    spacing_unit=4,
    slide_layouts=[
        SlideLayoutMapping(slide_number=1, content_type="hero_title", layout_template="hero_title"),
        SlideLayoutMapping(slide_number=2, content_type="title_content", layout_template="title_content"),
        SlideLayoutMapping(slide_number=3, content_type="key_point", layout_template="key_point"),
        SlideLayoutMapping(slide_number=4, content_type="data_table", layout_template="data_table"),
        SlideLayoutMapping(slide_number=5, content_type="closing", layout_template="closing"),
    ],
    design_score=0.88,
)

MOCK_S5_RESULT = S5QualityResult(
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

SAMPLE_HTML = """<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Test</title></head>
<body style="margin:0;padding:0;">
<div style="width:1280px;height:720px;background:#FFFFFF;">
<h1 style="color:#1A1A2E;">Test Slide</h1>
</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Вспомогательные функции для мокирования
# ---------------------------------------------------------------------------


def _make_mock_planner(plan: dict[str, Any]) -> AsyncMock:
    """Создать мок S0_PlannerNode, который записывает план в store."""

    async def mock_execute(store: Any) -> Any:
        store.execution_plan = plan
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S0_PlannerNode"
    return mock


def _make_mock_validator_pass() -> AsyncMock:
    """Создать мок PlanValidatorNode, который всегда проходит."""

    async def mock_execute(store: Any) -> Any:
        store.plan_validation_errors = None
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "PlanValidatorNode"
    return mock


def _make_mock_s1() -> AsyncMock:
    """Создать мок S1_ContextAnalyzer."""

    async def mock_execute(store: Any) -> Any:
        store.results["S1_ContextAnalyzer"] = MOCK_S1_RESULT.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S1_ContextAnalyzer"
    return mock


def _make_mock_s2() -> AsyncMock:
    """Создать мок S2_NarrativeArchitect."""

    async def mock_execute(store: Any) -> Any:
        store.results["S2_NarrativeArchitect"] = MOCK_S2_RESULT.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S2_NarrativeArchitect"
    return mock


def _make_mock_s3() -> AsyncMock:
    """Создать мок S3_DesignArchitect."""

    async def mock_execute(store: Any) -> Any:
        store.results["S3_DesignArchitect"] = MOCK_S3_RESULT.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S3_DesignArchitect"
    return mock


def _make_mock_s4(output_dir: str) -> AsyncMock:
    """Создать мок S4_SlideGenerator, который создаёт реальные файлы."""

    async def mock_execute(store: Any) -> Any:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        slides = []
        for i in range(1, 6):
            filename = f"slide_{i:02d}.html"
            (output_path / filename).write_text(SAMPLE_HTML, encoding="utf-8")
            slides.append(
                GeneratedSlide(
                    slide_number=i,
                    filename=filename,
                    layout_template_used="hero_title",
                    generation_success=True,
                )
            )

        # Создаём index.html и presentation.html
        (output_path / "index.html").write_text("<html>Index</html>", encoding="utf-8")
        (output_path / "presentation.html").write_text("<html>Presentation</html>", encoding="utf-8")

        result = S4GenerationResult(
            slides=slides,
            index_html_path=str(output_path / "index.html"),
            presentation_html_path=str(output_path / "presentation.html"),
            total_slides=5,
            generation_success=True,
        )
        store.results["S4_SlideGenerator"] = result.model_dump()

        from schemas.shared_store import Artifact

        store.artifacts.append(
            Artifact(
                artifact_id=f"{store.project_id}_presentation",
                filename="presentation.html",
                storage_path=str(output_path / "presentation.html"),
                version=1,
                created_by="S4_SlideGenerator",
            )
        )
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S4_SlideGenerator"
    return mock


def _make_mock_s5() -> AsyncMock:
    """Создать мок S5_QualityValidator."""

    async def mock_execute(store: Any) -> Any:
        store.results["S5_QualityValidator"] = MOCK_S5_RESULT.model_dump()
        return store

    mock = AsyncMock()
    mock.execute = AsyncMock(side_effect=mock_execute)
    mock.name = "S5_QualityValidator"
    return mock


# ---------------------------------------------------------------------------
# E2E-тесты
# ---------------------------------------------------------------------------


class TestFullPipelineE2E:
    """E2E-тест полного цикла генерации."""

    @pytest.mark.asyncio()
    async def test_full_pipeline_success(self) -> None:
        """Полный цикл S0→S1→S2→S3→S4→S5 завершается успешно."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Создаём EngineAPI
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            # Подменяем planner и validator
            engine._planner = _make_mock_planner(MOCK_PLAN)
            engine._validator = _make_mock_validator_pass()

            # Регистрируем мок-узлы
            mock_s1 = _make_mock_s1()
            mock_s2 = _make_mock_s2()
            mock_s3 = _make_mock_s3()
            mock_s4 = _make_mock_s4(tmpdir)
            mock_s5 = _make_mock_s5()

            engine.registry.register(mock_s1)
            engine.registry.register(mock_s2)
            engine.registry.register(mock_s3)
            engine.registry.register(mock_s4)
            engine.registry.register(mock_s5)

            # Запускаем полный цикл
            result = await engine.run(
                project_id="e2e-test-001",
                user_input={
                    "prompt": "Создай pitch-презентацию для AI-стартапа на 5 слайдов",
                },
            )

            # --- Проверки ---

            # 1. Статус — SUCCESS
            assert result.status == ProjectStatus.SUCCESS

            # 2. Нет ошибок
            assert len(result.errors) == 0

            # 3. Все 5 узлов вызваны
            mock_s1.execute.assert_called_once()
            mock_s2.execute.assert_called_once()
            mock_s3.execute.assert_called_once()
            mock_s4.execute.assert_called_once()
            mock_s5.execute.assert_called_once()

            # 4. Все результаты записаны в store
            assert "S1_ContextAnalyzer" in result.results
            assert "S2_NarrativeArchitect" in result.results
            assert "S3_DesignArchitect" in result.results
            assert "S4_SlideGenerator" in result.results
            assert "S5_QualityValidator" in result.results

            # 5. S1 — контекст
            s1 = result.results["S1_ContextAnalyzer"]
            assert s1["audience"] == "Инвесторы"
            assert s1["presentation_type"] == "pitch"
            assert s1["confidence_score"] == 0.95

            # 6. S2 — нарратив
            s2 = result.results["S2_NarrativeArchitect"]
            assert s2["selected_framework"] == "problem_solution"
            assert len(s2["narrative_structure"]) == 5

            # 7. S3 — дизайн
            s3 = result.results["S3_DesignArchitect"]
            assert s3["aesthetic_direction"] == "corporate_classic"
            assert s3["color_palette"]["accent"] == "#0066CC"

            # 8. S4 — генерация
            s4 = result.results["S4_SlideGenerator"]
            assert s4["total_slides"] == 5
            assert s4["generation_success"] is True
            assert len(s4["slides"]) == 5

            # 9. S5 — качество
            s5 = result.results["S5_QualityValidator"]
            assert s5["overall_quality_score"] == 0.9125
            assert s5["passed"] is True

            # 10. Артефакты созданы
            assert len(result.artifacts) >= 1
            artifact_filenames = [a.filename for a in result.artifacts]
            assert "presentation.html" in artifact_filenames

            # 11. Файлы на диске
            output_path = Path(tmpdir)
            assert (output_path / "slide_01.html").exists()
            assert (output_path / "slide_05.html").exists()
            assert (output_path / "index.html").exists()
            assert (output_path / "presentation.html").exists()

            # 12. Execution plan сохранён
            assert result.execution_plan is not None
            assert result.execution_plan["total_steps"] == 5

    @pytest.mark.asyncio()
    async def test_pipeline_with_plan_validation_failure(self) -> None:
        """Тест: план не проходит валидацию → статус FAILED."""
        engine = EngineAPI(config={"llm": {"model": "test-model"}})

        # Planner возвращает план
        engine._planner = _make_mock_planner(MOCK_PLAN)

        # Validator всегда возвращает ошибки
        async def mock_validator_fail(store: Any) -> Any:
            store.plan_validation_errors = ["Неизвестный узел: S99_Unknown"]
            return store

        validator_mock = AsyncMock()
        validator_mock.execute = AsyncMock(side_effect=mock_validator_fail)
        engine._validator = validator_mock

        result = await engine.run(
            project_id="e2e-fail-001",
            user_input={"prompt": "Тест"},
        )

        assert result.status == ProjectStatus.FAILED
        assert len(result.errors) > 0
        assert "валидацию" in result.errors[0]["error"]

    @pytest.mark.asyncio()
    async def test_pipeline_node_error_stops_execution(self) -> None:
        """Тест: ошибка в узле S2 останавливает выполнение."""
        engine = EngineAPI(config={"llm": {"model": "test-model"}})

        engine._planner = _make_mock_planner(MOCK_PLAN)
        engine._validator = _make_mock_validator_pass()

        # S1 работает нормально
        engine.registry.register(_make_mock_s1())

        # S2 бросает ошибку
        async def mock_s2_error(store: Any) -> Any:
            msg = "LLM timeout"
            raise RuntimeError(msg)

        s2_error = AsyncMock()
        s2_error.execute = AsyncMock(side_effect=mock_s2_error)
        s2_error.name = "S2_NarrativeArchitect"
        engine.registry.register(s2_error)

        result = await engine.run(
            project_id="e2e-error-001",
            user_input={"prompt": "Тест"},
        )

        assert result.status == ProjectStatus.FAILED
        assert len(result.errors) > 0
        # S1 должен быть выполнен, S2 — нет
        assert "S1_ContextAnalyzer" in result.results
        assert "S2_NarrativeArchitect" not in result.results

    @pytest.mark.asyncio()
    async def test_pipeline_cancel_during_execution(self) -> None:
        """Тест: отмена во время выполнения."""
        engine = EngineAPI(config={"llm": {"model": "test-model"}})

        engine._planner = _make_mock_planner(MOCK_PLAN)
        engine._validator = _make_mock_validator_pass()

        # S1 устанавливает cancel_token
        async def mock_s1_then_cancel(store: Any) -> Any:
            store.results["S1_ContextAnalyzer"] = MOCK_S1_RESULT.model_dump()
            # Имитируем отмену после S1
            token = engine._cancellation_tokens.get(store.project_id)
            if token:
                token.set()
            return store

        s1_cancel = AsyncMock()
        s1_cancel.execute = AsyncMock(side_effect=mock_s1_then_cancel)
        s1_cancel.name = "S1_ContextAnalyzer"
        engine.registry.register(s1_cancel)

        result = await engine.run(
            project_id="e2e-cancel-001",
            user_input={"prompt": "Тест"},
        )

        assert result.status == ProjectStatus.CANCELLED
        assert "S1_ContextAnalyzer" in result.results
        # S2 не должен быть выполнен
        assert "S2_NarrativeArchitect" not in result.results

    @pytest.mark.asyncio()
    async def test_event_bus_receives_events(self) -> None:
        """Тест: EventBus получает события во время выполнения."""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine = EngineAPI(config={"llm": {"model": "test-model"}})

            engine._planner = _make_mock_planner(MOCK_PLAN)
            engine._validator = _make_mock_validator_pass()

            engine.registry.register(_make_mock_s1())
            engine.registry.register(_make_mock_s2())
            engine.registry.register(_make_mock_s3())
            engine.registry.register(_make_mock_s4(tmpdir))
            engine.registry.register(_make_mock_s5())

            # Подписываемся на все типы событий
            received_events: list[Any] = []

            async def event_handler(event: Any) -> None:
                received_events.append(event)

            from schemas.events import EventType as EvType

            for ev_type in EvType:
                engine.event_bus.subscribe(ev_type, event_handler)

            await engine.run(
                project_id="e2e-events-001",
                user_input={"prompt": "Тест"},
            )

            # Должны быть события: PLAN_STARTED, PLAN_COMPLETED,
            # 5x STEP_STARTED, 5x STEP_COMPLETED = минимум 12
            assert len(received_events) >= 12

            event_types = [e.event_type for e in received_events]
            assert EvType.PLAN_STARTED in event_types
            assert EvType.PLAN_COMPLETED in event_types
            assert EvType.STEP_STARTED in event_types
            assert EvType.STEP_COMPLETED in event_types
