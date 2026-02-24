"""S1_ContextAnalyzer — LLM-узел, анализирующий запрос пользователя.

Реализация по ТЗ v3.0, §6 и technical_specification.md, §2.2.2.
Извлекает из запроса: аудиторию, цель, тип презентации, тональность,
количество слайдов, ключевые сообщения, content_mode.
Рассчитывает confidence_score. Если < 0.85 — генерирует уточняющие вопросы.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.tool_schemas import S1ContextResult

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Системный промпт для S1
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — аналитик контекста для AI-системы генерации презентаций.

## Твоя задача

Проанализировать запрос пользователя и извлечь структурированную информацию
для дальнейшей генерации презентации.

## Что нужно определить

1. **audience** — Целевая аудитория (кому будет показана презентация).
2. **purpose** — Цель презентации (зачем она нужна).
3. **presentation_type** — Тип (pitch, report, educational, proposal, keynote, internal).
4. **duration** — Ожидаемая длительность выступления.
5. **tone** — Тональность (professional, casual, inspirational, technical, formal).
6. **key_messages** — Список ключевых сообщений (3-7 штук).
7. **preferred_theme** — Предпочтительный визуальный стиль (если указан).
8. **slide_count** — Рекомендуемое количество слайдов (5-30).
9. **content_mode** — Режим работы с контентом:
   - `summarize` (по умолчанию) — свободная переработка текста
   - `verbatim` — сохранение формулировок пользователя
   - `strict` — сохранение текста и структуры без изменений
10. **confidence_score** — Уверенность в полноте анализа (0.0-1.0).
11. **clarification_questions** — Уточняющие вопросы, если confidence < 0.85.

## Правила расчёта confidence_score

- 1.0: Все поля однозначно определены из запроса.
- 0.85-0.99: Большинство полей определены, некоторые выведены логически.
- 0.70-0.84: Есть неопределённости, нужны уточнения.
- < 0.70: Запрос слишком расплывчатый, нужны существенные уточнения.

## Правила определения slide_count

- Короткий питч: 5-8 слайдов
- Стандартная презентация: 8-15 слайдов
- Детальный отчёт: 15-25 слайдов
- Если пользователь указал количество — используй его.

## Важно

- Если пользователь не указал что-то явно, выведи из контекста.
- Если вывести невозможно — используй разумные значения по умолчанию.
- Всегда генерируй clarification_questions, если confidence < 0.85.
"""


def _build_user_prompt(store: SharedStore) -> str:
    """Сформировать пользовательский промпт из SharedStore."""
    parts: list[str] = []

    # Основной запрос
    prompt = store.user_input.get("prompt", "")
    if prompt:
        parts.append(f"## Запрос пользователя\n\n{prompt}")

    # Дополнительный контекст
    context = store.user_input.get("context", "")
    if context:
        parts.append(f"## Дополнительный контекст\n\n{context}")

    # История чата (последние сообщения для контекста)
    if store.chat_history:
        history_lines = []
        for msg in store.chat_history[-5:]:
            history_lines.append(f"**{msg.role}:** {msg.content}")
        parts.append("## Предыдущие сообщения\n\n" + "\n".join(history_lines))

    # Прикреплённые файлы
    if store.attached_files:
        files_info = "\n".join(f"- {f.filename} ({f.path})" for f in store.attached_files)
        parts.append(f"## Прикреплённые файлы\n\n{files_info}")

    return "\n\n".join(parts) if parts else "Создай презентацию."


class S1ContextAnalyzerNode(BaseNode):
    """LLM-узел анализа контекста.

    Анализирует запрос пользователя и извлекает структурированные данные
    для последующих этапов генерации.

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
        return "S1_ContextAnalyzer"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client, mode=instructor.Mode.JSON)

    async def execute(self, store: SharedStore) -> SharedStore:
        """Проанализировать запрос пользователя.

        1. Формирует промпт из SharedStore.
        2. Вызывает LLM через Instructor с response_model=S1ContextResult.
        3. Записывает результат в store.results["S1_ContextAnalyzer"].

        Args:
            store: Текущее состояние SharedStore.

        Returns:
            SharedStore с результатами анализа контекста.

        Raises:
            RuntimeError: Если LLM не вернул валидный результат.
        """
        logger.info("[%s] S1_ContextAnalyzer: начало анализа", store.project_id)

        user_prompt = _build_user_prompt(store)
        client = self._create_client()

        try:
            result: S1ContextResult = await client.chat.completions.create(
                model=self._model,
                response_model=S1ContextResult,
                max_retries=self._max_retries,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            msg = f"S1_ContextAnalyzer: LLM не вернул валидный результат: {exc}"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg) from exc

        # Записываем результат в SharedStore
        store.results["S1_ContextAnalyzer"] = result.model_dump()

        logger.info(
            "[%s] S1_ContextAnalyzer: анализ завершён " "(confidence=%.2f, slides=%d, type=%s, tone=%s)",
            store.project_id,
            result.confidence_score,
            result.slide_count,
            result.presentation_type,
            result.tone,
        )

        # Логируем предупреждение, если confidence низкий
        if result.confidence_score < 0.85:
            logger.warning(
                "[%s] S1_ContextAnalyzer: низкий confidence (%.2f). " "Уточняющие вопросы: %s",
                store.project_id,
                result.confidence_score,
                "; ".join(result.clarification_questions),
            )

        return store
