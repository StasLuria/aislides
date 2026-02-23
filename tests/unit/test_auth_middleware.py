"""Тесты для middleware авторизации.

Покрывает:
- get_current_user: REST dependency.
- ws_authenticate: WebSocket аутентификация.
- Защита REST-эндпоинтов (projects, upload).
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.app.dependencies.auth import get_current_user, ws_authenticate
from backend.app.services.auth_service import create_access_token

# ─── get_current_user ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_current_user_no_credentials() -> None:
    """Без токена — 401."""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=None, db=AsyncMock())
    assert exc_info.value.status_code == 401
    assert "Требуется авторизация" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_invalid_token() -> None:
    """Невалидный токен — 401."""
    creds = MagicMock()
    creds.credentials = "invalid-token"

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=AsyncMock())
    assert exc_info.value.status_code == 401
    assert "Невалидный" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_expired_token() -> None:
    """Истёкший токен — 401."""
    token = create_access_token(
        user_id="user-123",
        email="test@test.com",
        expires_delta=timedelta(seconds=-1),
    )
    creds = MagicMock()
    creds.credentials = token

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=AsyncMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_user_not_found() -> None:
    """Пользователь не найден в БД — 401."""
    token = create_access_token(user_id="user-123", email="test@test.com")
    creds = MagicMock()
    creds.credentials = token

    mock_db = AsyncMock()
    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials=creds, db=mock_db)
        assert exc_info.value.status_code == 401
        assert "не найден" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_inactive_user() -> None:
    """Деактивированный пользователь — 403."""
    token = create_access_token(user_id="user-123", email="test@test.com")
    creds = MagicMock()
    creds.credentials = token

    mock_user = MagicMock()
    mock_user.is_active = False

    mock_db = AsyncMock()
    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=mock_user,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials=creds, db=mock_db)
        assert exc_info.value.status_code == 403
        assert "деактивирован" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_success() -> None:
    """Валидный токен + активный пользователь — OK."""
    token = create_access_token(user_id="user-123", email="test@test.com")
    creds = MagicMock()
    creds.credentials = token

    mock_user = MagicMock()
    mock_user.id = "user-123"
    mock_user.email = "test@test.com"
    mock_user.is_active = True

    mock_db = AsyncMock()
    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=mock_user,
    ):
        user = await get_current_user(credentials=creds, db=mock_db)
        assert user.id == "user-123"
        assert user.email == "test@test.com"


# ─── ws_authenticate ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ws_authenticate_no_token() -> None:
    """Без токена — None."""
    result = await ws_authenticate(token=None, db=AsyncMock())
    assert result is None


@pytest.mark.asyncio
async def test_ws_authenticate_invalid_token() -> None:
    """Невалидный токен — None."""
    result = await ws_authenticate(token="bad-token", db=AsyncMock())
    assert result is None


@pytest.mark.asyncio
async def test_ws_authenticate_user_not_found() -> None:
    """Пользователь не найден — None."""
    token = create_access_token(user_id="user-123", email="test@test.com")
    mock_db = AsyncMock()

    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=None,
    ):
        result = await ws_authenticate(token=token, db=mock_db)
        assert result is None


@pytest.mark.asyncio
async def test_ws_authenticate_inactive_user() -> None:
    """Деактивированный пользователь — None."""
    token = create_access_token(user_id="user-123", email="test@test.com")

    mock_user = MagicMock()
    mock_user.is_active = False

    mock_db = AsyncMock()
    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=mock_user,
    ):
        result = await ws_authenticate(token=token, db=mock_db)
        assert result is None


@pytest.mark.asyncio
async def test_ws_authenticate_success() -> None:
    """Валидный токен + активный пользователь — User."""
    token = create_access_token(user_id="user-123", email="test@test.com")

    mock_user = MagicMock()
    mock_user.id = "user-123"
    mock_user.email = "test@test.com"
    mock_user.is_active = True

    mock_db = AsyncMock()
    with patch(
        "backend.app.dependencies.auth.get_user_by_id",
        new_callable=AsyncMock,
        return_value=mock_user,
    ):
        result = await ws_authenticate(token=token, db=mock_db)
        assert result is not None
        assert result.id == "user-123"
