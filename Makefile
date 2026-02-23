# AI Presentation Generator — Makefile
# Локальная замена CI. Запускайте `make check` перед каждым коммитом.

.PHONY: lint format typecheck test check clean

## Линтинг (ruff)
lint:
	poetry run ruff check engine/ tools/ schemas/ tests/

## Форматирование (black + ruff format)
format:
	poetry run black engine/ tools/ schemas/ tests/
	poetry run ruff check --fix engine/ tools/ schemas/ tests/

## Проверка типов (mypy)
typecheck:
	poetry run mypy engine/ tools/ schemas/

## Тесты (pytest + coverage)
test:
	poetry run pytest

## Unit-тесты (быстрые, без LLM)
test-unit:
	poetry run pytest tests/unit/ -v

## Integration-тесты (с LLM)
test-integration:
	poetry run pytest tests/integration/ -v

## Полная проверка (линтинг + типы + тесты) — аналог CI
check: lint typecheck test

## Очистка кэшей
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf htmlcov/ .coverage
