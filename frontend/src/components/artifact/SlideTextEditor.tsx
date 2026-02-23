/**
 * SlideTextEditor — WYSIWYG-редактирование текста на HTML-слайдах.
 *
 * По roadmap 8.4: «Реализовать WYSIWYG-редактирование текста на слайдах».
 * По PRD, раздел 10.3 (v1.2): пользователь кликает на текстовый элемент
 * слайда и редактирует его прямо на месте через contentEditable.
 *
 * Архитектура:
 * 1. Рендерит HTML-слайд в контейнере
 * 2. Находит текстовые элементы (h1-h6, p, span, li, td, th)
 * 3. Делает их contentEditable при клике
 * 4. Отслеживает изменения и отправляет обновлённый HTML при сохранении
 *
 * Ограничения v1.2:
 * - Только текстовые правки (без перемещения/ресайза)
 * - Без drag-and-drop
 * - Без изменения стилей
 */

import { useCallback, useRef, useState, useEffect } from 'react'

/** Селектор текстовых элементов для редактирования. */
const TEXT_SELECTORS = 'h1, h2, h3, h4, h5, h6, p, span, li, td, th'

export interface SlideTextEditorProps {
  /** HTML-контент слайда. */
  htmlContent: string
  /** Callback при сохранении изменённого HTML. */
  onSave: (newHtml: string) => void
  /** Callback при отмене. */
  onCancel?: () => void
  /** Дополнительные CSS-классы. */
  className?: string
}

/** Деактивировать contentEditable у DOM-элемента. */
function deactivateElement(el: HTMLElement): void {
  el.contentEditable = 'false'
  el.style.outline = ''
  el.style.cursor = 'pointer'
}

/** Активировать contentEditable у DOM-элемента. */
function activateElement(el: HTMLElement): void {
  el.contentEditable = 'true'
  el.style.outline = '2px solid #3b82f6'
  el.style.cursor = 'text'
  el.focus()
}

export function SlideTextEditor({
  htmlContent,
  onSave,
  onCancel,
  className = '',
}: SlideTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeElementRef = useRef<HTMLElement | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  /** Инициализация: вставляем HTML и навешиваем обработчики. */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Вставляем HTML
    container.innerHTML = htmlContent

    // Находим все текстовые элементы
    const textElements = container.querySelectorAll(TEXT_SELECTORS)
    textElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.cursor = 'pointer'
      htmlEl.title = 'Нажмите для редактирования'
    })

    // Cleanup
    return () => {
      container.innerHTML = ''
    }
  }, [htmlContent])

  /** Обработчик клика — активирует contentEditable. */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const container = containerRef.current
      if (!container) return

      // Проверяем, что клик по текстовому элементу
      const textEl = target.closest(TEXT_SELECTORS) as HTMLElement | null
      if (!textEl || !container.contains(textEl)) return

      // Деактивируем предыдущий элемент
      const prev = activeElementRef.current
      if (prev && prev !== textEl) {
        deactivateElement(prev)
      }

      // Активируем новый элемент
      activateElement(textEl)
      activeElementRef.current = textEl
      setActiveTag(textEl.tagName.toLowerCase())
    },
    [],
  )

  /** Обработчик ввода — отслеживаем изменения. */
  const handleInput = useCallback(() => {
    setIsDirty(true)
  }, [])

  /** Обработчик клавиш — Escape для деактивации. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const current = activeElementRef.current
      if (e.key === 'Escape' && current) {
        deactivateElement(current)
        activeElementRef.current = null
        setActiveTag(null)
      }
    },
    [],
  )

  /** Сохранить изменённый HTML. */
  const handleSave = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Деактивируем все contentEditable
    const textElements = container.querySelectorAll(TEXT_SELECTORS)
    textElements.forEach((el) => {
      deactivateElement(el as HTMLElement)
    })

    activeElementRef.current = null
    setActiveTag(null)
    onSave(container.innerHTML)
    setIsDirty(false)
  }, [onSave])

  /** Отменить изменения. */
  const handleCancel = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.innerHTML = htmlContent
    }
    activeElementRef.current = null
    setActiveTag(null)
    setIsDirty(false)
    onCancel?.()
  }, [htmlContent, onCancel])

  return (
    <div
      data-testid="slide-text-editor"
      className={`flex flex-col h-full ${className}`}
    >
      {/* Toolbar */}
      <div
        data-testid="slide-editor-toolbar"
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            WYSIWYG-редактор слайда
          </span>
          {activeTag && (
            <span className="text-xs text-blue-400">
              Редактирование: {activeTag}
            </span>
          )}
          {isDirty && (
            <span
              data-testid="slide-editor-dirty"
              className="text-xs text-yellow-400"
            >
              ● Изменено
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              data-testid="slide-editor-cancel"
              onClick={handleCancel}
              className="px-3 py-1 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              Отмена
            </button>
          )}
          <button
            data-testid="slide-editor-save"
            onClick={handleSave}
            disabled={!isDirty}
            className="px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div
        ref={containerRef}
        data-testid="slide-editor-content"
        className="flex-1 overflow-auto p-4 bg-white"
        onClick={handleClick}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        role="textbox"
        tabIndex={0}
        aria-label="Редактор слайда"
      />
    </div>
  )
}
