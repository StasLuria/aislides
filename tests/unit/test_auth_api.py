"""Unit-тесты для API авторизации.

Тестирует endpoints:
- POST /api/auth/register
- POST /api/auth/login
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.main import app


@pytest.fixture
def mock_db() -> AsyncMock:
    """Мок сессии БД."""
    return AsyncMock()


@pytest.fixture
def mock_user() -> MagicMock:
    """Мок пользователя."""
    user = MagicMock()
    user.id = "user-test-123"
    user.email = "test@example.com"
    user.username = "TestUser"
    user.is_active = True
    user.hashed_password = "hashed"
    return user


class TestRegisterEndpoint:
    """Тесты POST /api/auth/register."""

    @pytest.mark.asyncio
    async def test_register_success(self, mock_user: MagicMock) -> None:
        """Успешная регистрация возвращает 201 с токеном."""
        with (
            patch("backend.app.routers.auth.get_db") as mock_get_db,
            patch("backend.app.routers.auth.register_user") as mock_register,
            patch("backend.app.routers.auth.create_access_token") as mock_token,
        ):
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            app.dependency_overrides[__import__("backend.app.database", fromlist=["get_db"]).get_db] = lambda: mock_db

            mock_register.return_value = mock_user
            mock_token.return_value = "test-jwt-token"

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/auth/register",
                    json={
                        "email": "new@example.com",
                        "username": "NewUser",
                        "password": "password123",
                    },
                )

            assert response.status_code == 201
            data = response.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"
            assert data["user"]["email"] == "test@example.com"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self) -> None:
        """Регистрация с существующим email возвращает 409."""
        with (patch("backend.app.routers.auth.register_user") as mock_register,):
            mock_register.side_effect = ValueError("уже существует")

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/auth/register",
                    json={
                        "email": "existing@example.com",
                        "username": "User",
                        "password": "password123",
                    },
                )

            assert response.status_code == 409
            assert "уже существует" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_invalid_email(self) -> None:
        """Регистрация с невалидным email возвращает 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/auth/register",
                json={
                    "email": "not-an-email",
                    "username": "User",
                    "password": "password123",
                },
            )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_password(self) -> None:
        """Регистрация с коротким паролем возвращает 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/auth/register",
                json={
                    "email": "test@example.com",
                    "username": "User",
                    "password": "12345",
                },
            )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_username(self) -> None:
        """Регистрация с коротким username возвращает 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/auth/register",
                json={
                    "email": "test@example.com",
                    "username": "A",
                    "password": "password123",
                },
            )

        assert response.status_code == 422


class TestLoginEndpoint:
    """Тесты POST /api/auth/login."""

    @pytest.mark.asyncio
    async def test_login_success(self, mock_user: MagicMock) -> None:
        """Успешный логин возвращает 200 с токеном."""
        with (
            patch("backend.app.routers.auth.authenticate_user") as mock_auth,
            patch("backend.app.routers.auth.create_access_token") as mock_token,
        ):
            mock_auth.return_value = mock_user
            mock_token.return_value = "test-jwt-token"

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/auth/login",
                    json={
                        "email": "test@example.com",
                        "password": "correct_password",
                    },
                )

            assert response.status_code == 200
            data = response.json()
            assert data["access_token"] == "test-jwt-token"
            assert data["token_type"] == "bearer"
            assert data["user"]["id"] == "user-test-123"

    @pytest.mark.asyncio
    async def test_login_wrong_credentials(self) -> None:
        """Неверные данные возвращают 401."""
        with patch("backend.app.routers.auth.authenticate_user") as mock_auth:
            mock_auth.return_value = None

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/auth/login",
                    json={
                        "email": "test@example.com",
                        "password": "wrong_password",
                    },
                )

            assert response.status_code == 401
            assert "Неверный" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_invalid_email_format(self) -> None:
        """Невалидный формат email возвращает 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/auth/login",
                json={
                    "email": "not-email",
                    "password": "password123",
                },
            )

        assert response.status_code == 422
