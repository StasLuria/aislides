# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-25

## Текущий статус

**Milestone: Product v1.0 — ДОСТИГНУТ ✅**

**Последняя активность:** Подготовка production-деплоя на Render.com (Infrastructure-as-Code).

## Что сделано (25.02.2026)

### Спринт 12: Production Deployment (Render.com)

| Задача | Статус | Детали |
|:---|:---|:---|
| 12.1 Dockerfile.render | ✅ | Multi-stage: frontend build → backend deps → nginx + uvicorn runtime |
| 12.2 render.yaml Blueprint | ✅ | Web service (starter) + PostgreSQL (basic-256mb), Frankfurt region |
| 12.3 Nginx config template | ✅ | deploy/nginx.render.conf с envsubst для PORT |
| 12.4 Entrypoint script | ✅ | deploy/entrypoint.sh — запуск nginx + uvicorn в одном контейнере |
| 12.5 Config: DATABASE_URL | ✅ | Автоконвертация postgres:// → postgresql+asyncpg:// |
| 12.6 Config: Database pool | ✅ | NullPool для SQLite, AsyncAdaptedQueuePool для PostgreSQL |
| 12.7 ADR-002 | ✅ | Решение о переключении Instructor на JSON mode |
| 12.8 Pre-commit Checklist | ✅ | Секция 9 в CONTRIBUTING.md — 8 обязательных шагов |

### Спринт 11 (24.02.2026): Интеграция и стабилизация UI

| Задача | Статус | Детали |
|:---|:---|:---|
| 11.1 Интеграция UI компонентов | ✅ | ChatInput, WebSocket, StatusCard, ArtifactPanel подключены в App.tsx |
| 11.2 Исправление бага S0 Planner | ✅ | Переключен Instructor на JSON mode для Gemini |
| 11.3 Исправление ExecutionPlanSchema | ✅ | Добавлен fallback-валидатор для строковых шагов |
| 11.4 Регистрация Tool Nodes | ✅ | S1-S5 узлы зарегистрированы в EngineAPI |
| 11.5 Исправление StatusCard | ✅ | Добавлен маппинг node_name → step_label |
| 11.6 Исправление Artifacts | ✅ | Добавлена эмиссия ARTIFACT_CREATED в RuntimeAgent |
| 11.7 Обновление AppLayout | ✅ | Добавлена поддержка внешнего управления ArtifactPanel |

## Метрики

| Метрика | Значение |
|:---|:---|
| Backend тесты (pytest) | 628 passed |
| Backend покрытие | 95.39% |
| Frontend тесты (vitest) | 245 passed |
| Ruff ошибки | 0 |
| Mypy ошибки | 0 |
| ESLint ошибки | 0 |
| Версия | 1.0.0 |

## Архитектура деплоя (Render.com)

```
[Browser] → [Render Web Service (port 10000)]
                ├── nginx (static SPA + proxy)
                │     ├── /api/* → uvicorn:8000
                │     ├── /ws/*  → uvicorn:8000 (WebSocket)
                │     └── /*     → /usr/share/nginx/html (SPA)
                └── uvicorn (FastAPI backend)
                      └── PostgreSQL (Render managed DB)
```

## Следующий шаг

Пользователь деплоит на Render.com через Blueprint (render.yaml). После деплоя — продолжить с **Фазой 1: Quick Wins** из `DEVELOPMENT_PLAN.md`.

## Блокеры

Нет.
