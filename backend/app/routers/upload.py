"""Upload endpoint — загрузка файлов.

Реализация по ТЗ v3.0, §13 и PRD.
Принимает файлы через multipart/form-data,
сохраняет через FileStorage и возвращает метаданные.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, UploadFile

from engine.file_storage import LocalFileStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

# Используем локальное хранилище для MVP
_storage = LocalFileStorage(base_dir="uploads")

# Ограничения
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".md",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".pptx",
    ".xlsx",
    ".csv",
}


@router.post("/upload")
async def upload_file(file: UploadFile) -> dict[str, str]:
    """Загрузить файл.

    Принимает файл через multipart/form-data.
    Валидирует размер и расширение.
    Сохраняет через FileStorage.

    Args:
        file: Загружаемый файл.

    Returns:
        Метаданные загруженного файла.

    Raises:
        HTTPException: При ошибке валидации.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Имя файла отсутствует")

    # Проверяем расширение
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимое расширение файла: {ext}. Допустимые: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Читаем содержимое
    content = await file.read()

    # Проверяем размер
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой: {len(content)} байт. Максимум: {MAX_FILE_SIZE} байт",
        )

    # Генерируем уникальное имя и сохраняем
    unique_name = LocalFileStorage.generate_unique_filename(file.filename)
    saved_path = await _storage.save(unique_name, content)

    logger.info(
        "[Upload] Файл загружен: %s -> %s (%d байт)",
        file.filename,
        saved_path,
        len(content),
    )

    return {
        "filename": file.filename,
        "stored_path": saved_path,
        "size": str(len(content)),
        "content_type": file.content_type or "application/octet-stream",
    }
