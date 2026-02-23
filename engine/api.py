"""EngineAPI — единственная точка входа для Backend.

Реализация по ТЗ v3.0, §3.
Инкапсулирует весь жизненный цикл: создание SharedStore,
вызов S0_PlannerNode, валидацию плана, исполнение через RuntimeAgent.

На данном этапе (Спринт 1) — заглушка с корректной структурой.
Полная реализация — Спринт 2 (после реализации S0_PlannerNode).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from engine.event_bus import EventBus
from engine.registry import ToolRegistry
from engine.runtime import RuntimeAgent
from schemas.events import EngineEvent, EventType
from schemas.shared_store import ChatMessage, ProjectStatus, SharedStore

logger = logging.getLogger(__name__)


class EngineAPI:
    """Публичный API движка.

    Предоставляет три метода:
    - ``run()`` — полный цикл генерации презентации.
    - ``apply_edit()`` — обработка ручной правки артефакта.
    - ``cancel()`` — отмена текущего выполнения.

    Attributes:
        event_bus: Шина событий для трансляции прогресса.
        registry: Реестр инструментальных узлов.
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self._config = config or {}
        self.event_bus = EventBus()
        self.registry = ToolRegistry()
        self._cancellation_tokens: dict[str, asyncio.Event] = {}

    async def run(
        self,
        project_id: str | None = None,
        user_input: dict[str, Any] | None = None,
        chat_history: list[dict[str, Any]] | None = None,
        existing_results: dict[str, Any] | None = None,
        attached_files: list[dict[str, Any]] | None = None,
    ) -> SharedStore:
        """Основной метод: выполнить полный цикл генерации.

        Args:
            project_id: Уникальный ID проекта (генерируется, если не указан).
            user_input: Входные данные от пользователя.
            chat_history: История чата.
            existing_results: Результаты предыдущих шагов (для частичной перегенерации).
            attached_files: Прикреплённые файлы.

        Returns:
            Финальный SharedStore с результатами.
        """
        project_id = project_id or str(uuid.uuid4())
        trace_id = project_id

        # 1. Создать SharedStore
        store = SharedStore(
            project_id=project_id,
            status=ProjectStatus.PLANNING,
            user_input=user_input or {},
            config=self._config,
            chat_history=[ChatMessage(**msg) for msg in (chat_history or [])],
            results=existing_results or {},
        )

        # 2. Создать cancel_token
        cancel_token = asyncio.Event()
        self._cancellation_tokens[project_id] = cancel_token

        await self.event_bus.emit(
            EngineEvent(
                event_type=EventType.PLAN_STARTED,
                trace_id=trace_id,
                component="EngineAPI",
                message="Начата генерация презентации",
            )
        )

        try:
            # 3. Вызвать S0_PlannerNode (TODO: Спринт 2)
            # store = await self._planner.execute(store)

            # 4. Вызвать PlanValidatorNode (TODO: Спринт 2)
            # store = await self._validator.execute(store)

            # 5. Вызвать RuntimeAgent
            if store.execution_plan is not None:
                agent = RuntimeAgent(
                    registry=self.registry,
                    event_bus=self.event_bus,
                    cancel_token=cancel_token,
                )
                store = await agent.execute(store)
            else:
                logger.warning("[%s] execution_plan отсутствует, пропуск RuntimeAgent", trace_id)

        except Exception as exc:
            store.status = ProjectStatus.FAILED
            store.errors.append({"component": "EngineAPI", "error": str(exc)})
            await self.event_bus.emit(
                EngineEvent(
                    event_type=EventType.ERROR,
                    trace_id=trace_id,
                    component="EngineAPI",
                    message=f"Критическая ошибка: {exc}",
                )
            )
            logger.exception("[%s] Критическая ошибка в EngineAPI.run", trace_id)
        finally:
            self._cancellation_tokens.pop(project_id, None)

        return store

    async def apply_edit(
        self,
        project_id: str,
        artifact_id: str,
        new_content: str,
        chat_history: list[dict[str, Any]],
        existing_results: dict[str, Any],
    ) -> SharedStore:
        """Обработать ручную правку артефакта.

        Args:
            project_id: ID проекта.
            artifact_id: ID артефакта для правки.
            new_content: Новое содержимое артефакта.
            chat_history: История чата.
            existing_results: Текущие результаты.

        Returns:
            Обновлённый SharedStore.
        """
        # TODO: Спринт 2 — полная реализация
        store = SharedStore(
            project_id=project_id,
            status=ProjectStatus.PENDING,
            user_input={
                "edit_context": {
                    "artifact_id": artifact_id,
                    "new_content": new_content,
                }
            },
            config=self._config,
            chat_history=[ChatMessage(**msg) for msg in chat_history],
            results=existing_results,
        )
        return store

    async def cancel(self, project_id: str) -> bool:
        """Отменить текущее выполнение для проекта.

        Args:
            project_id: ID проекта для отмены.

        Returns:
            True если отмена инициирована, False если проект не найден.
        """
        token = self._cancellation_tokens.get(project_id)
        if token:
            token.set()
            logger.info("[%s] Отмена инициирована", project_id)
            return True
        logger.warning("[%s] Токен отмены не найден", project_id)
        return False
