"""Health check эндпоинт."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", summary="Health check")
async def health_check() -> dict[str, str]:
    """Проверка работоспособности сервера."""
    return {"status": "ok"}
