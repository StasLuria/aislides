"""ToolRegistry — реестр инструментальных узлов.

Реализация по ТЗ v3.0, §6.
RuntimeAgent использует ToolRegistry для поиска узлов по имени
при исполнении шагов плана.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from engine.base_node import BaseNode

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Реестр инструментальных узлов (ToolNode).

    Хранит маппинг ``name -> BaseNode``. Используется RuntimeAgent
    для разрешения имён узлов из ExecutionPlan в конкретные объекты.

    Пример использования::

        registry = ToolRegistry()
        registry.register(S1ContextAnalyzerNode())
        node = registry.get("S1_ContextAnalyzer")
    """

    def __init__(self) -> None:
        self._nodes: dict[str, BaseNode] = {}

    def register(self, node: BaseNode, *, allow_override: bool = False) -> None:
        """Зарегистрировать узел в реестре.

        Args:
            node: Экземпляр узла для регистрации.
            allow_override: Если True, перезаписать существующий узел.

        Raises:
            ValueError: Если узел с таким именем уже зарегистрирован
                и allow_override=False.
        """
        if node.name in self._nodes and not allow_override:
            msg = f"Узел '{node.name}' уже зарегистрирован"
            raise ValueError(msg)
        self._nodes[node.name] = node
        logger.info("Зарегистрирован узел: %s", node.name)

    def get(self, name: str) -> BaseNode:
        """Получить узел по имени.

        Args:
            name: Имя узла (например, "S1_ContextAnalyzer").

        Returns:
            Экземпляр узла.

        Raises:
            KeyError: Если узел не найден.
        """
        if name not in self._nodes:
            msg = f"Узел '{name}' не найден в реестре. Доступные: {list(self._nodes.keys())}"
            raise KeyError(msg)
        return self._nodes[name]

    def has(self, name: str) -> bool:
        """Проверить, зарегистрирован ли узел.

        Args:
            name: Имя узла.

        Returns:
            True если узел зарегистрирован.
        """
        return name in self._nodes

    @property
    def available_nodes(self) -> list[str]:
        """Список имён всех зарегистрированных узлов."""
        return list(self._nodes.keys())

    def __len__(self) -> int:
        return len(self._nodes)
