"""S0_PlannerNode — LLM-узел, преобразующий запрос в исполняемый план.

Реализация по ТЗ v3.0, §6.1 и §7.
Формирует динамический промпт и вызывает LLM через Instructor,
получая валидированный ExecutionPlanSchema.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import instructor
from openai import AsyncOpenAI

from engine.base_node import BaseNode
from schemas.execution_plan import ExecutionPlanSchema

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Системный промпт (статическая часть)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Ты — планировщик AI-движка для генерации презентаций.

Твоя задача — проанализировать запрос пользователя и составить план выполнения,
состоящий из упорядоченных шагов. Каждый шаг вызывает один инструментальный узел.

## Доступные инструменты

- **S1_ContextAnalyzer** — Анализирует запрос пользователя: определяет аудиторию,
  цель, тип презентации, тональность, количество слайдов.
- **S2_NarrativeArchitect** — Создаёт нарративную структуру: выбирает фреймворк,
  формирует план слайдов с narrative beats.
- **S3_DesignArchitect** — Определяет дизайн-систему: цветовую палитру, типографику,
  маппинг слайдов на шаблоны макетов.
- **S4_SlideGenerator** — Генерирует HTML/CSS-код слайдов на основе структуры и дизайна.
- **S5_QualityValidator** — Проверяет качество презентации по 4 измерениям.

## Правила

1. Для новой презентации ВСЕГДА используй все 5 шагов в порядке S1 → S2 → S3 → S4 → S5.
2. Для ручной правки (edit_context) — используй только те шаги, которые затронуты правкой.
3. Каждый шаг должен иметь уникальный step_id (начиная с 1).
4. Поле `reason` должно объяснять, ПОЧЕМУ этот шаг нужен.
5. Поле `thought` должно содержать твоё пошаговое рассуждение ПЕРЕД составлением плана.
6. Не добавляй шаги, которых нет в списке доступных инструментов.
"""

EDIT_CONTEXT_ADDITION = """
## Контекст ручной правки

Пользователь внёс ручную правку в артефакт. Проанализируй, какие шаги нужно
перевыполнить, чтобы учесть эту правку. НЕ нужно перевыполнять все шаги —
только те, результаты которых зависят от изменённого артефакта.

Информация о правке:
- Артефакт: {artifact_id}
- Новое содержимое: {new_content}
"""


def _build_user_prompt(store: SharedStore) -> str:
    """Сформировать динамическую часть промпта из SharedStore.

    Включает:
    - Запрос пользователя
    - Историю чата (если есть)
    - Результаты предыдущих шагов (если есть)
    - Контекст ручной правки (если есть)
    """
    parts: list[str] = []

    # Запрос пользователя
    prompt = store.user_input.get("prompt", "")
    if prompt:
        parts.append(f"## Запрос пользователя\n\n{prompt}")

    # История чата
    if store.chat_history:
        history_lines = []
        for msg in store.chat_history[-10:]:  # Последние 10 сообщений
            history_lines.append(f"**{msg.role}:** {msg.content}")
        parts.append("## История чата\n\n" + "\n".join(history_lines))

    # Прикреплённые файлы
    if store.attached_files:
        files_info = ", ".join(f.filename for f in store.attached_files)
        parts.append(f"## Прикреплённые файлы\n\n{files_info}")

    # Существующие результаты (для частичной перегенерации)
    if store.results:
        results_keys = ", ".join(store.results.keys())
        parts.append(f"## Уже выполненные шаги\n\nРезультаты доступны для: {results_keys}")

    # Контекст ручной правки
    edit_context = store.user_input.get("edit_context")
    if edit_context:
        parts.append(
            EDIT_CONTEXT_ADDITION.format(
                artifact_id=edit_context.get("artifact_id", "unknown"),
                new_content=edit_context.get("new_content", ""),
            )
        )

    return "\n\n".join(parts) if parts else "Создай презентацию."


class S0PlannerNode(BaseNode):
    """LLM-планировщик: преобразует запрос пользователя в ExecutionPlanSchema.

    Использует Instructor для гарантированного получения валидированной
    Pydantic-модели от LLM.

    Args:
        model: Имя модели LLM (по умолчанию из config).
        max_retries: Максимальное количество повторных попыток Instructor.
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
        return "S0_PlannerNode"

    def _create_client(self) -> instructor.AsyncInstructor:
        """Создать Instructor-клиент для вызова LLM."""
        raw_client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        return instructor.from_openai(raw_client)

    async def execute(self, store: SharedStore) -> SharedStore:
        """Сгенерировать план выполнения через LLM.

        1. Формирует динамический промпт из SharedStore.
        2. Вызывает LLM через Instructor с response_model=ExecutionPlanSchema.
        3. Записывает план в store.execution_plan.

        Args:
            store: Текущее состояние SharedStore.

        Returns:
            SharedStore с заполненным execution_plan.

        Raises:
            RuntimeError: Если LLM не вернул валидный план после всех попыток.
        """
        logger.info("[%s] S0_PlannerNode: формирование промпта", store.project_id)

        system_prompt = SYSTEM_PROMPT
        user_prompt = _build_user_prompt(store)

        logger.debug("[%s] S0_PlannerNode: user_prompt=%s", store.project_id, user_prompt[:200])

        client = self._create_client()

        try:
            plan: ExecutionPlanSchema = await client.chat.completions.create(
                model=self._model,
                response_model=ExecutionPlanSchema,
                max_retries=self._max_retries,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            msg = f"S0_PlannerNode: LLM не вернул валидный план: {exc}"
            logger.error("[%s] %s", store.project_id, msg)
            raise RuntimeError(msg) from exc

        # Записываем план в SharedStore
        store.execution_plan = plan.model_dump()
        store.results["S0_PlannerNode"] = {
            "thought": plan.thought,
            "steps_count": len(plan.steps),
            "steps": [s.node for s in plan.steps],
        }

        logger.info(
            "[%s] S0_PlannerNode: план сгенерирован (%d шагов: %s)",
            store.project_id,
            len(plan.steps),
            ", ".join(s.node for s in plan.steps),
        )

        return store
