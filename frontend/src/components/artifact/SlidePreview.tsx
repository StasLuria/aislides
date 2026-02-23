/**
 * SlidePreview — превью HTML-слайдов через iframe.
 *
 * По roadmap 7.3: «Реализовать SlidePreview (превью HTML-слайдов)
 * с iframe и масштабированием».
 *
 * По PRD 5.2: «Live-превью для HTML/CSS».
 *
 * Поддерживает два режима:
 * - `url` — загрузка HTML по URL (src)
 * - `content` — рендеринг HTML-строки через srcdoc
 *
 * Масштабирование: CSS transform scale для вписывания
 * слайда 1920×1080 в контейнер панели.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'

export interface SlidePreviewProps {
  /** URL HTML-файла для загрузки. */
  url?: string
  /** HTML-контент для рендеринга через srcdoc. */
  content?: string
  /** Заголовок (для aria-label). */
  title?: string
  /** Дополнительные CSS-классы. */
  className?: string
}

/** Базовые размеры слайда (16:9). */
const SLIDE_WIDTH = 1920
const SLIDE_HEIGHT = 1080

export function SlidePreview({
  url,
  content,
  title = 'Превью слайда',
  className = '',
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  /**
   * Derive a stable key from content source so React remounts
   * the iframe (and resets loading/error state) when source changes.
   */
  const sourceKey = useMemo(() => url ?? content ?? '', [url, content])

  /** Пересчёт масштаба при изменении размера контейнера. */
  const recalcScale = useCallback(() => {
    if (!containerRef.current) return
    const { clientWidth, clientHeight } = containerRef.current
    const scaleX = clientWidth / SLIDE_WIDTH
    const scaleY = clientHeight / SLIDE_HEIGHT
    setScale(Math.min(scaleX, scaleY))
  }, [])

  useEffect(() => {
    recalcScale()
    const observer = new ResizeObserver(recalcScale)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [recalcScale])

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  if (!url && !content) {
    return (
      <div
        data-testid="slide-preview-empty"
        className="flex items-center justify-center h-full text-gray-400 text-sm p-4"
      >
        Нет слайда для отображения
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="slide-preview"
      className={`relative w-full h-full overflow-hidden bg-gray-100 ${className}`}
    >
      {/* Спиннер загрузки */}
      {isLoading && (
        <div
          data-testid="slide-preview-loading"
          className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Загрузка превью...</span>
          </div>
        </div>
      )}

      {/* Ошибка загрузки */}
      {hasError && (
        <div
          data-testid="slide-preview-error"
          className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm text-gray-500">Не удалось загрузить превью</div>
          </div>
        </div>
      )}

      {/* iframe с масштабированием */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        data-testid="slide-preview-frame-wrapper"
      >
        <iframe
          key={sourceKey}
          data-testid="slide-preview-iframe"
          title={title}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0 bg-white"
          {...(content ? { srcDoc: content } : { src: url })}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  )
}
