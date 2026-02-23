"""Unit-тесты для ProjectService.

Тестируем CRUD-операции напрямую через сервис.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from backend.app.services.project_service import ProjectService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

# ============================================================
# Projects CRUD
# ============================================================


class TestProjectServiceCRUD:
    """Тесты CRUD-операций для проектов."""

    @pytest.mark.asyncio
    async def test_create_project(self, db_session: AsyncSession) -> None:
        """Создание проекта."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тестовый проект")
        assert project.title == "Тестовый проект"
        assert project.status == "idle"
        assert project.id is not None

    @pytest.mark.asyncio
    async def test_create_project_default_title(self, db_session: AsyncSession) -> None:
        """Создание проекта с дефолтным названием."""
        svc = ProjectService(db_session)
        project = await svc.create_project()
        assert project.title == "Новый проект"

    @pytest.mark.asyncio
    async def test_get_project(self, db_session: AsyncSession) -> None:
        """Получение проекта по ID."""
        svc = ProjectService(db_session)
        created = await svc.create_project(title="Найди меня")
        found = await svc.get_project(created.id)
        assert found is not None
        assert found.id == created.id
        assert found.title == "Найди меня"

    @pytest.mark.asyncio
    async def test_get_nonexistent_project(self, db_session: AsyncSession) -> None:
        """Получение несуществующего проекта — None."""
        svc = ProjectService(db_session)
        found = await svc.get_project("nonexistent-id")
        assert found is None

    @pytest.mark.asyncio
    async def test_list_projects(self, db_session: AsyncSession) -> None:
        """Список проектов."""
        svc = ProjectService(db_session)
        await svc.create_project(title="Проект 1")
        await svc.create_project(title="Проект 2")

        projects, total = await svc.list_projects()
        assert total == 2
        assert len(projects) == 2

    @pytest.mark.asyncio
    async def test_list_projects_pagination(self, db_session: AsyncSession) -> None:
        """Пагинация списка проектов."""
        svc = ProjectService(db_session)
        for i in range(5):
            await svc.create_project(title=f"Проект {i}")

        projects, total = await svc.list_projects(offset=2, limit=2)
        assert total == 5
        assert len(projects) == 2

    @pytest.mark.asyncio
    async def test_update_project(self, db_session: AsyncSession) -> None:
        """Обновление проекта."""
        svc = ProjectService(db_session)
        created = await svc.create_project(title="Старое")
        updated = await svc.update_project(created.id, title="Новое")
        assert updated is not None
        assert updated.title == "Новое"

    @pytest.mark.asyncio
    async def test_update_nonexistent_project(self, db_session: AsyncSession) -> None:
        """Обновление несуществующего проекта — None."""
        svc = ProjectService(db_session)
        result = await svc.update_project("nonexistent-id", title="Тест")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_project(self, db_session: AsyncSession) -> None:
        """Удаление проекта."""
        svc = ProjectService(db_session)
        created = await svc.create_project(title="Удалить")
        deleted = await svc.delete_project(created.id)
        assert deleted is True

        found = await svc.get_project(created.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_project(self, db_session: AsyncSession) -> None:
        """Удаление несуществующего проекта — False."""
        svc = ProjectService(db_session)
        deleted = await svc.delete_project("nonexistent-id")
        assert deleted is False


# ============================================================
# Messages
# ============================================================


class TestProjectServiceMessages:
    """Тесты операций с сообщениями."""

    @pytest.mark.asyncio
    async def test_add_message(self, db_session: AsyncSession) -> None:
        """Добавление сообщения."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        msg = await svc.add_message(
            project_id=project.id,
            sender="user",
            text="Привет!",
        )
        assert msg.sender == "user"
        assert msg.text == "Привет!"
        assert msg.project_id == project.id

    @pytest.mark.asyncio
    async def test_add_message_with_metadata(self, db_session: AsyncSession) -> None:
        """Добавление сообщения с метаданными."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        msg = await svc.add_message(
            project_id=project.id,
            sender="ai",
            text="Результат",
            metadata_json='{"artifacts_count": 3}',
        )
        assert msg.metadata_json == '{"artifacts_count": 3}'

    @pytest.mark.asyncio
    async def test_list_messages(self, db_session: AsyncSession) -> None:
        """Список сообщений проекта."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        await svc.add_message(project_id=project.id, sender="user", text="Сообщение 1")
        await svc.add_message(project_id=project.id, sender="ai", text="Сообщение 2")

        messages, total = await svc.list_messages(project_id=project.id)
        assert total == 2
        assert len(messages) == 2

    @pytest.mark.asyncio
    async def test_list_messages_pagination(self, db_session: AsyncSession) -> None:
        """Пагинация сообщений."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        for i in range(5):
            await svc.add_message(project_id=project.id, sender="user", text=f"Msg {i}")

        messages, total = await svc.list_messages(project_id=project.id, offset=2, limit=2)
        assert total == 5
        assert len(messages) == 2


# ============================================================
# Artifacts
# ============================================================


class TestProjectServiceArtifacts:
    """Тесты операций с артефактами."""

    @pytest.mark.asyncio
    async def test_add_artifact(self, db_session: AsyncSession) -> None:
        """Добавление артефакта."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        artifact = await svc.add_artifact(
            project_id=project.id,
            filename="presentation.html",
            file_type="html",
            content="<h1>Тест</h1>",
            version=1,
        )
        assert artifact.filename == "presentation.html"
        assert artifact.file_type == "html"
        assert artifact.content == "<h1>Тест</h1>"

    @pytest.mark.asyncio
    async def test_get_artifact(self, db_session: AsyncSession) -> None:
        """Получение артефакта по ID."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        created = await svc.add_artifact(
            project_id=project.id,
            filename="test.html",
            file_type="html",
        )
        found = await svc.get_artifact(created.id)
        assert found is not None
        assert found.id == created.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_artifact(self, db_session: AsyncSession) -> None:
        """Получение несуществующего артефакта — None."""
        svc = ProjectService(db_session)
        found = await svc.get_artifact("nonexistent-id")
        assert found is None

    @pytest.mark.asyncio
    async def test_list_artifacts(self, db_session: AsyncSession) -> None:
        """Список артефактов проекта."""
        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")
        await svc.add_artifact(project_id=project.id, filename="a.html", file_type="html")
        await svc.add_artifact(project_id=project.id, filename="b.css", file_type="css")

        artifacts, total = await svc.list_artifacts(project_id=project.id)
        assert total == 2
        assert len(artifacts) == 2
