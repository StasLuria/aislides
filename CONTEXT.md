# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-23

## Текущий статус

**Milestone: Engine Core v1.0 — ДОСТИГНУТ ✅**
**Milestone: Backend v1.0 — ДОСТИГНУТ ✅**
**Milestone: Frontend Chat v1.0 — ДОСТИГНУТ ✅**
**Milestone: MVP v1.0 — ДОСТИГНУТ ✅**
**Спринт 8: Редактирование артефактов — ЗАВЕРШЁН ✅**
**Milestone: Auth v1.0 — ДОСТИГНУТ ✅**
**Спринт 9: Авторизация и многопользовательность — ЗАВЕРШЁН ✅**
**Спринт 10: Расширение и полировка — В ПРОЦЕССЕ (6/8 задач)**

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

### Спринт 5: WebSocket + Real-time ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 5.1 WebSocket endpoint /ws/projects/{id} | ✅ | ConnectionManager + WebSocket router |
| 5.2 EventBus → WebSocket bridge | ✅ | EngineBridge: _map_engine_event_to_ws |
| 5.3 Обработка user_message через WS | ✅ | run_generation, run_edit через EngineBridge |
| 5.4 Стриминг step_started/step_completed | ✅ | STEP_STARTED/STEP_COMPLETED → status_update |
| 5.5 Отправка artifact_generated с превью | ✅ | ARTIFACT_CREATED → artifact_generated |
| 5.6 Cancel через WebSocket | ✅ | _active_engines registry |
| 5.7 Загрузка файлов /api/upload | ✅ | LocalFileStorage + upload router, валидация |
| 5.8 Integration-тесты WebSocket | ✅ | 32 теста: CM, EventMapping, Bridge, FileStorage, Upload |
| 5.9 README + CHANGELOG | ✅ | v0.6.0 |
| 5.10 Milestone Backend v1.0 | ✅ | 252 теста, 96.16% coverage |

### Спринт 6: Базовый чат-интерфейс ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 6.1 React + Vite + TypeScript + TailwindCSS | ✅ | Vite 7 + React 19 + TS 5.9 + Tailwind 4.2 + Vitest 4 |
| 6.2 Layout: три зоны | ✅ | AppLayout, Sidebar, ChatPanel, ArtifactPanel, 12 тестов |
| 6.3 ChatMessage | ✅ | user/ai роли, аватары, timestamp, 8 тестов |
| 6.4 ChatInput | ✅ | Auto-resize, Enter/Shift+Enter, файлы, isLoading, 12 тестов |
| 6.5 useWebSocket | ✅ | Reconnect с exp backoff, JSON-протокол, 12 тестов |
| 6.6 StatusCard | ✅ | Progress bar, 4 статуса, createInitialSteps, 13 тестов |
| 6.7 ProjectList | ✅ | Список, выбор, создание, empty state, относит. даты, 10 тестов |
| 6.8 E2E-тест чата | ✅ | Full flow + error + multi-msg + loading, 4 E2E-теста |
| 6.9 README + CHANGELOG | ✅ | v0.7.0 |

### Спринт 7: Панель артефактов и превью ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 7.1 ArtifactPanel (расширение) | ✅ | Toolbar, табы, download/open, версия, 17 тестов |
| 7.2 MarkdownViewer | ✅ | react-markdown + remark-gfm + rehype-highlight, 13 тестов |
| 7.3 SlidePreview | ✅ | iframe + srcdoc, ResizeObserver, scale 1920×1080, 14 тестов |
| 7.4 ArtifactCard | ✅ | Иконки, превью, версия, onClick → панель, 11 тестов |
| 7.5 Кнопки «Скачать», «Открыть» | ✅ | useArtifactActions: Blob download + openNewTab, 9 тестов |
| 7.6 Версионирование артефактов | ✅ | VersionList: сортировка, подсветка, выбор, 12 тестов |
| 7.7 E2E-тест полного сценария | ✅ | 8 E2E-тестов: Card→Panel, SlidePreview, MD, Versions, Tabs, Toolbar |
| 7.8 README + CHANGELOG | ✅ | v0.8.0 |
| 7.9 Milestone MVP v1.0 | ✅ | 252 backend + 150 frontend тестов, 0 lint ошибок |

### Спринт 8: Редактирование артефактов ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 8.1 Monaco Editor для текстовых файлов | ✅ | CodeEditor + editorUtils + 22 теста |
| 8.2 Редактирование structure.md → перегенерация | ✅ | EditableArtifact + useArtifactEditor + 14 тестов |
| 8.3 WebSocket-сообщение artifact_edited | ✅ | WS: artifact_updated→artifact_edited, EngineBridge.run_artifact_update |
| 8.4 WYSIWYG-редактирование текста на слайдах | ✅ | SlideTextEditor + 14 тестов, contentEditable + useRef |
| 8.5 Integration-тесты: редактирование → перегенерация | ✅ | 13 integration-тестов: WS handler + EngineBridge + E2E cycle |
| 8.6 README + CHANGELOG | ✅ | v0.9.0 |

### Спринт 9: Авторизация и многопользовательность ✅

| Задача | Статус | Детали |
|:---|:---|:---|
| 9.1 Регистрация и авторизация (JWT) | ✅ | User model, bcrypt, JWT, auth_service, /api/auth/register + /login, 26 тестов |
| 9.2 Middleware авторизации для REST и WebSocket | ✅ | get_current_user (REST Bearer), ws_authenticate (WS query token), 302 backend тестов |
| 9.3 Привязать проекты и артефакты к пользователям | ✅ | user_id в Project model, ProjectService фильтрация по user_id |
| 9.4 Страница логина/регистрации на Frontend | ✅ | AuthContext, LoginForm, RegisterForm, AuthPage, ProtectedRoute, authApi, tokenStorage, useWebSocket+JWT, 34 новых теста (241 frontend) |
| 9.5 Integration-тесты: авторизация, изоляция данных | ✅ | 36 integration-тестов: auth endpoints (15), data isolation (11), WebSocket auth (10), реальная in-memory SQLite + JWT |
| 9.6 Обновить README.md и CHANGELOG.md | ✅ | README: +Auth, User, WS JWT; CHANGELOG: v0.10.0 |

### Спринт 10: Расширение и полировка (в процессе)

| Задача | Статус | Детали |
|:---|:---|:---|
| 10.1 CJM 2Б «Исследователь» (deep research) | ⏸️ | Отложена — требует web search API |
| 10.2 CJM 5 «Редизайн» | ✅ | S0 redesign prompt, EngineAPI.redesign(), WS handler, UI button |
| 10.3 Дизайн-пресеты (5+) | ✅ | 7 пресетов (swiss, tech, elegant, consulting, playful, data, dark_mode) + 190 тестов |
| 10.4 CSS-шаблоны макетов (10+) | ✅ | 7 семейств (corporate, swiss, tech, luxury, creative, data, mckinsey) + 56 тестов |
| 10.5 Экспорт в PDF и PPTX | ✅ | ExportService (WeasyPrint + python-pptx), export router, UI кнопки, 32 теста |
| 10.6 Docker Compose | ✅ | Backend + Frontend Dockerfiles, docker-compose.yml (3 services), dev override, nginx.conf |
| 10.7 Документация для пользователей | ✅ | 5-секционный user_guide |
| 10.8 Milestone Product v1.0 | ☐ | Финализация |

## Метрики

| Метрика | Значение |
|:---|:---|
| Backend тесты (pytest) | 628 passed |
| Backend покрытие | 96.82% |
| Frontend тесты (vitest) | 245 passed |
| Ruff ошибки | 0 |
| Mypy ошибки | 0 |
| ESLint ошибки | 0 |
| Дизайн-пресетов | 8 |
| Семейств макетов | 7 |
| Версия | 0.10.0 |

## Следующий шаг

**Task 10.8: Milestone Product v1.0** — финальный version bump, README, CHANGELOG, release

## Блокеры

Нет.
