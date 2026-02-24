"""S5_QualityValidator — LLM-узел финальной проверки качества презентации.

Реализация по ТЗ v3.0, §6 и technical_specification.md, §2.2.6.
Проводит многомерную валидацию по 4 измерениям:
нарратив, дизайн, контент, техническое исполнение.
Рассчитывает overall_quality_score. Врата качества: >= 0.85.
"""

from __future__ import annotations

import contextlib
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.tool_schemas import S5QualityResult

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Системный промпт для S5
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — валидатор качества для AI-системы генерации презентаций.

## Твоя задача

Провести финальную многомерную проверку качества сгенерированной презентации
и выставить оценки по 4 измерениям.

## 4 измерения качества

### 1. Нарратив (narrative)
- Логическая последовательность слайдов.
- Наличие чёткого начала, развития и завершения.
- Соответствие выбранному фреймворку.
- Каждый слайд вносит вклад в общую историю.
- Нет повторов и «мёртвых» слайдов.

### 2. Дизайн (design)
- Соответствие принципам Swiss Style (если применимо).
- Консистентность цветовой палитры.
- Правильное использование типографической шкалы.
- Достаточные отступы (whitespace).
- Визуальная иерархия.
- Контрастность текста (WCAG AA: >= 4.5:1).

### 3. Контент (content)
- Ясность и краткость текста.
- Отсутствие грамматических ошибок.
- Соответствие тональности (tone из S1).
- Информативность заголовков.
- Соблюдение лимитов (не более 5-7 буллетов на слайд).

### 4. Техническое исполнение (technical)
- Валидный HTML.
- Все стили инлайновые (нет <style> блоков).
- Нет CSS-переменных (var(--...)).
- Нет JavaScript.
- Корректная кодировка UTF-8.
- Размер слайда 1280x720px.

## Правила оценки

- Каждое измерение оценивается от 0.0 до 1.0.
- overall_quality_score = среднее арифметическое 4 измерений.
- Врата качества: overall_quality_score >= 0.85.
- Для каждого измерения укажи конкретные проблемы (issues) и рекомендации.
- blocking_issues — проблемы, которые ОБЯЗАТЕЛЬНО нужно исправить.
- warnings — проблемы, которые желательно исправить.

## Важно

- Будь строгим, но справедливым.
- Указывай конкретные номера слайдов при описании проблем.
- Если HTML-код слайдов не предоставлен, оценивай на основе метаданных.
"""


def _build_validation_prompt(store: SharedStore) -> str:
    """Сформировать промпт для валидации из SharedStore."""
    parts: list[str] = []

    # S1 — контекст
    s1 = store.results.get("S1_ContextAnalyzer", {})
    if s1:
        parts.append(f"## S1: Контекст\n```json\n{json.dumps(s1, ensure_ascii=False, indent=2)}\n```")

    # S2 — нарратив
    s2 = store.results.get("S2_NarrativeArchitect", {})
    if s2:
        parts.append(f"## S2: Нарратив\n```json\n{json.dumps(s2, ensure_ascii=False, indent=2)}\n```")

    # S3 — дизайн
    s3 = store.results.get("S3_DesignArchitect", {})
    if s3:
        parts.append(f"## S3: Дизайн-система\n```json\n{json.dumps(s3, ensure_ascii=False, indent=2)}\n```")

    # S4 — результат генерации
    s4 = store.results.get("S4_SlideGenerator", {})
    if s4:
        parts.append(f"## S4: Результат генерации\n```json\n{json.dumps(s4, ensure_ascii=False, indent=2)}\n```")

    # HTML-код слайдов (если доступен)
    slide_htmls = _read_slide_htmls(s4)
    if slide_htmls:
        for num, html in sorted(slide_htmls.items()):
            # Ограничиваем длину HTML для промпта
            truncated = html[:3000] + "..." if len(html) > 3000 else html
            parts.append(f"## HTML слайда {num}\n```html\n{truncated}\n```")

    parts.append(
        "\n## Инструкция\n\nПроведи полную валидацию по 4 измерениям. " "Выстави оценки, укажи проблемы и рекомендации."
    )

    return "\n\n".join(parts)


def _read_slide_htmls(s4_result: dict[str, Any]) -> dict[int, str]:
    """Попробовать прочитать HTML-файлы слайдов с диска."""
    htmls: dict[int, str] = {}

    slides = s4_result.get("slides", [])
    if not slides:
        return htmls

    # Определяем директорию из index_html_path
    index_path = s4_result.get("index_html_path", "")
    if not index_path:
        return htmls

    output_dir = Path(index_path).parent

    for slide_info in slides:
        filename = slide_info.get("filename", "")
        slide_number = slide_info.get("slide_number", 0)
        slide_path = output_dir / filename

        if slide_path.exists():
            with contextlib.suppress(OSError):
                htmls[slide_number] = slide_path.read_text(encoding="utf-8")

    return htmls


class S5QualityValidatorNode(BaseNode):
    """LLM-узел финальной проверки качества.

    Проводит многомерную валидацию сгенерированной презентации
    по 4 измерениям: нарратив, дизайн, контент, техническое исполнение.

    Args:
        model: Имя модели LLM.
        max_retries: Максимальное количество повторных попыток Instructor.
        api_key: API-ключ (по умолчанию из env).
        base_url: Base URL для API (по умолчанию из env).
        quality_threshold: Порог качества (по умолчанию 0.85).
    """

    def __init__(
        self,
        model: str = "gemini-2.5-flash",
        max_retries: int = 3,
        api_key: str | None = None,
        base_url: str | None = None,
        quality_threshold: float = 0.85,
    ) -> None:
        self._model = model
        self._max_retries = max_retries
        self._api_key = api_key
        self._base_url = base_url
        self._quality_threshold = quality_threshold

    @property
    def name(self) -> str:
        return "S5_QualityValidator"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client, mode=instructor.Mode.JSON)

    async def execute(self, store: SharedStore) -> SharedStore:
        """Провести финальную валидацию качества презентации.

        1. Собирает данные из S1-S4 в SharedStore.
        2. Читает HTML-файлы слайдов (если доступны).
        3. Вызывает LLM для многомерной оценки.
        4. Записывает S5QualityResult в store.results.

        Args:
            store: Текущее состояние SharedStore.

        Returns:
            SharedStore с результатами валидации.

        Raises:
            RuntimeError: Если S4 отсутствует в store.results.
        """
        logger.info("[%s] S5_QualityValidator: начало валидации", store.project_id)

        # Проверяем наличие S4
        s4_result = store.results.get("S4_SlideGenerator")
        if not s4_result:
            msg = "S5_QualityValidator: отсутствует результат S4_SlideGenerator"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        user_prompt = _build_validation_prompt(store)
        client = self._create_client()

        try:
            result: S5QualityResult = await client.chat.completions.create(
                model=self._model,
                response_model=S5QualityResult,
                max_retries=self._max_retries,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            msg = f"S5_QualityValidator: LLM не вернул валидный результат: {exc}"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg) from exc

        # Записываем результат в SharedStore
        store.results["S5_QualityValidator"] = result.model_dump()

        # Логируем результат
        logger.info(
            "[%s] S5_QualityValidator: валидация завершена " "(overall=%.2f, passed=%s, blocking=%d, warnings=%d)",
            store.project_id,
            result.overall_quality_score,
            result.passed,
            len(result.blocking_issues),
            len(result.warnings),
        )

        for dim in result.dimensions:
            logger.info(
                "[%s] S5_QualityValidator: %s = %.2f (%d issues)",
                store.project_id,
                dim.dimension,
                dim.score,
                len(dim.issues),
            )

        if not result.passed:
            logger.warning(
                "[%s] S5_QualityValidator: НЕ прошёл врата качества " "(%.2f < %.2f). Блокирующие: %s",
                store.project_id,
                result.overall_quality_score,
                self._quality_threshold,
                "; ".join(result.blocking_issues) if result.blocking_issues else "нет",
            )

        return store
