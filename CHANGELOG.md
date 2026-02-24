# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **Critical: Full Generation Cycle** — Integrated frontend components (`ChatInput`, `WebSocket`, `StatusCard`, `ArtifactPanel`) with the backend to enable a complete end-to-end presentation generation flow. (Commit `fa9f7e2`)
- **Bug: S0 Planner Pydantic Validation** — Switched `instructor` to `Mode.JSON` for Gemini compatibility, preventing Pydantic validation errors where steps were returned as strings instead of objects. (Commit `fa9f7e2`)
- **Bug: ExecutionPlanSchema Parsing** — Added a fallback validator to `ExecutionPlanSchema` to correctly parse string-formatted plan steps from the LLM. (Commit `fa9f7e2`)
- **Bug: Tool Node Registration** — Registered `S1-S5` tool nodes in `EngineAPI` to resolve `ToolNotFound` errors during runtime execution. (Commit `fa9f7e2`)
- **Bug: StatusCard UI** — Corrected the `engine_bridge` to map internal node names to human-readable step labels, ensuring the `StatusCard` UI updates correctly. (Commit `fa9f7e2`)
- **Bug: Missing Artifacts** — Added `ARTIFACT_CREATED` event emission in the `RuntimeAgent` to ensure generated artifacts are displayed in the UI. (Commit `fa9f7e2`)

### Changed

- `AppLayout.tsx` was updated to allow external control over the `ArtifactPanel`, facilitating the new integrated UI. (Commit `fa9f7e2`)

## [1.0.0] - 2026-02-23 — Milestone: Product v1.0

### Summary

This release marks the **Product v1.0 milestone**. All 4 development stages are complete: Engine Core, Backend + WebSocket, MVP Frontend, and Full Product (editing, authentication, export, deployment).

### Metrics

- **628 backend tests** (pytest) — 96.82% coverage
- **245 frontend tests** (Vitest)
- **78 integration tests** (auth, data isolation, WebSocket, editing, export)
- **8 design presets**, **7 layout families**
- **0 linter errors** (ruff, mypy, eslint)

### Added

- Final README.md update with Product v1.0 status and Docker Quick Start (task 10.8)
- Version bump to 1.0.0 across pyproject.toml, README.md (task 10.8)

## [0.11.0] - 2026-02-23 — Sprint 10: Expansion & Polish

### Added

- **Design Presets (7 new)**
    - `data/presets/swiss_minimalist.json` — Swiss grid-based minimalist design (task 10.3)
    - `data/presets/tech_innovation.json` — Modern tech/startup style with gradients (task 10.3)
    - `data/presets/elegant_premium.json` — Luxury premium design with serif fonts (task 10.3)
    - `data/presets/consulting_classic.json` — McKinsey/BCG-style consulting preset (task 10.3)
    - `data/presets/playful_creative.json` — Colorful creative/education style (task 10.3)
    - `data/presets/data_visualization.json` — Data-focused preset optimized for charts (task 10.3)
    - `data/presets/dark_mode_code.json` — Dark theme for technical/code presentations (task 10.3)
    - 190 preset validation tests (task 10.3)
- **CSS Layout Templates (6 new families)**
    - `data/layouts/swiss_layouts.md` — Grid-based Swiss minimalist layouts (task 10.4)
    - `data/layouts/tech_layouts.md` — Tech/startup layouts with gradient accents (task 10.4)
    - `data/layouts/luxury_layouts.md` — Premium luxury layouts with serif typography (task 10.4)
    - `data/layouts/creative_layouts.md` — Playful creative layouts with asymmetry (task 10.4)
    - `data/layouts/data_layouts.md` — Data visualization-optimized layouts (task 10.4)
    - `data/layouts/mckinsey_layouts.md` — Consulting-style structured layouts (task 10.4)
    - 56 layout validation tests (task 10.4)
- **CJM 5 «Redesign» — Restyle existing presentations**
    - `engine/nodes/planner_node.py` — Added REDESIGN_CONTEXT_ADDITION for S0 planner (task 10.2)
    - `engine/api.py` — Added `EngineAPI.redesign()` method (task 10.2)
    - `backend/app/services/engine_bridge.py` — Added `EngineBridge.run_redesign()` (task 10.2)
    - `backend/app/routers/websocket.py` — Added `_handle_redesign` WebSocket handler (task 10.2)
    - `frontend/src/components/layout/ArtifactPanel.tsx` — Added Redesign button in toolbar (task 10.2)
    - `frontend/src/types/index.ts` — Added `WsRedesignMessage` type (task 10.2)
    - Unit tests for redesign: engine (5), planner (4), WS bridge (5), frontend (4) (task 10.2)
- **PDF & PPTX Export**
    - `backend/app/services/export_service.py` — ExportService with WeasyPrint PDF and python-pptx PPTX generation (task 10.5)
    - `backend/app/routers/export.py` — `/api/projects/{id}/export/pdf` and `/export/pptx` endpoints (task 10.5)
    - `frontend/src/components/layout/ArtifactPanel.tsx` — Export PDF/PPTX buttons in toolbar (task 10.5)
    - 23 unit tests + 9 integration tests for export (task 10.5)
- **Docker Compose**
    - `backend/Dockerfile` — Multi-stage build for FastAPI backend (task 10.6)
    - `frontend/Dockerfile` — Multi-stage build for React frontend with nginx (task 10.6)
    - `docker-compose.yml` — Production: PostgreSQL + backend + frontend (3 services) (task 10.6)
    - `docker-compose.dev.yml` — Development override with hot-reload (task 10.6)
    - Updated `nginx.conf`, `.dockerignore`, `.env.example`, `Makefile` (task 10.6)
- **User Documentation**
    - `docs/user_guide/01_introduction.md` — Product overview and capabilities (task 10.7)
    - `docs/user_guide/02_getting_started.md` — Docker setup and quick start (task 10.7)
    - `docs/user_guide/03_interface_overview.md` — UI zones and toolbar (task 10.7)
    - `docs/user_guide/04_core_workflows.md` — Create, redesign, export, edit workflows (task 10.7)
    - `docs/user_guide/05_development.md` — Developer guide and contribution flow (task 10.7)

### Changed

- Backend tests: **628 total** (was 338), 96.82% coverage
- Frontend tests: **245 total** (was 241)
- Design presets: **8 total** (was 1)
- Layout families: **7 total** (was 1)

## [0.10.0] - 2026-02-23 — Sprint 9: Authentication & Multi-tenancy

### Added

- **Backend: Auth & User Model**
    - `backend/app/models/user.py` — User SQLAlchemy model with bcrypt password hashing (task 9.1)
    - `backend/app/services/auth_service.py` — Registration, login, JWT token creation/verification (task 9.1)
    - `backend/app/routers/auth.py` — `/api/auth/register`, `/api/auth/login`, `/api/auth/me` endpoints (task 9.1)
    - `backend/app/schemas/auth.py` — Pydantic schemas for auth requests/responses (task 9.1)
    - `backend/app/dependencies/auth.py` — `get_current_user` dependency for REST, `ws_authenticate` for WebSocket (task 9.2)
- **Frontend: Auth Components**
    - `frontend/src/contexts/AuthContext.tsx` — React context for global auth state with JWT decode/validate/restore (task 9.4)
    - `frontend/src/components/auth/LoginForm.tsx` — Login form with validation and error handling (task 9.4)
    - `frontend/src/components/auth/RegisterForm.tsx` — Registration form with password match/length validation (task 9.4)
    - `frontend/src/components/auth/AuthPage.tsx` — Auth page with login/register toggle (task 9.4)
    - `frontend/src/components/auth/ProtectedRoute.tsx` — Route guard with redirect to /auth (task 9.4)
    - `frontend/src/services/authApi.ts` — HTTP client for auth endpoints (task 9.4)
    - `frontend/src/services/tokenStorage.ts` — localStorage JWT token management with error handling (task 9.4)
- **Testing: Auth & Data Isolation**
    - `tests/integration/test_auth_integration.py` — 15 integration tests for register, login, token validation, full auth flow (task 9.5)
    - `tests/integration/test_data_isolation.py` — 11 integration tests for project/messages/artifacts isolation between users (task 9.5)
    - `tests/integration/test_ws_auth_integration.py` — 10 integration tests for ws_authenticate and WebSocket endpoint auth (task 9.5)
    - `tests/integration/conftest.py` — Shared fixtures with real in-memory SQLite, real JWT tokens, user_alice/user_bob helpers (task 9.5)
    - 34 new frontend auth tests: tokenStorage (7), authApi (8), AuthContext (7), LoginForm (5), RegisterForm (4), AuthPage (3), ProtectedRoute (4), App (3)

### Changed

- `backend/app/models/project.py` — Added `user_id` field for project ownership (task 9.3)
- `backend/app/services/project_service.py` — All operations now filter by `user_id` (task 9.3)
- `frontend/src/App.tsx` — Added BrowserRouter, AuthProvider, route-based auth flow (task 9.4)
- `frontend/src/hooks/useWebSocket.ts` — JWT token sent in WebSocket query params (task 9.4)
- Backend tests: **338 total** (was 265), 96.16% coverage
- Frontend tests: **241 total** (was 200)

## [0.9.0] - 2026-02-23 — Sprint 8: Artifact Editing

### Added

- `frontend/src/components/artifact/CodeEditor.tsx` — Monaco Editor integration for text file editing with language detection (task 8.1)
- `frontend/src/components/artifact/editorUtils.ts` — File extension → language mapping utility (task 8.1)
- `frontend/src/components/artifact/EditableArtifact.tsx` — Toggle between MarkdownViewer and CodeEditor view/edit modes (task 8.2)
- `frontend/src/hooks/useArtifactEditor.ts` — Edit state management, dirty tracking, WebSocket save (task 8.2)
- `frontend/src/components/artifact/SlideTextEditor.tsx` — WYSIWYG editing of text on HTML slides via contentEditable (task 8.4)
- `backend/app/routers/websocket.py` — Added `artifact_updated` handler with validation (task 8.3)
- `backend/app/services/engine_bridge.py` — Added `run_artifact_update()` method for edit → regeneration (task 8.3)
- `frontend/src/types/index.ts` — Extended with WsArtifactUpdated, WsArtifactEdited types
- `tests/integration/test_artifact_editing.py` — 13 integration tests: WS handler validation, EngineBridge update cycle, E2E edit flow (task 8.5)
- 50 new frontend tests: CodeEditor (22), EditableArtifact (8), useArtifactEditor (6), SlideTextEditor (14)

### Changed

- WebSocket protocol: added `artifact_updated` (client→server) and `artifact_edited` (server→client) message types
- `README.md` — Added 4 new editing components, updated WS protocol docs, updated status
- Frontend tests: 200 total (was 150), Backend tests: 265 total (was 252), 96.16% coverage

## [0.8.0] - 2026-02-23 — Sprint 7: Artifact Panel & Preview | Milestone: MVP v1.0

### Added

- `frontend/src/components/artifact/ArtifactCard.tsx` — Clickable artifact card in chat with icon, preview, version badge (task 7.1, 7.4)
- `frontend/src/components/artifact/MarkdownViewer.tsx` — Markdown rendering with react-markdown, remark-gfm, rehype-highlight (task 7.2)
- `frontend/src/components/artifact/SlidePreview.tsx` — HTML slide preview via iframe + srcdoc, ResizeObserver, 1920×1080 scaling (task 7.3)
- `frontend/src/components/artifact/VersionList.tsx` — Artifact version list with sorting, highlighting, navigation (task 7.6)
- `frontend/src/hooks/useArtifactActions.ts` — Download (Blob) and open in new tab actions (task 7.5)
- `frontend/src/types/index.ts` — Extended with ArtifactVersion, ArtifactFileType, WsArtifactFeedback types
- 8 E2E artifact flow tests: Card→Panel, SlidePreview, MarkdownViewer, Versions, Tabs, Toolbar, Close, Empty (task 7.7)
- 77 new frontend tests total: ArtifactCard (11), MarkdownViewer (13), SlidePreview (14), VersionList (12), useArtifactActions (9), ArtifactPanel (10), ArtifactFlow E2E (8)

### Changed

- `frontend/src/components/layout/ArtifactPanel.tsx` — Extended with toolbar (download, open, close), artifact tabs, version display
- `README.md` — Added 6 new artifact components to Frontend table, updated status to MVP v1.0
- Frontend tests: 150 total (was 73), Backend tests: 252 total, 96.16% coverage

### Milestone

- **MVP v1.0** reached: full pipeline from chat input → AI generation → artifact preview with download/versioning

## [0.7.0] - 2026-02-23 — Sprint 6: Basic Chat Interface

### Added

- `frontend/` — React + Vite 7 + TypeScript 5.9 + TailwindCSS 4.2 + Vitest 4 project scaffold (task 6.1)
- `frontend/src/components/layout/` — AppLayout, Sidebar, ChatPanel, ArtifactPanel (task 6.2)
- `frontend/src/components/chat/ChatMessage.tsx` — User/AI message bubbles with avatars and timestamps (task 6.3)
- `frontend/src/components/chat/ChatInput.tsx` — Auto-resize textarea, Enter/Shift+Enter, file attachments, isLoading (task 6.4)
- `frontend/src/hooks/useWebSocket.ts` — WebSocket client hook with reconnect and exponential backoff (task 6.5)
- `frontend/src/components/status/StatusCard.tsx` — Generation progress S0-S5 with progress bar and 4 statuses (task 6.6)
- `frontend/src/components/sidebar/ProjectList.tsx` — Project list with selection, creation, empty state, relative dates (task 6.7)
- `frontend/src/types/index.ts` — TypeScript types for messages, projects, artifacts, WebSocket protocol
- 73 frontend tests: Layout (12), ChatMessage (8), ChatInput (12), useWebSocket (12), StatusCard (13), ProjectList (10), E2E ChatFlow (4), App (2) (tasks 6.2-6.8)

### Changed

- `README.md` — Added Frontend section, updated project structure and quick start
- `vite.config.ts` — Proxy to backend API for development

## [0.6.0] - 2026-02-23 — Sprint 5: WebSocket + Real-time

### Added

- `backend/app/routers/websocket.py` — WebSocket endpoint `/ws/projects/{id}` with message routing (task 5.1)
- `backend/app/services/connection_manager.py` — Multi-client WebSocket connection manager (task 5.1)
- `backend/app/services/engine_bridge.py` — EventBus → WebSocket bridge with event mapping (tasks 5.2-5.5)
- WebSocket protocol: `user_message`, `edit_request`, `cancel` (client → server) (tasks 5.3, 5.6)
- WebSocket protocol: `status_update`, `artifact_generated`, `ai_message`, `error` (server → client) (tasks 5.4, 5.5)
- Cancel support via WebSocket through `_active_engines` registry (task 5.6)
- `engine/file_storage.py` — LocalFileStorage: save, load, delete, exists, unique filename generation (task 5.7)
- `backend/app/routers/upload.py` — File upload endpoint `/api/upload` with size/extension validation (task 5.7)
- 32 integration tests: ConnectionManager (7), EventMapping (7), EngineBridge (7), FileStorage (7), Upload (4) (task 5.8)

### Changed

- `backend/app/main.py` — Registered WebSocket and upload routers
- Test coverage: 96.16% (252 tests, target: 90%)

## [0.5.0] - 2026-02-23 — Sprint 4: Backend + FastAPI

### Added

- `backend/app/main.py` — FastAPI application with CORS, lifespan, router registration (task 4.1)
- `backend/app/config.py` — Application settings via pydantic-settings (task 4.1)
- `backend/app/database.py` — Async SQLAlchemy engine and session factory (task 4.1)
- `backend/app/models/` — SQLAlchemy ORM models: Project, Message, Artifact (task 4.3)
- `backend/app/schemas/project.py` — Pydantic API schemas: Create, Read, Update, List (task 4.2)
- `backend/app/services/project_service.py` — CRUD service for projects, messages, artifacts (task 4.4)
- `backend/app/services/engine_service.py` — EngineAPI wrapper with DB persistence (task 4.5)
- `backend/app/routers/projects.py` — REST API: POST/GET/PATCH/DELETE projects, GET messages/artifacts (task 4.2)
- `backend/app/routers/health.py` — Health check endpoint (task 4.2)
- 41 backend unit tests: API endpoints (17), ProjectService (14), EngineService (10) (task 4.6-4.7)
- `tests/unit/backend/conftest.py` — Test fixtures with in-memory SQLite + async TestClient

### Changed

- `pyproject.toml` — Added backend dependencies: sqlalchemy[asyncio], aiosqlite, pydantic-settings, httpx
- Test coverage: 96.39% (220 tests, target: 90%)

## [0.4.0] - 2026-02-23 — Sprint 3: Tools S4-S5 & E2E | Milestone: Engine Core v1.0

### Added

- `tools/s4_slide_generator.py` — S4_SlideGeneratorNode: HTML/CSS slide generation with LLM per tech spec S4 (task 3.1)
- `data/layouts/corporate_layouts.md` — MVP layout templates: 8 layout types with HTML/CSS structure (task 3.2)
- `tools/s5_quality_validator.py` — S5_QualityValidatorNode: 4-dimension quality scoring per tech spec S5 (task 3.3)
- `data/scoring/scoring_rubric.json` — Quality scoring rubric with weights and thresholds (task 3.4)
- 31 unit tests for S4_SlideGenerator (task 3.5)
- 20 unit tests for S5_QualityValidator (task 3.6)
- 5 E2E tests: full pipeline S0→S1→S2→S3→S4→S5, cancel, error handling, events (task 3.7)
- 8 integration tests for apply_edit(): validation, partial regeneration, events (task 3.9)
- `tests/e2e/` — E2E test directory
- `tests/integration/` — Integration test directory

### Changed

- `engine/api.py` — apply_edit() fully implemented per §14: validation, logging, AI_MESSAGE event, edit_context (task 3.8)
- Test coverage: 96.39% (179 tests, target: 90%)

### Milestone

- **Engine Core v1.0** reached: all 5 tool nodes (S1-S5), planner, validator, runtime, event bus, apply_edit, cancel — fully implemented and tested

## [0.3.0] - 2026-02-23 — Sprint 2: Planner & Tools S1-S3

### Added

- `engine/nodes/planner_node.py` — S0_PlannerNode: LLM planner with Instructor per §6.1 and §7 (task 2.1)
- `engine/nodes/validator_node.py` — PlanValidatorNode: plan validation with dependency checks per §6.1 (task 2.2)
- `tools/s1_context_analyzer.py` — S1_ContextAnalyzerNode: context analysis per tech spec S1 (task 2.3)
- `tools/s2_narrative_architect.py` — S2_NarrativeArchitectNode: narrative design per tech spec S2 (task 2.4)
- `tools/s3_design_architect.py` — S3_DesignArchitectNode: design system per tech spec S3 (task 2.5)
- `data/presets/corporate_classic.json` — MVP design preset with full color/typography/layout config (task 2.6)
- `tools/prompts/` — LLM prompt templates for S0-S3 (task 2.7)
- 60 new unit tests: PlannerNode (13), ValidatorNode (18), S1-S3 (23), EngineAPI updated (6) (tasks 2.8-2.11)
- `schemas/events.py` — added PLAN_COMPLETED event type

### Changed

- `engine/api.py` — full integration with S0_PlannerNode and PlanValidatorNode, replan loop (task 2.11)
- Test coverage: 95.32% (115 tests, target: 90%)

## [0.2.0] - 2026-02-23 — Sprint 1: Schemas & Core Engine

### Added

- `schemas/shared_store.py` — SharedStore Pydantic model per engine spec v3.0 §4 (task 1.1)
- `schemas/execution_plan.py` — ExecutionPlanSchema and PlanStep per §8 (task 1.2)
- `schemas/tool_schemas.py` — Pydantic models for S1-S5 tools per technical spec (task 1.3)
- `schemas/events.py` — EventType enum and EngineEvent model per §5 (task 1.4)
- `engine/event_bus.py` — EventBus with subscribe/unsubscribe/emit per §5 (task 1.4)
- `engine/base_node.py` — BaseNode abstract class per §6 (task 1.5)
- `engine/registry.py` — ToolRegistry for node lookup per §6 (task 1.5)
- `engine/runtime.py` — RuntimeAgent execution loop per §9 (task 1.6)
- `engine/api.py` — EngineAPI stub with run/apply_edit/cancel per §3 (task 1.7)
- 55 unit tests: SharedStore (12), ExecutionPlan (9), EventBus (11), RuntimeAgent+Registry (16), EngineAPI (7) (tasks 1.8-1.11)
- Test coverage: 96.54% (target: 90%)

## [0.1.0] - 2026-02-23 — Sprint 0: Project Setup

### Added

- Project structure: `engine/`, `tools/`, `schemas/`, `tests/`, `data/`, `docs/`, `configs/` (tasks 0.1-0.2)
- `pyproject.toml` with Poetry, all dependencies configured (task 0.3)
- `configs/config.yaml` per engine spec v3.0 §12 (task 0.4)
- `.env.example` with API key placeholders (task 0.5)
- Pre-commit hooks: ruff, black, mypy, trailing-whitespace, end-of-file-fixer (task 0.6)
- `Makefile` with `lint`, `format`, `typecheck`, `test`, `check` targets (task 0.7)
- Documentation: README, CONTRIBUTING, ONBOARDING, CHANGELOG (task 0.8)
- ADR-001: Engine architecture decision record (task 0.9)
- CONTEXT.md with current project state
