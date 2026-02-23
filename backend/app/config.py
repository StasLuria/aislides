"""Конфигурация Backend-приложения.

Загружает настройки из переменных окружения и .env файла.
"""

from __future__ import annotations

from functools import lru_cache

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

    # LLM
    llm_model: str = "gemini-2.5-flash"
    llm_api_key: str | None = None
    llm_base_url: str | None = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Получить синглтон настроек (кешируется)."""
    return Settings()
