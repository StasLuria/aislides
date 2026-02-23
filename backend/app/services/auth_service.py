"""Сервис аутентификации и авторизации.

Обеспечивает:
- Хеширование и верификацию паролей (bcrypt).
- Создание и валидацию JWT access-токенов.
- Регистрацию и аутентификацию пользователей.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.models.user import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt.

    Args:
        password: Открытый пароль.

    Returns:
        Bcrypt-хеш пароля.
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хеша.

    Args:
        plain_password: Открытый пароль.
        hashed_password: Bcrypt-хеш.

    Returns:
        True если пароль верный, False иначе.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    user_id: str,
    email: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Создаёт JWT access-токен.

    Args:
        user_id: UUID пользователя.
        email: Email пользователя.
        expires_delta: Время жизни токена. По умолчанию из настроек.

    Returns:
        Закодированный JWT-токен.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)

    expire = datetime.now(UTC) + expires_delta
    to_encode = {
        "sub": user_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, str] | None:
    """Декодирует и валидирует JWT access-токен.

    Args:
        token: JWT-токен.

    Returns:
        Payload словарь с 'sub' (user_id) и 'email', или None если токен невалиден.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        if user_id is None or email is None:
            return None
        return {"sub": user_id, "email": email}
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Находит пользователя по email.

    Args:
        db: Асинхронная сессия БД.
        email: Email для поиска.

    Returns:
        Объект User или None.
    """
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    """Находит пользователя по ID.

    Args:
        db: Асинхронная сессия БД.
        user_id: UUID пользователя.

    Returns:
        Объект User или None.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def register_user(
    db: AsyncSession,
    email: str,
    username: str,
    password: str,
) -> User:
    """Регистрирует нового пользователя.

    Args:
        db: Асинхронная сессия БД.
        email: Email пользователя.
        username: Имя пользователя.
        password: Открытый пароль (будет захеширован).

    Returns:
        Созданный объект User.

    Raises:
        ValueError: Если пользователь с таким email уже существует.
    """
    existing = await get_user_by_email(db, email)
    if existing is not None:
        msg = f"Пользователь с email {email} уже существует"
        raise ValueError(msg)

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Аутентифицирует пользователя по email и паролю.

    Args:
        db: Асинхронная сессия БД.
        email: Email пользователя.
        password: Открытый пароль.

    Returns:
        Объект User если аутентификация успешна, None иначе.
    """
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user
