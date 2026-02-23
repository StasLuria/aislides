"""Unit-тесты для WebSocket redesign handler и EngineBridge.run_redesign().

Тестирует:
- EngineBridge.run_redesign() — успешный и ошибочный сценарии.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.services.engine_bridge import EngineBridge
from schemas.shared_store import Artifact, ProjectStatus, SharedStore


class TestEngineBridgeRedesign:
    """Тесты для EngineBridge.run_redesign()."""

    @pytest.fixture
    def mock_manager(self) -> MagicMock:
        """Создать мок ConnectionManager."""
        mgr = MagicMock()
        mgr.send_to_project = AsyncMock()
        return mgr

    @pytest.fixture
    def bridge(self, mock_manager: MagicMock) -> EngineBridge:
        """Создать EngineBridge с моком."""
        return EngineBridge(mock_manager)

    @pytest.mark.asyncio
    async def test_run_redesign_success(
        self,
        bridge: EngineBridge,
        mock_manager: MagicMock,
    ) -> None:
        """run_redesign() должен вызвать engine.redesign() и отправить сообщение."""
        mock_store = SharedStore(
            project_id="proj-1",
            status=ProjectStatus.SUCCESS,
            config={},
            user_input={},
            artifacts=[
                Artifact(
                    artifact_id="a1",
                    filename="slide1.html",
                    storage_path="/tmp/a1",
                    created_by="S4",
                ),
                Artifact(
                    artifact_id="a2",
                    filename="slide2.html",
                    storage_path="/tmp/a2",
                    created_by="S4",
                ),
            ],
        )

        with patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls:
            mock_engine = mock_engine_cls.return_value
            mock_engine.redesign = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine.event_bus.subscribe = MagicMock()

            await bridge.run_redesign(
                project_id="proj-1",
                style_request="Swiss Minimalist",
            )

        mock_engine.redesign.assert_called_once_with(
            project_id="proj-1",
            style_request="Swiss Minimalist",
        )

        # Проверяем что отправлено сообщение об успехе
        calls = mock_manager.send_to_project.call_args_list
        success_calls = [
            c
            for c in calls
            if c[0][1].get("type") == "ai_message" and "Редизайн завершён" in c[0][1].get("payload", {}).get("text", "")
        ]
        assert len(success_calls) >= 1

    @pytest.mark.asyncio
    async def test_run_redesign_with_errors(
        self,
        bridge: EngineBridge,
        mock_manager: MagicMock,
    ) -> None:
        """run_redesign() должен отправить ошибку при store.errors."""
        mock_store = SharedStore(
            project_id="proj-1",
            status=ProjectStatus.FAILED,
            config={},
            user_input={},
            errors=[{"error": "S3 failed"}],
        )

        with patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls:
            mock_engine = mock_engine_cls.return_value
            mock_engine.redesign = AsyncMock(return_value=mock_store)
            mock_engine.event_bus = MagicMock()
            mock_engine.event_bus.subscribe = MagicMock()

            await bridge.run_redesign(
                project_id="proj-1",
                style_request="Tech Innovation",
            )

        calls = mock_manager.send_to_project.call_args_list
        error_calls = [
            c
            for c in calls
            if c[0][1].get("type") == "ai_message" and "Ошибка" in c[0][1].get("payload", {}).get("text", "")
        ]
        assert len(error_calls) >= 1

    @pytest.mark.asyncio
    async def test_run_redesign_exception(
        self,
        bridge: EngineBridge,
        mock_manager: MagicMock,
    ) -> None:
        """run_redesign() должен отправить error при исключении."""
        with patch("backend.app.services.engine_bridge.EngineAPI") as mock_engine_cls:
            mock_engine = mock_engine_cls.return_value
            mock_engine.redesign = AsyncMock(side_effect=RuntimeError("LLM timeout"))
            mock_engine.event_bus = MagicMock()
            mock_engine.event_bus.subscribe = MagicMock()

            await bridge.run_redesign(
                project_id="proj-1",
                style_request="Dark Mode",
            )

        calls = mock_manager.send_to_project.call_args_list
        error_calls = [c for c in calls if c[0][1].get("type") == "error"]
        assert len(error_calls) >= 1
        assert "LLM timeout" in error_calls[0][0][1]["payload"]["message"]
