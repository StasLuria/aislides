"""Tests for layout template files.

Validates that all layout families have proper MD files with HTML templates.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LAYOUTS_DIR = Path(__file__).resolve().parents[2] / "data" / "layouts"

# All layout families defined in S3 design architect
EXPECTED_FAMILIES = {
    "corporate",
    "swiss",
    "tech",
    "luxury",
    "creative",
    "data",
    "mckinsey",
}

# Mapping: family → expected file name
FAMILY_TO_FILE = {family: f"{family}_layouts.md" for family in EXPECTED_FAMILIES}

# Minimum number of layout templates per family
MIN_LAYOUTS_PER_FAMILY = 5


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def layout_files() -> dict[str, Path]:
    """Return mapping of family name to layout file path."""
    return {family: LAYOUTS_DIR / filename for family, filename in FAMILY_TO_FILE.items()}


@pytest.fixture(scope="module")
def layout_contents(layout_files: dict[str, Path]) -> dict[str, str]:
    """Return mapping of family name to file content."""
    result: dict[str, str] = {}
    for family, path in layout_files.items():
        if path.exists():
            result[family] = path.read_text(encoding="utf-8")
    return result


# ---------------------------------------------------------------------------
# Tests: File existence
# ---------------------------------------------------------------------------


class TestLayoutFilesExist:
    """Verify that all expected layout files exist."""

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_layout_file_exists(self, family: str) -> None:
        """Each layout family must have a corresponding MD file."""
        filepath = LAYOUTS_DIR / f"{family}_layouts.md"
        assert filepath.exists(), f"Layout file for family '{family}' not found: {filepath}"

    def test_layouts_directory_exists(self) -> None:
        """The layouts directory must exist."""
        assert LAYOUTS_DIR.is_dir(), f"Layouts directory not found: {LAYOUTS_DIR}"

    def test_all_families_covered(self) -> None:
        """All 7 layout families must have files."""
        existing = {p.stem.replace("_layouts", "") for p in LAYOUTS_DIR.glob("*_layouts.md")}
        missing = EXPECTED_FAMILIES - existing
        assert not missing, f"Missing layout files for families: {missing}"


# ---------------------------------------------------------------------------
# Tests: File structure and content
# ---------------------------------------------------------------------------


class TestLayoutFileStructure:
    """Verify that layout files have proper structure."""

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_file_has_title(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each layout file must start with a title."""
        content = layout_contents.get(family, "")
        assert content, f"Layout file for '{family}' is empty or missing"
        assert content.strip().startswith("#"), f"Layout file for '{family}' must start with a Markdown heading"

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_file_has_html_templates(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each layout file must contain HTML code blocks."""
        content = layout_contents.get(family, "")
        html_blocks = re.findall(r"```html\n(.*?)```", content, re.DOTALL)
        assert len(html_blocks) >= MIN_LAYOUTS_PER_FAMILY, (
            f"Layout file for '{family}' must have at least "
            f"{MIN_LAYOUTS_PER_FAMILY} HTML templates, "
            f"found {len(html_blocks)}"
        )

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_html_templates_have_slide_dimensions(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each HTML template must define 1280x720 slide dimensions."""
        content = layout_contents.get(family, "")
        html_blocks = re.findall(r"```html\n(.*?)```", content, re.DOTALL)
        for i, block in enumerate(html_blocks):
            assert "1280px" in block, f"Template {i + 1} in '{family}' missing width:1280px"
            assert "720px" in block, f"Template {i + 1} in '{family}' missing height:720px"

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_html_templates_use_inline_styles(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each HTML template must use inline styles."""
        content = layout_contents.get(family, "")
        html_blocks = re.findall(r"```html\n(.*?)```", content, re.DOTALL)
        for i, block in enumerate(html_blocks):
            assert 'style="' in block, f"Template {i + 1} in '{family}' must use inline styles"

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_file_has_placeholders_section(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each layout file must document color/font placeholders."""
        content = layout_contents.get(family, "")
        assert "[bg]" in content, f"Layout file for '{family}' must document [bg] placeholder"
        assert "[text]" in content, f"Layout file for '{family}' must document [text] placeholder"
        assert "[accent]" in content, f"Layout file for '{family}' must document [accent] placeholder"
        assert "[h_font]" in content, f"Layout file for '{family}' must document [h_font] placeholder"

    @pytest.mark.parametrize("family", sorted(EXPECTED_FAMILIES))
    def test_file_has_layout_names(self, family: str, layout_contents: dict[str, str]) -> None:
        """Each layout file must have named layout sections (## Layout:)."""
        content = layout_contents.get(family, "")
        layout_sections = re.findall(r"^## Layout:", content, re.MULTILINE)
        assert len(layout_sections) >= MIN_LAYOUTS_PER_FAMILY, (
            f"Layout file for '{family}' must have at least "
            f"{MIN_LAYOUTS_PER_FAMILY} named layouts, "
            f"found {len(layout_sections)}"
        )


# ---------------------------------------------------------------------------
# Tests: Cross-family consistency
# ---------------------------------------------------------------------------


class TestLayoutConsistency:
    """Verify consistency across all layout families."""

    def test_all_families_have_hero_layout(self, layout_contents: dict[str, str]) -> None:
        """Every family must have a hero/title layout."""
        for family, content in layout_contents.items():
            assert re.search(r"hero|title", content, re.IGNORECASE), f"Family '{family}' must have a hero/title layout"

    def test_all_families_have_cta_layout(self, layout_contents: dict[str, str]) -> None:
        """Every family must have a CTA/closing layout."""
        for family, content in layout_contents.items():
            assert re.search(
                r"cta|closing|final", content, re.IGNORECASE
            ), f"Family '{family}' must have a CTA/closing layout"

    def test_total_layout_count(self, layout_contents: dict[str, str]) -> None:
        """Total layouts across all families must be 10+."""
        total = 0
        for content in layout_contents.values():
            html_blocks = re.findall(r"```html\n(.*?)```", content, re.DOTALL)
            total += len(html_blocks)
        assert total >= 10, f"Total layout templates must be at least 10, found {total}"

    def test_no_duplicate_layout_names_within_family(self, layout_contents: dict[str, str]) -> None:
        """Layout names within a family must be unique."""
        for family, content in layout_contents.items():
            names = re.findall(r"^## Layout:\s*(.+)$", content, re.MULTILINE)
            unique_names = set(names)
            assert len(names) == len(unique_names), (
                f"Family '{family}' has duplicate layout names: " f"{[n for n in names if names.count(n) > 1]}"
            )
