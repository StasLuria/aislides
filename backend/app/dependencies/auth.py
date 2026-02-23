"""Зависимости авторизации для FastAPI.

Предоставляет:
- get_current_user: Dependency для REST-эндпоинтов (Bearer token из заголовка).
- ws_authenticate: Функция для аутентификации WebSocket-подключений (token из query params).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.database import get_db
from backend.app.services.auth_service import decode_access_token, get_user_by_id

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from backend.app.models.user import User

logger = logging.getLogger(__name__)

# Схема Bearer-авторизации для OpenAPI документации
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Извлекает текущего пользователя из JWT-токена в заголовке Authorization.

    Используется как Depends() в REST-эндпоинтах для защиты маршрутов.

    Args:
        credentials: Bearer-токен из заголовка Authorization.
        db: Сессия БД.

    Returns:
        Объект User текущего пользователя.

    Raises:
        HTTPException 401: Если токен отсутствует, невалиден или пользователь не найден.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(db, payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    return user


async def ws_authenticate(
    token: str | None,
    db: AsyncSession,
) -> User | None:
    """Аутентифицирует WebSocket-подключение по JWT-токену.

    Токен передаётся через query parameter: ws://host/ws/projects/{id}?token=JWT

    Args:
        token: JWT-токен из query parameter.
        db: Сессия БД.

    Returns:
        Объект User если аутентификация успешна, None иначе.
    """
    if token is None:
        logger.warning("[WS Auth] Токен не предоставлен")
        return None

    payload = decode_access_token(token)
    if payload is None:
        logger.warning("[WS Auth] Невалидный токен")
        return None

    user = await get_user_by_id(db, payload["sub"])
    if user is None:
        logger.warning("[WS Auth] Пользователь не найден: %s", payload["sub"])
        return None

    if not user.is_active:
        logger.warning("[WS Auth] Аккаунт деактивирован: %s", user.email)
        return None

    return user
