"""Unit-тесты для EngineAPI.redesign() — CJM 5 «Редизайн».

Тестирует:
- Валидацию входных данных (пустой style_request).
- Формирование redesign_context в user_input.
- Вызов run() с правильными параметрами.
- Эмиссию AI_MESSAGE события.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from engine.api import EngineAPI
from schemas.shared_store import ProjectStatus, SharedStore


@pytest.fixture
def engine() -> EngineAPI:
    """Создать экземпляр EngineAPI для тестов."""
    return EngineAPI()


class TestEngineAPIRedesign:
    """Тесты для EngineAPI.redesign()."""

    @pytest.mark.asyncio
    async def test_redesign_empty_style_request_raises(self, engine: EngineAPI) -> None:
        """redesign() должен бросить ValueError при пустом style_request."""
        with pytest.raises(ValueError, match="style_request не может быть пустым"):
            await engine.redesign(project_id="proj-1", style_request="")

    @pytest.mark.asyncio
    async def test_redesign_whitespace_style_request_raises(self, engine: EngineAPI) -> None:
        """redesign() должен бросить ValueError при style_request из пробелов."""
        with pytest.raises(ValueError, match="style_request не может быть пустым"):
            await engine.redesign(project_id="proj-1", style_request="   ")

    @pytest.mark.asyncio
    async def test_redesign_calls_run_with_correct_params(self, engine: EngineAPI) -> None:
        """redesign() должен вызвать run() с redesign_context."""
        mock_store = SharedStore(
            project_id="proj-1",
            status=ProjectStatus.SUCCESS,
            config={},
            user_input={},
        )

        with (
            patch.object(engine, "run", new_callable=AsyncMock, return_value=mock_store) as mock_run,
            patch.object(engine.event_bus, "emit", new_callable=AsyncMock),
        ):
            result = await engine.redesign(
                project_id="proj-1",
                style_request="Swiss Minimalist",
                existing_results={"S1_ContextAnalyzer": {}, "S2_NarrativeArchitect": {}},
            )

        assert result == mock_store
        mock_run.assert_called_once()
        call_kwargs = mock_run.call_args[1]
        assert call_kwargs["project_id"] == "proj-1"
        assert "redesign_context" in call_kwargs["user_input"]
        assert call_kwargs["user_input"]["redesign_context"]["style_request"] == "Swiss Minimalist"
        assert call_kwargs["existing_results"] == {
            "S1_ContextAnalyzer": {},
            "S2_NarrativeArchitect": {},
        }

    @pytest.mark.asyncio
    async def test_redesign_emits_ai_message(self, engine: EngineAPI) -> None:
        """redesign() должен эмитить AI_MESSAGE перед запуском."""
        mock_store = SharedStore(
            project_id="proj-1",
            status=ProjectStatus.SUCCESS,
            config={},
            user_input={},
        )

        with (
            patch.object(engine, "run", new_callable=AsyncMock, return_value=mock_store),
            patch.object(engine.event_bus, "emit", new_callable=AsyncMock) as mock_emit,
        ):
            await engine.redesign(
                project_id="proj-1",
                style_request="Dark Mode",
            )

        assert mock_emit.call_count >= 1
        first_event = mock_emit.call_args_list[0][0][0]
        assert "редизайн" in first_event.message.lower() or "Dark Mode" in first_event.message

    @pytest.mark.asyncio
    async def test_redesign_default_params(self, engine: EngineAPI) -> None:
        """redesign() должен использовать пустые defaults для optional params."""
        mock_store = SharedStore(
            project_id="proj-1",
            status=ProjectStatus.SUCCESS,
            config={},
            user_input={},
        )

        with (
            patch.object(engine, "run", new_callable=AsyncMock, return_value=mock_store) as mock_run,
            patch.object(engine.event_bus, "emit", new_callable=AsyncMock),
        ):
            await engine.redesign(
                project_id="proj-1",
                style_request="Tech Innovation",
            )

        call_kwargs = mock_run.call_args[1]
        assert call_kwargs["chat_history"] == []
        assert call_kwargs["existing_results"] == {}
