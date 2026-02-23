"""Unit-тесты для EngineService.

Тестируем обёртку над EngineAPI с mock-ами.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch

import pytest

from backend.app.services.engine_service import EngineService
from schemas.shared_store import Artifact, ProjectStatus, SharedStore

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def _make_store(
    project_id: str = "test-project",
    status: ProjectStatus = ProjectStatus.SUCCESS,
    artifacts: list[Artifact] | None = None,
    errors: list[dict] | None = None,
) -> SharedStore:
    """Создать тестовый SharedStore."""
    return SharedStore(
        project_id=project_id,
        status=status,
        user_input={"prompt": "тест"},
        config={"llm": {"provider": "openai"}},
        artifacts=artifacts or [],
        errors=errors or [],
    )


class TestEngineServiceGenerate:
    """Тесты метода generate()."""

    @pytest.mark.asyncio
    async def test_generate_success(self, db_session: AsyncSession) -> None:
        """Успешная генерация — сохраняет артефакты и сообщение."""
        from backend.app.services.project_service import ProjectService

        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")

        store = _make_store(
            project_id=project.id,
            artifacts=[
                Artifact(
                    artifact_id="art-1",
                    filename="presentation.html",
                    storage_path="/tmp/presentation.html",
                    version=1,
                    created_by="S4_SlideGenerator",
                ),
            ],
        )

        engine_service = EngineService()
        with patch.object(engine_service.engine, "run", new_callable=AsyncMock, return_value=store):
            result = await engine_service.generate(
                db=db_session,
                project_id=project.id,
                user_message="Создай презентацию",
            )

        assert result.status == ProjectStatus.SUCCESS
        assert len(result.artifacts) == 1

        # Проверяем, что сообщения сохранены
        messages, total = await svc.list_messages(project_id=project.id)
        assert total == 2  # user + ai
        assert messages[0].sender == "user"
        assert messages[1].sender == "ai"

        # Проверяем, что артефакты сохранены
        artifacts, art_total = await svc.list_artifacts(project_id=project.id)
        assert art_total == 1
        assert artifacts[0].filename == "presentation.html"

    @pytest.mark.asyncio
    async def test_generate_failure(self, db_session: AsyncSession) -> None:
        """Генерация с ошибкой — сохраняет ошибку в сообщении."""
        from backend.app.services.project_service import ProjectService

        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")

        store = _make_store(
            project_id=project.id,
            status=ProjectStatus.FAILED,
            errors=[{"error": "LLM timeout"}],
        )

        engine_service = EngineService()
        with patch.object(engine_service.engine, "run", new_callable=AsyncMock, return_value=store):
            result = await engine_service.generate(
                db=db_session,
                project_id=project.id,
                user_message="Создай презентацию",
            )

        assert result.status == ProjectStatus.FAILED

        # Проверяем AI-сообщение с ошибкой
        messages, _ = await svc.list_messages(project_id=project.id)
        ai_msg = next(m for m in messages if m.sender == "ai")
        assert "LLM timeout" in ai_msg.text


class TestEngineServiceApplyEdit:
    """Тесты метода apply_edit()."""

    @pytest.mark.asyncio
    async def test_apply_edit_success(self, db_session: AsyncSession) -> None:
        """Успешное применение правки."""
        from backend.app.services.project_service import ProjectService

        svc = ProjectService(db_session)
        project = await svc.create_project(title="Тест")

        store = _make_store(project_id=project.id)

        engine_service = EngineService()
        with patch.object(engine_service.engine, "apply_edit", new_callable=AsyncMock, return_value=store):
            result = await engine_service.apply_edit(
                db=db_session,
                project_id=project.id,
                artifact_id="art-1",
                new_content="<h1>Обновлено</h1>",
            )

        assert result.status == ProjectStatus.SUCCESS


class TestEngineServiceCancel:
    """Тесты метода cancel()."""

    @pytest.mark.asyncio
    async def test_cancel(self) -> None:
        """Отмена выполнения."""
        engine_service = EngineService()
        with patch.object(engine_service.engine, "cancel", new_callable=AsyncMock, return_value=True):
            result = await engine_service.cancel("test-project")
        assert result is True


class TestEngineServiceBuildSummary:
    """Тесты статического метода _build_summary()."""

    def test_summary_with_errors(self) -> None:
        """Резюме с ошибками."""
        store = _make_store(errors=[{"error": "Ошибка 1"}, {"error": "Ошибка 2"}])
        summary = EngineService._build_summary(store)
        assert "Ошибка 1" in summary
        assert "Ошибка 2" in summary

    def test_summary_no_artifacts(self) -> None:
        """Резюме без артефактов."""
        store = _make_store(artifacts=[])
        summary = EngineService._build_summary(store)
        assert "не были созданы" in summary

    def test_summary_with_artifacts(self) -> None:
        """Резюме с артефактами."""
        store = _make_store(
            artifacts=[
                Artifact(
                    artifact_id="a1",
                    filename="test.html",
                    storage_path="/tmp/test.html",
                    version=1,
                    created_by="S4",
                ),
            ],
        )
        summary = EngineService._build_summary(store)
        assert "1" in summary
