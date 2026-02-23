import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useArtifactActions } from '../useArtifactActions'
import type { ArtifactData } from '../../types'

const htmlArtifact: ArtifactData = {
  artifact_id: 'art-1',
  filename: 'presentation.html',
  file_type: 'html',
  content: '<h1>Hello</h1>',
  preview_url: '/preview/art-1',
  download_url: '/download/art-1',
}

const urlOnlyArtifact: ArtifactData = {
  artifact_id: 'art-2',
  filename: 'slides.html',
  file_type: 'html',
  preview_url: '/preview/art-2',
}

const contentOnlyArtifact: ArtifactData = {
  artifact_id: 'art-3',
  filename: 'structure.md',
  file_type: 'md',
  content: '# Structure\n\n- Slide 1\n- Slide 2',
}

const emptyArtifact: ArtifactData = {
  artifact_id: 'art-4',
  filename: 'empty.txt',
  file_type: 'txt',
}

describe('useArtifactActions', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let mockWindowOpen: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
    mockRevokeObjectURL = vi.fn()
    mockWindowOpen = vi.fn()
    clickSpy = vi.fn()

    URL.createObjectURL = mockCreateObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL as typeof URL.revokeObjectURL
    window.open = mockWindowOpen as typeof window.open

    // Mock createElement to spy on click
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(clickSpy as () => void)
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('download', () => {
    it('downloads from content via Blob when content is available', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(htmlArtifact)

      expect(mockCreateObjectURL).toHaveBeenCalledOnce()
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('creates Blob with correct MIME type for html', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(htmlArtifact)

      const blobArg = mockCreateObjectURL.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('text/html')
    })

    it('creates Blob with correct MIME type for md', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(contentOnlyArtifact)

      const blobArg = mockCreateObjectURL.mock.calls[0][0]
      expect(blobArg.type).toBe('text/markdown')
    })

    it('downloads via URL when no content but download_url exists', () => {
      const artifact: ArtifactData = {
        ...urlOnlyArtifact,
        download_url: '/download/art-2',
      }
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(artifact)

      expect(mockCreateObjectURL).not.toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalledOnce()
    })

    it('falls back to preview_url when no content or download_url', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(urlOnlyArtifact)

      expect(mockCreateObjectURL).not.toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalledOnce()
    })

    it('does nothing when no content, download_url, or preview_url', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.download(emptyArtifact)

      expect(mockCreateObjectURL).not.toHaveBeenCalled()
      expect(clickSpy).not.toHaveBeenCalled()
    })
  })

  describe('openNewTab', () => {
    it('opens Blob URL in new tab when content is available', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.openNewTab(htmlArtifact)

      expect(mockCreateObjectURL).toHaveBeenCalledOnce()
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'blob:mock-url',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('opens preview_url in new tab when no content', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.openNewTab(urlOnlyArtifact)

      expect(mockWindowOpen).toHaveBeenCalledWith(
        '/preview/art-2',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('does nothing when no content or URLs', () => {
      const { result } = renderHook(() => useArtifactActions())
      result.current.openNewTab(emptyArtifact)

      expect(mockWindowOpen).not.toHaveBeenCalled()
    })
  })
})
