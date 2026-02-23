"""Подключение к базе данных.

Использует SQLAlchemy async engine.
Для разработки — SQLite (aiosqlite), для продакшена — PostgreSQL (asyncpg).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.config import get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    # SQLite не поддерживает pool_size, поэтому используем NullPool для SQLite
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency для получения сессии БД в FastAPI."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
