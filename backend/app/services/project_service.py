"""Сервис для работы с проектами, сообщениями и артефактами.

Инкапсулирует бизнес-логику CRUD-операций.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from backend.app.models.project import Artifact, Message, Project

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ProjectService:
    """CRUD-сервис для проектов.

    Attributes:
        db: Асинхронная сессия SQLAlchemy.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # --- Projects ---

    async def create_project(self, title: str = "Новый проект") -> Project:
        """Создать новый проект."""
        project = Project(title=title)
        self.db.add(project)
        await self.db.flush()
        await self.db.refresh(project)
        logger.info("Создан проект: %s (%s)", project.title, project.id)
        return project

    async def get_project(self, project_id: str) -> Project | None:
        """Получить проект по ID."""
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def list_projects(self, offset: int = 0, limit: int = 50) -> tuple[list[Project], int]:
        """Получить список проектов с пагинацией.

        Returns:
            Кортеж (список проектов, общее количество).
        """
        # Общее количество
        count_result = await self.db.execute(select(Project.id))
        total = len(count_result.all())

        # Список с пагинацией
        result = await self.db.execute(select(Project).order_by(Project.updated_at.desc()).offset(offset).limit(limit))
        projects = list(result.scalars().all())
        return projects, total

    async def update_project(self, project_id: str, **kwargs: Any) -> Project | None:
        """Обновить проект."""
        project = await self.get_project(project_id)
        if project is None:
            return None
        for key, value in kwargs.items():
            if hasattr(project, key) and value is not None:
                setattr(project, key, value)
        await self.db.flush()
        await self.db.refresh(project)
        logger.info("Обновлён проект: %s", project_id)
        return project

    async def delete_project(self, project_id: str) -> bool:
        """Удалить проект (каскадно удаляет сообщения и артефакты)."""
        project = await self.get_project(project_id)
        if project is None:
            return False
        await self.db.delete(project)
        await self.db.flush()
        logger.info("Удалён проект: %s", project_id)
        return True

    # --- Messages ---

    async def add_message(
        self,
        project_id: str,
        sender: str,
        text: str,
        metadata_json: str | None = None,
    ) -> Message:
        """Добавить сообщение в проект."""
        message = Message(
            project_id=project_id,
            sender=sender,
            text=text,
            metadata_json=metadata_json,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def list_messages(
        self,
        project_id: str,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Message], int]:
        """Получить сообщения проекта с пагинацией."""
        count_result = await self.db.execute(select(Message.id).where(Message.project_id == project_id))
        total = len(count_result.all())

        result = await self.db.execute(
            select(Message)
            .where(Message.project_id == project_id)
            .order_by(Message.created_at)
            .offset(offset)
            .limit(limit)
        )
        messages = list(result.scalars().all())
        return messages, total

    # --- Artifacts ---

    async def add_artifact(
        self,
        project_id: str,
        filename: str,
        file_type: str,
        content: str | None = None,
        storage_path: str | None = None,
        version: int = 1,
    ) -> Artifact:
        """Добавить артефакт в проект."""
        artifact = Artifact(
            project_id=project_id,
            filename=filename,
            file_type=file_type,
            content=content,
            storage_path=storage_path,
            version=version,
        )
        self.db.add(artifact)
        await self.db.flush()
        await self.db.refresh(artifact)
        return artifact

    async def get_artifact(self, artifact_id: str) -> Artifact | None:
        """Получить артефакт по ID."""
        result = await self.db.execute(select(Artifact).where(Artifact.id == artifact_id))
        return result.scalar_one_or_none()

    async def list_artifacts(
        self,
        project_id: str,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Artifact], int]:
        """Получить артефакты проекта с пагинацией."""
        count_result = await self.db.execute(select(Artifact.id).where(Artifact.project_id == project_id))
        total = len(count_result.all())

        result = await self.db.execute(
            select(Artifact)
            .where(Artifact.project_id == project_id)
            .order_by(Artifact.created_at)
            .offset(offset)
            .limit(limit)
        )
        artifacts = list(result.scalars().all())
        return artifacts, total
