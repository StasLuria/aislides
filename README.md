# AI Presentation Generator

AI-powered presentation generator with LLM-driven planning and execution engine.

## Overview

This system automatically creates professional HTML5 presentations from user input using a multi-step pipeline orchestrated by an LLM planner. The engine analyzes context, designs narrative structure, applies a design system, generates slides, and validates quality. The backend provides a REST API for project management and engine integration.

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

## Project Structure

```
ai-presentation-generator/
├── engine/           # Core engine (API, runtime, event bus, nodes)
│   └── nodes/        # System nodes (planner, validator)
├── tools/            # Tool nodes (S1-S5)
│   └── prompts/      # LLM prompt templates
├── schemas/          # Pydantic models (SharedStore, ExecutionPlan, events)
├── backend/          # FastAPI backend
│   └── app/          # Application package
│       ├── models/   # SQLAlchemy ORM models
│       ├── schemas/  # Pydantic API schemas
│       ├── services/ # Business logic services
│       ├── routers/  # REST API routes
│       └── main.py   # FastAPI application entry point
├── configs/          # Configuration files (config.yaml)
├── data/             # Data files (presets, layouts, scoring rubrics)
│   ├── presets/      # Design presets (corporate_classic, etc.)
│   ├── layouts/      # Layout templates (corporate_layouts.md)
│   └── scoring/      # Quality scoring rubrics
├── tests/            # Tests (unit, integration, e2e)
│   ├── unit/         # Unit tests (engine, schemas, backend)
│   │   └── backend/  # Backend-specific unit tests
│   ├── integration/  # Integration tests (apply_edit)
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

# 3. Run tests
poetry run pytest

# 4. Run linters
make check

# 5. Start backend (requires database)
poetry run uvicorn backend.app.main:app --reload
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

**Current Sprint:** 4 — Backend + FastAPI (COMPLETED)
**Milestones:** Engine Core v1.0 ✅ → Backend API v1.0 ✅

### Sprint 4 Results

- **220 tests** (unit + integration + e2e) — all passing
- **96.39% code coverage** (target: 90%)
- **0 linter errors** (ruff + mypy)
- **Full REST API** for projects, messages, artifacts
- **EngineService** integrates engine with database persistence

| Module | Status | Coverage |
|:---|:---|:---|
| `schemas/shared_store.py` | ✅ | 100% |
| `schemas/execution_plan.py` | ✅ | 100% |
| `schemas/tool_schemas.py` | ✅ | 100% |
| `schemas/events.py` | ✅ | 100% |
| `engine/event_bus.py` | ✅ | 100% |
| `engine/registry.py` | ✅ | 100% |
| `engine/runtime.py` | ✅ | 98% |
| `engine/base_node.py` | ✅ | 100% |
| `engine/api.py` | ✅ | 95% |
| `engine/nodes/planner_node.py` | ✅ | 100% |
| `engine/nodes/validator_node.py` | ✅ | 100% |
| `tools/s1_context_analyzer.py` | ✅ | 96% |
| `tools/s2_narrative_architect.py` | ✅ | 97% |
| `tools/s3_design_architect.py` | ✅ | 83% |
| `tools/s4_slide_generator.py` | ✅ | 100% |
| `tools/s5_quality_validator.py` | ✅ | 98% |
| `backend/app/main.py` | ✅ | — |
| `backend/app/models/` | ✅ | — |
| `backend/app/services/` | ✅ | — |
| `backend/app/routers/` | ✅ | — |
| `data/presets/corporate_classic.json` | ✅ | — |
| `data/layouts/corporate_layouts.md` | ✅ | — |
| `data/scoring/scoring_rubric.json` | ✅ | — |
| `tools/prompts/` | ✅ | — |
