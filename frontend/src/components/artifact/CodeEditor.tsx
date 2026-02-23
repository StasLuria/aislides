/**
 * CodeEditor — редактор текстовых артефактов на базе Monaco Editor.
 *
 * По roadmap 8.1: «Интегрировать Monaco Editor для текстовых файлов».
 * По PRD, раздел 10.1: Monaco Editor для .md, .py, .json, .css и др.
 *
 * Поддерживает:
 * - Автоопределение языка по расширению файла
 * - Тёмную тему
 * - Ctrl+S / Cmd+S для сохранения
 * - Кнопки «Сохранить» и «Отмена»
 * - Отслеживание изменений (dirty state)
 */

import { useCallback, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { getLanguageFromFilename } from './editorUtils'

export interface CodeEditorProps {
  /** Содержимое файла для редактирования. */
  content: string
  /** Имя файла (для определения языка). */
  filename: string
  /** Callback при сохранении (Ctrl+S или кнопка). */
  onSave: (newContent: string) => void
  /** Callback при отмене редактирования. */
  onCancel?: () => void
  /** Только чтение. */
  readOnly?: boolean
  /** Дополнительные CSS-классы. */
  className?: string
}

export function CodeEditor({
  content,
  filename,
  onSave,
  onCancel,
  readOnly = false,
  className = '',
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const language = getLanguageFromFilename(filename)

  /** Обработчик монтирования редактора. */
  const handleEditorDidMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance

      // Ctrl+S / Cmd+S → сохранение
      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const value = editorInstance.getValue()
          onSave(value)
          setIsDirty(false)
        },
      )
    },
    [onSave],
  )

  /** Обработчик изменений в редакторе. */
  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && value !== content) {
        setIsDirty(true)
      }
    },
    [content],
  )

  /** Сохранить текущее содержимое. */
  const handleSave = useCallback(() => {
    if (editorRef.current) {
      const value = editorRef.current.getValue()
      onSave(value)
      setIsDirty(false)
    }
  }, [onSave])

  /** Отменить изменения — вернуть исходный контент. */
  const handleCancel = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.setValue(content)
      setIsDirty(false)
    }
    onCancel?.()
  }, [content, onCancel])

  return (
    <div
      data-testid="code-editor"
      className={`flex flex-col h-full ${className}`}
    >
      {/* Toolbar */}
      {!readOnly && (
        <div
          data-testid="code-editor-toolbar"
          className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">{filename}</span>
            <span className="text-xs text-gray-500">({language})</span>
            {isDirty && (
              <span
                data-testid="code-editor-dirty"
                className="text-xs text-yellow-400"
              >
                ● Изменено
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                data-testid="code-editor-cancel"
                onClick={handleCancel}
                className="px-3 py-1 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
            )}
            <button
              data-testid="code-editor-save"
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          defaultValue={content}
          language={language}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          onChange={handleChange}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  )
}
