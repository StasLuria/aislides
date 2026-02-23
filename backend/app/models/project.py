"""ORM-модели для проектов, сообщений и артефактов.

По PRD, раздел 9.2:
- Project: id, title, created_at, updated_at
- Message: id, project_id, sender, text, attachments, created_at
- Artifact: id, project_id, filename, file_type, storage_path, version, created_at
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class Project(Base):
    """Модель проекта (чата).

    Attributes:
        id: UUID проекта.
        user_id: FK на владельца проекта.
        title: Название проекта.
        status: Текущий статус (idle, running, completed, failed).
        created_at: Дата создания.
        updated_at: Дата последнего обновления.
    """

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), default="Новый проект")
    status: Mapped[str] = mapped_column(
        Enum("idle", "running", "completed", "failed", name="project_status"),
        default="idle",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    owner: Mapped[User] = relationship(back_populates="projects")
    messages: Mapped[list[Message]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    artifacts: Mapped[list[Artifact]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Artifact.created_at",
    )


class Message(Base):
    """Модель сообщения в чате.

    Attributes:
        id: UUID сообщения.
        project_id: FK на проект.
        sender: Отправитель ('user' или 'ai').
        text: Текст сообщения.
        metadata_json: Дополнительные данные (JSON-строка).
        created_at: Дата создания.
    """

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    sender: Mapped[str] = mapped_column(
        Enum("user", "ai", name="message_sender"),
    )
    text: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    project: Mapped[Project] = relationship(back_populates="messages")


class Artifact(Base):
    """Модель артефакта (сгенерированного файла).

    Attributes:
        id: UUID артефакта.
        project_id: FK на проект.
        filename: Имя файла.
        file_type: Тип файла (html, md, json и т.д.).
        storage_path: Путь к файлу в хранилище.
        content: Содержимое файла (для небольших артефактов).
        version: Версия артефакта.
        created_at: Дата создания.
    """

    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(50))
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    project: Mapped[Project] = relationship(back_populates="artifacts")
