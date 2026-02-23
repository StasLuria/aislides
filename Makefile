# AI Presentation Generator — Makefile
# Локальная замена CI + Docker-команды.

.PHONY: lint format typecheck test test-unit test-integration check clean \
        docker-up docker-down docker-build docker-logs docker-dev docker-reset

# ═══════════════════════════════════════════════════════
# Development (local)
# ═══════════════════════════════════════════════════════

## Линтинг (ruff)
lint:
	poetry run ruff check engine/ tools/ schemas/ backend/ tests/

## Форматирование (black + ruff format)
format:
	poetry run black engine/ tools/ schemas/ backend/ tests/
	poetry run ruff check --fix engine/ tools/ schemas/ backend/ tests/

## Проверка типов (mypy)
typecheck:
	poetry run mypy engine/ tools/ schemas/ backend/

## Тесты (pytest + coverage)
test:
	poetry run pytest

## Unit-тесты (быстрые, без LLM)
test-unit:
	poetry run pytest tests/unit/ -v

## Integration-тесты
test-integration:
	poetry run pytest tests/integration/ -v

## Frontend-тесты
test-frontend:
	cd frontend && npx vitest run

## Полная проверка (линтинг + типы + тесты) — аналог CI
check: lint typecheck test

## Очистка кэшей
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf htmlcov/ .coverage

# ═══════════════════════════════════════════════════════
# Docker
# ═══════════════════════════════════════════════════════

## Запустить все сервисы (production)
docker-up:
	docker compose up -d

## Запустить в режиме разработки (hot-reload)
docker-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

## Остановить все сервисы
docker-down:
	docker compose down

## Пересобрать и запустить
docker-build:
	docker compose up -d --build

## Показать логи
docker-logs:
	docker compose logs -f

## Полный сброс (удалить volumes)
docker-reset:
	docker compose down -v
	docker compose up -d --build
