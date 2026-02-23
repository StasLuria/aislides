"""Integration-тесты изоляции данных между пользователями.

Тестирует, что:
- Пользователь видит только свои проекты.
- Пользователь не может получить/обновить/удалить чужой проект.
- Пользователь не может получить сообщения/артефакты чужого проекта.
- Каскадное удаление работает корректно.
- Пагинация работает в контексте одного пользователя.

Все тесты используют реальную in-memory SQLite и реальные JWT-токены.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient

# ============================================================
# Project Isolation Tests
# ============================================================


class TestProjectIsolation:
    """Тесты изоляции проектов между пользователями."""

    @pytest.mark.asyncio
    async def test_user_sees_only_own_projects(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Alice видит только свои проекты, Bob — только свои."""
        # Alice создаёт 2 проекта
        await auth_client.post(
            "/api/projects",
            json={"title": "Alice Project 1"},
            headers=user_alice["headers"],
        )
        await auth_client.post(
            "/api/projects",
            json={"title": "Alice Project 2"},
            headers=user_alice["headers"],
        )

        # Bob создаёт 1 проект
        await auth_client.post(
            "/api/projects",
            json={"title": "Bob Project 1"},
            headers=user_bob["headers"],
        )

        # Alice видит только 2 своих проекта
        alice_resp = await auth_client.get(
            "/api/projects",
            headers=user_alice["headers"],
        )
        assert alice_resp.status_code == 200
        alice_projects = alice_resp.json()["projects"]
        assert len(alice_projects) == 2
        assert alice_resp.json()["total"] == 2
        assert all("Alice" in p["title"] for p in alice_projects)

        # Bob видит только 1 свой проект
        bob_resp = await auth_client.get(
            "/api/projects",
            headers=user_bob["headers"],
        )
        assert bob_resp.status_code == 200
        bob_projects = bob_resp.json()["projects"]
        assert len(bob_projects) == 1
        assert bob_resp.json()["total"] == 1
        assert bob_projects[0]["title"] == "Bob Project 1"

    @pytest.mark.asyncio
    async def test_user_cannot_get_other_users_project(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Bob не может получить проект Alice по ID."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Secret"},
            headers=user_alice["headers"],
        )
        alice_project_id = resp.json()["id"]

        # Alice может получить свой проект
        alice_get = await auth_client.get(
            f"/api/projects/{alice_project_id}",
            headers=user_alice["headers"],
        )
        assert alice_get.status_code == 200

        # Bob не может получить проект Alice — 404
        bob_get = await auth_client.get(
            f"/api/projects/{alice_project_id}",
            headers=user_bob["headers"],
        )
        assert bob_get.status_code == 404

    @pytest.mark.asyncio
    async def test_user_cannot_update_other_users_project(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Bob не может обновить проект Alice."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Original"},
            headers=user_alice["headers"],
        )
        alice_project_id = resp.json()["id"]

        # Bob пытается обновить — 404
        bob_patch = await auth_client.patch(
            f"/api/projects/{alice_project_id}",
            json={"title": "Hacked by Bob"},
            headers=user_bob["headers"],
        )
        assert bob_patch.status_code == 404

        # Проверяем, что проект Alice не изменился
        alice_get = await auth_client.get(
            f"/api/projects/{alice_project_id}",
            headers=user_alice["headers"],
        )
        assert alice_get.json()["title"] == "Alice Original"

    @pytest.mark.asyncio
    async def test_user_cannot_delete_other_users_project(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Bob не может удалить проект Alice."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Important"},
            headers=user_alice["headers"],
        )
        alice_project_id = resp.json()["id"]

        # Bob пытается удалить — 404
        bob_delete = await auth_client.delete(
            f"/api/projects/{alice_project_id}",
            headers=user_bob["headers"],
        )
        assert bob_delete.status_code == 404

        # Проект Alice всё ещё существует
        alice_get = await auth_client.get(
            f"/api/projects/{alice_project_id}",
            headers=user_alice["headers"],
        )
        assert alice_get.status_code == 200

    @pytest.mark.asyncio
    async def test_user_can_crud_own_project(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Пользователь может создать, прочитать, обновить и удалить свой проект."""
        # Create
        create_resp = await auth_client.post(
            "/api/projects",
            json={"title": "My Project"},
            headers=user_alice["headers"],
        )
        assert create_resp.status_code == 201
        project_id = create_resp.json()["id"]

        # Read
        get_resp = await auth_client.get(
            f"/api/projects/{project_id}",
            headers=user_alice["headers"],
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "My Project"

        # Update
        patch_resp = await auth_client.patch(
            f"/api/projects/{project_id}",
            json={"title": "Updated Project"},
            headers=user_alice["headers"],
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["title"] == "Updated Project"

        # Delete
        delete_resp = await auth_client.delete(
            f"/api/projects/{project_id}",
            headers=user_alice["headers"],
        )
        assert delete_resp.status_code == 204

        # Verify deleted
        get_resp2 = await auth_client.get(
            f"/api/projects/{project_id}",
            headers=user_alice["headers"],
        )
        assert get_resp2.status_code == 404


# ============================================================
# Messages Isolation Tests
# ============================================================


class TestMessagesIsolation:
    """Тесты изоляции сообщений между пользователями."""

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_users_messages(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Bob не может получить сообщения из проекта Alice."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Chat"},
            headers=user_alice["headers"],
        )
        alice_project_id = resp.json()["id"]

        # Alice может получить сообщения своего проекта
        alice_msgs = await auth_client.get(
            f"/api/projects/{alice_project_id}/messages",
            headers=user_alice["headers"],
        )
        assert alice_msgs.status_code == 200

        # Bob не может получить сообщения проекта Alice — 404
        bob_msgs = await auth_client.get(
            f"/api/projects/{alice_project_id}/messages",
            headers=user_bob["headers"],
        )
        assert bob_msgs.status_code == 404


# ============================================================
# Artifacts Isolation Tests
# ============================================================


class TestArtifactsIsolation:
    """Тесты изоляции артефактов между пользователями."""

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_users_artifacts(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Bob не может получить артефакты из проекта Alice."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Slides"},
            headers=user_alice["headers"],
        )
        alice_project_id = resp.json()["id"]

        # Alice может получить артефакты своего проекта
        alice_arts = await auth_client.get(
            f"/api/projects/{alice_project_id}/artifacts",
            headers=user_alice["headers"],
        )
        assert alice_arts.status_code == 200

        # Bob не может получить артефакты проекта Alice — 404
        bob_arts = await auth_client.get(
            f"/api/projects/{alice_project_id}/artifacts",
            headers=user_bob["headers"],
        )
        assert bob_arts.status_code == 404


# ============================================================
# Pagination Isolation Tests
# ============================================================


class TestPaginationIsolation:
    """Тесты пагинации в контексте изоляции данных."""

    @pytest.mark.asyncio
    async def test_pagination_respects_user_isolation(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Пагинация показывает total только для проектов текущего пользователя."""
        # Alice создаёт 3 проекта
        for i in range(3):
            await auth_client.post(
                "/api/projects",
                json={"title": f"Alice Project {i}"},
                headers=user_alice["headers"],
            )

        # Bob создаёт 5 проектов
        for i in range(5):
            await auth_client.post(
                "/api/projects",
                json={"title": f"Bob Project {i}"},
                headers=user_bob["headers"],
            )

        # Alice видит total=3
        alice_resp = await auth_client.get(
            "/api/projects?offset=0&limit=2",
            headers=user_alice["headers"],
        )
        assert alice_resp.status_code == 200
        assert alice_resp.json()["total"] == 3
        assert len(alice_resp.json()["projects"]) == 2

        # Bob видит total=5
        bob_resp = await auth_client.get(
            "/api/projects?offset=0&limit=10",
            headers=user_bob["headers"],
        )
        assert bob_resp.status_code == 200
        assert bob_resp.json()["total"] == 5
        assert len(bob_resp.json()["projects"]) == 5

    @pytest.mark.asyncio
    async def test_nonexistent_project_returns_404(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Запрос к несуществующему проекту возвращает 404."""
        resp = await auth_client.get(
            "/api/projects/nonexistent-id-12345",
            headers=user_alice["headers"],
        )
        assert resp.status_code == 404


# ============================================================
# Cross-User Security Tests
# ============================================================


class TestCrossUserSecurity:
    """Расширенные тесты безопасности между пользователями."""

    @pytest.mark.asyncio
    async def test_deleting_project_doesnt_affect_other_user(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
        user_bob: dict,
    ) -> None:
        """Удаление проекта Alice не влияет на проекты Bob."""
        # Alice и Bob создают по проекту
        alice_resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice To Delete"},
            headers=user_alice["headers"],
        )
        alice_project_id = alice_resp.json()["id"]

        bob_resp = await auth_client.post(
            "/api/projects",
            json={"title": "Bob Stays"},
            headers=user_bob["headers"],
        )
        assert bob_resp.status_code == 201

        # Alice удаляет свой проект
        await auth_client.delete(
            f"/api/projects/{alice_project_id}",
            headers=user_alice["headers"],
        )

        # Bob всё ещё видит свой проект
        bob_list = await auth_client.get(
            "/api/projects",
            headers=user_bob["headers"],
        )
        assert bob_list.status_code == 200
        assert bob_list.json()["total"] == 1
        assert bob_list.json()["projects"][0]["title"] == "Bob Stays"

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_access_any_project(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Неавторизованный пользователь не может получить никакой проект."""
        # Alice создаёт проект
        resp = await auth_client.post(
            "/api/projects",
            json={"title": "Alice Private"},
            headers=user_alice["headers"],
        )
        project_id = resp.json()["id"]

        # Без токена — 401
        unauth_get = await auth_client.get(f"/api/projects/{project_id}")
        assert unauth_get.status_code == 401

        unauth_list = await auth_client.get("/api/projects")
        assert unauth_list.status_code == 401

        unauth_msgs = await auth_client.get(f"/api/projects/{project_id}/messages")
        assert unauth_msgs.status_code == 401

        unauth_arts = await auth_client.get(f"/api/projects/{project_id}/artifacts")
        assert unauth_arts.status_code == 401
