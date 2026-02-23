/**
 * useArtifactPanel — хук для управления панелью артефактов.
 *
 * Позволяет открывать/закрывать/переключать панель
 * из любого дочернего компонента.
 * Будет расширен в Спринте 7.
 */

import { useState } from 'react'

export function useArtifactPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  }
}
