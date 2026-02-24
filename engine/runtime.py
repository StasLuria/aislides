"""RuntimeAgent — основной цикл исполнения плана.

Реализация по ТЗ v3.0, §9.
Последовательно выполняет шаги из ExecutionPlan, вызывая узлы
из ToolRegistry и транслируя события через EventBus.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from schemas.events import EngineEvent, EventType
from schemas.shared_store import ProjectStatus

if TYPE_CHECKING:
    from engine.event_bus import EventBus
    from engine.registry import ToolRegistry
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)


class RuntimeAgent:
    """Агент исполнения плана.

    Итерирует по шагам ``SharedStore.execution_plan``, для каждого шага:
    1. Проверяет ``cancel_token`` — если установлен, прерывает выполнение.
    2. Эмитирует ``STEP_STARTED``.
    3. Получает узел из ``ToolRegistry`` по имени.
    4. Вызывает ``node.execute(store)``.
    5. Эмитирует ``STEP_COMPLETED``.

    При ошибке записывает её в ``SharedStore.errors`` и устанавливает
    статус ``FAILED``.

    Attributes:
        registry: Реестр инструментальных узлов.
        event_bus: Шина событий.
        cancel_token: Токен отмены (asyncio.Event).
    """

    def __init__(
        self,
        registry: ToolRegistry,
        event_bus: EventBus,
        cancel_token: asyncio.Event | None = None,
    ) -> None:
        self._registry = registry
        self._event_bus = event_bus
        self._cancel_token = cancel_token or asyncio.Event()

    @property
    def cancel_token(self) -> asyncio.Event:
        """Токен отмены текущего выполнения."""
        return self._cancel_token

    async def execute(self, store: SharedStore) -> SharedStore:
        """Исполнить план из SharedStore.

        Args:
            store: SharedStore с заполненным ``execution_plan``.

        Returns:
            Обновлённый SharedStore с результатами выполнения.

        Raises:
            ValueError: Если ``execution_plan`` отсутствует.
        """
        if store.execution_plan is None:
            msg = "execution_plan отсутствует в SharedStore"
            raise ValueError(msg)

        steps = store.execution_plan.get("steps", [])
        trace_id = store.project_id

        store.status = ProjectStatus.EXECUTING

        for step in steps:
            # --- Проверка отмены ---
            if self._cancel_token.is_set():
                store.status = ProjectStatus.CANCELLED
                await self._event_bus.emit(
                    EngineEvent(
                        event_type=EventType.AI_MESSAGE,
                        trace_id=trace_id,
                        component="RuntimeAgent",
                        message="Выполнение отменено пользователем",
                    )
                )
                logger.info("[%s] Выполнение отменено", trace_id)
                return store

            step_id = step.get("step_id", "?")
            node_name = step.get("node", "unknown")

            # --- STEP_STARTED ---
            await self._event_bus.emit(
                EngineEvent(
                    event_type=EventType.STEP_STARTED,
                    trace_id=trace_id,
                    component="RuntimeAgent",
                    message=f"Начат шаг {step_id}: {node_name}",
                    data={"step_id": step_id, "node": node_name},
                )
            )

            # Запоминаем количество артефактов до выполнения шага
            artifacts_before = len(store.artifacts)

            try:
                node = self._registry.get(node_name)
                store = await node.execute(store)
            except KeyError:
                error_info = {
                    "step_id": step_id,
                    "node": node_name,
                    "error": f"Узел '{node_name}' не найден в реестре",
                }
                store.errors.append(error_info)
                store.status = ProjectStatus.FAILED
                await self._event_bus.emit(
                    EngineEvent(
                        event_type=EventType.ERROR,
                        trace_id=trace_id,
                        component="RuntimeAgent",
                        message=f"Узел '{node_name}' не найден",
                        data=error_info,
                    )
                )
                logger.error("[%s] Узел '%s' не найден", trace_id, node_name)
                return store
            except Exception as exc:
                error_info = {
                    "step_id": step_id,
                    "node": node_name,
                    "error": str(exc),
                }
                store.errors.append(error_info)
                store.status = ProjectStatus.FAILED
                await self._event_bus.emit(
                    EngineEvent(
                        event_type=EventType.ERROR,
                        trace_id=trace_id,
                        component="RuntimeAgent",
                        message=f"Ошибка на шаге {step_id}: {exc}",
                        data=error_info,
                    )
                )
                logger.exception("[%s] Ошибка на шаге %s", trace_id, step_id)
                return store

            # --- Эмитируем ARTIFACT_CREATED для новых артефактов ---
            for artifact in store.artifacts[artifacts_before:]:
                await self._event_bus.emit(
                    EngineEvent(
                        event_type=EventType.ARTIFACT_CREATED,
                        trace_id=trace_id,
                        component=node_name,
                        message=f"Создан артефакт: {artifact.filename}",
                        data={
                            "artifact_id": artifact.artifact_id,
                            "filename": artifact.filename,
                            "file_type": artifact.filename.rsplit(".", 1)[-1] if "." in artifact.filename else "",
                            "preview_url": f"/api/artifacts/{artifact.artifact_id}/preview",
                        },
                    )
                )

            # --- STEP_COMPLETED ---
            await self._event_bus.emit(
                EngineEvent(
                    event_type=EventType.STEP_COMPLETED,
                    trace_id=trace_id,
                    component="RuntimeAgent",
                    message=f"Завершён шаг {step_id}: {node_name}",
                    data={"step_id": step_id, "node": node_name},
                )
            )

        # --- Все шаги выполнены ---
        if store.status == ProjectStatus.EXECUTING:
            store.status = ProjectStatus.SUCCESS

        return store
