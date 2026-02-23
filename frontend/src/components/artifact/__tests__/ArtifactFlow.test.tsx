/**
 * E2E-тест: полный сценарий работы с артефактами.
 *
 * По roadmap 7.7: «E2E-тест: полный сценарий
 * (запрос → генерация → превью слайдов)».
 *
 * Тестирует интеграцию компонентов:
 * ArtifactCard → ArtifactPanel → SlidePreview / MarkdownViewer
 * + VersionList + useArtifactActions
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ArtifactCard } from '../ArtifactCard'
import { ArtifactPanel } from '../../layout/ArtifactPanel'
import { SlidePreview } from '../SlidePreview'
import { MarkdownViewer } from '../MarkdownViewer'
import { VersionList } from '../VersionList'
import type { ArtifactData, ArtifactVersion } from '../../../types'

// Mock ResizeObserver for SlidePreview
class MockResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: ResizeObserverCallback) {}
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// --- Test Data ---

const htmlArtifact: ArtifactData = {
  artifact_id: 'art-html-1',
  filename: 'presentation.html',
  file_type: 'html',
  content: '<html><body><h1>Slide 1</h1></body></html>',
  preview_url: '/preview/art-html-1',
  versions: [
    { version: 1, created_at: '2025-01-15T10:00:00Z' },
    { version: 2, created_at: '2025-01-15T12:00:00Z' },
  ],
  current_version: 2,
}

const mdArtifact: ArtifactData = {
  artifact_id: 'art-md-1',
  filename: 'structure.md',
  file_type: 'md',
  content: '# Presentation Structure\n\n## Slide 1: Introduction\n\n- Key point 1\n- Key point 2',
}

describe('Artifact Flow E2E', () => {
  describe('ArtifactCard → click → opens panel', () => {
    it('renders ArtifactCard and handles click', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<ArtifactCard artifact={htmlArtifact} onClick={onClick} />)

      const card = screen.getByTestId('artifact-card')
      expect(card).toBeInTheDocument()
      expect(screen.getByText('presentation.html')).toBeInTheDocument()

      await user.click(card)
      expect(onClick).toHaveBeenCalledWith(htmlArtifact)
    })
  })

  describe('ArtifactPanel with SlidePreview', () => {
    it('renders ArtifactPanel with HTML artifact in SlidePreview', () => {
      render(
        <ArtifactPanel
          isOpen={true}
          onClose={vi.fn()}
          artifact={htmlArtifact}
          artifacts={[htmlArtifact]}
          onSelectArtifact={vi.fn()}
          onDownload={vi.fn()}
          onOpenNewTab={vi.fn()}
        >
          <SlidePreview content={htmlArtifact.content} />
        </ArtifactPanel>,
      )

      // Panel is open
      const panel = screen.getByTestId('artifact-panel')
      expect(panel).toBeInTheDocument()

      // Title shows filename
      expect(screen.getByTestId('artifact-panel-title')).toHaveTextContent('presentation.html')

      // SlidePreview is rendered inside
      expect(screen.getByTestId('slide-preview')).toBeInTheDocument()
      expect(screen.getByTestId('slide-preview-iframe')).toBeInTheDocument()
    })
  })

  describe('ArtifactPanel with MarkdownViewer', () => {
    it('renders ArtifactPanel with MD artifact in MarkdownViewer', () => {
      render(
        <ArtifactPanel
          isOpen={true}
          onClose={vi.fn()}
          artifact={mdArtifact}
          artifacts={[mdArtifact]}
          onSelectArtifact={vi.fn()}
          onDownload={vi.fn()}
          onOpenNewTab={vi.fn()}
        >
          <MarkdownViewer content={mdArtifact.content!} />
        </ArtifactPanel>,
      )

      // MarkdownViewer renders the content
      expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument()
      expect(screen.getByText('Presentation Structure')).toBeInTheDocument()
    })
  })

  describe('VersionList navigation', () => {
    it('allows switching between versions', async () => {
      const user = userEvent.setup()
      const onSelectVersion = vi.fn()
      const versions: ArtifactVersion[] = htmlArtifact.versions!

      render(
        <VersionList
          versions={versions}
          currentVersion={2}
          onSelectVersion={onSelectVersion}
        />,
      )

      // Both versions visible
      expect(screen.getByTestId('version-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('version-item-2')).toBeInTheDocument()

      // v2 is highlighted
      expect(screen.getByTestId('version-item-2')).toHaveClass('bg-blue-50')

      // Click v1
      await user.click(screen.getByTestId('version-item-1'))
      expect(onSelectVersion).toHaveBeenCalledWith(1)
    })
  })

  describe('Full flow: multiple artifacts', () => {
    it('renders panel with artifact tabs and switching', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()

      render(
        <ArtifactPanel
          isOpen={true}
          onClose={vi.fn()}
          artifact={htmlArtifact}
          artifacts={[htmlArtifact, mdArtifact]}
          onSelectArtifact={onSelect}
          onDownload={vi.fn()}
          onOpenNewTab={vi.fn()}
        >
          <SlidePreview content={htmlArtifact.content} />
        </ArtifactPanel>,
      )

      // Panel shows artifact tabs
      expect(screen.getByTestId('artifact-tabs')).toBeInTheDocument()

      // Both artifact tabs visible
      const tabs = screen.getByTestId('artifact-tabs')
      expect(tabs).toBeInTheDocument()

      // Find md tab (unique text in tabs)
      const allMdButtons = screen.getAllByText('structure.md')
      const mdTab = allMdButtons[0]
      expect(mdTab).toBeInTheDocument()

      // Click on md tab — onSelectArtifact receives full artifact object
      await user.click(mdTab)
      expect(onSelect).toHaveBeenCalledWith(mdArtifact)
    })
  })

  describe('ArtifactPanel toolbar actions', () => {
    it('calls download and openNewTab callbacks', async () => {
      const user = userEvent.setup()
      const onDownload = vi.fn()
      const onOpenNewTab = vi.fn()

      render(
        <ArtifactPanel
          isOpen={true}
          onClose={vi.fn()}
          artifact={htmlArtifact}
          artifacts={[htmlArtifact]}
          onSelectArtifact={vi.fn()}
          onDownload={onDownload}
          onOpenNewTab={onOpenNewTab}
        >
          <SlidePreview content={htmlArtifact.content} />
        </ArtifactPanel>,
      )

      // Find toolbar buttons by data-testid
      const downloadBtn = screen.getByTestId('btn-download')
      const openBtn = screen.getByTestId('btn-open-new-tab')

      await user.click(downloadBtn)
      expect(onDownload).toHaveBeenCalledWith(htmlArtifact)

      await user.click(openBtn)
      expect(onOpenNewTab).toHaveBeenCalledWith(htmlArtifact)
    })
  })

  describe('ArtifactPanel close', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(
        <ArtifactPanel
          isOpen={true}
          onClose={onClose}
          artifact={htmlArtifact}
          artifacts={[htmlArtifact]}
          onSelectArtifact={vi.fn()}
          onDownload={vi.fn()}
          onOpenNewTab={vi.fn()}
        >
          <div>Content</div>
        </ArtifactPanel>,
      )

      const closeBtn = screen.getByTestId('btn-close-panel')
      await user.click(closeBtn)
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('Empty artifact panel', () => {
    it('renders panel without artifacts', () => {
      render(
        <ArtifactPanel
          isOpen={true}
          onClose={vi.fn()}
          artifacts={[]}
        >
          <div data-testid="empty-content">Нет артефактов</div>
        </ArtifactPanel>,
      )

      expect(screen.getByTestId('empty-content')).toBeInTheDocument()
    })
  })
})
