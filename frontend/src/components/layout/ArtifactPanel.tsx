/**
 * ArtifactPanel — правая панель для просмотра артефактов.
 *
 * По PRD 5.2: «Панель артефактов — появляется справа,
 * когда генерируется артефакт (по аналогии с Claude Artifacts)».
 *
 * Содержит live-превью HTML, просмотрщик PDF/изображений,
 * кнопки скачивания и версионирования.
 * Полная реализация — в Спринте 7.
 */

interface ArtifactPanelProps {
  /** Видимость панели. */
  isOpen: boolean
  /** Callback для закрытия панели. */
  onClose: () => void
  /** Дочерние элементы (ArtifactViewer). */
  children?: React.ReactNode
}

export function ArtifactPanel({ isOpen, onClose, children }: ArtifactPanelProps) {
  if (!isOpen) return null

  return (
    <aside
      data-testid="artifact-panel"
      className="flex flex-col w-[480px] min-w-[480px] bg-gray-50 border-l border-gray-200"
    >
      {/* Заголовок панели */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Артефакты</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          aria-label="Закрыть панель артефактов"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Содержимое */}
      <div className="flex-1 overflow-y-auto p-4">
        {children || (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Артефакты появятся здесь после генерации
          </div>
        )}
      </div>
    </aside>
  )
}
