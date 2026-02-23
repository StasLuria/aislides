"""Pydantic-схемы для авторизации.

Определяет модели запросов и ответов для endpoints регистрации и логина.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Запрос на регистрацию нового пользователя.

    Attributes:
        email: Email пользователя (валидируется как email).
        username: Отображаемое имя (2-100 символов).
        password: Пароль (минимум 6 символов).
    """

    email: EmailStr
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """Запрос на авторизацию.

    Attributes:
        email: Email пользователя.
        password: Пароль.
    """

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Ответ с JWT-токеном.

    Attributes:
        access_token: JWT access-токен.
        token_type: Тип токена (всегда 'bearer').
    """

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Данные пользователя в ответе.

    Attributes:
        id: UUID пользователя.
        email: Email.
        username: Отображаемое имя.
        is_active: Активен ли аккаунт.
    """

    id: str
    email: str
    username: str
    is_active: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Полный ответ авторизации: токен + данные пользователя.

    Attributes:
        access_token: JWT access-токен.
        token_type: Тип токена.
        user: Данные пользователя.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
