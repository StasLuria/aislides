/**
 * EditableArtifact — компонент для просмотра/редактирования текстовых артефактов.
 *
 * По roadmap 8.2: «Реализовать редактирование structure.md → перегенерация».
 * По PRD, раздел 10.1-10.2 (Подход А):
 * - В режиме просмотра: MarkdownViewer (для .md) или CodeEditor readOnly
 * - В режиме редактирования: CodeEditor с сохранением
 * - Кнопка «Редактировать» переключает режим
 * - Сохранение отправляет artifact_updated через WebSocket
 */

import { MarkdownViewer } from './MarkdownViewer'
import { CodeEditor } from './CodeEditor'
import { useArtifactEditor } from '../../hooks/useArtifactEditor'
import type { ArtifactViewMode } from '../../hooks/useArtifactEditor'

/** Типы файлов, для которых используется MarkdownViewer в режиме просмотра. */
const MARKDOWN_TYPES = new Set(['md', 'markdown'])

export interface EditableArtifactProps {
  /** ID артефакта. */
  artifactId: string
  /** Имя файла. */
  filename: string
  /** Содержимое файла. */
  content: string
  /** Тип файла (расширение). */
  fileType: string
  /** Функция отправки WebSocket-сообщения. */
  sendMessage: (message: Record<string, unknown>) => void
  /** Дополнительные CSS-классы. */
  className?: string
}

export function EditableArtifact({
  artifactId,
  filename,
  content,
  fileType,
  sendMessage,
  className = '',
}: EditableArtifactProps) {
  const { mode, isSaving, startEditing, cancelEditing, saveChanges } =
    useArtifactEditor({
      artifactId,
      originalContent: content,
      sendMessage,
    })

  const isMarkdown = MARKDOWN_TYPES.has(fileType.toLowerCase())

  return (
    <div
      data-testid="editable-artifact"
      className={`flex flex-col h-full ${className}`}
    >
      {/* Toolbar с кнопкой редактирования */}
      <div
        data-testid="editable-artifact-toolbar"
        className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200"
      >
        <span className="text-sm font-medium text-gray-700">{filename}</span>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span
              data-testid="editable-artifact-saving"
              className="text-xs text-blue-500"
            >
              Сохранение...
            </span>
          )}
          <ModeToggleButton mode={mode} onEdit={startEditing} onView={cancelEditing} />
        </div>
      </div>

      {/* Содержимое */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'view' ? (
          <ViewMode
            content={content}
            filename={filename}
            isMarkdown={isMarkdown}
          />
        ) : (
          <CodeEditor
            content={content}
            filename={filename}
            onSave={saveChanges}
            onCancel={cancelEditing}
          />
        )}
      </div>
    </div>
  )
}

/** Кнопка переключения режима. */
function ModeToggleButton({
  mode,
  onEdit,
  onView,
}: {
  mode: ArtifactViewMode
  onEdit: () => void
  onView: () => void
}) {
  if (mode === 'view') {
    return (
      <button
        data-testid="editable-artifact-edit-btn"
        onClick={onEdit}
        className="px-3 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
      >
        Редактировать
      </button>
    )
  }

  return (
    <button
      data-testid="editable-artifact-view-btn"
      onClick={onView}
      className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
    >
      Просмотр
    </button>
  )
}

/** Режим просмотра: MarkdownViewer для .md, CodeEditor readOnly для остальных. */
function ViewMode({
  content,
  filename,
  isMarkdown,
}: {
  content: string
  filename: string
  isMarkdown: boolean
}) {
  if (isMarkdown) {
    return <MarkdownViewer content={content} />
  }

  return (
    <CodeEditor
      content={content}
      filename={filename}
      onSave={() => {}}
      readOnly
    />
  )
}
