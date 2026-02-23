"""S2_NarrativeArchitect — LLM-узел, проектирующий нарративную структуру.

Реализация по ТЗ v3.0, §6 и technical_specification.md, §2.2.3.
Выбирает нарративный фреймворк, формирует 5-битную структуру повествования,
распределяет ключевые сообщения по слайдам.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.tool_schemas import S2NarrativeResult

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Системный промпт для S2
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — нарративный архитектор для AI-системы генерации презентаций.

## Твоя задача

На основе анализа контекста (S1) спроектировать нарративную структуру
презентации: выбрать фреймворк, определить структуру слайдов и распределить
контент.

## Доступные нарративные фреймворки

1. **Problem → Solution** — Классический для питчей и предложений.
   Биты: Opening (проблема) → Build (масштаб) → Climax (решение) → Resolution (доказательства) → CTA.

2. **Hero's Journey** — Для сторителлинга о бренде или клиенте.
   Биты: Opening (обычный мир) → Build (вызов) → Climax (трансформация) → Resolution (новый мир) → CTA.

3. **What Is / What Could Be** — Для визионерских презентаций.
   Биты: Opening (текущее состояние) → Build (контраст) → Climax (видение) → Resolution (путь) → CTA.

4. **Timeline / Journey** — Для отчётов о прогрессе и историй компаний.
   Биты: Opening (начало) → Build (этапы) → Climax (ключевой момент) → Resolution (результаты) → CTA.

5. **Nested Loops** — Для объяснения сложных тем.
   Биты: Opening (внешняя история) → Build (внутренние истории) → Climax (связь) → Resolution (выводы) → CTA.

6. **BLUF (Bottom Line Up Front)** — Для топ-менеджмента.
   Биты: Opening (вывод) → Build (обоснование) → Climax (данные) → Resolution (план) → CTA.

## Правила

1. Выбери ОДИН фреймворк, наиболее подходящий для аудитории, цели и типа презентации.
2. Обоснуй выбор в `framework_rationale`.
3. Создай `narrative_structure` — список слайдов с:
   - `slide_number` (начиная с 1)
   - `title` (заголовок слайда)
   - `content_type` (тип контента для маппинга на макет)
   - `narrative_beat` (один из: opening, build, climax, resolution, call_to_action)
   - `key_message` (ключевое сообщение слайда)
   - `speaker_notes` (заметки для спикера)
4. Количество слайдов должно соответствовать `slide_count` из S1.
5. Распредели 5 нарративных битов по слайдам пропорционально.
6. Рассчитай `narrative_score` (0.0-1.0) — оценку качества нарратива.

## Доступные content_type

- `hero_title` — Титульный слайд с крупным заголовком
- `section_header` — Разделительный слайд
- `key_point` — Один ключевой тезис с пояснением
- `bullet_list` — Список пунктов
- `process_steps` — Пошаговый процесс
- `comparison` — Сравнение (до/после, варианты)
- `data_table` — Таблица с данными
- `chart` — Диаграмма или график
- `quote` — Цитата
- `image_text` — Изображение + текст
- `funnel_stages` — Воронка
- `timeline` — Временная шкала
- `team_grid` — Команда
- `cta` — Призыв к действию (финальный слайд)

## Правила narrative_score

- 1.0: Идеальная структура, все биты сбалансированы, ключевые сообщения органично вплетены.
- 0.85-0.99: Хорошая структура с незначительными улучшениями.
- 0.70-0.84: Приемлемая структура, но есть проблемы с балансом или логикой.
- < 0.70: Слабая структура, требуется переработка.
"""


def _build_user_prompt(store: SharedStore) -> str:
    """Сформировать пользовательский промпт из контекста S1."""
    parts: list[str] = []

    # Результаты S1
    s1_result = store.results.get("S1_ContextAnalyzer", {})
    if s1_result:
        parts.append("## Результаты анализа контекста (S1)\n")
        parts.append(f"- **Аудитория:** {s1_result.get('audience', 'не определена')}")
        parts.append(f"- **Цель:** {s1_result.get('purpose', 'не определена')}")
        parts.append(f"- **Тип:** {s1_result.get('presentation_type', 'не определён')}")
        parts.append(f"- **Длительность:** {s1_result.get('duration', 'не определена')}")
        parts.append(f"- **Тональность:** {s1_result.get('tone', 'professional')}")
        parts.append(f"- **Количество слайдов:** {s1_result.get('slide_count', 10)}")
        parts.append(f"- **Режим контента:** {s1_result.get('content_mode', 'auto')}")

        key_messages = s1_result.get("key_messages", [])
        if key_messages:
            parts.append("\n**Ключевые сообщения:**")
            for i, msg in enumerate(key_messages, 1):
                parts.append(f"  {i}. {msg}")

    # Оригинальный запрос пользователя
    prompt = store.user_input.get("prompt", "")
    if prompt:
        parts.append(f"\n## Оригинальный запрос пользователя\n\n{prompt}")

    return "\n".join(parts) if parts else "Создай структуру презентации на 10 слайдов."


class S2NarrativeArchitectNode(BaseNode):
    """LLM-узел проектирования нарративной структуры.

    Выбирает нарративный фреймворк и формирует структуру слайдов
    на основе анализа контекста (S1).

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
        return "S2_NarrativeArchitect"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client)

    async def execute(self, store: SharedStore) -> SharedStore:
        """Спроектировать нарративную структуру презентации.

        1. Извлекает контекст из S1.
        2. Вызывает LLM через Instructor с response_model=S2NarrativeResult.
        3. Записывает результат в store.results["S2_NarrativeArchitect"].

        Args:
            store: SharedStore с результатами S1.

        Returns:
            SharedStore с нарративной структурой.

        Raises:
            RuntimeError: Если результаты S1 отсутствуют или LLM не вернул валидный результат.
        """
        logger.info("[%s] S2_NarrativeArchitect: начало проектирования", store.project_id)

        # Проверяем наличие результатов S1
        if "S1_ContextAnalyzer" not in store.results:
            msg = "S2_NarrativeArchitect: результаты S1_ContextAnalyzer отсутствуют"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg)

        user_prompt = _build_user_prompt(store)
        client = self._create_client()

        try:
            result: S2NarrativeResult = await client.chat.completions.create(
                model=self._model,
                response_model=S2NarrativeResult,
                max_retries=self._max_retries,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            msg = f"S2_NarrativeArchitect: LLM не вернул валидный результат: {exc}"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg) from exc

        # Записываем результат в SharedStore
        store.results["S2_NarrativeArchitect"] = result.model_dump()

        logger.info(
            "[%s] S2_NarrativeArchitect: структура спроектирована " "(framework=%s, slides=%d, score=%.2f)",
            store.project_id,
            result.selected_framework,
            len(result.narrative_structure),
            result.narrative_score,
        )

        return store
