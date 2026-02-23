"""REST API роутер для экспорта презентаций.

Эндпоинты:
- GET /api/projects/{id}/export/pdf  — экспорт в PDF
- GET /api/projects/{id}/export/pptx — экспорт в PPTX

Все эндпоинты требуют авторизации (Bearer JWT).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from backend.app.database import get_db
from backend.app.dependencies.auth import get_current_user
from backend.app.services.export_service import export_pdf, export_pptx
from backend.app.services.project_service import ProjectService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from backend.app.models.project import Artifact
    from backend.app.models.user import User

router = APIRouter(prefix="/api/projects", tags=["export"])


def _get_service(db: AsyncSession = Depends(get_db)) -> ProjectService:
    """Dependency для получения ProjectService."""
    return ProjectService(db)


async def _get_project_artifacts(
    project_id: str,
    current_user: User,
    svc: ProjectService,
) -> list[Artifact]:
    """Получить артефакты проекта с проверкой доступа.

    Args:
        project_id: UUID проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        Список артефактов проекта.

    Raises:
        HTTPException 404: Если проект не найден.
        HTTPException 400: Если нет артефактов для экспорта.
    """
    project = await svc.get_project(project_id, user_id=current_user.id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект '{project_id}' не найден",
        )

    artifacts, _total = await svc.list_artifacts(project_id=project_id)
    if not artifacts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет артефактов для экспорта",
        )

    return artifacts


@router.get(
    "/{project_id}/export/pdf",
    summary="Экспорт в PDF",
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF-файл презентации",
        },
    },
)
async def export_project_pdf(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> Response:
    """Экспортировать презентацию в PDF.

    Каждый HTML-слайд рендерится на отдельной странице 16:9.

    Args:
        project_id: UUID проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        PDF-файл как Response.
    """
    artifacts = await _get_project_artifacts(project_id, current_user, svc)

    try:
        pdf_bytes = export_pdf(artifacts)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="presentation_{project_id[:8]}.pdf"',
        },
    )


@router.get(
    "/{project_id}/export/pptx",
    summary="Экспорт в PPTX",
    response_class=Response,
    responses={
        200: {
            "content": {
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": {},
            },
            "description": "PPTX-файл презентации",
        },
    },
)
async def export_project_pptx(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_get_service),
) -> Response:
    """Экспортировать презентацию в PPTX.

    Каждый HTML-слайд конвертируется в текстовый слайд PowerPoint.

    Args:
        project_id: UUID проекта.
        current_user: Текущий авторизованный пользователь.
        svc: Сервис проектов.

    Returns:
        PPTX-файл как Response.
    """
    artifacts = await _get_project_artifacts(project_id, current_user, svc)

    try:
        pptx_bytes = export_pptx(artifacts)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={
            "Content-Disposition": f'attachment; filename="presentation_{project_id[:8]}.pptx"',
        },
    )
