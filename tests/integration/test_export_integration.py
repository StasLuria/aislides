"""Integration-тесты для export endpoints.

Тестирует:
- GET /api/projects/{id}/export/pdf — экспорт в PDF.
- GET /api/projects/{id}/export/pptx — экспорт в PPTX.
- Проверку авторизации и изоляции данных.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.mark.asyncio
class TestExportPdfEndpoint:
    """Тесты для GET /api/projects/{id}/export/pdf."""

    async def test_export_pdf_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Без токена — 401."""
        resp = await async_client.get("/api/projects/fake-id/export/pdf")
        assert resp.status_code == 401

    async def test_export_pdf_project_not_found(
        self,
        async_client: AsyncClient,
        alice_token: str,
    ) -> None:
        """Несуществующий проект — 404."""
        resp = await async_client.get(
            "/api/projects/nonexistent-id/export/pdf",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert resp.status_code == 404

    async def test_export_pdf_no_artifacts(
        self,
        async_client: AsyncClient,
        alice_token: str,
    ) -> None:
        """Проект без артефактов — 400."""
        # Создаём проект
        create_resp = await async_client.post(
            "/api/projects",
            json={"title": "Empty project"},
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        project_id = create_resp.json()["id"]

        resp = await async_client.get(
            f"/api/projects/{project_id}/export/pdf",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert resp.status_code == 400

    async def test_export_pdf_success(
        self,
        async_client: AsyncClient,
        alice_token: str,
        project_with_artifacts: str,
    ) -> None:
        """Успешный экспорт PDF."""
        resp = await async_client.get(
            f"/api/projects/{project_with_artifacts}/export/pdf",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert resp.content[:4] == b"%PDF"

    async def test_export_pdf_other_user_denied(
        self,
        async_client: AsyncClient,
        bob_token: str,
        project_with_artifacts: str,
    ) -> None:
        """Чужой проект — 404."""
        resp = await async_client.get(
            f"/api/projects/{project_with_artifacts}/export/pdf",
            headers={"Authorization": f"Bearer {bob_token}"},
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestExportPptxEndpoint:
    """Тесты для GET /api/projects/{id}/export/pptx."""

    async def test_export_pptx_unauthorized(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Без токена — 401."""
        resp = await async_client.get("/api/projects/fake-id/export/pptx")
        assert resp.status_code == 401

    async def test_export_pptx_success(
        self,
        async_client: AsyncClient,
        alice_token: str,
        project_with_artifacts: str,
    ) -> None:
        """Успешный экспорт PPTX."""
        resp = await async_client.get(
            f"/api/projects/{project_with_artifacts}/export/pptx",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert resp.status_code == 200
        assert "presentation" in resp.headers["content-type"]
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert resp.content[:2] == b"PK"

    async def test_export_pptx_other_user_denied(
        self,
        async_client: AsyncClient,
        bob_token: str,
        project_with_artifacts: str,
    ) -> None:
        """Чужой проект — 404."""
        resp = await async_client.get(
            f"/api/projects/{project_with_artifacts}/export/pptx",
            headers={"Authorization": f"Bearer {bob_token}"},
        )
        assert resp.status_code == 404

    async def test_export_pptx_no_artifacts(
        self,
        async_client: AsyncClient,
        alice_token: str,
    ) -> None:
        """Проект без артефактов — 400."""
        create_resp = await async_client.post(
            "/api/projects",
            json={"title": "Empty project"},
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        project_id = create_resp.json()["id"]

        resp = await async_client.get(
            f"/api/projects/{project_id}/export/pptx",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert resp.status_code == 400
