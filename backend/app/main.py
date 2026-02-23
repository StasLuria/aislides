"""FastAPI Backend для AI Presentation Generator.

Точка входа серверного приложения.
Настраивает CORS, middleware, lifespan и подключает роутеры.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.database import engine
from backend.app.models.base import Base
from backend.app.routers import health, projects, upload, websocket

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Управление жизненным циклом приложения.

    При старте:
    - Создаёт таблицы в БД (для разработки; в продакшене — Alembic).
    - Логирует запуск.

    При остановке:
    - Закрывает соединения с БД.
    """
    logger.info("Запуск %s...", settings.app_name)

    # Создаём таблицы (для разработки)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Таблицы БД созданы/проверены")
    yield

    # Cleanup
    await engine.dispose()
    logger.info("Сервер остановлен")


app = FastAPI(
    title=settings.app_name,
    description="Backend API для генерации презентаций с помощью AI",
    version="0.5.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(health.router)
app.include_router(projects.router)
app.include_router(upload.router)
app.include_router(websocket.router)
