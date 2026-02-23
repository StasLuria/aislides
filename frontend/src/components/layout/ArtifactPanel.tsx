/**
 * ArtifactPanel — правая панель для просмотра артефактов.
 *
 * По PRD 5.2: «Панель артефактов — появляется справа,
 * когда генерируется артефакт (по аналогии с Claude Artifacts)».
 *
 * Содержит:
 * - Заголовок с именем текущего артефакта
 * - Toolbar с кнопками действий (скачать, открыть, закрыть)
 * - Область просмотра (children: SlidePreview, MarkdownViewer и т.д.)
 * - Список артефактов (табы) при наличии нескольких
 */

import type { ArtifactData } from '../../types'

export interface ArtifactPanelProps {
  /** Видимость панели. */
  isOpen: boolean
  /** Callback для закрытия панели. */
  onClose: () => void
  /** Текущий артефакт для отображения. */
  artifact?: ArtifactData | null
  /** Список всех артефактов проекта. */
  artifacts?: ArtifactData[]
  /** Callback при выборе артефакта из списка. */
  onSelectArtifact?: (artifact: ArtifactData) => void
  /** Callback для скачивания. */
  onDownload?: (artifact: ArtifactData) => void
  /** Callback для открытия в новой вкладке. */
  onOpenNewTab?: (artifact: ArtifactData) => void
  /** Callback для редизайна (CJM 5). */
  onRedesign?: () => void
  /** Дочерние элементы (viewer). */
  children?: React.ReactNode
}

export function ArtifactPanel({
  isOpen,
  onClose,
  artifact,
  artifacts = [],
  onSelectArtifact,
  onDownload,
  onOpenNewTab,
  onRedesign,
  children,
}: ArtifactPanelProps) {
  if (!isOpen) return null

  return (
    <aside
      data-testid="artifact-panel"
      className="flex flex-col w-[480px] min-w-[480px] bg-gray-50 border-l border-gray-200"
    >
      {/* Заголовок панели */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          {artifact ? (
            <div>
              <h2
                className="text-sm font-semibold text-gray-700 truncate"
                data-testid="artifact-panel-title"
              >
                {artifact.filename}
              </h2>
              <span className="text-xs text-gray-400">
                {artifact.file_type.toUpperCase()}
                {artifact.current_version && artifact.current_version > 1
                  ? ` · v${artifact.current_version}`
                  : ''}
              </span>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-gray-700">Артефакты</h2>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 ml-2">
          {artifact && onOpenNewTab && (
            <button
              onClick={() => onOpenNewTab(artifact)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Открыть в новой вкладке"
              data-testid="btn-open-new-tab"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          )}
          {onRedesign && (
            <button
              onClick={onRedesign}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
              aria-label="Сменить стиль"
              data-testid="btn-redesign"
              title="Сменить стиль презентации"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </button>
          )}
          {artifact && onDownload && (
            <button
              onClick={() => onDownload(artifact)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Скачать"
              data-testid="btn-download"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            aria-label="Закрыть панель артефактов"
            data-testid="btn-close-panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Табы артефактов (если больше одного) */}
      {artifacts.length > 1 && (
        <div
          className="flex gap-1 px-3 py-2 border-b border-gray-200 overflow-x-auto"
          data-testid="artifact-tabs"
        >
          {artifacts.map((a) => (
            <button
              key={a.artifact_id}
              onClick={() => onSelectArtifact?.(a)}
              data-testid="artifact-tab"
              data-active={a.artifact_id === artifact?.artifact_id}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                a.artifact_id === artifact?.artifact_id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {a.filename}
            </button>
          ))}
        </div>
      )}

      {/* Содержимое */}
      <div className="flex-1 overflow-y-auto" data-testid="artifact-content">
        {children || (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
            Артефакты появятся здесь после генерации
          </div>
        )}
      </div>
    </aside>
  )
}
