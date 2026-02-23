/**
 * useArtifactEditor — хук для редактирования артефактов и отправки изменений.
 *
 * По roadmap 8.2: «Реализовать редактирование structure.md → перегенерация».
 * По PRD, раздел 10.1-10.2: сохранение → artifact_updated → перегенерация.
 *
 * Управляет:
 * - Переключением между режимами просмотра и редактирования
 * - Отправкой artifact_updated через WebSocket
 * - Состоянием сохранения (isSaving)
 */

import { useCallback, useState } from 'react'

/** Режим отображения артефакта. */
export type ArtifactViewMode = 'view' | 'edit'

/** Параметры хука useArtifactEditor. */
export interface UseArtifactEditorOptions {
  /** ID артефакта. */
  artifactId: string
  /** Исходное содержимое артефакта. */
  originalContent: string
  /** Функция отправки WebSocket-сообщения. */
  sendMessage: (message: Record<string, unknown>) => void
}

/** Возвращаемое значение хука useArtifactEditor. */
export interface UseArtifactEditorReturn {
  /** Текущий режим (view/edit). */
  mode: ArtifactViewMode
  /** Идёт ли сохранение. */
  isSaving: boolean
  /** Переключить в режим редактирования. */
  startEditing: () => void
  /** Отменить редактирование и вернуться к просмотру. */
  cancelEditing: () => void
  /** Сохранить изменения и отправить через WebSocket. */
  saveChanges: (newContent: string) => void
}

export function useArtifactEditor({
  artifactId,
  originalContent,
  sendMessage,
}: UseArtifactEditorOptions): UseArtifactEditorReturn {
  const [mode, setMode] = useState<ArtifactViewMode>('view')
  const [isSaving, setIsSaving] = useState(false)

  /** Переключить в режим редактирования. */
  const startEditing = useCallback(() => {
    setMode('edit')
  }, [])

  /** Отменить редактирование. */
  const cancelEditing = useCallback(() => {
    setMode('view')
  }, [])

  /** Сохранить изменения и отправить artifact_updated. */
  const saveChanges = useCallback(
    (newContent: string) => {
      // Не отправлять, если контент не изменился
      if (newContent === originalContent) {
        setMode('view')
        return
      }

      setIsSaving(true)

      // Отправляем WebSocket-сообщение artifact_updated
      sendMessage({
        type: 'artifact_updated',
        payload: {
          artifact_id: artifactId,
          new_content: newContent,
        },
      })

      // Переключаемся обратно в режим просмотра
      setIsSaving(false)
      setMode('view')
    },
    [artifactId, originalContent, sendMessage],
  )

  return {
    mode,
    isSaving,
    startEditing,
    cancelEditing,
    saveChanges,
  }
}
