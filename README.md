# AI Presentation Generator

**Version:** 1.0.0

AI-powered presentation generator with an LLM-driven planning and execution engine. The system supports multi-tenancy with JWT-based authentication, data isolation, artifact editing, and export to PDF/PPTX.

## Overview

This system automatically creates professional HTML5 presentations from user input using a multi-step pipeline orchestrated by an LLM planner. The engine analyzes context, designs narrative structure, applies a design system, generates slides, and validates quality. The backend provides a REST API and WebSocket real-time communication for project management and engine integration, with secure endpoints protected by JWT authentication. The frontend delivers a chat-based interface with an artifact panel for interacting with the AI, previewing, editing, and exporting generated presentations, complete with login/registration functionality.

## Architecture

The system is composed of three main parts: the **Engine Core**, the **FastAPI Backend**, and the **React Frontend**, all containerized with Docker.

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
| **ExportService** | PDF (WeasyPrint) and PPTX (python-pptx) export | ✅ |
| **REST API routes** | Secure CRUD endpoints for projects, messages, artifacts, export | ✅ |
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
| **ProtectedRoute** | Route guard for authenticated pages | ✅ |
| **AppLayout** | Three-zone layout (sidebar, chat, artifacts) | ✅ |
| **ChatInput** | Auto-resize textarea, Enter/Shift+Enter, file attachments | ✅ |
| **useWebSocket** | WebSocket client hook with JWT auth and auto-reconnect | ✅ |
| **StatusCard** | Generation progress (S0-S5) with progress bar | ✅ |
| **ProjectList** | Sidebar project list with selection and creation | ✅ |
| **ArtifactPanel** | Right panel with toolbar, tabs, download/open/export actions | ✅ |
| **CodeEditor/SlideTextEditor** | Monaco editor and WYSIWYG editor for artifacts | ✅ |

### WebSocket Protocol

The WebSocket endpoint at `/ws/projects/{id}?token=<jwt_token>` supports bidirectional real-time communication. The connection **must** be authenticated via a JWT token in the query parameters.

**Client → Server:**
- `user_message`
- `artifact_updated`
- `redesign`
- `cancel`

**Server → Client:**
- `status_update`
- `artifact_generated`
- `artifact_edited`
- `ai_message`
- `error`

## Quick Start (Docker — Local Development)

```bash
# 1. Clone the repository and create the environment file
cp .env.example .env

# 2. Fill in your OPENAI_API_KEY in the .env file

# 3. Build and run the application using Docker Compose
make up

# 4. Access the application at http://localhost:5173
```

## Production Deployment (Render.com)

The project includes Infrastructure-as-Code for one-click deployment to Render.com.

**Live URL:** https://aislides-4m3r.onrender.com

### Deploy Steps

1. Fork/clone the repository on GitHub.
2. Create a new **Blueprint** on Render.com and connect the repository.
3. Render will automatically provision the web service and PostgreSQL database from `render.yaml`.
4. Set the following environment variables in Render dashboard:

| Variable | Required | Description |
|:---|:---:|:---|
| `OPENAI_API_KEY` | Yes | OpenAI API key (starts with `sk-`) |
| `LLM_MODEL` | No | LLM model name (default: `gpt-4.1`) |
| `OPENAI_BASE_URL` | No | Custom base URL for OpenAI-compatible APIs |

`DATABASE_URL` and `JWT_SECRET_KEY` are automatically configured by Render.

### Architecture

```
[Browser] → [Render Web Service (port 10000)]
                ├── nginx (static SPA + proxy)
                │     ├── /api/* → uvicorn:8000
                │     ├── /ws/*  → uvicorn:8000 (WebSocket)
                │     └── /*     → /usr/share/nginx/html (SPA)
                └── uvicorn (FastAPI backend)
                      └── PostgreSQL (Render managed DB)
```

## Status

**Product v1.0 is complete.** All core features are implemented, tested, and documented.

**Milestones:** Engine Core v1.0 ✅ → Backend v1.0 ✅ → MVP v1.0 ✅ → Auth v1.0 ✅ → **Product v1.0 ✅**

### Final Metrics (v1.0.0)

- **Backend tests:** **628 passed** (pytest) with **95.40% coverage**.
- **Frontend tests:** **245 passed** (Vitest).
- **Integration tests:** **78 total** (auth, data isolation, WebSocket, editing, export).
- **Linters:** **0 errors** (ruff, mypy, eslint).
- **Design System:** **8 presets** and **7 layout families**.
-**.
