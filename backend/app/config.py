"""Конфигурация Backend-приложения.

Загружает настройки из переменных окружения и .env файла.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Настройки приложения.

    Attributes:
        app_name: Название приложения.
        debug: Режим отладки.
        database_url: URL подключения к БД (по умолчанию — SQLite для разработки).
        cors_origins: Разрешённые CORS-домены.
        llm_model: Модель LLM для движка.
        llm_api_key: API-ключ LLM.
        llm_base_url: Базовый URL LLM API.
    """

    app_name: str = "AI Presentation Generator"
    debug: bool = True

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/app.db"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # JWT Auth
    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 часа

    # LLM
    llm_model: str = "gemini-2.5-flash"
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    openai_api_key: str | None = None

    @field_validator("database_url")
    @classmethod
    def convert_database_url_for_async(cls, v: str) -> str:
        """Конвертирует DATABASE_URL для совместимости с SQLAlchemy async.

        Render.com предоставляет URL в формате ``postgresql://...``,
        а SQLAlchemy async требует ``postgresql+asyncpg://...``.
        Также поддерживает ``postgres://`` (устаревший формат Heroku/Render).
        """
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    """Получить синглтон настроек (кешируется)."""
    return Settings()
