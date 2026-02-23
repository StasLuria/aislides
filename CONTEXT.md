# CONTEXT.md — Текущее состояние проекта

**Последнее обновление:** 2026-02-23

## Текущий спринт

**Спринт 2: Планировщик и инструменты S1-S3 — ЗАВЕРШЁН ✅**

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
| 2.8 Unit-тесты PlannerNode | ✅ | 13 тестов с mock LLM |
| 2.9 Unit-тесты ValidatorNode | ✅ | 18 тестов |
| 2.10 Unit-тесты S1-S3 | ✅ | 23 теста с mock LLM |
| 2.11 Интеграция EngineAPI | ✅ | Replan loop, PLAN_COMPLETED event |
| 2.12 README + CHANGELOG | ✅ | v0.3.0 |

## Метрики

| Метрика | Значение |
|:---|:---|
| Unit-тесты | 115 passed |
| Покрытие | 95.32% |
| Ruff ошибки | 0 |
| Mypy ошибки | 0 |
| Версия | 0.3.0 |

## Следующий шаг

**Спринт 3: Инструменты S4-S5 и сквозной тест** — задача 3.1: `tools/s4_slide_generator.py` (S4 Node по technical_specification.md, раздел 2.5)

## Блокеры

Нет.
