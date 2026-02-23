"""Unit-тесты для S0 PlannerNode — поддержка redesign_context.

Тестирует:
- _build_user_prompt формирует правильный промпт с redesign_context.
- REDESIGN_CONTEXT_ADDITION содержит ключевые инструкции.
- Промпт без redesign_context не содержит секцию редизайна.
"""

from __future__ import annotations

from engine.nodes.planner_node import (
    REDESIGN_CONTEXT_ADDITION,
    SYSTEM_PROMPT,
    _build_user_prompt,
)
from schemas.shared_store import SharedStore


class TestPlannerRedesignPrompt:
    """Тесты для промптов S0 с redesign_context."""

    def test_system_prompt_contains_redesign_rule(self) -> None:
        """SYSTEM_PROMPT должен содержать правило для redesign."""
        assert "redesign_context" in SYSTEM_PROMPT
        assert "S3" in SYSTEM_PROMPT
        assert "S4" in SYSTEM_PROMPT
        assert "S5" in SYSTEM_PROMPT

    def test_redesign_context_addition_template(self) -> None:
        """REDESIGN_CONTEXT_ADDITION должен содержать placeholder."""
        assert "{style_request}" in REDESIGN_CONTEXT_ADDITION
        assert "S3" in REDESIGN_CONTEXT_ADDITION
        assert "S4" in REDESIGN_CONTEXT_ADDITION
        assert "S5" in REDESIGN_CONTEXT_ADDITION

    def test_build_user_prompt_with_redesign_context(self) -> None:
        """_build_user_prompt должен включить секцию редизайна."""
        store = SharedStore(
            project_id="test",
            config={},
            user_input={
                "prompt": "Смени стиль на Swiss Minimalist",
                "redesign_context": {
                    "style_request": "Swiss Minimalist с белым фоном",
                },
            },
            results={
                "S1_ContextAnalyzer": {"audience": "developers"},
                "S2_NarrativeArchitect": {"framework": "problem-solution"},
            },
        )

        prompt = _build_user_prompt(store)

        assert "Swiss Minimalist с белым фоном" in prompt
        assert "Контекст редизайна" in prompt
        assert "S1_ContextAnalyzer" in prompt
        assert "S2_NarrativeArchitect" in prompt

    def test_build_user_prompt_without_redesign_context(self) -> None:
        """_build_user_prompt без redesign_context не должен содержать секцию."""
        store = SharedStore(
            project_id="test",
            config={},
            user_input={
                "prompt": "Создай презентацию про AI",
            },
        )

        prompt = _build_user_prompt(store)

        assert "Контекст редизайна" not in prompt
        assert "style_request" not in prompt

    def test_build_user_prompt_redesign_and_existing_results(self) -> None:
        """Промпт с redesign_context должен показывать existing results."""
        store = SharedStore(
            project_id="test",
            config={},
            user_input={
                "prompt": "Смени стиль",
                "redesign_context": {
                    "style_request": "Dark Mode Code",
                },
            },
            results={
                "S1_ContextAnalyzer": {},
                "S2_NarrativeArchitect": {},
                "S3_DesignArchitect": {},
            },
        )

        prompt = _build_user_prompt(store)

        assert "Уже выполненные шаги" in prompt
        assert "Dark Mode Code" in prompt
