"""Unit-тесты для ExportService — экспорт в PDF и PPTX.

Тестирует:
- export_pdf: генерация PDF из HTML-артефактов.
- export_pptx: генерация PPTX из HTML-артефактов.
- Обработку ошибок при отсутствии артефактов.
- Извлечение текстовых блоков из HTML.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from backend.app.services.export_service import (
    _extract_text_blocks,
    _strip_html_tags,
    export_pdf,
    export_pptx,
)


def _make_artifact(
    content: str,
    file_type: str = "html",
    filename: str = "slide.html",
) -> MagicMock:
    """Создать мок артефакта."""
    artifact = MagicMock()
    artifact.content = content
    artifact.file_type = file_type
    artifact.filename = filename
    return artifact


# --- Вспомогательные функции ---


class TestExtractTextBlocks:
    """Тесты для _extract_text_blocks."""

    def test_extracts_headings(self) -> None:
        """Извлекает заголовки H1-H4."""
        html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>"
        blocks = _extract_text_blocks(html)
        tags = [b["tag"] for b in blocks]
        assert "h1" in tags
        assert "h2" in tags
        assert "h3" in tags

    def test_extracts_paragraphs(self) -> None:
        """Извлекает параграфы."""
        html = "<p>First paragraph</p><p>Second paragraph</p>"
        blocks = _extract_text_blocks(html)
        assert len(blocks) >= 2
        texts = [b["text"] for b in blocks]
        assert "First paragraph" in texts
        assert "Second paragraph" in texts

    def test_extracts_list_items(self) -> None:
        """Извлекает элементы списка."""
        html = "<ul><li>Item one</li><li>Item two</li></ul>"
        blocks = _extract_text_blocks(html)
        li_blocks = [b for b in blocks if b["tag"] == "li"]
        assert len(li_blocks) >= 2

    def test_empty_html(self) -> None:
        """Пустой HTML возвращает пустой список."""
        blocks = _extract_text_blocks("")
        assert blocks == []

    def test_skips_short_text(self) -> None:
        """Пропускает текст длиной 1 символ."""
        html = "<p>A</p><p>Long enough text</p>"
        blocks = _extract_text_blocks(html)
        texts = [b["text"] for b in blocks]
        assert "A" not in texts
        assert "Long enough text" in texts

    def test_no_duplicate_nested(self) -> None:
        """Не дублирует вложенные элементы с одинаковым текстом."""
        html = "<div><p>Same text</p></div>"
        blocks = _extract_text_blocks(html)
        same_blocks = [b for b in blocks if b["text"] == "Same text"]
        assert len(same_blocks) == 1


class TestStripHtmlTags:
    """Тесты для _strip_html_tags."""

    def test_strips_tags(self) -> None:
        """Удаляет HTML-теги."""
        assert _strip_html_tags("<p>Hello <b>World</b></p>") == "Hello World"

    def test_empty_string(self) -> None:
        """Пустая строка."""
        assert _strip_html_tags("") == ""

    def test_no_tags(self) -> None:
        """Строка без тегов."""
        assert _strip_html_tags("Plain text") == "Plain text"


# --- PDF Export ---


class TestExportPdf:
    """Тесты для export_pdf."""

    def test_generates_pdf_bytes(self) -> None:
        """Генерирует PDF из HTML-артефактов."""
        artifacts = [
            _make_artifact("<h1>Slide 1</h1><p>Content</p>"),
            _make_artifact("<h1>Slide 2</h1><p>More content</p>"),
        ]
        result = export_pdf(artifacts)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # PDF начинается с %PDF
        assert result[:4] == b"%PDF"

    def test_single_slide(self) -> None:
        """Генерирует PDF из одного слайда."""
        artifacts = [_make_artifact("<h1>Only Slide</h1>")]
        result = export_pdf(artifacts)
        assert result[:4] == b"%PDF"

    def test_raises_on_empty_artifacts(self) -> None:
        """Бросает ValueError при пустом списке."""
        with pytest.raises(ValueError, match="Нет HTML-артефактов"):
            export_pdf([])

    def test_raises_on_non_html_artifacts(self) -> None:
        """Бросает ValueError если нет HTML-артефактов."""
        artifacts = [_make_artifact("some content", file_type="json")]
        with pytest.raises(ValueError, match="Нет HTML-артефактов"):
            export_pdf(artifacts)

    def test_skips_non_html_artifacts(self) -> None:
        """Пропускает не-HTML артефакты."""
        artifacts = [
            _make_artifact("<h1>HTML Slide</h1>", file_type="html"),
            _make_artifact('{"key": "value"}', file_type="json"),
        ]
        result = export_pdf(artifacts)
        assert result[:4] == b"%PDF"

    def test_skips_artifacts_without_content(self) -> None:
        """Пропускает артефакты без контента."""
        artifacts = [
            _make_artifact("<h1>Has content</h1>"),
            _make_artifact(None, file_type="html"),  # type: ignore[arg-type]
        ]
        result = export_pdf(artifacts)
        assert result[:4] == b"%PDF"


# --- PPTX Export ---


class TestExportPptx:
    """Тесты для export_pptx."""

    def test_generates_pptx_bytes(self) -> None:
        """Генерирует PPTX из HTML-артефактов."""
        artifacts = [
            _make_artifact("<h1>Slide 1</h1><p>Content</p>"),
            _make_artifact("<h1>Slide 2</h1><ul><li>Item 1</li><li>Item 2</li></ul>"),
        ]
        result = export_pptx(artifacts)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # PPTX (ZIP) начинается с PK
        assert result[:2] == b"PK"

    def test_single_slide(self) -> None:
        """Генерирует PPTX из одного слайда."""
        artifacts = [_make_artifact("<h1>Only Slide</h1><p>Content here</p>")]
        result = export_pptx(artifacts)
        assert result[:2] == b"PK"

    def test_raises_on_empty_artifacts(self) -> None:
        """Бросает ValueError при пустом списке."""
        with pytest.raises(ValueError, match="Нет HTML-артефактов"):
            export_pptx([])

    def test_raises_on_non_html_artifacts(self) -> None:
        """Бросает ValueError если нет HTML-артефактов."""
        artifacts = [_make_artifact("some content", file_type="md")]
        with pytest.raises(ValueError, match="Нет HTML-артефактов"):
            export_pptx(artifacts)

    def test_plain_text_fallback(self) -> None:
        """Использует plain text если нет структурных элементов."""
        artifacts = [_make_artifact("Just plain text without tags")]
        # file_type=html но контент без тегов — должен извлечь текст
        result = export_pptx(artifacts)
        assert result[:2] == b"PK"

    def test_complex_html(self) -> None:
        """Обрабатывает сложный HTML с вложенными элементами."""
        html = """
        <div class="slide">
            <h1>Main Title</h1>
            <h3>Subtitle</h3>
            <p>Introduction paragraph with <strong>bold</strong> text.</p>
            <ul>
                <li>First point with details</li>
                <li>Second point with more info</li>
                <li>Third point conclusion</li>
            </ul>
            <p>Closing remarks for the slide.</p>
        </div>
        """
        artifacts = [_make_artifact(html)]
        result = export_pptx(artifacts)
        assert result[:2] == b"PK"


# --- Export Router (integration-style) ---


class TestExportRouterHelpers:
    """Тесты для вспомогательных функций."""

    def test_mixed_artifacts_pdf(self) -> None:
        """PDF из смешанных артефактов (HTML + другие)."""
        artifacts = [
            _make_artifact("<h1>Slide</h1>", file_type="html"),
            _make_artifact("# Markdown", file_type="md"),
            _make_artifact("<h2>Another</h2>", file_type="html"),
        ]
        result = export_pdf(artifacts)
        assert result[:4] == b"%PDF"

    def test_mixed_artifacts_pptx(self) -> None:
        """PPTX из смешанных артефактов (HTML + другие)."""
        artifacts = [
            _make_artifact("<h1>Slide</h1>", file_type="html"),
            _make_artifact("# Markdown", file_type="md"),
            _make_artifact("<h2>Another</h2>", file_type="html"),
        ]
        result = export_pptx(artifacts)
        assert result[:2] == b"PK"
