"""Pydantic-схемы для REST API.

Разделяем Create (входные данные), Read (выходные данные) и Update.
"""

from datetime import datetime

from pydantic import BaseModel, Field

# --- Project ---


class ProjectCreate(BaseModel):
    """Схема создания проекта."""

    title: str = Field(default="Новый проект", max_length=255)


class ProjectUpdate(BaseModel):
    """Схема обновления проекта."""

    title: str | None = Field(default=None, max_length=255)


class ProjectRead(BaseModel):
    """Схема чтения проекта."""

    id: str
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListRead(BaseModel):
    """Схема списка проектов."""

    projects: list[ProjectRead]
    total: int


# --- Message ---


class MessageCreate(BaseModel):
    """Схема создания сообщения."""

    text: str
    attachments: list[dict[str, str]] | None = None


class MessageRead(BaseModel):
    """Схема чтения сообщения."""

    id: str
    project_id: str
    sender: str
    text: str
    metadata_json: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageListRead(BaseModel):
    """Схема списка сообщений."""

    messages: list[MessageRead]
    total: int


# --- Artifact ---


class ArtifactRead(BaseModel):
    """Схема чтения артефакта."""

    id: str
    project_id: str
    filename: str
    file_type: str
    storage_path: str | None = None
    content: str | None = None
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactListRead(BaseModel):
    """Схема списка артефактов."""

    artifacts: list[ArtifactRead]
    total: int
