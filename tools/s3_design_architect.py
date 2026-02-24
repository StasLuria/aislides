"""S3_DesignArchitect — LLM-узел, создающий дизайн-систему презентации.

Реализация по ТЗ v3.0, §6 и technical_specification.md, §2.2.4.
Выбирает эстетическую дирекцию, определяет цветовую палитру,
типографику, систему отступов и маппинг слайдов на шаблоны макетов.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.tool_schemas import S3DesignResult

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# Путь к файлу пресетов (относительно корня проекта)
PRESETS_DIR = Path(__file__).resolve().parent.parent / "data" / "presets"

# ---------------------------------------------------------------------------
# Системный промпт для S3
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — дизайн-архитектор для AI-системы генерации презентаций.

## Твоя задача

На основе анализа контекста (S1) и нарративной структуры (S2) создать
полную дизайн-систему для презентации.

## Что нужно определить

1. **aesthetic_direction** — Эстетическая дирекция (одна из 13 пресетов).
2. **layout_family** — Семейство макетов.
3. **color_palette** — Цветовая палитра (все цвета в HEX #RRGGBB).
4. **typography** — Типографическая шкала.
5. **spacing_unit** — Базовая единица отступов (4px по умолчанию).
6. **slide_layouts** — Маппинг каждого слайда на конкретный шаблон макета.
7. **design_score** — Оценка качества дизайна (0.0-1.0).

## Эстетические дирекции и семейства макетов

### Corporate & Professional
- `corporate_classic` → layout_family: `corporate`
- `modern_bold` → layout_family: `corporate`
- `tech_innovation` → layout_family: `tech`

### Creative & Playful
- `playful_creative` → layout_family: `creative`
- `illustration_storytelling` → layout_family: `creative`

### Minimal & Clean
- `swiss_minimalist` → layout_family: `swiss`
- `scandinavian` → layout_family: `swiss`
- `neo_swiss` → layout_family: `swiss`

### Luxury & Premium
- `elegant_premium` → layout_family: `luxury`
- `luxury_cinematic` → layout_family: `luxury`

### Technical & Data-Driven
- `data_visualization` → layout_family: `data`
- `dark_mode_code` → layout_family: `tech`
- `consulting_classic` → layout_family: `mckinsey`
- `consulting_dense` → layout_family: `mckinsey`

## Правила выбора дирекции

- **Инвесторы, C-level:** `corporate_classic` или `consulting_classic`
- **Технические специалисты:** `tech_innovation` или `dark_mode_code`
- **Маркетинг, креатив:** `playful_creative` или `modern_bold`
- **Премиум-бренды:** `elegant_premium` или `luxury_cinematic`
- **Данные, аналитика:** `data_visualization` или `consulting_dense`
- **Минимализм, дизайн:** `swiss_minimalist` или `neo_swiss`

## Шаблоны макетов по семействам

### swiss
- `swiss_hero` — Титульный слайд
- `swiss_section` — Разделительный слайд
- `swiss_key_point` — Ключевой тезис
- `swiss_bullets` — Список пунктов
- `swiss_process` — Процесс
- `swiss_comparison` — Сравнение
- `swiss_quote` — Цитата
- `swiss_funnel` — Воронка
- `swiss_timeline` — Временная шкала
- `swiss_cta` — Призыв к действию

### corporate
- `corp_hero`, `corp_section`, `corp_key_point`, `corp_bullets`
- `corp_process`, `corp_comparison`, `corp_data_table`, `corp_chart`
- `corp_team`, `corp_cta`

### mckinsey
- `mck_hero`, `mck_section`, `mck_key_point`, `mck_bullets`
- `mck_process`, `mck_comparison`, `mck_data_table`, `mck_chart`
- `mck_cta`

### creative
- `creative_hero`, `creative_section`, `creative_key_point`
- `creative_bullets`, `creative_image_text`, `creative_quote`, `creative_cta`

### luxury
- `luxury_hero`, `luxury_section`, `luxury_key_point`
- `luxury_quote`, `luxury_image_text`, `luxury_cta`

### tech
- `tech_hero`, `tech_section`, `tech_key_point`, `tech_bullets`
- `tech_process`, `tech_chart`, `tech_cta`

### data
- `data_hero`, `data_section`, `data_table`, `data_chart`
- `data_comparison`, `data_bullets`, `data_cta`

## Маппинг content_type → layout_template

Для каждого слайда из S2 нужно сопоставить его `content_type` с конкретным
шаблоном макета из выбранного семейства. Например:
- `hero_title` → `{family}_hero`
- `section_header` → `{family}_section`
- `key_point` → `{family}_key_point`
- `bullet_list` → `{family}_bullets`
- `process_steps` → `{family}_process`
- `comparison` → `{family}_comparison`
- `data_table` → `{family}_data_table`
- `chart` → `{family}_chart`
- `quote` → `{family}_quote`
- `cta` → `{family}_cta`

## Правила для цветовой палитры

1. Все цвета ТОЛЬКО в формате HEX (#RRGGBB). CSS-переменные ЗАПРЕЩЕНЫ.
2. Контраст текста на фоне должен соответствовать WCAG AA (минимум 4.5:1).
3. Акцентный цвет должен выделяться на фоне.
4. Палитра должна соответствовать тональности и аудитории.

## Правила для типографики

1. Используй Google Fonts (доступны без установки).
2. Заголовки и основной текст — разные шрифты (или разные начертания).
3. Размеры должны обеспечивать читаемость на экране 1920x1080.

## design_score

- 1.0: Идеальная дизайн-система, все элементы согласованы.
- 0.85-0.99: Хорошая система с незначительными улучшениями.
- 0.70-0.84: Приемлемая, но есть проблемы с согласованностью.
- < 0.70: Требуется переработка.
"""


def _load_preset(preset_name: str) -> dict[str, object] | None:
    """Загрузить пресет из JSON-файла, если он существует."""
    preset_path = PRESETS_DIR / f"{preset_name}.json"
    if preset_path.exists():
        with open(preset_path) as f:
            result: dict[str, object] = json.load(f)
        return result
    return None


def _build_user_prompt(store: SharedStore) -> str:
    """Сформировать пользовательский промпт из контекста S1 и S2."""
    parts: list[str] = []

    # Результаты S1
    s1_result = store.results.get("S1_ContextAnalyzer", {})
    if s1_result:
        parts.append("## Контекст (S1)\n")
        parts.append(f"- **Аудитория:** {s1_result.get('audience', 'не определена')}")
        parts.append(f"- **Цель:** {s1_result.get('purpose', 'не определена')}")
        parts.append(f"- **Тип:** {s1_result.get('presentation_type', 'не определён')}")
        parts.append(f"- **Тональность:** {s1_result.get('tone', 'professional')}")
        parts.append(f"- **Количество слайдов:** {s1_result.get('slide_count', 10)}")

        preferred_theme = s1_result.get("preferred_theme")
        if preferred_theme:
            parts.append(f"- **Предпочтительный стиль:** {preferred_theme}")

    # Результаты S2
    s2_result = store.results.get("S2_NarrativeArchitect", {})
    if s2_result:
        parts.append("\n## Нарративная структура (S2)\n")
        parts.append(f"- **Фреймворк:** {s2_result.get('selected_framework', 'не определён')}")

        slides = s2_result.get("narrative_structure", [])
        if slides:
            parts.append(f"\n**Слайды ({len(slides)} шт.):**\n")
            for slide in slides:
                parts.append(
                    f"  {slide.get('slide_number', '?')}. "
                    f"[{slide.get('content_type', '?')}] "
                    f"{slide.get('title', '?')} "
                    f"({slide.get('narrative_beat', '?')})"
                )

    # Загружаем пресет, если preferred_theme указан
    if s1_result:
        preferred = s1_result.get("preferred_theme")
        if preferred:
            preset_data = _load_preset(preferred)
            if preset_data:
                parts.append(f"\n## Загруженный пресет: {preferred}\n")
                parts.append(f"```json\n{json.dumps(preset_data, indent=2, ensure_ascii=False)}\n```")

    return "\n".join(parts) if parts else "Создай дизайн-систему для презентации на 10 слайдов."


class S3DesignArchitectNode(BaseNode):
    """LLM-узел создания дизайн-системы.

    Определяет эстетическую дирекцию, цветовую палитру, типографику
    и маппинг слайдов на шаблоны макетов.

    Args:
        model: Имя модели LLM.
        max_retries: Максимальное количество повторных попыток Instructor.
        api_key: API-ключ (по умолчанию из env).
        base_url: Base URL для API (по умолчанию из env).
    """

    def __init__(
        self,
        model: str = "gemini-2.5-flash",
        max_retries: int = 3,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._model = model
        self._max_retries = max_retries
        self._api_key = api_key
        self._base_url = base_url

    @property
    def name(self) -> str:
        return "S3_DesignArchitect"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client, mode=instructor.Mode.JSON)

    async def execute(self, store: SharedStore) -> SharedStore:
        """Создать дизайн-систему для презентации.

        1. Извлекает контекст из S1 и структуру из S2.
        2. Вызывает LLM через Instructor с response_model=S3DesignResult.
        3. Записывает результат в store.results["S3_DesignArchitect"].

        Args:
            store: SharedStore с результатами S1 и S2.

        Returns:
            SharedStore с дизайн-системой.

        Raises:
            RuntimeError: Если результаты S1 отсутствуют или LLM не вернул валидный результат.
        """
        logger.info("[%s] S3_DesignArchitect: начало проектирования дизайна", store.project_id)

        # Проверяем наличие результатов S1
        if "S1_ContextAnalyzer" not in store.results:
            msg = "S3_DesignArchitect: результаты S1_ContextAnalyzer отсутствуют"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        user_prompt = _build_user_prompt(store)
        client = self._create_client()

        try:
            result: S3DesignResult = await client.chat.completions.create(
                model=self._model,
                response_model=S3DesignResult,
                max_retries=self._max_retries,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            msg = f"S3_DesignArchitect: LLM не вернул валидный результат: {exc}"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg) from exc

        # Записываем результат в SharedStore
        store.results["S3_DesignArchitect"] = result.model_dump()

        logger.info(
            "[%s] S3_DesignArchitect: дизайн-система создана " "(direction=%s, family=%s, score=%.2f)",
            store.project_id,
            result.aesthetic_direction,
            result.layout_family,
            result.design_score,
        )

        return store
