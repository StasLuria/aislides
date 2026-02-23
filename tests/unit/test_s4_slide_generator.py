"""Unit-тесты для S4_SlideGeneratorNode.

Все LLM-вызовы замокированы. Тестируем:
- Генерацию HTML-слайдов (с mock LLM).
- Создание index.html и presentation.html.
- Fallback при ошибке LLM.
- Валидацию входных данных (отсутствие S2/S3).
- Вспомогательные функции (_clean_html_response, _build_slide_prompt и т.д.).
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas.shared_store import SharedStore
from schemas.tool_schemas import GeneratedSlide
from tools.s4_slide_generator import (
    S4SlideGeneratorNode,
    _build_index_html,
    _build_presentation_html,
    _build_slide_prompt,
    _clean_html_response,
    _escape_for_srcdoc,
    _generate_fallback_slide,
)

# ---------------------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------------------

SAMPLE_DESIGN: dict[str, Any] = {
    "aesthetic_direction": "corporate_classic",
    "layout_family": "corporate",
    "color_palette": {
        "background": "#FFFFFF",
        "text_primary": "#1A1A2E",
        "text_secondary": "#6B7280",
        "accent": "#0066CC",
        "accent_secondary": "#00B4D8",
        "surface": "#F8F9FA",
    },
    "typography": {
        "font_family_heading": "Inter",
        "font_family_body": "Inter",
        "size_h1": "48px",
        "size_h2": "36px",
        "size_body": "18px",
    },
    "spacing_unit": 4,
    "slide_layouts": [
        {"slide_number": 1, "content_type": "hero_title", "layout_template": "hero_title"},
        {"slide_number": 2, "content_type": "title_content", "layout_template": "title_content"},
    ],
    "design_score": 0.9,
}

SAMPLE_NARRATIVE: list[dict[str, Any]] = [
    {
        "slide_number": 1,
        "title": "Заголовок презентации",
        "content_type": "hero_title",
        "narrative_beat": "opening",
        "key_message": "Главное сообщение",
        "speaker_notes": "",
    },
    {
        "slide_number": 2,
        "title": "Основной контент",
        "content_type": "title_content",
        "narrative_beat": "build",
        "key_message": "Ключевой тезис",
        "speaker_notes": "Раскрыть подробнее",
    },
]

SAMPLE_HTML = """<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Test</title></head>
<body style="margin:0;padding:0;">
<div style="width:1280px;height:720px;background:#FFFFFF;">
<h1 style="color:#1A1A2E;">Test Slide</h1>
</div>
</body>
</html>"""


@pytest.fixture()
def store_with_s2_s3() -> SharedStore:
    """SharedStore с результатами S2 и S3."""
    return SharedStore(
        project_id="test-s4",
        user_input={"prompt": "Тестовая презентация"},
        config={"llm": {"model": "test-model"}},
        results={
            "S2_NarrativeArchitect": {
                "selected_framework": "problem_solution",
                "framework_rationale": "Подходит для бизнес-презентации",
                "narrative_structure": SAMPLE_NARRATIVE,
                "narrative_score": 0.9,
            },
            "S3_DesignArchitect": SAMPLE_DESIGN,
        },
    )


@pytest.fixture()
def store_no_s2() -> SharedStore:
    """SharedStore без S2."""
    return SharedStore(
        project_id="test-s4-no-s2",
        user_input={"prompt": "Тест"},
        config={},
        results={"S3_DesignArchitect": SAMPLE_DESIGN},
    )


@pytest.fixture()
def store_no_s3() -> SharedStore:
    """SharedStore без S3."""
    return SharedStore(
        project_id="test-s4-no-s3",
        user_input={"prompt": "Тест"},
        config={},
        results={
            "S2_NarrativeArchitect": {
                "narrative_structure": SAMPLE_NARRATIVE,
            },
        },
    )


@pytest.fixture()
def store_empty_narrative() -> SharedStore:
    """SharedStore с пустым narrative_structure."""
    return SharedStore(
        project_id="test-s4-empty",
        user_input={"prompt": "Тест"},
        config={},
        results={
            "S2_NarrativeArchitect": {
                "narrative_structure": [],
            },
            "S3_DesignArchitect": SAMPLE_DESIGN,
        },
    )


# ---------------------------------------------------------------------------
# Тесты вспомогательных функций
# ---------------------------------------------------------------------------


class TestCleanHtmlResponse:
    """Тесты для _clean_html_response."""

    def test_clean_markdown_html_wrapper(self) -> None:
        text = "```html\n<html><body>Hello</body></html>\n```"
        result = _clean_html_response(text)
        assert result == "<html><body>Hello</body></html>"

    def test_clean_generic_markdown_wrapper(self) -> None:
        text = "```\n<html><body>Hello</body></html>\n```"
        result = _clean_html_response(text)
        assert result == "<html><body>Hello</body></html>"

    def test_no_wrapper(self) -> None:
        text = "<html><body>Hello</body></html>"
        result = _clean_html_response(text)
        assert result == "<html><body>Hello</body></html>"

    def test_whitespace_trimming(self) -> None:
        text = "  \n  <html>Test</html>  \n  "
        result = _clean_html_response(text)
        assert result == "<html>Test</html>"

    def test_empty_string(self) -> None:
        assert _clean_html_response("") == ""
        assert _clean_html_response("   ") == ""


class TestEscapeForSrcdoc:
    """Тесты для _escape_for_srcdoc."""

    def test_escape_ampersand(self) -> None:
        assert "&amp;" in _escape_for_srcdoc("a & b")

    def test_escape_quotes(self) -> None:
        assert "&quot;" in _escape_for_srcdoc('a "b" c')

    def test_escape_angle_brackets(self) -> None:
        result = _escape_for_srcdoc("<div>test</div>")
        assert "&lt;" in result
        assert "&gt;" in result

    def test_combined_escaping(self) -> None:
        result = _escape_for_srcdoc('<a href="test">&copy;</a>')
        assert "&lt;" in result
        assert "&gt;" in result
        assert "&amp;" in result
        assert "&quot;" in result


class TestBuildSlidePrompt:
    """Тесты для _build_slide_prompt."""

    def test_contains_slide_number(self) -> None:
        result = _build_slide_prompt(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1, 2)
        assert "Слайд 1 из 2" in result

    def test_contains_design_info(self) -> None:
        result = _build_slide_prompt(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1, 2)
        assert "corporate" in result
        assert "#FFFFFF" in result

    def test_contains_layout_template(self) -> None:
        result = _build_slide_prompt(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1, 2)
        assert "hero_title" in result

    def test_default_layout_for_unknown_slide(self) -> None:
        result = _build_slide_prompt(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 99, 100)
        assert "title_content" in result  # дефолт


class TestGenerateFallbackSlide:
    """Тесты для _generate_fallback_slide."""

    def test_returns_valid_html(self) -> None:
        result = _generate_fallback_slide(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1)
        assert "<!DOCTYPE html>" in result
        assert "<html" in result
        assert "</html>" in result

    def test_contains_title(self) -> None:
        result = _generate_fallback_slide(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1)
        assert "Заголовок презентации" in result

    def test_contains_key_message(self) -> None:
        result = _generate_fallback_slide(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1)
        assert "Главное сообщение" in result

    def test_uses_design_colors(self) -> None:
        result = _generate_fallback_slide(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1)
        assert "#FFFFFF" in result
        assert "#1A1A2E" in result

    def test_slide_dimensions(self) -> None:
        result = _generate_fallback_slide(SAMPLE_NARRATIVE[0], SAMPLE_DESIGN, 1)
        assert "1280px" in result
        assert "720px" in result

    def test_default_values_for_empty_blueprint(self) -> None:
        result = _generate_fallback_slide({}, {}, 5)
        assert "Слайд 5" in result
        assert "<!DOCTYPE html>" in result


class TestBuildIndexHtml:
    """Тесты для _build_index_html."""

    def test_returns_valid_html(self) -> None:
        slides = [
            GeneratedSlide(slide_number=1, filename="slide_01.html", layout_template_used="hero_title"),
            GeneratedSlide(slide_number=2, filename="slide_02.html", layout_template_used="title_content"),
        ]
        result = _build_index_html(slides, SAMPLE_DESIGN)
        assert "<!DOCTYPE html>" in result
        assert "slide_01.html" in result
        assert "slide_02.html" in result
        assert "presentation.html" in result

    def test_contains_slide_count(self) -> None:
        slides = [
            GeneratedSlide(slide_number=1, filename="slide_01.html", layout_template_used="hero_title"),
        ]
        result = _build_index_html(slides, SAMPLE_DESIGN)
        assert "Всего слайдов: 1" in result


class TestBuildPresentationHtml:
    """Тесты для _build_presentation_html."""

    def test_returns_valid_html(self) -> None:
        slide_htmls = {1: SAMPLE_HTML, 2: SAMPLE_HTML}
        result = _build_presentation_html(slide_htmls, SAMPLE_DESIGN)
        assert "<!DOCTYPE html>" in result
        assert "slide-1" in result
        assert "slide-2" in result

    def test_contains_navigation(self) -> None:
        result = _build_presentation_html({1: SAMPLE_HTML}, SAMPLE_DESIGN)
        assert "index.html" in result


# ---------------------------------------------------------------------------
# Тесты S4SlideGeneratorNode
# ---------------------------------------------------------------------------


class TestS4SlideGeneratorNode:
    """Тесты для S4SlideGeneratorNode."""

    def test_name(self) -> None:
        node = S4SlideGeneratorNode()
        assert node.name == "S4_SlideGenerator"

    @pytest.mark.asyncio()
    async def test_missing_s2_raises(self, store_no_s2: SharedStore) -> None:
        node = S4SlideGeneratorNode()
        with pytest.raises(RuntimeError, match="S2_NarrativeArchitect"):
            await node.execute(store_no_s2)

    @pytest.mark.asyncio()
    async def test_missing_s3_raises(self, store_no_s3: SharedStore) -> None:
        node = S4SlideGeneratorNode()
        with pytest.raises(RuntimeError, match="S3_DesignArchitect"):
            await node.execute(store_no_s3)

    @pytest.mark.asyncio()
    async def test_empty_narrative_raises(self, store_empty_narrative: SharedStore) -> None:
        node = S4SlideGeneratorNode()
        with pytest.raises(RuntimeError, match="narrative_structure"):
            await node.execute(store_empty_narrative)

    @pytest.mark.asyncio()
    async def test_successful_generation(self, store_with_s2_s3: SharedStore) -> None:
        """Тест успешной генерации с mock LLM."""
        with tempfile.TemporaryDirectory() as tmpdir:
            node = S4SlideGeneratorNode(output_dir=tmpdir)

            # Мокаем AsyncOpenAI
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = SAMPLE_HTML

            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

            with patch("tools.s4_slide_generator.AsyncOpenAI", return_value=mock_client):
                result = await node.execute(store_with_s2_s3)

            # Проверяем результат в store
            assert "S4_SlideGenerator" in result.results
            s4 = result.results["S4_SlideGenerator"]
            assert s4["total_slides"] == 2
            assert s4["generation_success"] is True
            assert len(s4["slides"]) == 2

            # Проверяем файлы на диске
            output_path = Path(tmpdir)
            assert (output_path / "slide_01.html").exists()
            assert (output_path / "slide_02.html").exists()
            assert (output_path / "index.html").exists()
            assert (output_path / "presentation.html").exists()

            # Проверяем артефакты
            assert len(result.artifacts) == 2
            assert result.artifacts[0].filename == "presentation.html"
            assert result.artifacts[1].filename == "index.html"

    @pytest.mark.asyncio()
    async def test_fallback_on_llm_error(self, store_with_s2_s3: SharedStore) -> None:
        """Тест fallback при ошибке LLM."""
        with tempfile.TemporaryDirectory() as tmpdir:
            node = S4SlideGeneratorNode(output_dir=tmpdir)

            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(side_effect=Exception("LLM error"))

            with patch("tools.s4_slide_generator.AsyncOpenAI", return_value=mock_client):
                result = await node.execute(store_with_s2_s3)

            # Генерация должна завершиться (fallback), но generation_success = False
            s4 = result.results["S4_SlideGenerator"]
            assert s4["generation_success"] is False
            assert s4["total_slides"] == 2

            # Fallback-слайды должны быть на диске
            output_path = Path(tmpdir)
            assert (output_path / "slide_01.html").exists()
            assert (output_path / "slide_02.html").exists()

            # Проверяем, что fallback содержит валидный HTML
            content = (output_path / "slide_01.html").read_text()
            assert "<!DOCTYPE html>" in content

    @pytest.mark.asyncio()
    async def test_empty_llm_response_triggers_fallback(self, store_with_s2_s3: SharedStore) -> None:
        """Тест fallback при пустом ответе LLM."""
        with tempfile.TemporaryDirectory() as tmpdir:
            node = S4SlideGeneratorNode(output_dir=tmpdir)

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = ""

            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

            with patch("tools.s4_slide_generator.AsyncOpenAI", return_value=mock_client):
                result = await node.execute(store_with_s2_s3)

            s4 = result.results["S4_SlideGenerator"]
            assert s4["generation_success"] is False

    @pytest.mark.asyncio()
    async def test_markdown_wrapped_html_cleaned(self, store_with_s2_s3: SharedStore) -> None:
        """Тест очистки markdown-обёрток из ответа LLM."""
        with tempfile.TemporaryDirectory() as tmpdir:
            node = S4SlideGeneratorNode(output_dir=tmpdir)

            wrapped_html = f"```html\n{SAMPLE_HTML}\n```"
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = wrapped_html

            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

            with patch("tools.s4_slide_generator.AsyncOpenAI", return_value=mock_client):
                result = await node.execute(store_with_s2_s3)

            s4 = result.results["S4_SlideGenerator"]
            assert s4["generation_success"] is True

            # Проверяем, что файл не содержит markdown-обёрток
            content = (Path(tmpdir) / "slide_01.html").read_text()
            assert "```" not in content
            assert "<!DOCTYPE html>" in content
