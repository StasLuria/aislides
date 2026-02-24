# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-24

## Текущий статус

**Milestone: Product v1.0 — ДОСТИГНУТ ✅**

**Последняя активность:** Создание ADR-002, добавление Pre-commit Checklist в CONTRIBUTING.md, исправление 16 упавших тестов.

## Что сделано (24.02.2026)

### Спринт 11 (ad-hoc): Интеграция, стабилизация, документация

| Задача | Статус | Детали |
|:---|:---|:---|
| 11.1 Интеграция UI компонентов | ✅ | ChatInput, WebSocket, StatusCard, ArtifactPanel подключены в App.tsx |
| 11.2 Исправление бага S0 Planner | ✅ | Переключен Instructor на JSON mode для Gemini |
| 11.3 Исправление ExecutionPlanSchema | ✅ | Добавлен fallback-валидатор для строковых шагов |
| 11.4 Регистрация Tool Nodes | ✅ | S1-S5 узлы зарегистрированы в EngineAPI |
| 11.5 Исправление StatusCard | ✅ | Добавлен маппинг node_name → step_label |
| 11.6 Исправление Artifacts | ✅ | Добавлена эмиссия ARTIFACT_CREATED в RuntimeAgent |
| 11.7 Обновление AppLayout | ✅ | Добавлена поддержка внешнего управления ArtifactPanel |
| 11.8 Исправление тестов | ✅ | 16 тестов исправлены (allow_override в ToolRegistry) |
| 11.9 ADR-002 | ✅ | Задокументировано решение о JSON mode для Instructor |
| 11.10 Pre-commit Checklist | ✅ | Добавлена секция 9 в CONTRIBUTING.md |

## Последнее архитектурное решение

**ADR-002:** Переключение Instructor на `Mode.JSON` вместо `Mode.TOOLS` для совместимости с Gemini через OpenAI API. См. `docs/adr/ADR-002-instructor-json-mode.md`.

## Метрики

| Метрика | Значение |
|:---|:---|
| Backend тесты (pytest) | 628 passed |
| Backend покрытие | 95.39% |
| Frontend тесты (vitest) | 245 passed |
| Ruff ошибки | 0 |
| Mypy ошибки | 0 |
| ESLint ошибки | 0 |
| Версия | 1.0.0 (не изменена) |

## Следующий шаг

Начать работу над **Фазой 1: Quick Wins** из `DEVELOPMENT_PLAN.md`.

## Блокеры

Нет.
