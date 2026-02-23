"""Unit-тесты для сервиса аутентификации.

Тестирует:
- Хеширование и верификацию паролей.
- Создание и декодирование JWT-токенов.
- Регистрацию и аутентификацию пользователей.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.app.services.auth_service import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    register_user,
    verify_password,
)

# --- Тесты хеширования паролей ---


class TestPasswordHashing:
    """Тесты хеширования и верификации паролей."""

    def test_hash_password_returns_hash(self) -> None:
        """hash_password возвращает bcrypt-хеш, отличный от исходного пароля."""
        password = "my_secure_password"
        hashed = hash_password(password)
        assert hashed != password
        assert hashed.startswith("$2b$")

    def test_verify_password_correct(self) -> None:
        """verify_password возвращает True для правильного пароля."""
        password = "test_password_123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self) -> None:
        """verify_password возвращает False для неправильного пароля."""
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_hash_password_unique_salts(self) -> None:
        """Два хеша одного пароля различаются (разные salt)."""
        password = "same_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
        # Но оба верифицируются
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


# --- Тесты JWT-токенов ---


class TestJWTTokens:
    """Тесты создания и декодирования JWT-токенов."""

    def test_create_and_decode_token(self) -> None:
        """Созданный токен успешно декодируется с правильными данными."""
        token = create_access_token(user_id="user-123", email="test@example.com")
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"

    def test_decode_expired_token(self) -> None:
        """Просроченный токен возвращает None."""
        token = create_access_token(
            user_id="user-123",
            email="test@example.com",
            expires_delta=timedelta(seconds=-1),
        )
        payload = decode_access_token(token)
        assert payload is None

    def test_decode_invalid_token(self) -> None:
        """Невалидный токен возвращает None."""
        payload = decode_access_token("invalid.token.string")
        assert payload is None

    def test_decode_token_missing_fields(self) -> None:
        """Токен без обязательных полей возвращает None."""
        from jose import jwt

        from backend.app.config import get_settings

        settings = get_settings()
        # Токен без 'sub'
        token = jwt.encode(
            {"email": "test@example.com"},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        payload = decode_access_token(token)
        assert payload is None

    def test_custom_expiration(self) -> None:
        """Токен с кастомным временем жизни работает."""
        token = create_access_token(
            user_id="user-456",
            email="custom@example.com",
            expires_delta=timedelta(hours=1),
        )
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-456"


# --- Тесты работы с БД ---


class TestUserDBOperations:
    """Тесты операций с пользователями в БД."""

    @pytest.mark.asyncio
    async def test_get_user_by_email_found(self) -> None:
        """get_user_by_email возвращает пользователя, если он найден."""
        mock_user = MagicMock()
        mock_user.email = "test@example.com"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await get_user_by_email(mock_db, "test@example.com")
        assert user is not None
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self) -> None:
        """get_user_by_email возвращает None, если пользователь не найден."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await get_user_by_email(mock_db, "nonexistent@example.com")
        assert user is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_found(self) -> None:
        """get_user_by_id возвращает пользователя по UUID."""
        mock_user = MagicMock()
        mock_user.id = "user-123"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await get_user_by_id(mock_db, "user-123")
        assert user is not None
        assert user.id == "user-123"

    @pytest.mark.asyncio
    async def test_register_user_success(self) -> None:
        """register_user создаёт нового пользователя."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # Нет существующего

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await register_user(
            db=mock_db,
            email="new@example.com",
            username="NewUser",
            password="password123",
        )
        assert user.email == "new@example.com"
        assert user.username == "NewUser"
        assert user.hashed_password != "password123"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_user_duplicate_email(self) -> None:
        """register_user выбрасывает ValueError при дублировании email."""
        existing_user = MagicMock()
        existing_user.email = "existing@example.com"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValueError, match="уже существует"):
            await register_user(
                db=mock_db,
                email="existing@example.com",
                username="User",
                password="password123",
            )

    @pytest.mark.asyncio
    async def test_authenticate_user_success(self) -> None:
        """authenticate_user возвращает пользователя при правильных данных."""
        mock_user = MagicMock()
        mock_user.email = "test@example.com"
        mock_user.hashed_password = hash_password("correct_password")
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "test@example.com", "correct_password")
        assert user is not None
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self) -> None:
        """authenticate_user возвращает None при неверном пароле."""
        mock_user = MagicMock()
        mock_user.email = "test@example.com"
        mock_user.hashed_password = hash_password("correct_password")
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "test@example.com", "wrong_password")
        assert user is None

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self) -> None:
        """authenticate_user возвращает None если пользователь не найден."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "nonexistent@example.com", "password")
        assert user is None

    @pytest.mark.asyncio
    async def test_authenticate_user_inactive(self) -> None:
        """authenticate_user возвращает None для неактивного пользователя."""
        mock_user = MagicMock()
        mock_user.email = "inactive@example.com"
        mock_user.hashed_password = hash_password("password123")
        mock_user.is_active = False

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "inactive@example.com", "password123")
        assert user is None
