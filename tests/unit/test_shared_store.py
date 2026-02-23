"""Unit-тесты для schemas/shared_store.py."""

from __future__ import annotations

import json

import pytest

from schemas.shared_store import (
    Artifact,
    AttachedFile,
    ChatMessage,
    ProjectStatus,
    SharedStore,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def minimal_store() -> SharedStore:
    """Минимальный SharedStore с обязательными полями."""
    return SharedStore(
        project_id="test-001",
        user_input={"prompt": "Создай презентацию о Python"},
        config={"llm": {"default_provider": "gemini"}},
    )


@pytest.fixture()
def full_store() -> SharedStore:
    """SharedStore со всеми полями заполненными."""
    return SharedStore(
        project_id="test-002",
        status=ProjectStatus.EXECUTING,
        user_input={"prompt": "Создай презентацию", "slide_count": 10},
        config={"llm": {"default_provider": "gemini"}},
        chat_history=[
            ChatMessage(role="user", content="Привет"),
            ChatMessage(role="assistant", content="Здравствуйте!"),
        ],
        attached_files=[
            AttachedFile(file_id="f1", filename="data.csv", path="/tmp/data.csv"),
        ],
        execution_plan={"steps": [{"step_id": 1, "node": "S1_ContextAnalyzer"}]},
        results={"S1_ContextAnalyzer": {"audience": "developers"}},
        artifacts=[
            Artifact(
                artifact_id="a1",
                filename="presentation.html",
                storage_path="/output/presentation.html",
                version=1,
                created_by="S4_SlideGenerator",
            ),
        ],
        errors=[],
    )


# ---------------------------------------------------------------------------
# Tests: Creation
# ---------------------------------------------------------------------------


class TestSharedStoreCreation:
    """Тесты создания SharedStore."""

    def test_minimal_creation(self, minimal_store: SharedStore) -> None:
        """SharedStore создаётся с минимальными обязательными полями."""
        assert minimal_store.project_id == "test-001"
        assert minimal_store.status == ProjectStatus.PENDING
        assert minimal_store.user_input["prompt"] == "Создай презентацию о Python"
        assert minimal_store.chat_history == []
        assert minimal_store.attached_files == []
        assert minimal_store.execution_plan is None
        assert minimal_store.plan_validation_errors is None
        assert minimal_store.results == {}
        assert minimal_store.artifacts == []
        assert minimal_store.errors == []

    def test_full_creation(self, full_store: SharedStore) -> None:
        """SharedStore создаётся со всеми полями."""
        assert full_store.project_id == "test-002"
        assert full_store.status == ProjectStatus.EXECUTING
        assert len(full_store.chat_history) == 2
        assert len(full_store.attached_files) == 1
        assert full_store.execution_plan is not None
        assert "S1_ContextAnalyzer" in full_store.results
        assert len(full_store.artifacts) == 1

    def test_missing_required_fields_raises(self) -> None:
        """Отсутствие обязательных полей вызывает ValidationError."""
        with pytest.raises(Exception):  # noqa: B017
            SharedStore()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# Tests: ProjectStatus
# ---------------------------------------------------------------------------


class TestProjectStatus:
    """Тесты перечисления ProjectStatus."""

    def test_all_statuses_exist(self) -> None:
        """Все 6 статусов определены."""
        statuses = [s.value for s in ProjectStatus]
        assert statuses == ["pending", "planning", "executing", "success", "failed", "cancelled"]

    def test_status_transition(self, minimal_store: SharedStore) -> None:
        """Статус можно менять."""
        minimal_store.status = ProjectStatus.PLANNING
        assert minimal_store.status == ProjectStatus.PLANNING
        minimal_store.status = ProjectStatus.SUCCESS
        assert minimal_store.status == ProjectStatus.SUCCESS


# ---------------------------------------------------------------------------
# Tests: Serialization
# ---------------------------------------------------------------------------


class TestSharedStoreSerialization:
    """Тесты сериализации/десериализации."""

    def test_to_json(self, minimal_store: SharedStore) -> None:
        """to_json возвращает валидный JSON."""
        json_str = minimal_store.to_json()
        parsed = json.loads(json_str)
        assert parsed["project_id"] == "test-001"
        assert parsed["status"] == "pending"

    def test_from_json_roundtrip(self, full_store: SharedStore) -> None:
        """Roundtrip: to_json -> from_json сохраняет все данные."""
        json_str = full_store.to_json()
        restored = SharedStore.from_json(json_str)
        assert restored.project_id == full_store.project_id
        assert restored.status == full_store.status
        assert len(restored.chat_history) == len(full_store.chat_history)
        assert len(restored.artifacts) == len(full_store.artifacts)
        assert restored.results == full_store.results

    def test_from_json_invalid_raises(self) -> None:
        """Невалидный JSON вызывает ошибку."""
        with pytest.raises(Exception):  # noqa: B017
            SharedStore.from_json("not a json")


# ---------------------------------------------------------------------------
# Tests: Sub-models
# ---------------------------------------------------------------------------


class TestSubModels:
    """Тесты вложенных моделей."""

    def test_chat_message(self) -> None:
        """ChatMessage создаётся корректно."""
        msg = ChatMessage(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_attached_file(self) -> None:
        """AttachedFile создаётся корректно."""
        f = AttachedFile(file_id="f1", filename="test.pdf", path="/tmp/test.pdf")
        assert f.file_id == "f1"
        assert f.filename == "test.pdf"

    def test_artifact(self) -> None:
        """Artifact создаётся с дефолтной версией."""
        a = Artifact(
            artifact_id="a1",
            filename="slide.html",
            storage_path="/output/slide.html",
            created_by="S4",
        )
        assert a.version == 1
        assert a.created_by == "S4"

    def test_artifact_version_increment(self) -> None:
        """Версию артефакта можно задать явно."""
        a = Artifact(
            artifact_id="a1",
            filename="slide.html",
            storage_path="/output/slide.html",
            version=3,
            created_by="S4",
        )
        assert a.version == 3
