"""SharedStore — единственный источник правды о состоянии задачи.

Реализация по ТЗ v3.0, §4.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ProjectStatus(str, Enum):
    """Статус проекта в жизненном цикле движка."""

    PENDING = "pending"
    PLANNING = "planning"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ChatMessage(BaseModel):
    """Сообщение в истории чата."""

    role: str
    content: str


class AttachedFile(BaseModel):
    """Метаданные прикреплённого файла."""

    file_id: str
    filename: str
    path: str


class Artifact(BaseModel):
    """Метаданные сгенерированного артефакта (файла).

    Примеры: structure.md, presentation.html.
    """

    artifact_id: str
    filename: str
    storage_path: str
    version: int = 1
    created_by: str


class SharedStore(BaseModel):
    """Центральное хранилище состояния задачи.

    Передаётся между всеми узлами движка. Содержит входные данные,
    план выполнения, результаты работы узлов и метаданные артефактов.

    Attributes:
        project_id: Уникальный идентификатор проекта.
        status: Текущий статус выполнения.
        user_input: Входные данные от пользователя.
        config: Конфигурация движка (из config.yaml).
        chat_history: История сообщений чата.
        attached_files: Прикреплённые файлы от пользователя.
        execution_plan: JSON-план, сгенерированный S0_PlannerNode.
        plan_validation_errors: Ошибки валидации плана (если есть).
        results: Структурированные результаты работы каждого узла.
        artifacts: Метаданные сгенерированных файлов.
        errors: Список ошибок, возникших при выполнении.
    """

    project_id: str
    status: ProjectStatus = ProjectStatus.PENDING
    user_input: dict[str, Any]
    config: dict[str, Any]
    chat_history: list[ChatMessage] = Field(default_factory=list)
    attached_files: list[AttachedFile] = Field(default_factory=list)
    execution_plan: dict[str, Any] | None = None
    plan_validation_errors: list[str] | None = None
    results: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[Artifact] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)

    def to_json(self) -> str:
        """Сериализовать SharedStore в JSON-строку."""
        return self.model_dump_json()

    @classmethod
    def from_json(cls, json_str: str) -> SharedStore:
        """Десериализовать SharedStore из JSON-строки."""
        return cls.model_validate_json(json_str)
