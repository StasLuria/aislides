"""EngineService — обёртка над EngineAPI для Backend.

Управляет жизненным циклом движка, запускает генерацию,
обрабатывает результаты и сохраняет артефакты в БД.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from backend.app.services.project_service import ProjectService
from engine.api import EngineAPI

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from schemas.events import EventType
    from schemas.shared_store import SharedStore

logger = logging.getLogger(__name__)


class EngineService:
    """Сервис для управления движком генерации.

    Attributes:
        engine: Экземпляр EngineAPI.
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.engine = EngineAPI(config=config)

    async def generate(
        self,
        db: AsyncSession,
        project_id: str,
        user_message: str,
        chat_history: list[dict[str, Any]] | None = None,
    ) -> SharedStore:
        """Запустить генерацию презентации.

        1. Обновляет статус проекта на 'running'.
        2. Сохраняет сообщение пользователя в БД.
        3. Запускает EngineAPI.run().
        4. Сохраняет результаты (артефакты, AI-сообщение) в БД.
        5. Обновляет статус проекта.

        Args:
            db: Сессия БД.
            project_id: ID проекта.
            user_message: Текст запроса пользователя.
            chat_history: История чата (опционально).

        Returns:
            Финальный SharedStore с результатами.
        """
        svc = ProjectService(db)

        # 1. Обновить статус проекта
        await svc.update_project(project_id, status="running")

        # 2. Сохранить сообщение пользователя
        await svc.add_message(
            project_id=project_id,
            sender="user",
            text=user_message,
        )

        # 3. Запустить движок
        store = await self.engine.run(
            project_id=project_id,
            user_input={"prompt": user_message},
            chat_history=chat_history,
        )

        # 4. Сохранить результаты
        await self._save_results(svc, project_id, store)

        # 5. Обновить статус проекта
        final_status = "completed" if store.status.value == "completed" else "failed"
        await svc.update_project(project_id, status=final_status)

        return store

    async def apply_edit(
        self,
        db: AsyncSession,
        project_id: str,
        artifact_id: str,
        new_content: str,
        chat_history: list[dict[str, Any]] | None = None,
    ) -> SharedStore:
        """Обработать ручную правку артефакта.

        Args:
            db: Сессия БД.
            project_id: ID проекта.
            artifact_id: ID артефакта.
            new_content: Новое содержимое.
            chat_history: История чата.

        Returns:
            Обновлённый SharedStore.
        """
        svc = ProjectService(db)
        await svc.update_project(project_id, status="running")

        store = await self.engine.apply_edit(
            project_id=project_id,
            artifact_id=artifact_id,
            new_content=new_content,
            chat_history=chat_history,
        )

        await self._save_results(svc, project_id, store)

        final_status = "completed" if store.status.value == "completed" else "failed"
        await svc.update_project(project_id, status=final_status)

        return store

    async def cancel(self, project_id: str) -> bool:
        """Отменить текущее выполнение."""
        return await self.engine.cancel(project_id)

    def subscribe(
        self,
        event_type: EventType,
        callback: Any,
    ) -> None:
        """Подписаться на события движка.

        Args:
            event_type: Тип события.
            callback: Async-функция обработчик.
        """
        self.engine.event_bus.subscribe(event_type, callback)

    async def _save_results(
        self,
        svc: ProjectService,
        project_id: str,
        store: SharedStore,
    ) -> None:
        """Сохранить результаты генерации в БД.

        Args:
            svc: Сервис проектов.
            project_id: ID проекта.
            store: SharedStore с результатами.
        """
        # Сохранить артефакты
        for artifact in store.artifacts:
            # Определяем file_type из расширения filename
            file_type = artifact.filename.rsplit(".", 1)[-1] if "." in artifact.filename else "unknown"
            # Читаем content с диска для сохранения в DB
            artifact_content: str | None = None
            if artifact.storage_path:
                try:
                    from pathlib import Path
                    content_path = Path(artifact.storage_path)
                    if content_path.exists():
                        artifact_content = content_path.read_text(encoding="utf-8")
                except Exception:
                    logger.warning(
                        "Could not read artifact content from %s",
                        artifact.storage_path,
                    )
            await svc.add_artifact(
                project_id=project_id,
                filename=artifact.filename,
                file_type=file_type,
                content=artifact_content,
                storage_path=artifact.storage_path,
                version=artifact.version,
            )

        # Сохранить AI-сообщение с итогом
        summary = self._build_summary(store)
        if summary:
            await svc.add_message(
                project_id=project_id,
                sender="ai",
                text=summary,
                metadata_json=json.dumps(
                    {"artifacts_count": len(store.artifacts), "status": store.status.value},
                    ensure_ascii=False,
                ),
            )

    @staticmethod
    def _build_summary(store: SharedStore) -> str:
        """Построить текстовое резюме генерации.

        Args:
            store: SharedStore с результатами.

        Returns:
            Текст резюме.
        """
        if store.errors:
            error_msgs = [e.get("error", "Неизвестная ошибка") for e in store.errors]
            return f"Произошла ошибка при генерации: {'; '.join(error_msgs)}"

        artifact_count = len(store.artifacts)
        if artifact_count == 0:
            return "Генерация завершена, но артефакты не были созданы."

        return f"Генерация завершена. Создано артефактов: {artifact_count}."
