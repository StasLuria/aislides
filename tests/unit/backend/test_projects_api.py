"""Unit-тесты для REST API проектов.

Тестируем все CRUD-эндпоинты через TestClient + in-memory SQLite.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient

# ============================================================
# POST /api/projects
# ============================================================


class TestCreateProject:
    """Тесты создания проекта."""

    @pytest.mark.asyncio
    async def test_create_project_default_title(self, client: AsyncClient) -> None:
        """Создание проекта с дефолтным названием."""
        resp = await client.post("/api/projects", json={})
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Новый проект"
        assert data["status"] == "idle"
        assert "id" in data
        assert "user_id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_project_custom_title(self, client: AsyncClient) -> None:
        """Создание проекта с кастомным названием."""
        resp = await client.post("/api/projects", json={"title": "Моя презентация"})
        assert resp.status_code == 201
        assert resp.json()["title"] == "Моя презентация"


# ============================================================
# GET /api/projects
# ============================================================


class TestListProjects:
    """Тесты списка проектов."""

    @pytest.mark.asyncio
    async def test_list_empty(self, client: AsyncClient) -> None:
        """Пустой список проектов."""
        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["projects"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_with_projects(self, client: AsyncClient) -> None:
        """Список с несколькими проектами."""
        await client.post("/api/projects", json={"title": "Проект 1"})
        await client.post("/api/projects", json={"title": "Проект 2"})
        await client.post("/api/projects", json={"title": "Проект 3"})

        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["projects"]) == 3

    @pytest.mark.asyncio
    async def test_list_pagination(self, client: AsyncClient) -> None:
        """Пагинация списка проектов."""
        for i in range(5):
            await client.post("/api/projects", json={"title": f"Проект {i}"})

        resp = await client.get("/api/projects?offset=0&limit=2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 5
        assert len(data["projects"]) == 2


# ============================================================
# GET /api/projects/{id}
# ============================================================


class TestGetProject:
    """Тесты получения проекта."""

    @pytest.mark.asyncio
    async def test_get_existing_project(self, client: AsyncClient) -> None:
        """Получение существующего проекта."""
        create_resp = await client.post("/api/projects", json={"title": "Тест"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == project_id
        assert resp.json()["title"] == "Тест"

    @pytest.mark.asyncio
    async def test_get_nonexistent_project(self, client: AsyncClient) -> None:
        """Получение несуществующего проекта — 404."""
        resp = await client.get("/api/projects/nonexistent-id")
        assert resp.status_code == 404


# ============================================================
# PATCH /api/projects/{id}
# ============================================================


class TestUpdateProject:
    """Тесты обновления проекта."""

    @pytest.mark.asyncio
    async def test_update_title(self, client: AsyncClient) -> None:
        """Обновление названия проекта."""
        create_resp = await client.post("/api/projects", json={"title": "Старое"})
        project_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/projects/{project_id}",
            json={"title": "Новое"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Новое"

    @pytest.mark.asyncio
    async def test_update_nonexistent_project(self, client: AsyncClient) -> None:
        """Обновление несуществующего проекта — 404."""
        resp = await client.patch(
            "/api/projects/nonexistent-id",
            json={"title": "Тест"},
        )
        assert resp.status_code == 404


# ============================================================
# DELETE /api/projects/{id}
# ============================================================


class TestDeleteProject:
    """Тесты удаления проекта."""

    @pytest.mark.asyncio
    async def test_delete_existing_project(self, client: AsyncClient) -> None:
        """Удаление существующего проекта."""
        create_resp = await client.post("/api/projects", json={"title": "Удалить"})
        project_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/projects/{project_id}")
        assert resp.status_code == 204

        # Проверяем, что проект удалён
        get_resp = await client.get(f"/api/projects/{project_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_project(self, client: AsyncClient) -> None:
        """Удаление несуществующего проекта — 404."""
        resp = await client.delete("/api/projects/nonexistent-id")
        assert resp.status_code == 404


# ============================================================
# GET /api/projects/{id}/messages
# ============================================================


class TestListMessages:
    """Тесты получения сообщений проекта."""

    @pytest.mark.asyncio
    async def test_messages_empty(self, client: AsyncClient) -> None:
        """Пустой список сообщений."""
        create_resp = await client.post("/api/projects", json={"title": "Тест"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}/messages")
        assert resp.status_code == 200
        data = resp.json()
        assert data["messages"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_messages_nonexistent_project(self, client: AsyncClient) -> None:
        """Сообщения несуществующего проекта — 404."""
        resp = await client.get("/api/projects/nonexistent-id/messages")
        assert resp.status_code == 404


# ============================================================
# GET /api/projects/{id}/artifacts
# ============================================================


class TestListArtifacts:
    """Тесты получения артефактов проекта."""

    @pytest.mark.asyncio
    async def test_artifacts_empty(self, client: AsyncClient) -> None:
        """Пустой список артефактов."""
        create_resp = await client.post("/api/projects", json={"title": "Тест"})
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/projects/{project_id}/artifacts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["artifacts"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_artifacts_nonexistent_project(self, client: AsyncClient) -> None:
        """Артефакты несуществующего проекта — 404."""
        resp = await client.get("/api/projects/nonexistent-id/artifacts")
        assert resp.status_code == 404


# ============================================================
# Health check
# ============================================================


class TestHealthCheck:
    """Тесты health check."""

    @pytest.mark.asyncio
    async def test_health(self, client: AsyncClient) -> None:
        """Health check возвращает ok."""
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
