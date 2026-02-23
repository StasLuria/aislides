/**
 * ChatInput — поле ввода сообщения с кнопкой отправки.
 *
 * По PRD 5.2: «Поле ввода» в области чата.
 * По PRD 8.3 (US-3): поддержка прикрепления файлов через кнопку «+».
 *
 * Поддерживает:
 * - Многострочный ввод (textarea с auto-resize)
 * - Отправку по Enter (Shift+Enter для новой строки)
 * - Прикрепление файлов
 * - Блокировку во время генерации (isLoading)
 */

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'

export interface ChatInputProps {
  /** Callback при отправке сообщения. */
  onSend: (text: string, files?: File[]) => void
  /** Блокировка ввода (во время генерации). */
  isLoading?: boolean
  /** Placeholder текст. */
  placeholder?: string
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Напишите сообщение...',
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0) return
    if (isLoading) return

    onSend(trimmed, files.length > 0 ? files : undefined)
    setText('')
    setFiles([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, files, isLoading, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)

      // Auto-resize textarea
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    },
    [],
  )

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [],
  )

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const canSend = (text.trim().length > 0 || files.length > 0) && !isLoading

  return (
    <div data-testid="chat-input" className="border-t border-gray-200 bg-white p-4">
      {/* Прикреплённые файлы */}
      {files.length > 0 && (
        <div data-testid="file-list" className="flex flex-wrap gap-2 mb-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-1 bg-gray-100 rounded-lg px-3 py-1 text-sm text-gray-700"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => handleRemoveFile(index)}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Удалить ${file.name}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Поле ввода */}
      <div className="flex items-end gap-2">
        {/* Кнопка прикрепления файла */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          aria-label="Прикрепить файл"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
        />

        {/* Кнопка отправки */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 p-2 rounded-xl bg-blue-600 text-white
            hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors"
          aria-label="Отправить сообщение"
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
