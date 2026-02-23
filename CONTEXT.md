# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-23

## Текущий спринт

**Спринт 1: Схемы данных и ядро — ЗАВЕРШЁН ✅**

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
| 1.12 README + CHANGELOG | ✅ | Обновлены |

## Следующий шаг

**Спринт 2: Планировщик и инструменты S1-S3** — задача 2.1: `engine/nodes/planner_node.py` (S0_PlannerNode по ТЗ v3.0, §6.1)

## Блокеры

Нет.
