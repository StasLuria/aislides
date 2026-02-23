"""Фикстуры для integration-тестов авторизации и изоляции данных.

Используем in-memory SQLite с реальными моделями (User, Project, Message, Artifact).
В отличие от unit-тестов, здесь НЕ мокаем auth — используем реальные JWT-токены.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.base import Base
from backend.app.models.user import User
from backend.app.services.auth_service import create_access_token, hash_password

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

# In-memory SQLite для integration-тестов
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_engine() -> Any:
    """Создать тестовый движок БД с реальными таблицами."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine: Any) -> async_sessionmaker[AsyncSession]:
    """Создать фабрику сессий."""
    return async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture
async def db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """Создать тестовую сессию БД."""
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def auth_client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient, None]:
    """HTTP-клиент с реальной БД и реальной авторизацией (без мока auth).

    Используется для тестирования полного auth flow:
    register → login → protected endpoints.
    """

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def user_alice(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, Any]:
    """Создать пользователя Alice и вернуть его данные + токен.

    Returns:
        dict с ключами: id, email, username, token, headers.
    """
    async with session_factory() as session:
        user = User(
            email="alice@example.com",
            username="Alice",
            hashed_password=hash_password("password123"),
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)
        user_id = user.id
        await session.commit()

    token = create_access_token(user_id=user_id, email="alice@example.com")
    return {
        "id": user_id,
        "email": "alice@example.com",
        "username": "Alice",
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest_asyncio.fixture
async def user_bob(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, Any]:
    """Создать пользователя Bob и вернуть его данные + токен.

    Returns:
        dict с ключами: id, email, username, token, headers.
    """
    async with session_factory() as session:
        user = User(
            email="bob@example.com",
            username="Bob",
            hashed_password=hash_password("password456"),
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)
        user_id = user.id
        await session.commit()

    token = create_access_token(user_id=user_id, email="bob@example.com")
    return {
        "id": user_id,
        "email": "bob@example.com",
        "username": "Bob",
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest_asyncio.fixture
async def async_client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient, None]:
    """HTTP-клиент с реальной БД (алиас для auth_client)."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def alice_token(user_alice: dict[str, Any]) -> str:
    """JWT-токен Alice."""
    return user_alice["token"]


@pytest_asyncio.fixture
async def bob_token(user_bob: dict[str, Any]) -> str:
    """JWT-токен Bob."""
    return user_bob["token"]


@pytest_asyncio.fixture
async def project_with_artifacts(
    async_client: AsyncClient,
    alice_token: str,
    session_factory: async_sessionmaker[AsyncSession],
    user_alice: dict[str, Any],
) -> str:
    """Создать проект Alice с HTML-артефактами для тестирования экспорта.

    Returns:
        project_id: UUID проекта.
    """
    from backend.app.models.project import Artifact, Project

    async with session_factory() as session:
        project = Project(
            user_id=user_alice["id"],
            title="Export Test Project",
        )
        session.add(project)
        await session.flush()
        await session.refresh(project)

        # Добавляем HTML-артефакты (слайды)
        for i in range(3):
            artifact = Artifact(
                project_id=project.id,
                filename=f"slide_{i + 1}.html",
                file_type="html",
                content=f"<h1>Slide {i + 1}</h1><p>Content for slide {i + 1}</p>",
                version=1,
            )
            session.add(artifact)

        await session.commit()
        return project.id
