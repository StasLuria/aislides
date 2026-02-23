"""BaseNode — абстрактный базовый класс для всех узлов движка.

Реализация по ТЗ v3.0, §6.
"""

from __future__ import annotations

import abc
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from schemas.shared_store import SharedStore


class BaseNode(abc.ABC):
    """Абстрактный базовый класс для всех узлов (системных и инструментальных).

    Каждый узел реализует метод ``execute``, который принимает SharedStore,
    выполняет свою работу и возвращает обновлённый SharedStore.
    """

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Уникальное имя узла (например, 'S1_ContextAnalyzer')."""

    @abc.abstractmethod
    async def execute(self, store: SharedStore) -> SharedStore:
        """Выполнить работу узла.

        Args:
            store: Текущее состояние SharedStore.

        Returns:
            Обновлённый SharedStore с результатами работы узла.
        """
