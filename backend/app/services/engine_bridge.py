"""EngineBridge — мост между EngineAPI (EventBus) и WebSocket (ConnectionManager).

Подписывается на события движка и пересылает их клиенту
в формате WebSocket-протокола (PRD, раздел 9.1).

Маппинг событий:
- PLAN_STARTED    → status_update (step S0: in_progress)
- STEP_STARTED    → status_update (step SN: in_progress)
- STEP_COMPLETED  → status_update (step SN: completed)
- PLAN_COMPLETED  → status_update (все шаги: completed)
- ARTIFACT_CREATED → artifact_generated
- AI_MESSAGE      → ai_message
- ERROR           → error
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from engine.api import EngineAPI
from schemas.events import EngineEvent, EventType

if TYPE_CHECKING:
    from backend.app.services.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

# Глобальный реестр активных движков по project_id
_active_engines: dict[str, EngineAPI] = {}


class EngineBridge:
    """Мост между EngineAPI и WebSocket-клиентами.

    Для каждого проекта создаёт экземпляр EngineAPI,
    подписывается на все события EventBus и транслирует
    их через ConnectionManager в формате WebSocket-протокола.

    Attributes:
        _manager: Менеджер WebSocket-подключений.
    """

    def __init__(self, manager: ConnectionManager) -> None:
        self._manager = manager

    async def run_generation(
        self,
        project_id: str,
        user_message: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> None:
        """Запустить генерацию и транслировать события через WebSocket.

        Args:
            project_id: ID проекта.
            user_message: Текст запроса пользователя.
            attachments: Прикреплённые файлы (опционально).
        """
        engine = EngineAPI()
        _active_engines[project_id] = engine

        # Подписываемся на все типы событий
        self._subscribe_all(engine, project_id)

        try:
            store = await engine.run(
                project_id=project_id,
                user_input={
                    "prompt": user_message,
                    "attachments": attachments or [],
                },
            )

            # Отправляем финальное сообщение
            artifact_count = len(store.artifacts)
            if store.errors:
                error_msgs = [e.get("error", "Неизвестная ошибка") for e in store.errors]
                await self._manager.send_to_project(
                    project_id,
                    {
                        "type": "ai_message",
                        "payload": {
                            "text": f"Произошла ошибка: {'; '.join(error_msgs)}",
                        },
                    },
                )
            elif artifact_count > 0:
                await self._manager.send_to_project(
                    project_id,
                    {
                        "type": "ai_message",
                        "payload": {
                            "text": f"Генерация завершена. Создано артефактов: {artifact_count}.",
                        },
                    },
                )
            else:
                await self._manager.send_to_project(
                    project_id,
                    {
                        "type": "ai_message",
                        "payload": {
                            "text": "Генерация завершена, но артефакты не были созданы.",
                        },
                    },
                )

        except Exception as exc:
            logger.exception("[Bridge] Ошибка генерации для project=%s", project_id)
            await self._manager.send_to_project(
                project_id,
                {
                    "type": "error",
                    "payload": {"message": f"Ошибка генерации: {exc}"},
                },
            )
        finally:
            _active_engines.pop(project_id, None)

    async def run_edit(
        self,
        project_id: str,
        artifact_id: str,
        feedback_text: str,
    ) -> None:
        """Запустить apply_edit и транслировать события.

        Args:
            project_id: ID проекта.
            artifact_id: ID артефакта.
            feedback_text: Текст фидбека от пользователя.
        """
        engine = EngineAPI()
        _active_engines[project_id] = engine

        self._subscribe_all(engine, project_id)

        try:
            store = await engine.apply_edit(
                project_id=project_id,
                artifact_id=artifact_id,
                new_content=feedback_text,
            )

            if store.errors:
                error_msgs = [e.get("error", "Неизвестная ошибка") for e in store.errors]
                await self._manager.send_to_project(
                    project_id,
                    {
                        "type": "ai_message",
                        "payload": {
                            "text": f"Ошибка при правке: {'; '.join(error_msgs)}",
                        },
                    },
                )
            else:
                await self._manager.send_to_project(
                    project_id,
                    {
                        "type": "ai_message",
                        "payload": {
                            "text": f"Правка артефакта '{artifact_id}' завершена.",
                        },
                    },
                )

        except Exception as exc:
            logger.exception("[Bridge] Ошибка apply_edit для project=%s", project_id)
            await self._manager.send_to_project(
                project_id,
                {
                    "type": "error",
                    "payload": {"message": f"Ошибка при правке: {exc}"},
                },
            )
        finally:
            _active_engines.pop(project_id, None)

    async def cancel(self, project_id: str) -> bool:
        """Отменить текущую генерацию.

        Args:
            project_id: ID проекта.

        Returns:
            True если отмена инициирована.
        """
        engine = _active_engines.get(project_id)
        if engine:
            return await engine.cancel(project_id)
        return False

    def _subscribe_all(self, engine: EngineAPI, project_id: str) -> None:
        """Подписаться на все типы событий EventBus.

        Создаёт обработчик для каждого типа события,
        который транслирует событие через WebSocket.

        Args:
            engine: Экземпляр EngineAPI.
            project_id: ID проекта.
        """
        for event_type in EventType:
            handler = self._make_handler(project_id, event_type)
            engine.event_bus.subscribe(event_type, handler)

    def _make_handler(
        self,
        project_id: str,
        event_type: EventType,
    ) -> Any:
        """Создать обработчик события для конкретного типа.

        Args:
            project_id: ID проекта.
            event_type: Тип события.

        Returns:
            Async-функция обработчик.
        """
        manager = self._manager

        async def handler(event: EngineEvent) -> None:
            ws_message = _map_engine_event_to_ws(event)
            if ws_message:
                await manager.send_to_project(project_id, ws_message)

        return handler


def _map_engine_event_to_ws(event: EngineEvent) -> dict[str, Any] | None:
    """Маппинг события движка в WebSocket-сообщение.

    Преобразует EngineEvent в формат WebSocket-протокола (PRD 9.1).

    Args:
        event: Событие движка.

    Returns:
        Словарь WebSocket-сообщения или None если событие не маппится.
    """
    et = event.event_type

    if et == EventType.PLAN_STARTED:
        return {
            "type": "status_update",
            "payload": {
                "step": "S0: Планирование",
                "status": "in_progress",
                "message": event.message,
            },
        }

    if et == EventType.PLAN_COMPLETED:
        return {
            "type": "status_update",
            "payload": {
                "step": "S0: Планирование",
                "status": "completed",
                "message": event.message,
            },
        }

    if et == EventType.STEP_STARTED:
        return {
            "type": "status_update",
            "payload": {
                "step": event.component,
                "status": "in_progress",
                "message": event.message,
            },
        }

    if et == EventType.STEP_COMPLETED:
        return {
            "type": "status_update",
            "payload": {
                "step": event.component,
                "status": "completed",
                "message": event.message,
            },
        }

    if et == EventType.ARTIFACT_CREATED:
        data = event.data or {}
        return {
            "type": "artifact_generated",
            "payload": {
                "artifact_id": data.get("artifact_id", ""),
                "filename": data.get("filename", ""),
                "file_type": data.get("file_type", ""),
                "preview_url": data.get("preview_url", ""),
            },
        }

    if et == EventType.AI_MESSAGE:
        return {
            "type": "ai_message",
            "payload": {
                "text": event.message,
            },
        }

    if et == EventType.ERROR:
        return {
            "type": "error",
            "payload": {
                "message": event.message,
            },
        }

    return None
