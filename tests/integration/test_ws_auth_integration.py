"""Integration-тесты WebSocket-авторизации.

Тестирует:
- ws_authenticate с реальной БД (валидный/невалидный/истёкший/несуществующий/неактивный).
- WebSocket endpoint: подключение с/без токена через mock WebSocket.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.dependencies.auth import ws_authenticate
from backend.app.models.user import User
from backend.app.services.auth_service import (
    create_access_token,
    hash_password,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ============================================================
# ws_authenticate Integration Tests
# ============================================================


class TestWsAuthenticateIntegration:
    """Integration-тесты ws_authenticate с реальной БД."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Валидный токен возвращает пользователя из БД."""
        user = User(
            email="wsuser@example.com",
            username="WsUser",
            hashed_password=hash_password("password123"),
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        user_id = user.id

        token = create_access_token(user_id=user_id, email="wsuser@example.com")
        result = await ws_authenticate(token, db_session)
        assert result is not None
        assert result.id == user_id
        assert result.email == "wsuser@example.com"

    @pytest.mark.asyncio
    async def test_none_token_returns_none(
        self,
        db_session: AsyncSession,
    ) -> None:
        """None-токен возвращает None."""
        result = await ws_authenticate(None, db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Невалидный токен возвращает None."""
        result = await ws_authenticate("invalid-token-string", db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Истёкший токен возвращает None."""
        user = User(
            email="expired@example.com",
            username="Expired",
            hashed_password=hash_password("password123"),
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        expired_token = create_access_token(
            user_id=user.id,
            email="expired@example.com",
            expires_delta=timedelta(seconds=-10),
        )
        result = await ws_authenticate(expired_token, db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_token_for_nonexistent_user_returns_none(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Токен для несуществующего пользователя возвращает None."""
        token = create_access_token(
            user_id="ghost-user-id",
            email="ghost@example.com",
        )
        result = await ws_authenticate(token, db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_token_for_inactive_user_returns_none(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Токен для деактивированного пользователя возвращает None."""
        user = User(
            email="inactive@example.com",
            username="Inactive",
            hashed_password=hash_password("password123"),
            is_active=False,
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        token = create_access_token(
            user_id=user.id,
            email="inactive@example.com",
        )
        result = await ws_authenticate(token, db_session)
        assert result is None


# ============================================================
# WebSocket Endpoint Auth Integration Tests
# ============================================================


class TestWebSocketEndpointAuth:
    """Integration-тесты авторизации WebSocket endpoint.

    Тестируем websocket_endpoint напрямую, подменяя async_session_factory
    через patch на уровне модуля backend.app.database.
    """

    def _make_session_factory_mock(self, db_session: AsyncSession) -> MagicMock:
        """Создать мок async_session_factory, возвращающий реальную сессию."""
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=db_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        return MagicMock(return_value=mock_ctx)

    @pytest.mark.asyncio
    async def test_ws_connection_without_token_is_rejected(
        self,
        db_session: AsyncSession,
    ) -> None:
        """WebSocket без токена закрывается с кодом 4001."""
        from backend.app.routers.websocket import websocket_endpoint

        mock_ws = AsyncMock()
        mock_ws.close = AsyncMock()

        await websocket_endpoint(
            websocket=mock_ws,
            project_id="proj-1",
            token=None,
        )

        mock_ws.close.assert_called_once_with(code=4001, reason="Unauthorized")

    @pytest.mark.asyncio
    async def test_ws_connection_with_invalid_token_is_rejected(
        self,
        db_session: AsyncSession,
    ) -> None:
        """WebSocket с невалидным токеном закрывается с кодом 4001."""
        from backend.app.routers.websocket import websocket_endpoint

        mock_ws = AsyncMock()
        mock_ws.close = AsyncMock()

        factory_mock = self._make_session_factory_mock(db_session)

        with patch("backend.app.database.async_session_factory", factory_mock):
            await websocket_endpoint(
                websocket=mock_ws,
                project_id="proj-1",
                token="invalid-token",
            )

        mock_ws.close.assert_called_once_with(code=4001, reason="Unauthorized")

    @pytest.mark.asyncio
    async def test_ws_connection_with_valid_token_is_accepted(
        self,
        db_session: AsyncSession,
    ) -> None:
        """WebSocket с валидным токеном принимает подключение."""
        from fastapi import WebSocketDisconnect

        from backend.app.routers.websocket import websocket_endpoint

        # Создаём пользователя
        user = User(
            email="wsvalid@example.com",
            username="WsValid",
            hashed_password=hash_password("password123"),
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        user_id = user.id
        await db_session.commit()

        token = create_access_token(user_id=user_id, email="wsvalid@example.com")

        mock_ws = AsyncMock()
        mock_ws.accept = AsyncMock()
        mock_ws.send_text = AsyncMock()
        mock_ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect())

        factory_mock = self._make_session_factory_mock(db_session)

        with patch("backend.app.database.async_session_factory", factory_mock):
            await websocket_endpoint(
                websocket=mock_ws,
                project_id="proj-1",
                token=token,
            )

        # WebSocket должен быть принят
        mock_ws.accept.assert_called_once()
        # Должно быть отправлено сообщение "connected"
        assert mock_ws.send_text.call_count >= 1

    @pytest.mark.asyncio
    async def test_ws_connection_with_expired_token_is_rejected(
        self,
        db_session: AsyncSession,
    ) -> None:
        """WebSocket с истёкшим токеном закрывается с кодом 4001."""
        from backend.app.routers.websocket import websocket_endpoint

        # Создаём пользователя
        user = User(
            email="wsexpired@example.com",
            username="WsExpired",
            hashed_password=hash_password("password123"),
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        await db_session.commit()

        expired_token = create_access_token(
            user_id=user.id,
            email="wsexpired@example.com",
            expires_delta=timedelta(seconds=-10),
        )

        mock_ws = AsyncMock()
        mock_ws.close = AsyncMock()

        factory_mock = self._make_session_factory_mock(db_session)

        with patch("backend.app.database.async_session_factory", factory_mock):
            await websocket_endpoint(
                websocket=mock_ws,
                project_id="proj-1",
                token=expired_token,
            )

        mock_ws.close.assert_called_once_with(code=4001, reason="Unauthorized")
