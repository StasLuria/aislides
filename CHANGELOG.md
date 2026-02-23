# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.3.0] - 2026-02-23 — Sprint 2: Planner & Tools S1-S3

### Added

- `engine/nodes/planner_node.py` — S0_PlannerNode: LLM planner with Instructor per §6.1 and §7 (task 2.1)
- `engine/nodes/validator_node.py` — PlanValidatorNode: plan validation with dependency checks per §6.1 (task 2.2)
- `tools/s1_context_analyzer.py` — S1_ContextAnalyzerNode: context analysis per tech spec S1 (task 2.3)
- `tools/s2_narrative_architect.py` — S2_NarrativeArchitectNode: narrative design per tech spec S2 (task 2.4)
- `tools/s3_design_architect.py` — S3_DesignArchitectNode: design system per tech spec S3 (task 2.5)
- `data/presets/corporate_classic.json` — MVP design preset with full color/typography/layout config (task 2.6)
- `tools/prompts/` — LLM prompt templates for S0-S3 (task 2.7)
- 60 new unit tests: PlannerNode (13), ValidatorNode (18), S1-S3 (23), EngineAPI updated (6) (tasks 2.8-2.11)
- `schemas/events.py` — added PLAN_COMPLETED event type

### Changed

- `engine/api.py` — full integration with S0_PlannerNode and PlanValidatorNode, replan loop (task 2.11)
- Test coverage: 95.32% (115 tests, target: 90%)

## [0.2.0] - 2026-02-23 — Sprint 1: Schemas & Core Engine

### Added

- `schemas/shared_store.py` — SharedStore Pydantic model per engine spec v3.0 §4 (task 1.1)
- `schemas/execution_plan.py` — ExecutionPlanSchema and PlanStep per §8 (task 1.2)
- `schemas/tool_schemas.py` — Pydantic models for S1-S5 tools per technical spec (task 1.3)
- `schemas/events.py` — EventType enum and EngineEvent model per §5 (task 1.4)
- `engine/event_bus.py` — EventBus with subscribe/unsubscribe/emit per §5 (task 1.4)
- `engine/base_node.py` — BaseNode abstract class per §6 (task 1.5)
- `engine/registry.py` — ToolRegistry for node lookup per §6 (task 1.5)
- `engine/runtime.py` — RuntimeAgent execution loop per §9 (task 1.6)
- `engine/api.py` — EngineAPI stub with run/apply_edit/cancel per §3 (task 1.7)
- 55 unit tests: SharedStore (12), ExecutionPlan (9), EventBus (11), RuntimeAgent+Registry (16), EngineAPI (7) (tasks 1.8-1.11)
- Test coverage: 96.54% (target: 90%)

## [0.1.0] - 2026-02-23 — Sprint 0: Project Setup

### Added

- Project structure: `engine/`, `tools/`, `schemas/`, `tests/`, `data/`, `docs/`, `configs/` (tasks 0.1-0.2)
- `pyproject.toml` with Poetry, all dependencies configured (task 0.3)
- `configs/config.yaml` per engine spec v3.0 §12 (task 0.4)
- `.env.example` with API key placeholders (task 0.5)
- Pre-commit hooks: ruff, black, mypy, trailing-whitespace, end-of-file-fixer (task 0.6)
- `Makefile` with `lint`, `format`, `typecheck`, `test`, `check` targets (task 0.7)
- Documentation: README, CONTRIBUTING, ONBOARDING, CHANGELOG (task 0.8)
- ADR-001: Engine architecture decision record (task 0.9)
- CONTEXT.md with current project state
