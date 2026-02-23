"""WebSocket endpoint для real-time коммуникации.

Реализация по PRD, раздел 9.1 и ТЗ v3.0, §17.

Протокол сообщений:
- Клиент → Сервер: user_message, artifact_feedback, cancel
- Сервер → Клиент: ai_message, status_update, artifact_generated, error
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.services.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Глобальный менеджер подключений
manager = ConnectionManager()

# Множество для хранения ссылок на фоновые задачи (RUF006)
_background_tasks: set[asyncio.Task[None]] = set()


@router.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
) -> None:
    """WebSocket endpoint для проекта.

    Жизненный цикл:
    1. Принимает подключение.
    2. Регистрирует клиента в ConnectionManager.
    3. Слушает входящие сообщения в бесконечном цикле.
    4. Маршрутизирует сообщения по типу.
    5. При отключении — очищает ресурсы.

    Args:
        websocket: WebSocket-соединение.
        project_id: ID проекта.
    """
    await manager.connect(project_id, websocket)
    logger.info("[WS] Клиент подключён к проекту %s", project_id)

    try:
        # Отправляем подтверждение подключения
        await manager.send_to_project(
            project_id,
            {
                "type": "connected",
                "payload": {"project_id": project_id},
            },
        )

        while True:
            # Получаем сообщение от клиента
            raw_data = await websocket.receive_text()

            try:
                message = json.loads(raw_data)
            except json.JSONDecodeError:
                await manager.send_to_project(
                    project_id,
                    {
                        "type": "error",
                        "payload": {"message": "Невалидный JSON"},
                    },
                )
                continue

            # Маршрутизация по типу сообщения
            msg_type = message.get("type")
            payload = message.get("payload", {})

            if msg_type == "user_message":
                await _handle_user_message(project_id, payload)
            elif msg_type == "artifact_feedback":
                await _handle_artifact_feedback(project_id, payload)
            elif msg_type == "cancel":
                await _handle_cancel(project_id)
            else:
                await manager.send_to_project(
                    project_id,
                    {
                        "type": "error",
                        "payload": {"message": f"Неизвестный тип сообщения: {msg_type}"},
                    },
                )

    except WebSocketDisconnect:
        logger.info("[WS] Клиент отключился от проекта %s", project_id)
    except Exception:
        logger.exception("[WS] Ошибка в WebSocket для проекта %s", project_id)
    finally:
        manager.disconnect(project_id, websocket)


async def _handle_user_message(
    project_id: str,
    payload: dict[str, Any],
) -> None:
    """Обработать user_message от клиента.

    1. Извлекает текст и вложения.
    2. Отправляет ai_message «Начинаю работу...».
    3. Запускает EngineService.generate() в фоне.
    4. Подписывается на события EventBus и пересылает клиенту.

    Args:
        project_id: ID проекта.
        payload: Данные сообщения (text, attachments).
    """
    from backend.app.services.engine_bridge import EngineBridge

    text = payload.get("text", "")
    attachments = payload.get("attachments", [])

    if not text.strip():
        await manager.send_to_project(
            project_id,
            {
                "type": "error",
                "payload": {"message": "Текст сообщения не может быть пустым"},
            },
        )
        return

    # Отправляем подтверждение
    await manager.send_to_project(
        project_id,
        {
            "type": "ai_message",
            "payload": {"text": "Начинаю работу над презентацией..."},
        },
    )

    # Запускаем генерацию в фоне
    bridge = EngineBridge(manager)
    task = asyncio.create_task(
        bridge.run_generation(
            project_id=project_id,
            user_message=text,
            attachments=attachments,
        )
    )
    # Сохраняем ссылку на задачу, чтобы она не была собрана GC
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _handle_artifact_feedback(
    project_id: str,
    payload: dict[str, Any],
) -> None:
    """Обработать artifact_feedback от клиента.

    Запускает apply_edit() через EngineBridge.

    Args:
        project_id: ID проекта.
        payload: Данные (artifact_id, feedback_text).
    """
    from backend.app.services.engine_bridge import EngineBridge

    artifact_id = payload.get("artifact_id", "")
    feedback_text = payload.get("feedback_text", "")

    if not artifact_id or not feedback_text.strip():
        await manager.send_to_project(
            project_id,
            {
                "type": "error",
                "payload": {"message": "artifact_id и feedback_text обязательны"},
            },
        )
        return

    await manager.send_to_project(
        project_id,
        {
            "type": "ai_message",
            "payload": {"text": f"Обрабатываю правку для артефакта '{artifact_id}'..."},
        },
    )

    bridge = EngineBridge(manager)
    task = asyncio.create_task(
        bridge.run_edit(
            project_id=project_id,
            artifact_id=artifact_id,
            feedback_text=feedback_text,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _handle_cancel(project_id: str) -> None:
    """Обработать cancel от клиента.

    Вызывает EngineService.cancel().

    Args:
        project_id: ID проекта.
    """
    from backend.app.services.engine_bridge import EngineBridge

    bridge = EngineBridge(manager)
    cancelled = await bridge.cancel(project_id)

    await manager.send_to_project(
        project_id,
        {
            "type": "ai_message",
            "payload": {
                "text": "Генерация отменена." if cancelled else "Нет активной генерации для отмены.",
            },
        },
    )
