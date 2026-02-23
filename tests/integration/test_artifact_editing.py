"""Integration-тесты: редактирование артефактов → перегенерация.

По roadmap 8.5: «Integration-тесты: редактирование → перегенерация».

Тестирует:
- WebSocket: artifact_updated → artifact_edited протокол
- EngineBridge.run_artifact_update: полный цикл
- _handle_artifact_updated: валидация, маршрутизация
- Сценарии ошибок: пустые поля, исключения движка
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.services.connection_manager import ConnectionManager
from backend.app.services.engine_bridge import EngineBridge

# ============================================================
# EngineBridge.run_artifact_update Tests
# ============================================================


class TestRunArtifactUpdate:
    """Тесты для EngineBridge.run_artifact_update."""

    @pytest.fixture()
    def mock_manager(self) -> Any:
        """Создать mock ConnectionManager."""
        mgr = AsyncMock(spec=ConnectionManager)
        mgr.send_to_project = AsyncMock()
        return mgr

    @pytest.mark.asyncio()
    async def test_artifact_update_success(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: успешное обновление артефакта через run_artifact_update."""
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

            await bridge.run_artifact_update(
                project_id="proj-1",
                artifact_id="structure.md",
                new_content="# Новая структура\n\n## Слайд 1",
            )

            # Проверяем вызов apply_edit
            mock_engine.apply_edit.assert_called_once_with(
                project_id="proj-1",
                artifact_id="structure.md",
                new_content="# Новая структура\n\n## Слайд 1",
            )

            # Проверяем отправку artifact_edited с completed
            calls = mock_manager.send_to_project.call_args_list
            last_call = calls[-1]
            msg = last_call[0][1]
            assert msg["type"] == "artifact_edited"
            assert msg["payload"]["artifact_id"] == "structure.md"
            assert msg["payload"]["status"] == "completed"

    @pytest.mark.asyncio()
    async def test_artifact_update_with_errors(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: обновление артефакта с ошибками в store."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.errors = [{"error": "Зависимый артефакт не найден"}]

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_artifact_update(
                project_id="proj-1",
                artifact_id="structure.md",
                new_content="# Битая структура",
            )

            calls = mock_manager.send_to_project.call_args_list
            last_call = calls[-1]
            msg = last_call[0][1]
            assert msg["type"] == "artifact_edited"
            assert msg["payload"]["status"] == "error"
            assert "не найден" in msg["payload"]["message"]

    @pytest.mark.asyncio()
    async def test_artifact_update_exception(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: исключение при обновлении артефакта."""
        bridge = EngineBridge(mock_manager)

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(
                side_effect=RuntimeError("Engine crashed"),
            )
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_artifact_update(
                project_id="proj-1",
                artifact_id="structure.md",
                new_content="# Контент",
            )

            calls = mock_manager.send_to_project.call_args_list
            last_call = calls[-1]
            msg = last_call[0][1]
            assert msg["type"] == "error"
            assert "Engine crashed" in msg["payload"]["message"]

    @pytest.mark.asyncio()
    async def test_artifact_update_cleans_active_engines(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: run_artifact_update очищает _active_engines после завершения."""
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

            from backend.app.services import engine_bridge

            await bridge.run_artifact_update(
                project_id="proj-cleanup",
                artifact_id="test.md",
                new_content="content",
            )

            # Движок должен быть удалён из реестра
            assert "proj-cleanup" not in engine_bridge._active_engines

    @pytest.mark.asyncio()
    async def test_artifact_update_subscribes_events(
        self,
        mock_manager: Any,
    ) -> None:
        """Тест: run_artifact_update подписывается на события."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.errors = []

        with (
            patch.object(bridge, "_subscribe_all") as mock_subscribe,
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_artifact_update(
                project_id="proj-1",
                artifact_id="test.md",
                new_content="content",
            )

            mock_subscribe.assert_called_once_with(mock_engine, "proj-1")


# ============================================================
# WebSocket artifact_updated Handler Tests
# ============================================================


class TestHandleArtifactUpdated:
    """Тесты для _handle_artifact_updated в WebSocket router."""

    @pytest.fixture()
    def ws_app(self) -> Any:
        """Создать FastAPI app с WebSocket router."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from backend.app.routers.websocket import router

        app = FastAPI()
        app.include_router(router)
        return TestClient(app)

    def test_artifact_updated_missing_artifact_id(self, ws_app: Any) -> None:
        """Тест: artifact_updated без artifact_id → error."""
        with ws_app.websocket_connect("/ws/projects/proj-1") as ws:
            # Получаем connected
            data = ws.receive_json()
            assert data["type"] == "connected"

            # Отправляем artifact_updated без artifact_id
            ws.send_json(
                {
                    "type": "artifact_updated",
                    "payload": {
                        "new_content": "# Новый контент",
                    },
                }
            )

            response = ws.receive_json()
            assert response["type"] == "error"
            assert "artifact_id" in response["payload"]["message"]

    def test_artifact_updated_missing_content(self, ws_app: Any) -> None:
        """Тест: artifact_updated без new_content → error."""
        with ws_app.websocket_connect("/ws/projects/proj-1") as ws:
            data = ws.receive_json()
            assert data["type"] == "connected"

            ws.send_json(
                {
                    "type": "artifact_updated",
                    "payload": {
                        "artifact_id": "structure.md",
                        "new_content": "   ",
                    },
                }
            )

            response = ws.receive_json()
            assert response["type"] == "error"
            assert "new_content" in response["payload"]["message"]

    def test_artifact_updated_empty_payload(self, ws_app: Any) -> None:
        """Тест: artifact_updated с пустым payload → error."""
        with ws_app.websocket_connect("/ws/projects/proj-1") as ws:
            data = ws.receive_json()
            assert data["type"] == "connected"

            ws.send_json(
                {
                    "type": "artifact_updated",
                    "payload": {},
                }
            )

            response = ws.receive_json()
            assert response["type"] == "error"

    def test_artifact_updated_valid_sends_accepted(self, ws_app: Any) -> None:
        """Тест: валидный artifact_updated → artifact_edited (accepted)."""
        with ws_app.websocket_connect("/ws/projects/proj-1") as ws:
            data = ws.receive_json()
            assert data["type"] == "connected"

            # EngineBridge импортируется внутри _handle_artifact_updated,
            # мокаем в модуле engine_bridge
            with patch(
                "backend.app.services.engine_bridge.EngineBridge",
            ) as mock_bridge_cls:
                mock_bridge = MagicMock()
                mock_bridge.run_artifact_update = AsyncMock()
                mock_bridge_cls.return_value = mock_bridge

                ws.send_json(
                    {
                        "type": "artifact_updated",
                        "payload": {
                            "artifact_id": "structure.md",
                            "new_content": "# Новая структура",
                        },
                    }
                )

                response = ws.receive_json()
                assert response["type"] == "artifact_edited"
                assert response["payload"]["artifact_id"] == "structure.md"
                assert response["payload"]["status"] == "accepted"


# ============================================================
# Full Edit Cycle E2E Tests
# ============================================================


class TestEditCycleE2E:
    """E2E-тесты полного цикла редактирования."""

    @pytest.fixture()
    def mock_manager(self) -> Any:
        """Создать mock ConnectionManager."""
        mgr = AsyncMock(spec=ConnectionManager)
        mgr.send_to_project = AsyncMock()
        return mgr

    @pytest.mark.asyncio()
    async def test_full_edit_cycle_structure_md(
        self,
        mock_manager: Any,
    ) -> None:
        """E2E: редактирование structure.md → перегенерация → artifact_edited."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.errors = []
        mock_store.artifacts = [
            {"artifact_id": "structure.md", "content": "# Updated"},
            {"artifact_id": "slide-1.html", "content": "<h1>Updated</h1>"},
        ]

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_artifact_update(
                project_id="proj-e2e",
                artifact_id="structure.md",
                new_content="# Обновлённая структура\n\n## Слайд 1: Введение\n## Слайд 2: Итоги",
            )

            # Проверяем: apply_edit вызван с правильными параметрами
            mock_engine.apply_edit.assert_called_once_with(
                project_id="proj-e2e",
                artifact_id="structure.md",
                new_content="# Обновлённая структура\n\n## Слайд 1: Введение\n## Слайд 2: Итоги",
            )

            # Проверяем: отправлено artifact_edited completed
            calls = mock_manager.send_to_project.call_args_list
            last_msg = calls[-1][0][1]
            assert last_msg["type"] == "artifact_edited"
            assert last_msg["payload"]["status"] == "completed"
            assert "structure.md" in last_msg["payload"]["message"]

    @pytest.mark.asyncio()
    async def test_full_edit_cycle_html_slide(
        self,
        mock_manager: Any,
    ) -> None:
        """E2E: редактирование HTML-слайда → перегенерация."""
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

            new_html = "<h1>Новый заголовок</h1><p>Обновлённый текст</p>"
            await bridge.run_artifact_update(
                project_id="proj-e2e",
                artifact_id="slide-3.html",
                new_content=new_html,
            )

            mock_engine.apply_edit.assert_called_once_with(
                project_id="proj-e2e",
                artifact_id="slide-3.html",
                new_content=new_html,
            )

    @pytest.mark.asyncio()
    async def test_edit_cycle_with_multiple_errors(
        self,
        mock_manager: Any,
    ) -> None:
        """E2E: редактирование с несколькими ошибками."""
        bridge = EngineBridge(mock_manager)

        mock_store = MagicMock()
        mock_store.errors = [
            {"error": "Невалидный Markdown"},
            {"error": "Зависимый слайд повреждён"},
        ]

        with (
            patch.object(bridge, "_subscribe_all"),
            patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls,
        ):
            mock_engine = AsyncMock()
            mock_engine.apply_edit = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine_cls.return_value = mock_engine

            await bridge.run_artifact_update(
                project_id="proj-e2e",
                artifact_id="structure.md",
                new_content="broken content",
            )

            calls = mock_manager.send_to_project.call_args_list
            last_msg = calls[-1][0][1]
            assert last_msg["type"] == "artifact_edited"
            assert last_msg["payload"]["status"] == "error"
            # Оба сообщения об ошибках должны быть в тексте
            assert "Невалидный Markdown" in last_msg["payload"]["message"]
            assert "Зависимый слайд повреждён" in last_msg["payload"]["message"]

    @pytest.mark.asyncio()
    async def test_edit_cycle_concurrent_edits(
        self,
        mock_manager: Any,
    ) -> None:
        """E2E: параллельные правки разных артефактов."""
        import asyncio

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

            # Запускаем два обновления параллельно
            await asyncio.gather(
                bridge.run_artifact_update(
                    project_id="proj-a",
                    artifact_id="structure.md",
                    new_content="# A",
                ),
                bridge.run_artifact_update(
                    project_id="proj-b",
                    artifact_id="slide-1.html",
                    new_content="<h1>B</h1>",
                ),
            )

            # Оба должны завершиться без ошибок
            assert mock_engine.apply_edit.call_count == 2
