"""Подключение к базе данных.

Использует SQLAlchemy async engine.
Для разработки — SQLite (aiosqlite), для продакшена — PostgreSQL (asyncpg).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from backend.app.config import get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

settings = get_settings()

# SQLite не поддерживает connection pooling — используем NullPool.
# PostgreSQL — используем AsyncAdaptedQueuePool для production.
_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    poolclass=NullPool if _is_sqlite else AsyncAdaptedQueuePool,
    pool_pre_ping=not _is_sqlite,
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
