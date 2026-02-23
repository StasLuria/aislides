"""Pydantic-модели для результатов работы инструментальных узлов S1-S5.

Реализация по technical_specification.md, разделы 2.2.2-2.2.6.
Эти модели используются Instructor для гарантированного получения
валидированных структурированных данных от LLM.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# S1: Context Analyzer
# ---------------------------------------------------------------------------


class S1ContextResult(BaseModel):
    """Результат работы S1_ContextAnalyzerNode.

    Содержит структурированный анализ пользовательского запроса.
    """

    audience: str = Field(..., description="Целевая аудитория презентации")
    purpose: str = Field(..., description="Цель презентации")
    presentation_type: str = Field(..., description="Тип презентации (pitch, report, educational и т.д.)")
    duration: str = Field(default="10 минут", description="Ожидаемая длительность")
    tone: str = Field(default="professional", description="Тональность (professional, casual, inspirational и т.д.)")
    key_messages: list[str] = Field(default_factory=list, description="Ключевые сообщения для передачи")
    preferred_theme: str | None = Field(default=None, description="Предпочтительная тема/стиль дизайна")
    slide_count: int = Field(default=10, description="Рекомендуемое количество слайдов")
    content_mode: str = Field(default="auto", description="Режим контента: auto, detailed, concise")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Уверенность в полноте анализа (0.0-1.0)")
    clarification_questions: list[str] = Field(
        default_factory=list, description="Уточняющие вопросы (если confidence < 0.85)"
    )


# ---------------------------------------------------------------------------
# S2: Narrative Architect
# ---------------------------------------------------------------------------


class SlideBlueprint(BaseModel):
    """Описание одного слайда в нарративной структуре."""

    slide_number: int = Field(..., description="Порядковый номер слайда")
    title: str = Field(..., description="Заголовок слайда")
    content_type: str = Field(..., description="Тип контента (hero_title, process_steps, data_table, key_point и т.д.)")
    narrative_beat: str = Field(..., description="Нарративный бит (opening, build, climax, resolution, call_to_action)")
    key_message: str = Field(..., description="Ключевое сообщение слайда")
    speaker_notes: str = Field(default="", description="Заметки для спикера")


class S2NarrativeResult(BaseModel):
    """Результат работы S2_NarrativeArchitectNode.

    Содержит полную нарративную структуру презентации.
    """

    selected_framework: str = Field(..., description="Выбранный нарративный фреймворк")
    framework_rationale: str = Field(..., description="Обоснование выбора фреймворка")
    narrative_structure: list[SlideBlueprint] = Field(..., description="Структура слайдов")
    narrative_score: float = Field(..., ge=0.0, le=1.0, description="Оценка качества нарратива (0.0-1.0)")


# ---------------------------------------------------------------------------
# S3: Design Architect
# ---------------------------------------------------------------------------


class ColorPalette(BaseModel):
    """Цветовая палитра дизайн-системы. Все цвета в HEX (#RRGGBB)."""

    background: str = Field(..., description="Основной цвет фона", pattern=r"^#[0-9A-Fa-f]{6}$")
    text_primary: str = Field(..., description="Основной цвет текста", pattern=r"^#[0-9A-Fa-f]{6}$")
    text_secondary: str = Field(..., description="Вторичный цвет текста", pattern=r"^#[0-9A-Fa-f]{6}$")
    accent: str = Field(..., description="Акцентный цвет", pattern=r"^#[0-9A-Fa-f]{6}$")
    accent_secondary: str = Field(..., description="Вторичный акцентный цвет", pattern=r"^#[0-9A-Fa-f]{6}$")
    surface: str = Field(..., description="Цвет поверхностей (карточки, блоки)", pattern=r"^#[0-9A-Fa-f]{6}$")


class TypographyScale(BaseModel):
    """Типографическая шкала."""

    font_family_heading: str = Field(..., description="Шрифт для заголовков")
    font_family_body: str = Field(..., description="Шрифт для основного текста")
    size_h1: str = Field(default="48px", description="Размер H1")
    size_h2: str = Field(default="36px", description="Размер H2")
    size_h3: str = Field(default="28px", description="Размер H3")
    size_body: str = Field(default="18px", description="Размер основного текста")
    size_caption: str = Field(default="14px", description="Размер подписей")
    line_height: float = Field(default=1.5, description="Межстрочный интервал")


class SlideLayoutMapping(BaseModel):
    """Маппинг слайда на конкретный шаблон макета."""

    slide_number: int
    content_type: str = Field(..., description="Тип контента из S2")
    layout_template: str = Field(..., description="Шаблон макета (например, swiss_hero, swiss_funnel)")


class S3DesignResult(BaseModel):
    """Результат работы S3_DesignArchitectNode.

    Содержит полную дизайн-систему для презентации.
    """

    aesthetic_direction: str = Field(
        ..., description="Эстетическая дирекция (corporate_classic, tech_innovation, neo_swiss и т.д.)"
    )
    layout_family: str = Field(..., description="Семейство макетов (swiss, corporate, mckinsey)")
    color_palette: ColorPalette
    typography: TypographyScale
    spacing_unit: int = Field(default=4, description="Базовая единица отступов (px)")
    slide_layouts: list[SlideLayoutMapping] = Field(..., description="Маппинг слайдов на шаблоны макетов")
    design_score: float = Field(..., ge=0.0, le=1.0, description="Оценка качества дизайна (0.0-1.0)")


# ---------------------------------------------------------------------------
# S4: Slide Generator
# ---------------------------------------------------------------------------


class GeneratedSlide(BaseModel):
    """Метаданные одного сгенерированного слайда."""

    slide_number: int
    filename: str = Field(..., description="Имя файла (например, slide_01.html)")
    layout_template_used: str = Field(..., description="Использованный шаблон макета")
    generation_success: bool = Field(default=True)


class S4GenerationResult(BaseModel):
    """Результат работы S4_SlideGeneratorNode.

    Содержит отчёт о генерации HTML-слайдов.
    """

    slides: list[GeneratedSlide] = Field(..., description="Список сгенерированных слайдов")
    index_html_path: str = Field(..., description="Путь к index.html")
    presentation_html_path: str = Field(..., description="Путь к presentation.html")
    total_slides: int = Field(..., description="Общее количество слайдов")
    generation_success: bool = Field(default=True, description="Успешность генерации")


# ---------------------------------------------------------------------------
# S5: Quality Validator
# ---------------------------------------------------------------------------


class QualityDimension(BaseModel):
    """Оценка по одному измерению качества."""

    dimension: str = Field(..., description="Название измерения (narrative, design, content, technical)")
    score: float = Field(..., ge=0.0, le=1.0, description="Оценка (0.0-1.0)")
    issues: list[str] = Field(default_factory=list, description="Найденные проблемы")
    recommendations: list[str] = Field(default_factory=list, description="Рекомендации")


class S5QualityResult(BaseModel):
    """Результат работы S5_QualityValidatorNode.

    Содержит детальный отчёт о качестве презентации.
    """

    dimensions: list[QualityDimension] = Field(..., description="Оценки по 4 измерениям")
    overall_quality_score: float = Field(..., ge=0.0, le=1.0, description="Итоговая оценка качества (0.0-1.0)")
    blocking_issues: list[str] = Field(default_factory=list, description="Блокирующие проблемы")
    warnings: list[str] = Field(default_factory=list, description="Предупреждения")
    passed: bool = Field(..., description="Пройдены ли врата качества (overall >= 0.85)")
