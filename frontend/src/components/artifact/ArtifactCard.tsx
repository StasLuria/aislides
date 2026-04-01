/**
 * ArtifactCard — карточка артефакта, отображаемая в ленте чата.
 *
 * По PRD 5.3: «При генерации артефактов в чате появляются их превью.
 * При клике на превью артефакт открывается в Панели артефактов».
 *
 * Показывает иконку типа файла, имя, тип и кнопку открытия.
 * Для HTML-артефактов с content показывает mini iframe preview.
 */

import type { ArtifactData } from '../../types'

export interface ArtifactCardProps {
  /** Данные артефакта. */
  artifact: ArtifactData
  /** Callback при клике — открывает артефакт в панели. */
  onClick: (artifact: ArtifactData) => void
}

/** Иконка по типу файла. */
function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'html':
      return '🖼'
    case 'md':
      return '📄'
    case 'json':
      return '📋'
    case 'css':
      return '🎨'
    case 'pdf':
      return '📕'
    case 'image':
      return '🖼️'
    default:
      return '📎'
  }
}

/** Человекочитаемое название типа. */
function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case 'html':
      return 'HTML-слайды'
    case 'md':
      return 'Markdown'
    case 'json':
      return 'JSON'
    case 'css':
      return 'Стили CSS'
    case 'pdf':
      return 'PDF-документ'
    case 'image':
      return 'Изображение'
    default:
      return 'Файл'
  }
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const isHtmlWithContent = artifact.file_type === 'html' && artifact.content

  return (
    <button
      data-testid="artifact-card"
      data-artifact-id={artifact.artifact_id}
      onClick={() => onClick(artifact)}
      className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Иконка типа */}
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-lg group-hover:bg-blue-50 transition-colors"
          data-testid="artifact-icon"
        >
          {getFileIcon(artifact.file_type)}
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            {artifact.filename}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {getFileTypeLabel(artifact.file_type)}
          </div>
        </div>

        {/* Стрелка открытия */}
        <div className="flex items-center text-gray-300 group-hover:text-blue-500 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>

      {/* Превью: mini iframe для HTML с content, иначе placeholder */}
      {isHtmlWithContent ? (
        <div
          data-testid="artifact-preview"
          className="mt-2 rounded border border-gray-100 bg-white h-24 overflow-hidden relative pointer-events-none"
        >
          <iframe
            srcDoc={artifact.content}
            title={`Превью ${artifact.filename}`}
            sandbox=""
            className="w-[1920px] h-[1080px] border-0 origin-top-left"
            style={{
              transform: 'scale(0.18)',
              transformOrigin: 'top left',
            }}
            tabIndex={-1}
          />
        </div>
      ) : artifact.file_type === 'html' ? (
        <div
          data-testid="artifact-preview"
          className="mt-2 rounded border border-gray-100 bg-gray-50 h-24 flex items-center justify-center"
        >
          <span className="text-xs text-gray-400">Нажмите для просмотра</span>
        </div>
      ) : null}

      {/* Версия */}
      {artifact.current_version && artifact.current_version > 1 && (
        <div className="mt-1.5 text-xs text-gray-400" data-testid="artifact-version">
          Версия {artifact.current_version}
        </div>
      )}
    </button>
  )
}
