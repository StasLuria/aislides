"""REST API роутер для проектов.

Эндпоинты:
- POST   /api/projects          — создать проект
- GET    /api/projects          — список проектов
- GET    /api/projects/{id}     — получить проект
- PATCH  /api/projects/{id}     — обновить проект
- DELETE /api/projects/{id}     — удалить проект
- GET    /api/projects/{id}/messages  — история сообщений
- GET    /api/projects/{id}/artifacts — список артефактов

Все эндпоинты требуют авторизации (Bearer JWT).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.database import get_db
from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.project import (
    ArtifactListRead,
    ArtifactRead,
    MessageListRead,
    MessageRead,
    ProjectCreate,
    ProjectListRead,
    ProjectRead,
    ProjectUpdate,
)
from backend.app.services.project_service import ProjectService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from backend.app.models.user import User

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_service(db: AsyncSession = Depends(get_db)) -> ProjectService:
    """Dependency для получения ProjectService."""
    return ProjectService(db)


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать проект",
)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> ProjectRead:
    """Создать новый проект.

    Args:
        body: Данные для создания проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Созданный проект.
    """
    project = await svc.create_project(title=body.title)
    return ProjectRead.model_validate(project)


@router.get(
    "",
    response_model=ProjectListRead,
    summary="Список проектов",
)
async def list_projects(
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> ProjectListRead:
    """Получить список проектов с пагинацией.

    Args:
        offset: Смещение для пагинации.
        limit: Количество записей.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Список проектов и общее количество.
    """
    projects, total = await svc.list_projects(offset=offset, limit=limit)
    return ProjectListRead(
        projects=[ProjectRead.model_validate(p) for p in projects],
        total=total,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Получить проект",
)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> ProjectRead:
    """Получить проект по ID.

    Args:
        project_id: UUID проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Данные проекта.

    Raises:
        HTTPException 404: Если проект не найден.
    """
    project = await svc.get_project(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )
    return ProjectRead.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Обновить проект",
)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> ProjectRead:
    """Обновить проект.

    Args:
        project_id: UUID проекта.
        body: Данные для обновления.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Обновлённый проект.

    Raises:
        HTTPException 404: Если проект не найден.
    """
    project = await svc.update_project(project_id, title=body.title)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )
    return ProjectRead.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить проект",
)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> None:
    """Удалить проект.

    Args:
        project_id: UUID проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Raises:
        HTTPException 404: Если проект не найден.
    """
    deleted = await svc.delete_project(project_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )


@router.get(
    "/{project_id}/messages",
    response_model=MessageListRead,
    summary="История сообщений",
)
async def list_messages(
    project_id: str,
    offset: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> MessageListRead:
    """Получить историю сообщений проекта.

    Args:
        project_id: UUID проекта.
        offset: Смещение для пагинации.
        limit: Количество записей.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Список сообщений и общее количество.

    Raises:
        HTTPException 404: Если проект не найден.
    """
    project = await svc.get_project(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )
    messages, total = await svc.list_messages(
        project_id=project_id,
        offset=offset,
        limit=limit,
    )
    return MessageListRead(
        messages=[MessageRead.model_validate(m) for m in messages],
        total=total,
    )


@router.get(
    "/{project_id}/artifacts",
    response_model=ArtifactListRead,
    summary="Список артефактов",
)
async def list_artifacts(
    project_id: str,
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> ArtifactListRead:
    """Получить артефакты проекта.

    Args:
        project_id: UUID проекта.
        offset: Смещение для пагинации.
        limit: Количество записей.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Список артефактов и общее количество.

    Raises:
        HTTPException 404: Если проект не найден.
    """
    project = await svc.get_project(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )
    artifacts, total = await svc.list_artifacts(
        project_id=project_id,
        offset=offset,
        limit=limit,
    )
    return ArtifactListRead(
        artifacts=[ArtifactRead.model_validate(a) for a in artifacts],
        total=total,
    )
