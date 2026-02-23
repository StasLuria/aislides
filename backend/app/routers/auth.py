"""Роутер авторизации.

Endpoints:
- POST /api/auth/register — регистрация нового пользователя.
- POST /api/auth/login — авторизация и получение JWT-токена.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.database import get_db
from backend.app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from backend.app.services.auth_service import (
    authenticate_user,
    create_access_token,
    register_user,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового пользователя",
)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Регистрирует нового пользователя и возвращает JWT-токен.

    Args:
        request: Данные для регистрации (email, username, password).
        db: Сессия БД.

    Returns:
        AuthResponse с access_token и данными пользователя.

    Raises:
        HTTPException 409: Если email уже занят.
    """
    try:
        user = await register_user(
            db=db,
            email=request.email,
            username=request.username,
            password=request.password,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        ) from err

    token = create_access_token(user_id=user.id, email=user.email)
    logger.info("Зарегистрирован пользователь: %s", user.email)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Авторизация пользователя",
)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Авторизует пользователя и возвращает JWT-токен.

    Args:
        request: Данные для входа (email, password).
        db: Сессия БД.

    Returns:
        AuthResponse с access_token и данными пользователя.

    Raises:
        HTTPException 401: Если email или пароль неверны.
    """
    user = await authenticate_user(
        db=db,
        email=request.email,
        password=request.password,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_id=user.id, email=user.email)
    logger.info("Авторизован пользователь: %s", user.email)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
