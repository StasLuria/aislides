"""Integration-тесты авторизации.

Тестирует полный цикл авторизации с реальной БД (in-memory SQLite):
- Регистрация нового пользователя → получение JWT.
- Логин существующего пользователя → получение JWT.
- Использование JWT для доступа к защищённым эндпоинтам.
- Отклонение запросов без токена / с невалидным токеном.
- Полный flow: register → login → create project → list projects.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

import pytest

from backend.app.services.auth_service import create_access_token

if TYPE_CHECKING:
    from httpx import AsyncClient

# ============================================================
# Registration Integration Tests
# ============================================================


class TestRegistrationIntegration:
    """Integration-тесты регистрации с реальной БД."""

    @pytest.mark.asyncio
    async def test_register_creates_user_and_returns_token(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Регистрация создаёт пользователя в БД и возвращает валидный JWT."""
        response = await auth_client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "NewUser",
                "password": "securepass123",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["username"] == "NewUser"
        assert "id" in data["user"]

    @pytest.mark.asyncio
    async def test_register_token_works_for_protected_endpoints(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Токен, полученный при регистрации, работает для защищённых эндпоинтов."""
        # Регистрируемся
        reg_response = await auth_client.post(
            "/api/auth/register",
            json={
                "email": "tokentest@example.com",
                "username": "TokenTest",
                "password": "securepass123",
            },
        )
        token = reg_response.json()["access_token"]

        # Используем токен для создания проекта
        proj_response = await auth_client.post(
            "/api/projects",
            json={"title": "Мой проект"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert proj_response.status_code == 201
        assert proj_response.json()["title"] == "Мой проект"

    @pytest.mark.asyncio
    async def test_register_duplicate_email_returns_409(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Повторная регистрация с тем же email возвращает 409."""
        user_data = {
            "email": "duplicate@example.com",
            "username": "First",
            "password": "password123",
        }

        # Первая регистрация — успех
        response1 = await auth_client.post("/api/auth/register", json=user_data)
        assert response1.status_code == 201

        # Вторая регистрация — конфликт
        response2 = await auth_client.post(
            "/api/auth/register",
            json={**user_data, "username": "Second"},
        )
        assert response2.status_code == 409

    @pytest.mark.asyncio
    async def test_register_validation_errors(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Невалидные данные при регистрации возвращают 422."""
        # Невалидный email
        response = await auth_client.post(
            "/api/auth/register",
            json={"email": "bad", "username": "User", "password": "password123"},
        )
        assert response.status_code == 422

        # Короткий пароль
        response = await auth_client.post(
            "/api/auth/register",
            json={"email": "ok@example.com", "username": "User", "password": "123"},
        )
        assert response.status_code == 422


# ============================================================
# Login Integration Tests
# ============================================================


class TestLoginIntegration:
    """Integration-тесты логина с реальной БД."""

    @pytest.mark.asyncio
    async def test_login_with_valid_credentials(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Логин с правильными данными возвращает JWT."""
        response = await auth_client.post(
            "/api/auth/login",
            json={
                "email": "alice@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "alice@example.com"
        assert data["user"]["id"] == user_alice["id"]

    @pytest.mark.asyncio
    async def test_login_with_wrong_password(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Логин с неверным паролем возвращает 401."""
        response = await auth_client.post(
            "/api/auth/login",
            json={
                "email": "alice@example.com",
                "password": "wrong_password",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_with_nonexistent_email(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Логин с несуществующим email возвращает 401."""
        response = await auth_client.post(
            "/api/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_token_works_for_protected_endpoints(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Токен, полученный при логине, работает для защищённых эндпоинтов."""
        # Логинимся
        login_response = await auth_client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "password123"},
        )
        token = login_response.json()["access_token"]

        # Используем токен для списка проектов
        proj_response = await auth_client.get(
            "/api/projects",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert proj_response.status_code == 200
        assert "projects" in proj_response.json()


# ============================================================
# Token Validation Integration Tests
# ============================================================


class TestTokenValidationIntegration:
    """Integration-тесты валидации JWT-токенов."""

    @pytest.mark.asyncio
    async def test_no_token_returns_401(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Запрос без токена возвращает 401."""
        response = await auth_client.get("/api/projects")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Запрос с невалидным токеном возвращает 401."""
        response = await auth_client.get(
            "/api/projects",
            headers={"Authorization": "Bearer invalid-token-string"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(
        self,
        auth_client: AsyncClient,
        user_alice: dict,
    ) -> None:
        """Запрос с истёкшим токеном возвращает 401."""
        expired_token = create_access_token(
            user_id=user_alice["id"],
            email=user_alice["email"],
            expires_delta=timedelta(seconds=-10),
        )
        response = await auth_client.get(
            "/api/projects",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_token_for_deleted_user_returns_401(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Токен для несуществующего пользователя возвращает 401."""
        ghost_token = create_access_token(
            user_id="nonexistent-user-id",
            email="ghost@example.com",
        )
        response = await auth_client.get(
            "/api/projects",
            headers={"Authorization": f"Bearer {ghost_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_bearer_header_returns_401(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Запрос с неправильным форматом Authorization header возвращает 401."""
        response = await auth_client.get(
            "/api/projects",
            headers={"Authorization": "NotBearer some-token"},
        )
        assert response.status_code == 401


# ============================================================
# Full Auth Flow Integration Tests
# ============================================================


class TestFullAuthFlow:
    """Integration-тесты полного цикла авторизации."""

    @pytest.mark.asyncio
    async def test_register_then_login_then_use_api(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Полный flow: register → login → create project → list projects."""
        # 1. Регистрация
        reg_response = await auth_client.post(
            "/api/auth/register",
            json={
                "email": "fullflow@example.com",
                "username": "FullFlow",
                "password": "securepass123",
            },
        )
        assert reg_response.status_code == 201
        reg_token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]

        # 2. Логин (тем же пользователем)
        login_response = await auth_client.post(
            "/api/auth/login",
            json={"email": "fullflow@example.com", "password": "securepass123"},
        )
        assert login_response.status_code == 200
        login_token = login_response.json()["access_token"]
        assert login_response.json()["user"]["id"] == user_id

        # 3. Создание проекта с токеном от логина
        headers = {"Authorization": f"Bearer {login_token}"}
        proj_response = await auth_client.post(
            "/api/projects",
            json={"title": "Тестовый проект"},
            headers=headers,
        )
        assert proj_response.status_code == 201
        project_id = proj_response.json()["id"]

        # 4. Список проектов — должен содержать созданный проект
        list_response = await auth_client.get("/api/projects", headers=headers)
        assert list_response.status_code == 200
        projects = list_response.json()["projects"]
        assert len(projects) == 1
        assert projects[0]["id"] == project_id
        assert projects[0]["title"] == "Тестовый проект"

        # 5. Токен от регистрации тоже работает
        list_response2 = await auth_client.get(
            "/api/projects",
            headers={"Authorization": f"Bearer {reg_token}"},
        )
        assert list_response2.status_code == 200
        assert len(list_response2.json()["projects"]) == 1

    @pytest.mark.asyncio
    async def test_two_users_register_independently(
        self,
        auth_client: AsyncClient,
    ) -> None:
        """Два пользователя могут зарегистрироваться и получить разные токены."""
        # Регистрация пользователя 1
        resp1 = await auth_client.post(
            "/api/auth/register",
            json={"email": "user1@example.com", "username": "User1", "password": "pass123456"},
        )
        assert resp1.status_code == 201

        # Регистрация пользователя 2
        resp2 = await auth_client.post(
            "/api/auth/register",
            json={"email": "user2@example.com", "username": "User2", "password": "pass654321"},
        )
        assert resp2.status_code == 201

        # Разные user_id
        assert resp1.json()["user"]["id"] != resp2.json()["user"]["id"]

        # Разные токены
        assert resp1.json()["access_token"] != resp2.json()["access_token"]
