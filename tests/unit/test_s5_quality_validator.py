"""Unit-тесты для S5_QualityValidatorNode.

Все LLM-вызовы замокированы. Тестируем:
- Валидацию входных данных (отсутствие S4).
- Успешную валидацию с mock LLM.
- Обработку ошибок LLM.
- Вспомогательные функции (_build_validation_prompt, _read_slide_htmls).
- Логику passed/not passed (врата качества).
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas.shared_store import SharedStore
from schemas.tool_schemas import QualityDimension, S5QualityResult
from tools.s5_quality_validator import (
    S5QualityValidatorNode,
    _build_validation_prompt,
    _read_slide_htmls,
)

# ---------------------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------------------

SAMPLE_S4_RESULT: dict[str, Any] = {
    "slides": [
        {
            "slide_number": 1,
            "filename": "slide_01.html",
            "layout_template_used": "hero_title",
            "generation_success": True,
        },
        {
            "slide_number": 2,
            "filename": "slide_02.html",
            "layout_template_used": "title_content",
            "generation_success": True,
        },
    ],
    "index_html_path": "/tmp/test_slides/index.html",
    "presentation_html_path": "/tmp/test_slides/presentation.html",
    "total_slides": 2,
    "generation_success": True,
}

SAMPLE_S5_QUALITY_RESULT = S5QualityResult(
    dimensions=[
        QualityDimension(dimension="narrative", score=0.9, issues=[], recommendations=["Добавить переход"]),
        QualityDimension(dimension="design", score=0.88, issues=[], recommendations=[]),
        QualityDimension(dimension="content", score=0.92, issues=[], recommendations=[]),
        QualityDimension(dimension="technical", score=0.95, issues=[], recommendations=[]),
    ],
    overall_quality_score=0.9125,
    blocking_issues=[],
    warnings=["Слайд 2: можно улучшить контрастность"],
    passed=True,
)

SAMPLE_S5_FAILED_RESULT = S5QualityResult(
    dimensions=[
        QualityDimension(dimension="narrative", score=0.6, issues=["Нет логической связи"], recommendations=[]),
        QualityDimension(dimension="design", score=0.5, issues=["Нарушена палитра"], recommendations=[]),
        QualityDimension(dimension="content", score=0.7, issues=["Грамматические ошибки"], recommendations=[]),
        QualityDimension(dimension="technical", score=0.8, issues=["Найден <style> блок"], recommendations=[]),
    ],
    overall_quality_score=0.65,
    blocking_issues=["Нарушена палитра на слайде 3", "Найден <style> блок"],
    warnings=["Грамматические ошибки на слайде 2"],
    passed=False,
)


@pytest.fixture()
def store_with_s4() -> SharedStore:
    """SharedStore с результатами S1-S4."""
    return SharedStore(
        project_id="test-s5",
        user_input={"prompt": "Тестовая презентация"},
        config={"llm": {"model": "test-model"}},
        results={
            "S1_ContextAnalyzer": {
                "audience": "Инвесторы",
                "purpose": "Привлечение инвестиций",
                "presentation_type": "pitch",
                "tone": "professional",
                "slide_count": 10,
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
                "typography": {"font_family_heading": "Inter"},
            },
            "S4_SlideGenerator": SAMPLE_S4_RESULT,
        },
    )


@pytest.fixture()
def store_no_s4() -> SharedStore:
    """SharedStore без S4."""
    return SharedStore(
        project_id="test-s5-no-s4",
        user_input={"prompt": "Тест"},
        config={},
        results={
            "S1_ContextAnalyzer": {"audience": "Тест"},
        },
    )


@pytest.fixture()
def store_minimal() -> SharedStore:
    """SharedStore с минимальными данными (только S4)."""
    return SharedStore(
        project_id="test-s5-minimal",
        user_input={"prompt": "Тест"},
        config={},
        results={
            "S4_SlideGenerator": SAMPLE_S4_RESULT,
        },
    )


# ---------------------------------------------------------------------------
# Тесты вспомогательных функций
# ---------------------------------------------------------------------------


class TestBuildValidationPrompt:
    """Тесты для _build_validation_prompt."""

    def test_includes_s1_data(self, store_with_s4: SharedStore) -> None:
        result = _build_validation_prompt(store_with_s4)
        assert "Инвесторы" in result
        assert "S1: Контекст" in result

    def test_includes_s2_data(self, store_with_s4: SharedStore) -> None:
        result = _build_validation_prompt(store_with_s4)
        assert "S2: Нарратив" in result
        assert "problem_solution" in result

    def test_includes_s3_data(self, store_with_s4: SharedStore) -> None:
        result = _build_validation_prompt(store_with_s4)
        assert "S3: Дизайн-система" in result
        assert "corporate_classic" in result

    def test_includes_s4_data(self, store_with_s4: SharedStore) -> None:
        result = _build_validation_prompt(store_with_s4)
        assert "S4: Результат генерации" in result

    def test_includes_instruction(self, store_with_s4: SharedStore) -> None:
        result = _build_validation_prompt(store_with_s4)
        assert "Инструкция" in result

    def test_minimal_store(self, store_minimal: SharedStore) -> None:
        """Промпт работает даже без S1-S3."""
        result = _build_validation_prompt(store_minimal)
        assert "S4: Результат генерации" in result
        assert "Инструкция" in result


class TestReadSlideHtmls:
    """Тесты для _read_slide_htmls."""

    def test_empty_s4_result(self) -> None:
        result = _read_slide_htmls({})
        assert result == {}

    def test_no_slides(self) -> None:
        result = _read_slide_htmls({"slides": [], "index_html_path": "/tmp/test/index.html"})
        assert result == {}

    def test_no_index_path(self) -> None:
        result = _read_slide_htmls({"slides": [{"slide_number": 1, "filename": "s.html"}]})
        assert result == {}

    def test_reads_existing_files(self) -> None:
        """Тест чтения реальных файлов с диска."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Создаём тестовые файлы
            slide1 = Path(tmpdir) / "slide_01.html"
            slide1.write_text("<html>Slide 1</html>", encoding="utf-8")
            slide2 = Path(tmpdir) / "slide_02.html"
            slide2.write_text("<html>Slide 2</html>", encoding="utf-8")

            s4_result: dict[str, Any] = {
                "slides": [
                    {"slide_number": 1, "filename": "slide_01.html"},
                    {"slide_number": 2, "filename": "slide_02.html"},
                ],
                "index_html_path": str(Path(tmpdir) / "index.html"),
            }

            result = _read_slide_htmls(s4_result)
            assert len(result) == 2
            assert "<html>Slide 1</html>" in result[1]
            assert "<html>Slide 2</html>" in result[2]

    def test_missing_files_skipped(self) -> None:
        """Тест: отсутствующие файлы пропускаются."""
        with tempfile.TemporaryDirectory() as tmpdir:
            s4_result: dict[str, Any] = {
                "slides": [
                    {"slide_number": 1, "filename": "nonexistent.html"},
                ],
                "index_html_path": str(Path(tmpdir) / "index.html"),
            }

            result = _read_slide_htmls(s4_result)
            assert len(result) == 0


# ---------------------------------------------------------------------------
# Тесты S5QualityValidatorNode
# ---------------------------------------------------------------------------


class TestS5QualityValidatorNode:
    """Тесты для S5QualityValidatorNode."""

    def test_name(self) -> None:
        node = S5QualityValidatorNode()
        assert node.name == "S5_QualityValidator"

    def test_default_threshold(self) -> None:
        node = S5QualityValidatorNode()
        assert node._quality_threshold == 0.85

    def test_custom_threshold(self) -> None:
        node = S5QualityValidatorNode(quality_threshold=0.9)
        assert node._quality_threshold == 0.9

    @pytest.mark.asyncio()
    async def test_missing_s4_raises(self, store_no_s4: SharedStore) -> None:
        node = S5QualityValidatorNode()
        with pytest.raises(RuntimeError, match="S4_SlideGenerator"):
            await node.execute(store_no_s4)

    @pytest.mark.asyncio()
    async def test_successful_validation_passed(self, store_with_s4: SharedStore) -> None:
        """Тест успешной валидации — качество выше порога."""
        node = S5QualityValidatorNode()

        mock_instructor = MagicMock()
        mock_instructor.chat.completions.create = AsyncMock(return_value=SAMPLE_S5_QUALITY_RESULT)

        with patch.object(node, "_create_client", return_value=mock_instructor):
            result = await node.execute(store_with_s4)

        assert "S5_QualityValidator" in result.results
        s5 = result.results["S5_QualityValidator"]
        assert s5["overall_quality_score"] == 0.9125
        assert s5["passed"] is True
        assert len(s5["dimensions"]) == 4
        assert len(s5["blocking_issues"]) == 0

    @pytest.mark.asyncio()
    async def test_failed_validation(self, store_with_s4: SharedStore) -> None:
        """Тест валидации — качество ниже порога."""
        node = S5QualityValidatorNode()

        mock_instructor = MagicMock()
        mock_instructor.chat.completions.create = AsyncMock(return_value=SAMPLE_S5_FAILED_RESULT)

        with patch.object(node, "_create_client", return_value=mock_instructor):
            result = await node.execute(store_with_s4)

        s5 = result.results["S5_QualityValidator"]
        assert s5["overall_quality_score"] == 0.65
        assert s5["passed"] is False
        assert len(s5["blocking_issues"]) == 2

    @pytest.mark.asyncio()
    async def test_llm_error_raises(self, store_with_s4: SharedStore) -> None:
        """Тест: ошибка LLM пробрасывается как RuntimeError."""
        node = S5QualityValidatorNode()

        mock_instructor = MagicMock()
        mock_instructor.chat.completions.create = AsyncMock(side_effect=Exception("LLM validation error"))

        with (
            patch.object(node, "_create_client", return_value=mock_instructor),
            pytest.raises(RuntimeError, match="LLM не вернул валидный результат"),
        ):
            await node.execute(store_with_s4)

    @pytest.mark.asyncio()
    async def test_dimensions_logged(self, store_with_s4: SharedStore) -> None:
        """Тест: все 4 измерения записаны в результат."""
        node = S5QualityValidatorNode()

        mock_instructor = MagicMock()
        mock_instructor.chat.completions.create = AsyncMock(return_value=SAMPLE_S5_QUALITY_RESULT)

        with patch.object(node, "_create_client", return_value=mock_instructor):
            result = await node.execute(store_with_s4)

        s5 = result.results["S5_QualityValidator"]
        dimension_names = [d["dimension"] for d in s5["dimensions"]]
        assert "narrative" in dimension_names
        assert "design" in dimension_names
        assert "content" in dimension_names
        assert "technical" in dimension_names

    @pytest.mark.asyncio()
    async def test_with_slide_html_files(self, store_with_s4: SharedStore) -> None:
        """Тест: валидация с реальными HTML-файлами на диске."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Создаём тестовые HTML-файлы
            slide1 = Path(tmpdir) / "slide_01.html"
            slide1.write_text("<html><body>Slide 1</body></html>", encoding="utf-8")
            slide2 = Path(tmpdir) / "slide_02.html"
            slide2.write_text("<html><body>Slide 2</body></html>", encoding="utf-8")

            # Обновляем S4 результат с реальными путями
            store_with_s4.results["S4_SlideGenerator"]["index_html_path"] = str(Path(tmpdir) / "index.html")

            node = S5QualityValidatorNode()

            mock_instructor = MagicMock()
            mock_instructor.chat.completions.create = AsyncMock(return_value=SAMPLE_S5_QUALITY_RESULT)

            with patch.object(node, "_create_client", return_value=mock_instructor):
                await node.execute(store_with_s4)

            # Проверяем, что промпт содержал HTML слайдов
            call_args = mock_instructor.chat.completions.create.call_args
            messages = call_args.kwargs.get("messages", [])
            user_msg = messages[-1]["content"] if messages else ""
            assert "HTML слайда 1" in user_msg
            assert "HTML слайда 2" in user_msg
