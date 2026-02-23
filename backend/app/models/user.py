"""ORM-модель пользователя.

Хранит учётные данные для JWT-авторизации.
Пароль хранится в виде bcrypt-хеша.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base


class User(Base):
    """Модель пользователя.

    Attributes:
        id: UUID пользователя.
        email: Уникальный email (используется для логина).
        username: Отображаемое имя пользователя.
        hashed_password: Bcrypt-хеш пароля.
        is_active: Активен ли аккаунт.
        created_at: Дата регистрации.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
    )
    username: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
