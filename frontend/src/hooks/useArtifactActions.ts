/**
 * useArtifactActions — хук для действий с артефактами.
 *
 * По roadmap 7.5: «Реализовать кнопки Скачать, Открыть в новой вкладке».
 * По PRD 5.2: «Кнопки: Скачать, Открыть в новой вкладке, Версии».
 *
 * Предоставляет:
 * - `download(artifact)` — скачивание файла через Blob + <a> click
 * - `openNewTab(artifact)` — открытие preview_url в новой вкладке
 */

import { useCallback } from 'react'
import type { ArtifactData } from '../types'

export interface ArtifactActions {
  /** Скачать артефакт. */
  download: (artifact: ArtifactData) => void
  /** Открыть артефакт в новой вкладке. */
  openNewTab: (artifact: ArtifactData) => void
}

export function useArtifactActions(): ArtifactActions {
  /**
   * Скачивание артефакта.
   *
   * Если есть download_url — используем его.
   * Если есть content — создаём Blob и скачиваем.
   * Если есть preview_url — используем его как fallback.
   */
  const download = useCallback((artifact: ArtifactData) => {
    const url = artifact.download_url ?? artifact.preview_url

    if (artifact.content) {
      // Скачиваем из content через Blob
      const mimeType = getMimeType(artifact.file_type)
      const blob = new Blob([artifact.content], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      triggerDownload(blobUrl, artifact.filename)
      URL.revokeObjectURL(blobUrl)
    } else if (url) {
      // Скачиваем по URL
      triggerDownload(url, artifact.filename)
    }
  }, [])

  /**
   * Открытие артефакта в новой вкладке.
   *
   * Если есть content — создаём Blob URL.
   * Если есть preview_url — открываем его.
   */
  const openNewTab = useCallback((artifact: ArtifactData) => {
    if (artifact.content) {
      const mimeType = getMimeType(artifact.file_type)
      const blob = new Blob([artifact.content], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
    } else {
      const url = artifact.preview_url ?? artifact.download_url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
  }, [])

  return { download, openNewTab }
}

/** Создаёт невидимую ссылку и кликает по ней для скачивания. */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Определяет MIME-тип по file_type артефакта. */
function getMimeType(fileType: string): string {
  switch (fileType) {
    case 'html':
      return 'text/html'
    case 'md':
      return 'text/markdown'
    case 'json':
      return 'application/json'
    case 'css':
      return 'text/css'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}
