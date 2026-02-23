# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
