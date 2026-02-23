"""ConnectionManager — менеджер WebSocket-подключений.

Управляет активными WebSocket-соединениями по project_id.
Позволяет отправлять сообщения всем клиентам проекта.
"""

from __future__ import annotations

import contextlib
import json
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Менеджер WebSocket-подключений.

    Хранит активные соединения, сгруппированные по project_id.
    Поддерживает множественные подключения к одному проекту.

    Attributes:
        _connections: Словарь project_id -> список WebSocket.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        """Принять и зарегистрировать WebSocket-подключение.

        Args:
            project_id: ID проекта.
            websocket: WebSocket-соединение.
        """
        await websocket.accept()
        if project_id not in self._connections:
            self._connections[project_id] = []
        self._connections[project_id].append(websocket)
        logger.info(
            "[CM] Подключение добавлено: project=%s, всего=%d",
            project_id,
            len(self._connections[project_id]),
        )

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        """Удалить WebSocket-подключение.

        Args:
            project_id: ID проекта.
            websocket: WebSocket-соединение.
        """
        if project_id in self._connections:
            with contextlib.suppress(ValueError):
                self._connections[project_id].remove(websocket)
            if not self._connections[project_id]:
                del self._connections[project_id]
        logger.info("[CM] Подключение удалено: project=%s", project_id)

    async def send_to_project(
        self,
        project_id: str,
        message: dict[str, Any],
    ) -> None:
        """Отправить сообщение всем клиентам проекта.

        Args:
            project_id: ID проекта.
            message: Словарь с данными для отправки (будет сериализован в JSON).
        """
        connections = self._connections.get(project_id, [])
        if not connections:
            logger.debug("[CM] Нет подключений для project=%s", project_id)
            return

        text = json.dumps(message, ensure_ascii=False)
        disconnected: list[WebSocket] = []

        for ws in connections:
            try:
                await ws.send_text(text)
            except Exception:
                logger.warning("[CM] Не удалось отправить сообщение, помечаем для удаления")
                disconnected.append(ws)

        # Удаляем отключённые соединения
        for ws in disconnected:
            self.disconnect(project_id, ws)

    def get_connections_count(self, project_id: str) -> int:
        """Получить количество активных подключений для проекта.

        Args:
            project_id: ID проекта.

        Returns:
            Количество подключений.
        """
        return len(self._connections.get(project_id, []))

    def has_connections(self, project_id: str) -> bool:
        """Проверить, есть ли активные подключения для проекта.

        Args:
            project_id: ID проекта.

        Returns:
            True если есть подключения.
        """
        return bool(self._connections.get(project_id))
