"""Integration-тесты WebSocket, ConnectionManager, EngineBridge, FileStorage, Upload.

Тестирует:
- ConnectionManager: connect, disconnect, send_to_project
- WebSocket endpoint: подключение, маршрутизация сообщений
- EngineBridge: маппинг событий движка → WebSocket-сообщения
- FileStorage: save, load, delete, exists
- Upload endpoint: загрузка файлов, валидация
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.services.connection_manager import ConnectionManager
from backend.app.services.engine_bridge import EngineBridge, _map_engine_event_to_ws
from engine.file_storage import LocalFileStorage
from schemas.events import EngineEvent, EventType

# ============================================================
# ConnectionManager Tests
# ============================================================


class TestConnectionManager:
    """Тесты для ConnectionManager."""

    @pytest.fixture()
    def manager(self) -> ConnectionManager:
        """Создать экземпляр ConnectionManager."""
        return ConnectionManager()

    @pytest.fixture()
    def mock_websocket(self) -> MagicMock:
        """Создать mock WebSocket."""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        return ws

    @pytest.mark.asyncio()
    async def test_connect(
        self,
        manager: ConnectionManager,
        mock_websocket: MagicMock,
    ) -> None:
        """Тест: подключение клиента."""
        await manager.connect("proj-1", mock_websocket)
        assert manager.has_connections("proj-1")
        assert manager.get_connections_count("proj-1") == 1
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio()
    async def test_disconnect(
        self,
        manager: ConnectionManager,
        mock_websocket: MagicMock,
    ) -> None:
        """Тест: отключение клиента."""
        await manager.connect("proj-1", mock_websocket)
        manager.disconnect("proj-1", mock_websocket)
        assert not manager.has_connections("proj-1")
        assert manager.get_connections_count("proj-1") == 0

    @pytest.mark.asyncio()
    async def test_disconnect_nonexistent(
        self,
        manager: ConnectionManager,
        mock_websocket: MagicMock,
    ) -> None:
        """Тест: отключение несуществующего клиента не вызывает ошибку."""
        manager.disconnect("proj-nonexistent", mock_websocket)

    @pytest.mark.asyncio()
    async def test_multiple_connections(
        self,
        manager: ConnectionManager,
    ) -> None:
        """Тест: множественные подключения к одному проекту."""
        ws1 = AsyncMock()
        ws1.accept = AsyncMock()
        ws2 = AsyncMock()
        ws2.accept = AsyncMock()

        await manager.connect("proj-1", ws1)
        await manager.connect("proj-1", ws2)
        assert manager.get_connections_count("proj-1") == 2

    @pytest.mark.asyncio()
    async def test_send_to_project(
        self,
        manager: ConnectionManager,
        mock_websocket: MagicMock,
    ) -> None:
        """Тест: отправка сообщения клиенту."""
        await manager.connect("proj-1", mock_websocket)
        msg = {"type": "test", "payload": {"data": "hello"}}
        await manager.send_to_project("proj-1", msg)
        mock_websocket.send_text.assert_called_once_with(json.dumps(msg, ensure_ascii=False))

    @pytest.mark.asyncio()
    async def test_send_to_project_no_connections(
        self,
        manager: ConnectionManager,
    ) -> None:
        """Тест: отправка сообщения без подключений не вызывает ошибку."""
        await manager.send_to_project("proj-nonexistent", {"type": "test"})

    @pytest.mark.asyncio()
    async def test_send_removes_disconnected(
        self,
        manager: ConnectionManager,
    ) -> None:
        """Тест: отключённые клиенты удаляются при отправке."""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock(side_effect=Exception("disconnected"))

        await manager.connect("proj-1", ws)
        await manager.send_to_project("proj-1", {"type": "test"})
        # После ошибки отправки клиент должен быть удалён
        assert not manager.has_connections("proj-1")


# ============================================================
# Event Mapping Tests
# ============================================================


class TestEventMapping:
    """Тесты маппинга событий движка → WebSocket-сообщения."""

    def test_plan_started(self) -> None:
        """Тест: PLAN_STARTED → status_update."""
        event = EngineEvent(
            event_type=EventType.PLAN_STARTED,
            trace_id="t1",
            component="EngineAPI",
            message="Начата генерация",
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "status_update"
        assert result["payload"]["status"] == "in_progress"

    def test_plan_completed(self) -> None:
        """Тест: PLAN_COMPLETED → status_update."""
        event = EngineEvent(
            event_type=EventType.PLAN_COMPLETED,
            trace_id="t1",
            component="EngineAPI",
            message="План готов",
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "status_update"
        assert result["payload"]["status"] == "completed"

    def test_step_started(self) -> None:
        """Тест: STEP_STARTED → status_update."""
        event = EngineEvent(
            event_type=EventType.STEP_STARTED,
            trace_id="t1",
            component="RuntimeAgent",
            message="Анализ контекста",
            data={"node": "S1_ContextAnalyzer"},
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "status_update"
        assert result["payload"]["step"] == "S1: Анализ контекста"
        assert result["payload"]["status"] == "in_progress"

    def test_step_completed(self) -> None:
        """Тест: STEP_COMPLETED → status_update."""
        event = EngineEvent(
            event_type=EventType.STEP_COMPLETED,
            trace_id="t1",
            component="S1_ContextAnalyzer",
            message="Анализ завершён",
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "status_update"
        assert result["payload"]["status"] == "completed"

    def test_artifact_created(self) -> None:
        """Тест: ARTIFACT_CREATED → artifact_generated."""
        event = EngineEvent(
            event_type=EventType.ARTIFACT_CREATED,
            trace_id="t1",
            component="S4",
            message="Артефакт создан",
            data={
                "artifact_id": "slide-1",
                "filename": "slide_1.html",
                "file_type": "html",
                "preview_url": "/preview/slide-1",
            },
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "artifact_generated"
        assert result["payload"]["artifact_id"] == "slide-1"
        assert result["payload"]["filename"] == "slide_1.html"

    def test_ai_message(self) -> None:
        """Тест: AI_MESSAGE → ai_message."""
        event = EngineEvent(
            event_type=EventType.AI_MESSAGE,
            trace_id="t1",
            component="EngineAPI",
            message="Генерация завершена",
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "ai_message"
        assert result["payload"]["text"] == "Генерация завершена"

    def test_error(self) -> None:
        """Тест: ERROR → error."""
        event = EngineEvent(
            event_type=EventType.ERROR,
            trace_id="t1",
            component="EngineAPI",
            message="Критическая ошибка",
        )
        result = _map_engine_event_to_ws(event)
        assert result is not None
        assert result["type"] == "error"
        assert result["payload"]["message"] == "Критическая ошибка"


# ============================================================
# EngineBridge Tests
# ============================================================


class TestEngineBridge:
    """Тесты для EngineBridge."""

    @pytest.fixture()
    def mock_manager(self) -> Any:
        """Создать mock ConnectionManager."""
        mgr = MagicMock(spec=ConnectionManager)
        mgr.send_to_project = AsyncMock()
        mgr.has_connections = MagicMock(return_value=True)
        return mgr

    @pytest.mark.asyncio()
    async def test_run_generation_success(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: успешная генерация через bridge."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.artifacts = [MagicMock()]
        mock_store.errors = []

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.run = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_generation(
                project_id="proj-1",
                user_message="Создай презентацию",
            )

            mock_engine.run.assert_called_once()
            # Должно быть финальное сообщение
            mock_manager.send_to_project.assert_called()

    @pytest.mark.asyncio()
    async def test_run_generation_with_errors(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: генерация с ошибками."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.artifacts = []
        mock_store.errors = [{"error": "LLM timeout"}]

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.run = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_generation(
                project_id="proj-1",
                user_message="Создай презентацию",
            )

            # Должно быть сообщение об ошибке
            calls = mock_manager.send_to_project.call_args_list
            last_call = calls[-1]
            msg = last_call[0][1]
            assert "ошибка" in msg["payload"]["text"].lower() or "LLM timeout" in msg["payload"]["text"]

    @pytest.mark.asyncio()
    async def test_run_generation_exception(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: исключение при генерации."""
        bridge = EngineBridge(mock_manager)

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.run = AsyncMock(side_effect=RuntimeError("Connection lost"))
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_generation(
                project_id="proj-1",
                user_message="Создай презентацию",
            )

            calls = mock_manager.send_to_project.call_args_list
            last_call = calls[-1]
            msg = last_call[0][1]
            assert msg["type"] == "error"

    @pytest.mark.asyncio()
    async def test_run_edit_success(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: успешная правка через bridge."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.errors = []

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_edit(
                project_id="proj-1",
                artifact_id="slide-1",
                feedback_text="Измени заголовок",
            )

            mock_engine.apply_edit.assert_called_once()

    @pytest.mark.asyncio()
    async def test_cancel_active_engine(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: отмена активной генерации."""
        bridge = EngineBridge(mock_manager)

        mock_engine = AsyncMock()
        mock_engine.cancel = AsyncMock(return_value=True)

        # Имитируем активный движок
        from backend.app.services import engine_bridge

        engine_bridge._active_engines["proj-1"] = mock_engine

        result = await bridge.cancel("proj-1")
        assert result is True

        # Cleanup
        engine_bridge._active_engines.pop("proj-1", None)

    @pytest.mark.asyncio()
    async def test_cancel_no_active_engine(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: отмена без активной генерации."""
        bridge = EngineBridge(mock_manager)
        result = await bridge.cancel("proj-nonexistent")
        assert result is False

    def test_subscribe_all(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: подписка на все типы событий."""
        bridge = EngineBridge(mock_manager)
        mock_engine = MagicMock()
        mock_engine.event_bus = MagicMock()
        mock_engine.event_bus.subscribe = MagicMock()

        bridge._subscribe_all(mock_engine, "proj-1")

        # Должно быть по одному вызову subscribe для каждого типа события
        assert mock_engine.event_bus.subscribe.call_count == len(EventType)


# ============================================================
# FileStorage Tests
# ============================================================


class TestLocalFileStorage:
    """Тесты для LocalFileStorage."""

    @pytest.fixture()
    def storage(self, tmp_path: Any) -> LocalFileStorage:
        """Создать FileStorage с временной директорией."""
        return LocalFileStorage(base_dir=str(tmp_path / "uploads"))

    @pytest.mark.asyncio()
    async def test_save_and_load(self, storage: LocalFileStorage) -> None:
        """Тест: сохранение и загрузка файла."""
        content = b"Hello, World!"
        path = await storage.save("test.txt", content)
        assert path.endswith("test.txt")

        loaded = await storage.load("test.txt")
        assert loaded == content

    @pytest.mark.asyncio()
    async def test_save_nested_path(self, storage: LocalFileStorage) -> None:
        """Тест: сохранение файла во вложенную директорию."""
        content = b"Nested content"
        path = await storage.save("subdir/nested.txt", content)
        assert "subdir" in path

        loaded = await storage.load("subdir/nested.txt")
        assert loaded == content

    @pytest.mark.asyncio()
    async def test_load_nonexistent(self, storage: LocalFileStorage) -> None:
        """Тест: загрузка несуществующего файла."""
        with pytest.raises(FileNotFoundError):
            await storage.load("nonexistent.txt")

    @pytest.mark.asyncio()
    async def test_delete(self, storage: LocalFileStorage) -> None:
        """Тест: удаление файла."""
        await storage.save("to_delete.txt", b"delete me")
        assert await storage.exists("to_delete.txt")

        result = await storage.delete("to_delete.txt")
        assert result is True
        assert not await storage.exists("to_delete.txt")

    @pytest.mark.asyncio()
    async def test_delete_nonexistent(self, storage: LocalFileStorage) -> None:
        """Тест: удаление несуществующего файла."""
        result = await storage.delete("nonexistent.txt")
        assert result is False

    @pytest.mark.asyncio()
    async def test_exists(self, storage: LocalFileStorage) -> None:
        """Тест: проверка существования файла."""
        assert not await storage.exists("test.txt")
        await storage.save("test.txt", b"content")
        assert await storage.exists("test.txt")

    def test_generate_unique_filename(self) -> None:
        """Тест: генерация уникального имени файла."""
        name1 = LocalFileStorage.generate_unique_filename("photo.jpg")
        name2 = LocalFileStorage.generate_unique_filename("photo.jpg")
        assert name1 != name2
        assert name1.endswith(".jpg")
        assert name2.endswith(".jpg")


# ============================================================
# Upload Endpoint Tests
# ============================================================


class TestUploadEndpoint:
    """Тесты для upload endpoint."""

    @pytest.fixture()
    def client(self) -> Any:
        """Создать TestClient для upload endpoint с авторизацией."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from backend.app.dependencies.auth import get_current_user
        from backend.app.routers.upload import router

        test_app = FastAPI()
        test_app.include_router(router)

        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = "test@test.com"
        mock_user.is_active = True

        async def override_user() -> Any:
            return mock_user

        test_app.dependency_overrides[get_current_user] = override_user
        return TestClient(test_app)

    def test_upload_success(self, client: Any, tmp_path: Any) -> None:
        """Тест: успешная загрузка файла."""
        with patch("backend.app.routers.upload._storage") as mock_storage:
            mock_storage.save = AsyncMock(return_value=str(tmp_path / "test.txt"))

            response = client.post(
                "/api/upload",
                files={"file": ("test.txt", b"Hello World", "text/plain")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "test.txt"
            assert data["size"] == str(len(b"Hello World"))

    def test_upload_no_filename(self, client: Any) -> None:
        """Тест: загрузка без имени файла."""
        response = client.post(
            "/api/upload",
            files={"file": ("", b"content", "text/plain")},
        )
        # FastAPI может вернуть 400 или 422 для невалидного имени файла
        assert response.status_code in (400, 422)

    def test_upload_invalid_extension(self, client: Any) -> None:
        """Тест: загрузка файла с недопустимым расширением."""
        response = client.post(
            "/api/upload",
            files={"file": ("malware.exe", b"content", "application/octet-stream")},
        )
        assert response.status_code == 400
        assert "расширение" in response.json()["detail"].lower() or "extension" in response.json()["detail"].lower()

    def test_upload_too_large(self, client: Any) -> None:
        """Тест: загрузка слишком большого файла."""
        large_content = b"x" * (10 * 1024 * 1024 + 1)  # 10MB + 1 byte
        response = client.post(
            "/api/upload",
            files={"file": ("big.txt", large_content, "text/plain")},
        )
        assert response.status_code == 400
        assert "большой" in response.json()["detail"].lower() or "big" in response.json()["detail"].lower()
