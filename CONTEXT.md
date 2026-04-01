# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-03-14

## Текущий статус

**Milestone: Product v1.0 — ДОСТИГНУТ ✅**

**Последняя активность:** Production-деплой на Render.com — сервис запущен и работает (Live).

## Что сделано (14.03.2026)

### Спринт 13: Production Deployment Fixes

| Задача | Статус | Детали |
|:---|:---|:---|
| 13.1 TypeScript build errors | ✅ | Исправлены ошибки типов в тестах и компонентах; тесты исключены из `tsconfig.app.json` |
| 13.2 Health check 404 | ✅ | Добавлен prefix `/api` к health router; увеличен startup timeout до 60s |
| 13.3 LLM model not found | ✅ | `EngineAPI` теперь читает `LLM_MODEL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` из env vars |
| 13.4 Default model → gpt-4.1 | ✅ | Дефолтная модель изменена с `gemini-2.5-flash` на `gpt-4.1` |
| 13.5 Artifact content pipeline | ✅ | Content передаётся через WebSocket и сохраняется в DB; ArtifactCard показывает mini iframe preview |
| 13.6 Project switching data loss | ✅ | При переключении проекта загружаются messages и artifacts из API; auto-open первого HTML артефакта |

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

## Метрики

| Метрика | Значение |
|:---|:---|
| Backend тесты (pytest) | 628 passed |
| Backend покрытие | 95.40% |
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

**Live URL:** https://aislides-4m3r.onrender.com

## Переменные окружения на Render

| Переменная | Описание | Обязательная |
|:---|:---|:---|
| `OPENAI_API_KEY` | OpenAI API ключ (sk-...) | Да |
| `LLM_MODEL` | Модель LLM (default: `gpt-4.1`) | Нет |
| `OPENAI_BASE_URL` | Кастомный base URL для OpenAI-compatible API | Нет |
| `DATABASE_URL` | PostgreSQL URL (автоматически из Render) | Да (auto) |
| `JWT_SECRET_KEY` | Секрет для JWT токенов (автоматически генерируется) | Да (auto) |

## Следующий шаг

Продолжить с **Фазой 1: Quick Wins** из `DEVELOPMENT_PLAN.md`.

## Блокеры

Нет.
