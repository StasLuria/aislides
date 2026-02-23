# AI Presentation Generator

**Version:** 0.10.0

AI-powered presentation generator with an LLM-driven planning and execution engine. The system supports multi-tenancy with JWT-based authentication and ensures data isolation between users.

## Overview

This system automatically creates professional HTML5 presentations from user input using a multi-step pipeline orchestrated by an LLM planner. The engine analyzes context, designs narrative structure, applies a design system, generates slides, and validates quality. The backend provides a REST API and WebSocket real-time communication for project management and engine integration, with secure endpoints protected by JWT authentication. The frontend delivers a chat-based interface with an artifact panel for interacting with the AI, previewing, and editing generated presentations, complete with login/registration functionality.

## Architecture

The system is composed of three main parts: the **Engine Core**, the **FastAPI Backend**, and the **React Frontend**.

### Engine Core

The engine follows an **intelligent orchestrator** pattern:

1.  **EngineAPI** — Public interface for the Backend.
2.  **S0_PlannerNode** — LLM agent that converts user requests into JSON execution plans.
3.  **PlanValidatorNode** — Validates the generated plan (with a replan loop).
4.  **RuntimeAgent** — Executes plan steps by invoking tool nodes (S1-S5).
5.  **EventBus** — Broadcasts execution events for real-time UI updates.

| Node | Purpose | Status |
|:---|:---|:---:|
| **S1_ContextAnalyzer** | Analyzes user request: audience, purpose, tone, slide count | ✅ |
| **S2_NarrativeArchitect** | Designs narrative structure: framework, slide blueprints | ✅ |
| **S3_DesignArchitect** | Creates design system: colors, typography, layout mapping | ✅ |
| **S4_SlideGenerator** | Generates HTML/CSS slides from blueprints + design system | ✅ |
| **S5_QualityValidator** | Validates presentation quality across 4 dimensions | ✅ |

### Backend (FastAPI)

The backend handles business logic, data persistence, and real-time communication.

| Component | Purpose | Status |
|:---|:---|:---:|
| **FastAPI app** | REST API server with CORS, lifespan | ✅ |
| **SQLAlchemy models** | Project, Message, Artifact, User ORM models | ✅ |
| **AuthService** | User registration, login, password hashing, JWT creation | ✅ |
| **Auth Dependencies** | `get_current_user` (REST) and `ws_authenticate` (WebSocket) | ✅ |
| **ProjectService** | CRUD operations with user-based data isolation | ✅ |
| **EngineService** | Wrapper over EngineAPI with DB persistence | ✅ |
| **REST API routes** | Secure CRUD endpoints for projects, messages, artifacts | ✅ |
| **WebSocket endpoint** | `/ws/projects/{id}` with JWT authentication | ✅ |
| **ConnectionManager** | Multi-client WebSocket connection management | ✅ |
| **EngineBridge** | EventBus → WebSocket event mapping and streaming | ✅ |
| **FileStorage** | Local file storage with upload/download/delete | ✅ |

### Frontend (React + Vite + TypeScript + TailwindCSS)

The frontend provides a complete user interface for interacting with the system.

| Component | Purpose | Status |
|:---|:---|:---:|
| **AuthContext** | Global auth state management, JWT decoding, session restore | ✅ |
| **AuthPage** | Login/Registration page with form toggle | ✅ |
| **LoginForm/RegisterForm** | Forms with validation and error handling | ✅ |
| **ProtectedRoute** | Route guard for authenticated pages | ✅ |
| **authApi/tokenStorage** | HTTP client and secure localStorage for JWT | ✅ |
| **AppLayout** | Three-zone layout (sidebar, chat, artifacts) | ✅ |
| **ChatMessage** | User/AI message bubbles with avatars and timestamps | ✅ |
| **ChatInput** | Auto-resize textarea, Enter/Shift+Enter, file attachments | ✅ |
| **useWebSocket** | WebSocket client hook with JWT auth and auto-reconnect | ✅ |
| **StatusCard** | Generation progress (S0-S5) with progress bar | ✅ |
| **ProjectList** | Sidebar project list with selection and creation | ✅ |
| **ArtifactPanel** | Right panel with toolbar, tabs, download/open actions | ✅ |
| **CodeEditor/SlideTextEditor** | Monaco editor and WYSIWYG editor for artifacts | ✅ |

### WebSocket Protocol

The WebSocket endpoint at `/ws/projects/{id}?token=<jwt_token>` supports bidirectional real-time communication. The connection **must** be authenticated via a JWT token in the query parameters.

**Client → Server:**
- `user_message`
- `artifact_feedback`
- `artifact_updated`
- `cancel`

**Server → Client:**
- `status_update`
- `artifact_generated`
- `artifact_edited`
- `ai_message`
- `error`

## Project Structure

```
ai-presentation-generator/
├── backend/          # FastAPI backend
│   └── app/          # Application package
│       ├── models/   # SQLAlchemy ORM models (User, Project, etc.)
│       ├── schemas/  # Pydantic API schemas (Auth, Project, etc.)
│       ├── services/ # Business logic (AuthService, ProjectService, etc.)
│       ├── routers/  # REST API + WebSocket routes (auth, projects, etc.)
│       └── dependencies/ # Shared dependencies (get_current_user)
├── frontend/         # React frontend
│   └── src/
│       ├── components/  # UI components (auth, chat, layout, artifact)
│       ├── contexts/    # React contexts (AuthContext)
│       ├── services/    # API services (authApi, tokenStorage)
│       ├── hooks/       # Custom hooks (useWebSocket, etc.)
│       └── types/       # TypeScript type definitions
├── engine/           # Core engine (API, runtime, event bus, nodes)
├── tools/            # Tool nodes (S1-S5)
├── tests/            # Tests (unit, integration, e2e)
│   ├── unit/         # Unit tests (backend, frontend)
│   └── integration/  # Integration tests (auth, data_isolation, websocket)
└── ...
```

## Quick Start

```bash
# 1. Install dependencies (backend & frontend)
poetry install
cd frontend && pnpm install && cd ..

# 2. Set up environment
cp .env.example .env
# Fill in API keys in .env

# 3. Run all tests (backend + frontend)
make check

# 4. Start backend (with auto-migration)
poetry run uvicorn backend.app.main:app --reload

# 5. Start frontend dev server
cd frontend && pnpm dev
```

## Status

**Current Sprint:** 9 — Authentication & Multi-tenancy (COMPLETED)

**Milestones:** Engine Core v1.0 ✅ → Backend v1.0 ✅ → MVP v1.0 ✅ → Auth v1.0 ✅

### Sprint 9 Results

- **Full authentication flow:** User registration, login, JWT session management, and secure endpoints.
- **Multi-tenancy:** Complete data isolation between users for projects, messages, and artifacts.
- **338 backend tests** (pytest) — all passing, **96.16% coverage**.
- **241 frontend tests** (Vitest) — all passing.
- **36 new integration tests** covering auth endpoints, data isolation, and WebSocket security using a real in-memory database.
- **0 linter errors** (ESLint + ruff + mypy).
