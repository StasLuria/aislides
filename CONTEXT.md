# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-23

## Текущий статус

**Milestone: Engine Core v1.0 — ДОСТИГНУТ ✅**
**Спринт 4: Backend + FastAPI — ЗАВЕРШЁН ✅**

## Что сделано

### Спринт 0: Настройка проекта ✅

| Задача | Статус |
|:---|:---|
| 0.1 Локальный Git-репозиторий | ✅ |
| 0.2 Структура директорий | ✅ |
| 0.3 pyproject.toml + Poetry | ✅ |
| 0.4 config.yaml | ✅ |
| 0.5 .env.example | ✅ |
| 0.6 Pre-commit хуки | ✅ |
| 0.7 Makefile (локальный CI) | ✅ |
| 0.8 Документация перенесена | ✅ |
| 0.9 ADR-001 создан | ✅ |

### Спринт 1: Схемы данных и ядро ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 1.1 schemas/shared_store.py | ✅ | SharedStore, ChatMessage, AttachedFile, Artifact |
| 1.2 schemas/execution_plan.py | ✅ | ExecutionPlanSchema, PlanStep |
| 1.3 schemas/tool_schemas.py | ✅ | Pydantic-модели S1-S5 |
| 1.4 engine/event_bus.py | ✅ | EventBus + schemas/events.py |
| 1.5 engine/registry.py | ✅ | ToolRegistry + engine/base_node.py |
| 1.6 engine/runtime.py | ✅ | RuntimeAgent с cancel_token |
| 1.7 engine/api.py | ✅ | EngineAPI (заглушка) |
| 1.8-1.11 Unit-тесты | ✅ | 55 тестов, 96.54% coverage |
| 1.12 README + CHANGELOG | ✅ | v0.2.0 |

### Спринт 2: Планировщик и инструменты S1-S3 ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 2.1 engine/nodes/planner_node.py | ✅ | S0_PlannerNode (Instructor + OpenAI-compatible API) |
| 2.2 engine/nodes/validator_node.py | ✅ | PlanValidatorNode (валидация + dependency checks) |
| 2.3 tools/s1_context_analyzer.py | ✅ | S1_ContextAnalyzerNode |
| 2.4 tools/s2_narrative_architect.py | ✅ | S2_NarrativeArchitectNode |
| 2.5 tools/s3_design_architect.py | ✅ | S3_DesignArchitectNode |
| 2.6 data/presets/corporate_classic.json | ✅ | MVP-пресет |
| 2.7 tools/prompts/ | ✅ | Шаблоны промптов S0-S3 |
| 2.8-2.10 Unit-тесты | ✅ | 60 новых тестов с mock LLM |
| 2.11 Интеграция EngineAPI | ✅ | Replan loop, PLAN_COMPLETED event |
| 2.12 README + CHANGELOG | ✅ | v0.3.0 |

### Спринт 3: Инструменты S4-S5 и сквозной тест ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 3.1 tools/s4_slide_generator.py | ✅ | S4_SlideGeneratorNode, 100% coverage |
| 3.2 data/layouts/corporate_layouts.md | ✅ | 8 типов лейаутов |
| 3.3 tools/s5_quality_validator.py | ✅ | S5_QualityValidatorNode, 98% coverage |
| 3.4 data/scoring/scoring_rubric.json | ✅ | Рубрика с весами и порогами |
| 3.5 Unit-тесты S4 | ✅ | 31 тест |
| 3.6 Unit-тесты S5 | ✅ | 20 тестов |
| 3.7 E2E-тест полного цикла | ✅ | 5 E2E-тестов |
| 3.8 apply_edit() в EngineAPI | ✅ | Валидация, логирование, AI_MESSAGE event |
| 3.9 Integration-тест apply_edit() | ✅ | 8 тестов |
| 3.10 README + CHANGELOG | ✅ | v0.4.0 |
| 3.11 Milestone Engine Core v1.0 | ✅ | 179 тестов, 96.39% coverage |

### Спринт 4: Backend + FastAPI ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 4.1 Структура backend/ | ✅ | backend/app/ с routers, models, services, schemas |
| 4.2 FastAPI main.py | ✅ | CORS, lifespan, router registration |
| 4.3 SQLAlchemy ORM модели | ✅ | Project, Message, Artifact (async) |
| 4.4 REST API /api/projects (CRUD) | ✅ | POST/GET/PATCH/DELETE + пагинация |
| 4.5 REST API /api/projects/{id}/messages | ✅ | GET с пагинацией |
| 4.6 REST API /api/projects/{id}/artifacts | ✅ | GET с пагинацией |
| 4.7 EngineService | ✅ | generate(), apply_edit(), cancel() с DB persistence |
| 4.8 Unit-тесты Backend | ✅ | 41 тест: API (17), ProjectService (14), EngineService (10) |
| 4.9 README + CHANGELOG | ✅ | v0.5.0 |

## Метрики

| Метрика | Значение |
|:---|:---|
| Тесты (unit + integration + e2e) | 220 passed |
| Покрытие | 96.39% |
| Ruff ошибки | 0 |
| Mypy ошибки | 0 |
| Версия | 0.5.0 |

## Следующий шаг

**Этап 2, Спринт 5: WebSocket + Real-time** — задача 5.1: WebSocket endpoint `/ws/projects/{id}`

## Блокеры

Нет.
