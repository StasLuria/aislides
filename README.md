# AI Presentation Generator

AI-powered presentation generator with LLM-driven planning and execution engine.

## Overview

This system automatically creates professional HTML5 presentations from user input using a multi-step pipeline orchestrated by an LLM planner. The engine analyzes context, designs narrative structure, applies a design system, generates slides, and validates quality. The backend provides a REST API and WebSocket real-time communication for project management and engine integration. The frontend delivers a chat-based interface with artifact panel for interacting with the AI and previewing generated presentations.

## Architecture

The engine follows an **intelligent orchestrator** pattern:

1. **EngineAPI** — Public interface for the Backend
2. **S0_PlannerNode** — LLM agent that converts user requests into JSON execution plans
3. **PlanValidatorNode** — Validates the generated plan (with replan loop)
4. **RuntimeAgent** — Executes plan steps by invoking tool nodes (S1-S5)
5. **EventBus** — Broadcasts execution events for real-time UI updates

### Tool Nodes (S1-S5)

| Node | Purpose | Status |
|:---|:---|:---|
| **S1_ContextAnalyzer** | Analyzes user request: audience, purpose, tone, slide count | ✅ |
| **S2_NarrativeArchitect** | Designs narrative structure: framework, slide blueprints | ✅ |
| **S3_DesignArchitect** | Creates design system: colors, typography, layout mapping | ✅ |
| **S4_SlideGenerator** | Generates HTML/CSS slides from blueprints + design system | ✅ |
| **S5_QualityValidator** | Validates presentation quality across 4 dimensions | ✅ |

### Backend (FastAPI)

| Component | Purpose | Status |
|:---|:---|:---|
| **FastAPI app** | REST API server with CORS, lifespan | ✅ |
| **SQLAlchemy models** | Project, Message, Artifact ORM models | ✅ |
| **ProjectService** | CRUD operations for projects, messages, artifacts | ✅ |
| **EngineService** | Wrapper over EngineAPI with DB persistence | ✅ |
| **REST API routes** | CRUD endpoints for projects, messages, artifacts | ✅ |
| **Health check** | `/health` endpoint | ✅ |
| **WebSocket endpoint** | `/ws/projects/{id}` real-time communication | ✅ |
| **ConnectionManager** | Multi-client WebSocket connection management | ✅ |
| **EngineBridge** | EventBus → WebSocket event mapping and streaming | ✅ |
| **FileStorage** | Local file storage with upload/download/delete | ✅ |
| **Upload endpoint** | `/api/upload` with validation (size, extension) | ✅ |

### Frontend (React + Vite + TypeScript + TailwindCSS)

| Component | Purpose | Status |
|:---|:---|:---|
| **AppLayout** | Three-zone layout (sidebar, chat, artifacts) | ✅ |
| **ChatMessage** | User/AI message bubbles with avatars and timestamps | ✅ |
| **ChatInput** | Auto-resize textarea, Enter/Shift+Enter, file attachments | ✅ |
| **useWebSocket** | WebSocket client hook with reconnect (exp backoff) | ✅ |
| **StatusCard** | Generation progress (S0-S5) with progress bar | ✅ |
| **ProjectList** | Sidebar project list with selection and creation | ✅ |
| **ArtifactPanel** | Right panel with toolbar, tabs, download/open actions | ✅ |
| **ArtifactCard** | Clickable artifact card in chat with icon and preview | ✅ |
| **MarkdownViewer** | Markdown rendering with GFM and syntax highlighting | ✅ |
| **SlidePreview** | HTML slide preview via iframe with 1920×1080 scaling | ✅ |
| **VersionList** | Artifact version list with navigation and highlighting | ✅ |
| **useArtifactActions** | Download (Blob) and open in new tab actions | ✅ |

### WebSocket Protocol

The WebSocket endpoint at `/ws/projects/{id}` supports bidirectional real-time communication:

**Client → Server:**
- `user_message` — Send a message to trigger generation
- `edit_request` — Request artifact editing
- `cancel` — Cancel active generation

**Server → Client:**
- `status_update` — Step progress (step_started, step_completed)
- `artifact_generated` — New artifact with preview URL
- `ai_message` — AI response text
- `error` — Error notification

## Project Structure

```
ai-presentation-generator/
├── engine/           # Core engine (API, runtime, event bus, nodes)
│   ├── nodes/        # System nodes (planner, validator)
│   └── file_storage.py  # Local file storage service
├── tools/            # Tool nodes (S1-S5)
│   └── prompts/      # LLM prompt templates
├── schemas/          # Pydantic models (SharedStore, ExecutionPlan, events)
├── backend/          # FastAPI backend
│   └── app/          # Application package
│       ├── models/   # SQLAlchemy ORM models
│       ├── schemas/  # Pydantic API schemas
│       ├── services/ # Business logic (ProjectService, EngineService, ConnectionManager, EngineBridge)
│       ├── routers/  # REST API + WebSocket routes
│       └── main.py   # FastAPI application entry point
├── frontend/         # React frontend
│   └── src/          # Source code
│       ├── components/  # UI components (chat, layout, status, sidebar, artifact)
│       ├── hooks/       # Custom hooks (useWebSocket, useArtifactPanel, useArtifactActions)
│       └── types/       # TypeScript type definitions
├── configs/          # Configuration files (config.yaml)
├── data/             # Data files (presets, layouts, scoring rubrics)
│   ├── presets/      # Design presets (corporate_classic, etc.)
│   ├── layouts/      # Layout templates (corporate_layouts.md)
│   └── scoring/      # Quality scoring rubrics
├── tests/            # Tests (unit, integration, e2e)
│   ├── unit/         # Unit tests (engine, schemas, backend)
│   │   └── backend/  # Backend-specific unit tests
│   ├── integration/  # Integration tests (apply_edit, websocket)
│   └── e2e/          # End-to-end pipeline tests
├── docs/             # Documentation (specs, roadmap, ADRs)
│   └── adr/          # Architecture Decision Records
├── CONTRIBUTING.md   # Development rules and standards
├── ONBOARDING.md     # Quick start guide for new developers
└── CHANGELOG.md      # Version history
```

## Quick Start

```bash
# 1. Install dependencies
pip install poetry
poetry install

# 2. Set up environment
cp .env.example .env
# Fill in API keys in .env

# 3. Run backend tests
poetry run pytest

# 4. Run backend linters
make check

# 5. Start backend (requires database)
poetry run uvicorn backend.app.main:app --reload

# 6. Install frontend dependencies
cd frontend && pnpm install

# 7. Run frontend tests
pnpm test

# 8. Start frontend dev server
pnpm dev
```

## Documentation

| Document | Description |
|:---|:---|
| [Engine Architecture v3.0](docs/engine_architecture_specification_v3_ru.md) | Engine architecture specification |
| [Technical Specification](docs/technical_specification.md) | Business logic: S1-S5 skills, design system |
| [PRD](docs/product_requirements_document.md) | Product requirements |
| [Development Roadmap](docs/development_roadmap.md) | Sprint plan with tasks |
| [CONTRIBUTING](CONTRIBUTING.md) | Development rules and standards |
| [ONBOARDING](ONBOARDING.md) | Quick start for new developers |

## Status

**Current Sprint:** 7 — Artifact Panel & Preview (COMPLETED)
**Milestones:** Engine Core v1.0 ✅ → Backend API v1.0 ✅ → Backend v1.0 (WebSocket) ✅ → Frontend Chat v1.0 ✅ → MVP v1.0 ✅

### Sprint 7 Results

- **150 frontend tests** (Vitest + Testing Library) — all passing
- **252 backend tests** (pytest) — all passing, 96.16% coverage
- **0 linter errors** (ESLint + ruff + mypy)
- **5 new artifact components:** ArtifactPanel, ArtifactCard, MarkdownViewer, SlidePreview, VersionList
- **2 new hooks:** useArtifactActions, useArtifactPanel
- **8 E2E integration tests:** full artifact flow (Card→Panel, Preview, MD, Versions, Tabs, Toolbar)
