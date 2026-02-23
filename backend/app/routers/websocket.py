"""WebSocket endpoint для real-time коммуникации.

Реализация по PRD, раздел 9.1 и ТЗ v3.0, §17.

Протокол сообщений:
- Клиент → Сервер: user_message, artifact_feedback, artifact_updated, cancel
- Сервер → Клиент: ai_message, status_update, artifact_generated, artifact_edited, error

Авторизация: JWT-токен передаётся через query parameter ?token=JWT.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

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
    token: str | None = Query(default=None),
) -> None:
    """WebSocket endpoint для проекта.

    Жизненный цикл:
    1. Аутентифицирует пользователя по JWT-токену из query parameter.
    2. Принимает подключение.
    3. Регистрирует клиента в ConnectionManager.
    4. Слушает входящие сообщения в бесконечном цикле.
    5. Маршрутизирует сообщения по типу.
    6. При отключении — очищает ресурсы.

    Args:
        websocket: WebSocket-соединение.
        project_id: ID проекта.
        token: JWT-токен для аутентификации (query parameter).
    """
    # Аутентификация WebSocket-подключения
    from backend.app.database import async_session_factory
    from backend.app.dependencies.auth import ws_authenticate

    user = None
    if token is not None:
        async with async_session_factory() as db:
            user = await ws_authenticate(token, db)

    if user is None:
        # Закрываем соединение с кодом 4001 (Unauthorized)
        await websocket.close(code=4001, reason="Unauthorized")
        logger.warning("[WS] Неавторизованное подключение к проекту %s", project_id)
        return

    await manager.connect(project_id, websocket)
    logger.info("[WS] Пользователь %s подключён к проекту %s", user.email, project_id)

    try:
        # Отправляем подтверждение подключения
        await manager.send_to_project(
            project_id,
            {
                "type": "connected",
                "payload": {
                    "project_id": project_id,
                    "user_id": user.id,
                },
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
            elif msg_type == "artifact_updated":
                await _handle_artifact_updated(project_id, payload)
            elif msg_type == "cancel":
                await _handle_cancel(project_id)
            else:
                await manager.send_to_project(
                    project_id,
                    {
                        "type": "error",
                        "payload": {
                            "message": f"Неизвестный тип сообщения: {msg_type}",
                        },
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
            "payload": {
                "text": f"Обрабатываю правку для артефакта '{artifact_id}'...",
            },
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


async def _handle_artifact_updated(
    project_id: str,
    payload: dict[str, Any],
) -> None:
    """Обработать artifact_updated от клиента.

    Пользователь отредактировал артефакт в CodeEditor и сохранил.
    Запускает перегенерацию зависимых артефактов через EngineBridge.

    По roadmap 8.3: «Реализовать WebSocket-сообщение artifact_edited».
    По PRD, раздел 10.2: artifact_updated → перегенерация.

    Args:
        project_id: ID проекта.
        payload: Данные (artifact_id, new_content).
    """
    from backend.app.services.engine_bridge import EngineBridge

    artifact_id = payload.get("artifact_id", "")
    new_content = payload.get("new_content", "")

    if not artifact_id or not new_content.strip():
        await manager.send_to_project(
            project_id,
            {
                "type": "error",
                "payload": {"message": "artifact_id и new_content обязательны"},
            },
        )
        return

    # Подтверждаем получение правки
    await manager.send_to_project(
        project_id,
        {
            "type": "artifact_edited",
            "payload": {
                "artifact_id": artifact_id,
                "status": "accepted",
                "message": f"Правка артефакта '{artifact_id}' принята. " "Запускаю перегенерацию...",
            },
        },
    )

    # Запускаем перегенерацию через EngineBridge
    bridge = EngineBridge(manager)
    task = asyncio.create_task(
        bridge.run_artifact_update(
            project_id=project_id,
            artifact_id=artifact_id,
            new_content=new_content,
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
