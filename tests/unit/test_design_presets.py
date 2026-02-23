"""Unit-тесты для валидации дизайн-пресетов.

Проверяют, что все JSON-файлы в data/presets/ соответствуют
ожидаемой схеме и могут быть загружены S3_DesignArchitect.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

# Путь к директории пресетов
PRESETS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "presets"

# Обязательные поля верхнего уровня
REQUIRED_TOP_LEVEL_KEYS = {
    "preset_id",
    "category",
    "description",
    "recommended_for",
    "layout_family",
    "color_variants",
    "typography",
    "spacing",
    "content_rules",
    "layout_templates",
}

# Обязательные поля цветовой палитры
REQUIRED_COLOR_KEYS = {
    "background",
    "text_primary",
    "text_secondary",
    "accent",
    "accent_secondary",
    "surface",
}

# Обязательные поля типографики
REQUIRED_TYPOGRAPHY_KEYS = {
    "font_family_heading",
    "font_family_body",
    "size_h1",
    "size_h2",
    "size_h3",
    "size_body",
    "size_caption",
    "line_height",
}

# Обязательные поля spacing
REQUIRED_SPACING_KEYS = {
    "unit",
    "whitespace_target",
    "slide_padding",
    "content_gap",
    "section_gap",
}

# Обязательные поля content_rules
REQUIRED_CONTENT_RULES_KEYS = {
    "bullet_style",
    "max_bullets_per_slide",
    "max_words_per_bullet",
    "max_words_title",
    "image_treatment",
}

# Обязательные поля recommended_for
REQUIRED_RECOMMENDED_FOR_KEYS = {
    "audiences",
    "purposes",
    "tones",
}

# Допустимые категории
VALID_CATEGORIES = {
    "Corporate & Professional",
    "Creative & Playful",
    "Minimal & Clean",
    "Luxury & Premium",
    "Technical & Data-Driven",
}

# Допустимые семейства макетов
VALID_LAYOUT_FAMILIES = {
    "corporate",
    "swiss",
    "mckinsey",
    "creative",
    "luxury",
    "tech",
    "data",
}

# HEX-паттерн
HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


def _load_all_presets() -> list[tuple[str, dict[str, Any]]]:
    """Загрузить все JSON-пресеты из директории."""
    presets: list[tuple[str, dict[str, Any]]] = []
    for path in sorted(PRESETS_DIR.glob("*.json")):
        with open(path) as f:
            data: dict[str, Any] = json.load(f)
        presets.append((path.stem, data))
    return presets


ALL_PRESETS = _load_all_presets()


class TestPresetsExist:
    """Проверяем, что пресеты существуют и их достаточно."""

    def test_presets_directory_exists(self) -> None:
        assert PRESETS_DIR.exists(), f"Директория {PRESETS_DIR} не найдена"

    def test_at_least_six_presets(self) -> None:
        """Должно быть минимум 6 пресетов (1 исходный + 5+ новых)."""
        preset_files = list(PRESETS_DIR.glob("*.json"))
        assert len(preset_files) >= 6, f"Ожидалось >= 6 пресетов, найдено {len(preset_files)}"

    def test_all_presets_are_valid_json(self) -> None:
        """Все файлы в data/presets/*.json должны быть валидным JSON."""
        for path in PRESETS_DIR.glob("*.json"):
            with open(path) as f:
                data = json.load(f)
            assert isinstance(data, dict), f"{path.name} не является JSON-объектом"


class TestPresetSchema:
    """Проверяем схему каждого пресета."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_all_required_top_level_keys(self, name: str, preset: dict[str, Any]) -> None:
        missing = REQUIRED_TOP_LEVEL_KEYS - set(preset.keys())
        assert not missing, f"Пресет {name}: отсутствуют ключи {missing}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_preset_id_matches_filename(self, name: str, preset: dict[str, Any]) -> None:
        assert preset["preset_id"] == name, f"preset_id '{preset['preset_id']}' != filename '{name}'"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_valid_category(self, name: str, preset: dict[str, Any]) -> None:
        assert (
            preset["category"] in VALID_CATEGORIES
        ), f"Пресет {name}: категория '{preset['category']}' не в {VALID_CATEGORIES}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_valid_layout_family(self, name: str, preset: dict[str, Any]) -> None:
        assert (
            preset["layout_family"] in VALID_LAYOUT_FAMILIES
        ), f"Пресет {name}: layout_family '{preset['layout_family']}' не в {VALID_LAYOUT_FAMILIES}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_description_not_empty(self, name: str, preset: dict[str, Any]) -> None:
        assert len(preset["description"]) >= 20, f"Пресет {name}: описание слишком короткое"


class TestPresetRecommendedFor:
    """Проверяем секцию recommended_for."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_required_keys(self, name: str, preset: dict[str, Any]) -> None:
        rec = preset["recommended_for"]
        missing = REQUIRED_RECOMMENDED_FOR_KEYS - set(rec.keys())
        assert not missing, f"Пресет {name} recommended_for: отсутствуют {missing}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_audiences_not_empty(self, name: str, preset: dict[str, Any]) -> None:
        assert len(preset["recommended_for"]["audiences"]) >= 1

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_purposes_not_empty(self, name: str, preset: dict[str, Any]) -> None:
        assert len(preset["recommended_for"]["purposes"]) >= 1

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_tones_not_empty(self, name: str, preset: dict[str, Any]) -> None:
        assert len(preset["recommended_for"]["tones"]) >= 1


class TestPresetColorVariants:
    """Проверяем цветовые варианты."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_at_least_two_variants(self, name: str, preset: dict[str, Any]) -> None:
        variants = preset["color_variants"]
        assert len(variants) >= 2, f"Пресет {name}: ожидалось >= 2 цветовых вариантов, найдено {len(variants)}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_all_variants_have_required_colors(self, name: str, preset: dict[str, Any]) -> None:
        import re

        for variant_name, colors in preset["color_variants"].items():
            missing = REQUIRED_COLOR_KEYS - set(colors.keys())
            assert not missing, f"Пресет {name}, вариант {variant_name}: отсутствуют {missing}"
            # Проверяем формат HEX
            for color_key in REQUIRED_COLOR_KEYS:
                value = colors[color_key]
                assert re.match(HEX_COLOR_PATTERN, value), (
                    f"Пресет {name}, вариант {variant_name}, {color_key}: " f"'{value}' не соответствует HEX-формату"
                )


class TestPresetTypography:
    """Проверяем типографику."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_required_keys(self, name: str, preset: dict[str, Any]) -> None:
        typo = preset["typography"]
        missing = REQUIRED_TYPOGRAPHY_KEYS - set(typo.keys())
        assert not missing, f"Пресет {name} typography: отсутствуют {missing}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_font_families_not_empty(self, name: str, preset: dict[str, Any]) -> None:
        typo = preset["typography"]
        assert len(typo["font_family_heading"]) >= 2
        assert len(typo["font_family_body"]) >= 2

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_sizes_are_px_strings(self, name: str, preset: dict[str, Any]) -> None:
        typo = preset["typography"]
        for key in ("size_h1", "size_h2", "size_h3", "size_body", "size_caption"):
            value = typo[key]
            assert value.endswith("px"), f"Пресет {name}, {key}: '{value}' должен заканчиваться на 'px'"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_line_height_is_reasonable(self, name: str, preset: dict[str, Any]) -> None:
        lh = preset["typography"]["line_height"]
        assert 1.0 <= lh <= 2.5, f"Пресет {name}: line_height {lh} вне диапазона [1.0, 2.5]"


class TestPresetSpacing:
    """Проверяем spacing."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_required_keys(self, name: str, preset: dict[str, Any]) -> None:
        sp = preset["spacing"]
        missing = REQUIRED_SPACING_KEYS - set(sp.keys())
        assert not missing, f"Пресет {name} spacing: отсутствуют {missing}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_unit_is_power_of_two_or_four(self, name: str, preset: dict[str, Any]) -> None:
        unit = preset["spacing"]["unit"]
        assert unit in (2, 4, 8, 16), f"Пресет {name}: spacing unit {unit} не в (2, 4, 8, 16)"


class TestPresetContentRules:
    """Проверяем content_rules."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_required_keys(self, name: str, preset: dict[str, Any]) -> None:
        cr = preset["content_rules"]
        missing = REQUIRED_CONTENT_RULES_KEYS - set(cr.keys())
        assert not missing, f"Пресет {name} content_rules: отсутствуют {missing}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_max_bullets_reasonable(self, name: str, preset: dict[str, Any]) -> None:
        mb = preset["content_rules"]["max_bullets_per_slide"]
        assert 2 <= mb <= 10, f"Пресет {name}: max_bullets {mb} вне [2, 10]"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_max_words_title_reasonable(self, name: str, preset: dict[str, Any]) -> None:
        mw = preset["content_rules"]["max_words_title"]
        assert 3 <= mw <= 15, f"Пресет {name}: max_words_title {mw} вне [3, 15]"


class TestPresetLayoutTemplates:
    """Проверяем layout_templates."""

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_has_hero_and_cta(self, name: str, preset: dict[str, Any]) -> None:
        lt = preset["layout_templates"]
        assert "hero_title" in lt, f"Пресет {name}: отсутствует hero_title"
        assert "cta" in lt, f"Пресет {name}: отсутствует cta"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_at_least_five_templates(self, name: str, preset: dict[str, Any]) -> None:
        lt = preset["layout_templates"]
        assert len(lt) >= 5, f"Пресет {name}: ожидалось >= 5 шаблонов, найдено {len(lt)}"

    @pytest.mark.parametrize("name,preset", ALL_PRESETS, ids=[p[0] for p in ALL_PRESETS])
    def test_template_names_match_family(self, name: str, preset: dict[str, Any]) -> None:
        """Имена шаблонов должны начинаться с префикса семейства."""
        family = preset["layout_family"]
        # Маппинг семейства на допустимые префиксы
        family_prefixes: dict[str, list[str]] = {
            "corporate": ["corp_"],
            "swiss": ["swiss_"],
            "mckinsey": ["mck_"],
            "creative": ["creative_"],
            "luxury": ["luxury_"],
            "tech": ["tech_"],
            "data": ["data_"],
        }
        valid_prefixes = family_prefixes.get(family, [])
        if not valid_prefixes:
            return  # Неизвестное семейство — пропускаем

        for content_type, template_name in preset["layout_templates"].items():
            matches = any(template_name.startswith(p) for p in valid_prefixes)
            assert matches, (
                f"Пресет {name}, {content_type}: шаблон '{template_name}' " f"не начинается с {valid_prefixes}"
            )


class TestLoadPresetFunction:
    """Проверяем, что _load_preset из s3_design_architect работает."""

    def test_load_existing_preset(self) -> None:
        from tools.s3_design_architect import _load_preset

        result = _load_preset("corporate_classic")
        assert result is not None
        assert result["preset_id"] == "corporate_classic"

    def test_load_nonexistent_preset(self) -> None:
        from tools.s3_design_architect import _load_preset

        result = _load_preset("nonexistent_preset_xyz")
        assert result is None

    def test_load_all_new_presets(self) -> None:
        from tools.s3_design_architect import _load_preset

        expected = [
            "swiss_minimalist",
            "tech_innovation",
            "elegant_premium",
            "consulting_classic",
            "playful_creative",
            "data_visualization",
            "dark_mode_code",
        ]
        for preset_name in expected:
            result = _load_preset(preset_name)
            assert result is not None, f"Не удалось загрузить пресет {preset_name}"
            assert result["preset_id"] == preset_name
