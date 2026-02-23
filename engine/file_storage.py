"""FileStorage — абстракция для работы с файлами.

Реализация по ТЗ v3.0, §13.
Поддерживает локальную файловую систему (MVP) и S3 (будущее).
"""

from __future__ import annotations

import logging
import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)


class FileStorage(ABC):
    """Абстрактный интерфейс хранилища файлов.

    Определяет контракт для сохранения и загрузки файлов.
    Конкретные реализации: LocalFileStorage, S3FileStorage (будущее).
    """

    @abstractmethod
    async def save(self, path: str, content: bytes) -> str:
        """Сохранить файл.

        Args:
            path: Относительный путь файла.
            content: Содержимое файла в байтах.

        Returns:
            URL или путь к сохранённому файлу.
        """
        ...

    @abstractmethod
    async def load(self, path: str) -> bytes:
        """Загрузить файл.

        Args:
            path: Относительный путь файла.

        Returns:
            Содержимое файла в байтах.

        Raises:
            FileNotFoundError: Если файл не найден.
        """
        ...

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """Удалить файл.

        Args:
            path: Относительный путь файла.

        Returns:
            True если файл удалён, False если не найден.
        """
        ...

    @abstractmethod
    async def exists(self, path: str) -> bool:
        """Проверить существование файла.

        Args:
            path: Относительный путь файла.

        Returns:
            True если файл существует.
        """
        ...


class LocalFileStorage(FileStorage):
    """Локальное файловое хранилище.

    Сохраняет файлы в указанную директорию на диске.
    Используется для MVP и разработки.

    Attributes:
        _base_dir: Базовая директория для хранения файлов.
    """

    def __init__(self, base_dir: str = "uploads") -> None:
        self._base_dir = Path(base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)
        logger.info("[FileStorage] Инициализирован: base_dir=%s", self._base_dir)

    async def save(self, path: str, content: bytes) -> str:
        """Сохранить файл на диск.

        Args:
            path: Относительный путь файла.
            content: Содержимое файла.

        Returns:
            Абсолютный путь к сохранённому файлу.
        """
        full_path = self._base_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        logger.info("[FileStorage] Файл сохранён: %s (%d байт)", full_path, len(content))
        return str(full_path)

    async def load(self, path: str) -> bytes:
        """Загрузить файл с диска.

        Args:
            path: Относительный путь файла.

        Returns:
            Содержимое файла.

        Raises:
            FileNotFoundError: Если файл не найден.
        """
        full_path = self._base_dir / path
        if not full_path.exists():
            msg = f"Файл не найден: {full_path}"
            raise FileNotFoundError(msg)
        return full_path.read_bytes()

    async def delete(self, path: str) -> bool:
        """Удалить файл с диска.

        Args:
            path: Относительный путь файла.

        Returns:
            True если файл удалён.
        """
        full_path = self._base_dir / path
        if full_path.exists():
            full_path.unlink()
            logger.info("[FileStorage] Файл удалён: %s", full_path)
            return True
        return False

    async def exists(self, path: str) -> bool:
        """Проверить существование файла на диске.

        Args:
            path: Относительный путь файла.

        Returns:
            True если файл существует.
        """
        return (self._base_dir / path).exists()

    @staticmethod
    def generate_unique_filename(original_name: str) -> str:
        """Генерировать уникальное имя файла.

        Args:
            original_name: Оригинальное имя файла.

        Returns:
            Уникальное имя файла с UUID-префиксом.
        """
        ext = os.path.splitext(original_name)[1]
        return f"{uuid.uuid4().hex}{ext}"
