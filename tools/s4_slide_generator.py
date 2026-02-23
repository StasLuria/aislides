"""S4_SlideGenerator — LLM-узел, генерирующий HTML-слайды.

Реализация по ТЗ v3.0, §6 и technical_specification.md, §2.2.5.
Читает нарратив (S2) и дизайн-систему (S3) из SharedStore,
генерирует HTML-файлы слайдов с инлайновыми CSS-стилями,
создаёт index.html и presentation.html.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.tool_schemas import GeneratedSlide, S4GenerationResult

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Системный промпт для S4
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — генератор HTML-слайдов для AI-системы создания презентаций.

## Твоя задача

Сгенерировать HTML-код одного слайда презентации на основе:
1. Нарративной структуры (из S2) — заголовок, контент, тип слайда.
2. Дизайн-системы (из S3) — цвета, шрифты, отступы, макет.
3. Шаблона макета (layout_template) — определяет визуальную структуру.

## Правила генерации HTML

1. **Инлайновые стили:** Все CSS-стили ДОЛЖНЫ быть инлайновыми (атрибут `style`).
   НЕ используй `<style>` блоки, CSS-переменные или внешние файлы.
2. **Размер слайда:** Каждый слайд — `<div>` с фиксированными размерами
   `width: 1280px; height: 720px` (16:9).
3. **Цвета:** Используй ТОЛЬКО HEX-коды из предоставленной палитры.
4. **Шрифты:** Используй Google Fonts, указанные в дизайн-системе.
   Подключай через `<link>` в `<head>`.
5. **Отступы:** Соблюдай spacing_unit из дизайн-системы.
6. **Контент:** Размещай контент согласно layout_template.
7. **Качество:** HTML должен быть валидным, семантичным и доступным.
8. **Кодировка:** UTF-8, lang="ru".

## Формат вывода

Верни ПОЛНЫЙ HTML-документ для одного слайда, включая <!DOCTYPE html>,
<html>, <head> (с meta charset, Google Fonts link), <body>.

## Типы макетов

- **hero_title**: Крупный заголовок по центру, подзаголовок.
- **title_content**: Заголовок сверху, контент ниже.
- **two_column**: Две колонки с контентом.
- **key_point**: Акцентное сообщение крупным шрифтом.
- **process_steps**: Шаги процесса (горизонтально или вертикально).
- **data_table**: Таблица с данными.
- **quote**: Цитата с автором.
- **image_text**: Изображение + текст.
- **closing**: Финальный слайд (спасибо, контакты, CTA).
- **section_divider**: Разделитель секций.

## Важно

- Каждый слайд должен быть САМОДОСТАТОЧНЫМ HTML-документом.
- НЕ используй JavaScript.
- НЕ используй CSS-переменные (var(--...)).
- Все стили — только инлайновые.
"""


def _build_slide_prompt(
    slide_blueprint: dict[str, Any],
    design: dict[str, Any],
    slide_number: int,
    total_slides: int,
) -> str:
    """Сформировать промпт для генерации одного слайда."""
    parts: list[str] = []

    parts.append(f"## Слайд {slide_number} из {total_slides}")
    parts.append(
        f"### Нарративная структура\n```json\n{json.dumps(slide_blueprint, ensure_ascii=False, indent=2)}\n```"
    )

    # Дизайн-система
    palette = design.get("color_palette", {})
    typography = design.get("typography", {})
    layout_family = design.get("layout_family", "corporate")
    spacing = design.get("spacing_unit", 4)

    parts.append("### Дизайн-система")
    parts.append(f"- **Семейство макетов:** {layout_family}")
    parts.append(f"- **Цветовая палитра:**\n```json\n{json.dumps(palette, ensure_ascii=False, indent=2)}\n```")
    parts.append(f"- **Типографика:**\n```json\n{json.dumps(typography, ensure_ascii=False, indent=2)}\n```")
    parts.append(f"- **Базовый отступ:** {spacing}px")

    # Маппинг макета
    slide_layouts = design.get("slide_layouts", [])
    layout_template = "title_content"  # дефолт
    for mapping in slide_layouts:
        if mapping.get("slide_number") == slide_number:
            layout_template = mapping.get("layout_template", "title_content")
            break

    parts.append(f"- **Шаблон макета:** {layout_template}")

    parts.append(
        "\n### Инструкция\n\nСгенерируй ПОЛНЫЙ HTML-документ для этого слайда. "
        "Все стили — инлайновые. Размер: 1280x720px."
    )

    return "\n\n".join(parts)


def _build_index_html(slides: list[GeneratedSlide], design: dict[str, Any]) -> str:
    """Создать index.html для навигации по слайдам."""
    palette = design.get("color_palette", {})
    bg = palette.get("background", "#FFFFFF")
    text = palette.get("text_primary", "#1A1A2E")
    accent = palette.get("accent", "#0066CC")
    typography = design.get("typography", {})
    font_heading = typography.get("font_family_heading", "Inter")
    font_body = typography.get("font_family_body", "Inter")

    slide_links = []
    for slide in slides:
        slide_links.append(
            f'    <a href="{slide.filename}" '
            f'style="display:block;padding:12px 24px;margin:8px 0;'
            f"background:{accent};color:#FFFFFF;text-decoration:none;"
            f"border-radius:8px;font-family:'{font_body}',sans-serif;"
            f'font-size:16px;">'
            f"Слайд {slide.slide_number}: {slide.layout_template_used}"
            f"</a>"
        )

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Презентация — Навигация</title>
    <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@400;700&family={font_body.replace(' ', '+')}:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:40px;background:{bg};color:{text};font-family:'{font_body}',sans-serif;">
    <h1 style="font-family:'{font_heading}',sans-serif;font-size:36px;margin-bottom:24px;">
        Навигация по презентации
    </h1>
    <p style="font-size:18px;margin-bottom:32px;">Всего слайдов: {len(slides)}</p>
    <nav>
{chr(10).join(slide_links)}
    </nav>
    <div style="margin-top:32px;">
        <a href="presentation.html"
           style="display:inline-block;padding:16px 32px;background:{text};color:{bg};
                  text-decoration:none;border-radius:8px;font-size:18px;font-weight:600;">
            Открыть полную презентацию
        </a>
    </div>
</body>
</html>"""


def _build_presentation_html(
    slide_htmls: dict[int, str],
    design: dict[str, Any],
) -> str:
    """Создать presentation.html — все слайды в одном файле с навигацией."""
    palette = design.get("color_palette", {})
    bg = palette.get("background", "#FFFFFF")
    text = palette.get("text_primary", "#1A1A2E")
    typography = design.get("typography", {})
    font_body = typography.get("font_family_body", "Inter")

    # Извлекаем <body> содержимое из каждого слайда
    slide_sections = []
    for num in sorted(slide_htmls.keys()):
        html = slide_htmls[num]
        # Оборачиваем каждый слайд в section
        slide_sections.append(
            f'    <section id="slide-{num}" style="margin-bottom:40px;">\n'
            f'      <div style="width:1280px;height:720px;overflow:hidden;'
            f'border:1px solid #E0E0E0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">\n'
            f'        <iframe srcdoc="{_escape_for_srcdoc(html)}" '
            f'width="1280" height="720" style="border:none;"></iframe>\n'
            f"      </div>\n"
            f"    </section>"
        )

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Презентация</title>
</head>
<body style="margin:0;padding:40px;background:{bg};color:{text};
             font-family:'{font_body}',sans-serif;
             display:flex;flex-direction:column;align-items:center;">
    <h1 style="font-size:24px;margin-bottom:32px;">Презентация</h1>
{chr(10).join(slide_sections)}
    <nav style="position:fixed;bottom:20px;right:20px;background:{text};
                color:{bg};padding:12px 20px;border-radius:8px;font-size:14px;">
        <a href="index.html" style="color:{bg};text-decoration:none;">← К навигации</a>
    </nav>
</body>
</html>"""


def _escape_for_srcdoc(html: str) -> str:
    """Экранировать HTML для использования в атрибуте srcdoc."""
    return html.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


class S4SlideGeneratorNode(BaseNode):
    """LLM-узел генерации HTML-слайдов.

    Для каждого слайда из нарративной структуры (S2) генерирует
    HTML-файл с инлайновыми CSS-стилями на основе дизайн-системы (S3).

    Args:
        model: Имя модели LLM.
        max_retries: Максимальное количество повторных попыток Instructor.
        api_key: API-ключ (по умолчанию из env).
        base_url: Base URL для API (по умолчанию из env).
        output_dir: Директория для сохранения HTML-файлов.
    """

    def __init__(
        self,
        model: str = "gemini-2.5-flash",
        max_retries: int = 3,
        api_key: str | None = None,
        base_url: str | None = None,
        output_dir: str | None = None,
    ) -> None:
        self._model = model
        self._max_retries = max_retries
        self._api_key = api_key
        self._base_url = base_url
        self._output_dir = output_dir or os.path.join("output", "slides")

    @property
    def name(self) -> str:
        return "S4_SlideGenerator"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client)

    async def _generate_single_slide(
        self,
        client: instructor.AsyncInstructor,
        slide_blueprint: dict[str, Any],
        design: dict[str, Any],
        slide_number: int,
        total_slides: int,
    ) -> tuple[str, bool]:
        """Сгенерировать HTML для одного слайда.

        Returns:
            Кортеж (html_content, success).
        """
        user_prompt = _build_slide_prompt(
            slide_blueprint=slide_blueprint,
            design=design,
            slide_number=slide_number,
            total_slides=total_slides,
        )

        try:
            # Для генерации HTML используем обычный completion (не structured output),
            # так как нам нужен свободный HTML-текст, а не JSON.
            raw_client = AsyncOpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
            response = await raw_client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
            )

            html_content = response.choices[0].message.content or ""

            # Очищаем от markdown-обёрток, если LLM добавил ```html ... ```
            html_content = _clean_html_response(html_content)

            if not html_content.strip():
                logger.error(
                    "S4_SlideGenerator: пустой ответ для слайда %d",
                    slide_number,
                )
                return _generate_fallback_slide(slide_blueprint, design, slide_number), False

            return html_content, True

        except Exception as exc:
            logger.error(
                "S4_SlideGenerator: ошибка генерации слайда %d: %s",
                slide_number,
                exc,
            )
            return _generate_fallback_slide(slide_blueprint, design, slide_number), False

    async def execute(self, store: SharedStore) -> SharedStore:
        """Сгенерировать HTML-слайды для всей презентации.

        1. Читает S2 (нарратив) и S3 (дизайн) из store.results.
        2. Для каждого слайда генерирует HTML через LLM.
        3. Создаёт index.html и presentation.html.
        4. Сохраняет файлы на диск.
        5. Записывает S4GenerationResult в store.results.

        Args:
            store: Текущее состояние SharedStore.

        Returns:
            SharedStore с результатами генерации.

        Raises:
            RuntimeError: Если S2 или S3 отсутствуют в store.results.
        """
        logger.info("[%s] S4_SlideGenerator: начало генерации", store.project_id)

        # Проверяем наличие S2 и S3
        s2_result = store.results.get("S2_NarrativeArchitect")
        s3_result = store.results.get("S3_DesignArchitect")

        if not s2_result:
            msg = "S4_SlideGenerator: отсутствует результат S2_NarrativeArchitect"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        if not s3_result:
            msg = "S4_SlideGenerator: отсутствует результат S3_DesignArchitect"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        # Извлекаем данные
        narrative_structure = s2_result.get("narrative_structure", [])
        design = s3_result

        if not narrative_structure:
            msg = "S4_SlideGenerator: narrative_structure пуст"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        total_slides = len(narrative_structure)

        # Создаём директорию для выходных файлов
        output_path = Path(self._output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Генерируем слайды
        client = self._create_client()
        generated_slides: list[GeneratedSlide] = []
        slide_htmls: dict[int, str] = {}

        for idx, blueprint in enumerate(narrative_structure, start=1):
            logger.info(
                "[%s] S4_SlideGenerator: генерация слайда %d/%d",
                store.project_id,
                idx,
                total_slides,
            )

            html_content, success = await self._generate_single_slide(
                client=client,
                slide_blueprint=blueprint,
                design=design,
                slide_number=idx,
                total_slides=total_slides,
            )

            # Определяем layout_template
            layout_template = blueprint.get("content_type", "title_content")
            slide_layouts = design.get("slide_layouts", [])
            for mapping in slide_layouts:
                if mapping.get("slide_number") == idx:
                    layout_template = mapping.get("layout_template", layout_template)
                    break

            filename = f"slide_{idx:02d}.html"

            # Сохраняем файл
            slide_path = output_path / filename
            slide_path.write_text(html_content, encoding="utf-8")

            generated_slides.append(
                GeneratedSlide(
                    slide_number=idx,
                    filename=filename,
                    layout_template_used=layout_template,
                    generation_success=success,
                )
            )
            slide_htmls[idx] = html_content

        # Создаём index.html
        index_html = _build_index_html(generated_slides, design)
        index_path = output_path / "index.html"
        index_path.write_text(index_html, encoding="utf-8")

        # Создаём presentation.html
        presentation_html = _build_presentation_html(slide_htmls, design)
        presentation_path = output_path / "presentation.html"
        presentation_path.write_text(presentation_html, encoding="utf-8")

        # Формируем результат
        all_success = all(s.generation_success for s in generated_slides)
        result = S4GenerationResult(
            slides=generated_slides,
            index_html_path=str(index_path),
            presentation_html_path=str(presentation_path),
            total_slides=total_slides,
            generation_success=all_success,
        )

        # Записываем в SharedStore
        store.results["S4_SlideGenerator"] = result.model_dump()

        # Сохраняем артефакты
        from schemas.shared_store import Artifact

        store.artifacts.append(
            Artifact(
                artifact_id=f"{store.project_id}_presentation",
                filename="presentation.html",
                storage_path=str(presentation_path),
                version=1,
                created_by=self.name,
            )
        )
        store.artifacts.append(
            Artifact(
                artifact_id=f"{store.project_id}_index",
                filename="index.html",
                storage_path=str(index_path),
                version=1,
                created_by=self.name,
            )
        )

        logger.info(
            "[%s] S4_SlideGenerator: генерация завершена " "(slides=%d, success=%s, output=%s)",
            store.project_id,
            total_slides,
            all_success,
            str(output_path),
        )

        return store


def _clean_html_response(text: str) -> str:
    """Очистить ответ LLM от markdown-обёрток."""
    text = text.strip()

    # Убираем ```html ... ``` обёртку
    if text.startswith("```html"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    return text.strip()


def _generate_fallback_slide(
    blueprint: dict[str, Any],
    design: dict[str, Any],
    slide_number: int,
) -> str:
    """Сгенерировать fallback-слайд при ошибке LLM."""
    palette = design.get("color_palette", {})
    bg = palette.get("background", "#FFFFFF")
    text_color = palette.get("text_primary", "#1A1A2E")
    accent = palette.get("accent", "#0066CC")
    typography = design.get("typography", {})
    font_heading = typography.get("font_family_heading", "Inter")
    font_body = typography.get("font_family_body", "Inter")

    title = blueprint.get("title", f"Слайд {slide_number}")
    key_message = blueprint.get("key_message", "")

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@700&family={font_body.replace(' ', '+')}:wght@400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;">
    <div style="width:1280px;height:720px;background:{bg};display:flex;
                flex-direction:column;justify-content:center;align-items:center;
                padding:80px;box-sizing:border-box;">
        <h1 style="font-family:'{font_heading}',sans-serif;font-size:48px;
                   color:{text_color};margin:0 0 24px 0;text-align:center;">
            {title}
        </h1>
        <p style="font-family:'{font_body}',sans-serif;font-size:24px;
                  color:{accent};margin:0;text-align:center;max-width:800px;">
            {key_message}
        </p>
        <div style="position:absolute;bottom:32px;right:32px;
                    font-family:'{font_body}',sans-serif;font-size:14px;
                    color:{palette.get('text_secondary', '#666666')};">
            {slide_number}
        </div>
    </div>
</body>
</html>"""
