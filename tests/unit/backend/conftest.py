"""Фикстуры для тестирования Backend.

Используем in-memory SQLite для изоляции тестов.
Все REST-эндпоинты защищены авторизацией — фикстуры предоставляют
авторизованный клиент и заголовки с JWT-токеном.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.database import get_db
from backend.app.dependencies.auth import get_current_user
from backend.app.main import app
from backend.app.models.base import Base
from backend.app.services.auth_service import create_access_token

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

# In-memory SQLite для тестов
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Тестовый пользователь
TEST_USER_ID = "test-user-00000000-0000-0000-0000-000000000001"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_NAME = "Test User"


def _make_mock_user() -> MagicMock:
    """Создать мок-объект пользователя для тестов."""
    user = MagicMock()
    user.id = TEST_USER_ID
    user.email = TEST_USER_EMAIL
    user.username = TEST_USER_NAME
    user.is_active = True
    return user


@pytest_asyncio.fixture
async def db_engine():
    """Создать тестовый движок БД."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine: Any) -> AsyncGenerator[AsyncSession, None]:
    """Создать тестовую сессию БД."""
    session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine: Any) -> AsyncGenerator[AsyncClient, None]:
    """Создать тестовый HTTP-клиент с подменённой БД и авторизацией.

    Все запросы автоматически авторизованы через override get_current_user.
    """
    session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def override_get_current_user() -> MagicMock:
        return _make_mock_user()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def unauth_client(db_engine: Any) -> AsyncGenerator[AsyncClient, None]:
    """Создать тестовый HTTP-клиент БЕЗ авторизации.

    Используется для тестирования что эндпоинты возвращают 401.
    """
    session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    # НЕ переопределяем get_current_user — будет требовать реальный токен

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
def auth_headers() -> dict[str, str]:
    """Заголовки авторизации с валидным JWT-токеном."""
    token = create_access_token(user_id=TEST_USER_ID, email=TEST_USER_EMAIL)
    return {"Authorization": f"Bearer {token}"}
