"""EngineAPI — единственная точка входа для Backend.

Реализация по ТЗ v3.0, §3.
Инкапсулирует весь жизненный цикл: создание SharedStore,
вызов S0_PlannerNode, валидацию плана, исполнение через RuntimeAgent.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Any

from engine.event_bus import EventBus
from engine.nodes.planner_node import S0PlannerNode
from engine.nodes.validator_node import PlanValidatorNode
from engine.registry import ToolRegistry
from engine.runtime import RuntimeAgent
from schemas.events import EngineEvent, EventType
from schemas.shared_store import ChatMessage, ProjectStatus, SharedStore
from tools.s1_context_analyzer import S1ContextAnalyzerNode
from tools.s2_narrative_architect import S2NarrativeArchitectNode
from tools.s3_design_architect import S3DesignArchitectNode
from tools.s4_slide_generator import S4SlideGeneratorNode
from tools.s5_quality_validator import S5QualityValidatorNode

logger = logging.getLogger(__name__)

# Максимальное количество попыток перепланирования при ошибках валидации
MAX_REPLAN_ATTEMPTS = 2


class EngineAPI:
    """Публичный API движка.

    Предоставляет три метода:
    - ``run()`` — полный цикл генерации презентации.
    - ``apply_edit()`` — обработка ручной правки артефакта.
    - ``cancel()`` — отмена текущего выполнения.

    Attributes:
        event_bus: Шина событий для трансляции прогресса.
        registry: Реестр инструментальных узлов.
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self._config = config or {}
        self.event_bus = EventBus()
        self.registry = ToolRegistry()
        self._cancellation_tokens: dict[str, asyncio.Event] = {}

        # Настройки LLM из конфигурации с fallback на переменные окружения
        llm_config = self._config.get("llm", {})
        self._llm_model = llm_config.get("model") or os.environ.get("LLM_MODEL", "gpt-4.1")
        self._llm_api_key = llm_config.get("api_key") or os.environ.get("OPENAI_API_KEY")
        self._llm_base_url = llm_config.get("base_url") or os.environ.get("OPENAI_BASE_URL")
        self._llm_max_retries = llm_config.get("max_retries", 3)

        # Создаём узлы планирования и валидации
        self._planner = S0PlannerNode(
            model=self._llm_model,
            max_retries=self._llm_max_retries,
            api_key=self._llm_api_key,
            base_url=self._llm_base_url,
        )
        self._validator = PlanValidatorNode(registry=self.registry)

        # Регистрируем инструментальные узлы S1-S5
        self._register_tool_nodes()

    def _register_tool_nodes(self) -> None:
        """Зарегистрировать все инструментальные узлы S1-S5 в реестре.

        Каждый узел создаётся с общими настройками LLM из конфигурации.
        """
        common_kwargs = {
            "model": self._llm_model,
            "max_retries": self._llm_max_retries,
            "api_key": self._llm_api_key,
            "base_url": self._llm_base_url,
        }

        self.registry.register(S1ContextAnalyzerNode(**common_kwargs))
        self.registry.register(S2NarrativeArchitectNode(**common_kwargs))
        self.registry.register(S3DesignArchitectNode(**common_kwargs))
        self.registry.register(S4SlideGeneratorNode(**common_kwargs))
        self.registry.register(S5QualityValidatorNode(**common_kwargs))

        logger.info(
            "Зарегистрировано %d инструментальных узлов: %s",
            len(self.registry),
            self.registry.available_nodes,
        )

    async def run(
        self,
        project_id: str | None = None,
        user_input: dict[str, Any] | None = None,
        chat_history: list[dict[str, Any]] | None = None,
        existing_results: dict[str, Any] | None = None,
        attached_files: list[dict[str, Any]] | None = None,
    ) -> SharedStore:
        """Основной метод: выполнить полный цикл генерации.

        Цикл:
        1. Создать SharedStore.
        2. Вызвать S0_PlannerNode для генерации плана.
        3. Валидировать план через PlanValidatorNode.
        4. При ошибках валидации — перепланировать (до MAX_REPLAN_ATTEMPTS).
        5. Исполнить план через RuntimeAgent.

        Args:
            project_id: Уникальный ID проекта (генерируется, если не указан).
            user_input: Входные данные от пользователя.
            chat_history: История чата.
            existing_results: Результаты предыдущих шагов (для частичной перегенерации).
            attached_files: Прикреплённые файлы.

        Returns:
            Финальный SharedStore с результатами.
        """
        project_id = project_id or str(uuid.uuid4())
        trace_id = project_id

        # 1. Создать SharedStore
        store = SharedStore(
            project_id=project_id,
            status=ProjectStatus.PLANNING,
            user_input=user_input or {},
            config=self._config,
            chat_history=[ChatMessage(**msg) for msg in (chat_history or [])],
            results=existing_results or {},
        )

        # 2. Создать cancel_token
        cancel_token = asyncio.Event()
        self._cancellation_tokens[project_id] = cancel_token

        await self.event_bus.emit(
            EngineEvent(
                event_type=EventType.PLAN_STARTED,
                trace_id=trace_id,
                component="EngineAPI",
                message="Начата генерация презентации",
            )
        )

        try:
            # 3. Планирование + валидация (с повторными попытками)
            store = await self._plan_and_validate(store, trace_id)

            # Проверяем, прошла ли валидация
            if store.plan_validation_errors:
                store.status = ProjectStatus.FAILED
                store.errors.append(
                    {
                        "component": "PlanValidatorNode",
                        "error": f"План не прошёл валидацию после {MAX_REPLAN_ATTEMPTS} попыток: "
                        + "; ".join(store.plan_validation_errors),
                    }
                )
                await self.event_bus.emit(
                    EngineEvent(
                        event_type=EventType.ERROR,
                        trace_id=trace_id,
                        component="PlanValidatorNode",
                        message="План не прошёл валидацию",
                    )
                )
                return store

            await self.event_bus.emit(
                EngineEvent(
                    event_type=EventType.PLAN_COMPLETED,
                    trace_id=trace_id,
                    component="EngineAPI",
                    message="План сгенерирован и валидирован",
                )
            )

            # 4. Исполнение плана через RuntimeAgent
            if store.execution_plan is not None:
                store.status = ProjectStatus.EXECUTING
                agent = RuntimeAgent(
                    registry=self.registry,
                    event_bus=self.event_bus,
                    cancel_token=cancel_token,
                )
                store = await agent.execute(store)
            else:
                logger.warning("[%s] execution_plan отсутствует, пропуск RuntimeAgent", trace_id)

        except Exception as exc:
            store.status = ProjectStatus.FAILED
            store.errors.append({"component": "EngineAPI", "error": str(exc)})
            await self.event_bus.emit(
                EngineEvent(
                    event_type=EventType.ERROR,
                    trace_id=trace_id,
                    component="EngineAPI",
                    message=f"Критическая ошибка: {exc}",
                )
            )
            logger.exception("[%s] Критическая ошибка в EngineAPI.run", trace_id)
        finally:
            self._cancellation_tokens.pop(project_id, None)

        return store

    async def _plan_and_validate(self, store: SharedStore, trace_id: str) -> SharedStore:
        """Планирование с валидацией и повторными попытками.

        Args:
            store: SharedStore для планирования.
            trace_id: ID для трассировки.

        Returns:
            SharedStore с валидированным планом или ошибками валидации.
        """
        for attempt in range(1, MAX_REPLAN_ATTEMPTS + 1):
            logger.info(
                "[%s] Планирование: попытка %d/%d",
                trace_id,
                attempt,
                MAX_REPLAN_ATTEMPTS,
            )

            # Вызвать S0_PlannerNode
            store = await self._planner.execute(store)

            # Вызвать PlanValidatorNode
            store = await self._validator.execute(store)

            # Если план валиден — выходим
            if store.plan_validation_errors is None:
                logger.info("[%s] План валиден с попытки %d", trace_id, attempt)
                return store

            # Если есть ошибки — добавляем их в user_input для перепланирования
            logger.warning(
                "[%s] Попытка %d: ошибки валидации: %s",
                trace_id,
                attempt,
                "; ".join(store.plan_validation_errors),
            )

            if attempt < MAX_REPLAN_ATTEMPTS:
                # Добавляем ошибки валидации в контекст для перепланирования
                store.user_input["validation_errors"] = store.plan_validation_errors
                store.execution_plan = None  # Сбрасываем план

        return store

    async def apply_edit(
        self,
        project_id: str,
        artifact_id: str,
        new_content: str,
        chat_history: list[dict[str, Any]] | None = None,
        existing_results: dict[str, Any] | None = None,
    ) -> SharedStore:
        """Обработать ручную правку артефакта.

        Механизм по ТЗ v3.0, §14:
        1. Валидирует входные данные.
        2. Записывает ``edit_context`` в ``user_input``.
        3. Передаёт ``existing_results`` чтобы S0_PlannerNode мог
           сгенерировать план перегенерации **только зависимых** артефактов.
        4. Запускает стандартный ``run()``.

        Args:
            project_id: ID проекта.
            artifact_id: ID артефакта для правки.
            new_content: Новое содержимое артефакта.
            chat_history: История чата (опционально).
            existing_results: Текущие результаты (опционально).

        Returns:
            Обновлённый SharedStore.

        Raises:
            ValueError: Если ``artifact_id`` или ``new_content`` пустые.
        """
        # Валидация входных данных
        if not artifact_id or not artifact_id.strip():
            msg = "artifact_id не может быть пустым"
            raise ValueError(msg)
        if not new_content:
            msg = "new_content не может быть пустым"
            raise ValueError(msg)

        logger.info(
            "[%s] apply_edit: артефакт=%s, длина контента=%d",
            project_id,
            artifact_id,
            len(new_content),
        )

        await self.event_bus.emit(
            EngineEvent(
                event_type=EventType.AI_MESSAGE,
                trace_id=project_id,
                component="EngineAPI",
                message=f"Обработка ручной правки артефакта '{artifact_id}'",
                data={"artifact_id": artifact_id, "content_length": len(new_content)},
            )
        )

        return await self.run(
            project_id=project_id,
            user_input={
                "prompt": f"Пользователь вручную отредактировал артефакт '{artifact_id}'. "
                "Проанализируй правку и перегенерируй только зависимые артефакты.",
                "edit_context": {
                    "artifact_id": artifact_id,
                    "new_content": new_content,
                },
            },
            chat_history=chat_history or [],
            existing_results=existing_results or {},
        )

    async def redesign(
        self,
        project_id: str,
        style_request: str,
        existing_results: dict[str, Any] | None = None,
        chat_history: list[dict[str, Any]] | None = None,
    ) -> SharedStore:
        """Redesign existing presentation with a new style.

        Mechanism (CJM 5):
        1. Validates inputs.
        2. Sets ``redesign_context`` in ``user_input``.
        3. Passes ``existing_results`` (S1, S2) so S0_PlannerNode
           generates a plan with only S3 -> S4 -> S5.
        4. Runs the standard ``run()`` pipeline.

        Args:
            project_id: Project ID.
            style_request: Description of the desired new style.
            existing_results: Results from previous generation (S1, S2).
            chat_history: Chat history (optional).

        Returns:
            Updated SharedStore.

        Raises:
            ValueError: If ``style_request`` is empty.
        """
        if not style_request or not style_request.strip():
            msg = "style_request не может быть пустым"
            raise ValueError(msg)

        logger.info(
            "[%s] redesign: style_request=%s",
            project_id,
            style_request[:100],
        )

        await self.event_bus.emit(
            EngineEvent(
                event_type=EventType.AI_MESSAGE,
                trace_id=project_id,
                component="EngineAPI",
                message=f"Начинаю редизайн презентации: {style_request[:100]}",
                data={"style_request": style_request},
            )
        )

        return await self.run(
            project_id=project_id,
            user_input={
                "prompt": f"Смени стиль презентации на: {style_request}",
                "redesign_context": {
                    "style_request": style_request,
                },
            },
            chat_history=chat_history or [],
            existing_results=existing_results or {},
        )

    async def cancel(self, project_id: str) -> bool:
        """Отменить текущее выполнение для проекта.

        Args:
            project_id: ID проекта для отмены.

        Returns:
            True если отмена инициирована, False если проект не найден.
        """
        token = self._cancellation_tokens.get(project_id)
        if token:
            token.set()
            logger.info("[%s] Отмена инициирована", project_id)
            return True
        logger.warning("[%s] Токен отмены не найден", project_id)
        return False
