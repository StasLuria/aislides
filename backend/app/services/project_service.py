"""Сервис для работы с проектами, сообщениями и артефактами.

Инкапсулирует бизнес-логику CRUD-операций.
Все операции с проектами фильтруются по user_id для изоляции данных.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import func as sa_func
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

    async def create_project(
        self,
        user_id: str,
        title: str = "Новый проект",
    ) -> Project:
        """Создать новый проект.

        Args:
            user_id: UUID владельца проекта.
            title: Название проекта.

        Returns:
            Созданный проект.
        """
        project = Project(user_id=user_id, title=title)
        self.db.add(project)
        await self.db.flush()
        await self.db.refresh(project)
        logger.info("Создан проект: %s (%s) для user %s", project.title, project.id, user_id)
        return project

    async def get_project(self, project_id: str, user_id: str | None = None) -> Project | None:
        """Получить проект по ID.

        Args:
            project_id: UUID проекта.
            user_id: Если указан, проверяет принадлежность проекта пользователю.

        Returns:
            Проект или None.
        """
        stmt = select(Project).where(Project.id == project_id)
        if user_id is not None:
            stmt = stmt.where(Project.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_projects(
        self,
        user_id: str,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Project], int]:
        """Получить список проектов пользователя с пагинацией.

        Args:
            user_id: UUID владельца.
            offset: Смещение для пагинации.
            limit: Количество записей.

        Returns:
            Кортеж (список проектов, общее количество).
        """
        # Общее количество
        count_result = await self.db.execute(
            select(sa_func.count()).select_from(Project).where(Project.user_id == user_id)
        )
        total = count_result.scalar() or 0

        # Список с пагинацией
        result = await self.db.execute(
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(Project.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        projects = list(result.scalars().all())
        return projects, total

    async def update_project(
        self,
        project_id: str,
        user_id: str | None = None,
        **kwargs: Any,
    ) -> Project | None:
        """Обновить проект.

        Args:
            project_id: UUID проекта.
            user_id: Если указан, проверяет принадлежность.
            **kwargs: Поля для обновления.

        Returns:
            Обновлённый проект или None.
        """
        project = await self.get_project(project_id, user_id=user_id)
        if project is None:
            return None
        for key, value in kwargs.items():
            if hasattr(project, key) and value is not None:
                setattr(project, key, value)
        await self.db.flush()
        await self.db.refresh(project)
        logger.info("Обновлён проект: %s", project_id)
        return project

    async def delete_project(self, project_id: str, user_id: str | None = None) -> bool:
        """Удалить проект (каскадно удаляет сообщения и артефакты).

        Args:
            project_id: UUID проекта.
            user_id: Если указан, проверяет принадлежность.

        Returns:
            True если удалён, False если не найден.
        """
        project = await self.get_project(project_id, user_id=user_id)
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
