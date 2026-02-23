import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ArtifactCard } from '../ArtifactCard'
import type { ArtifactData } from '../../../types'

const htmlArtifact: ArtifactData = {
  artifact_id: 'art-1',
  filename: 'presentation.html',
  file_type: 'html',
  preview_url: '/preview/art-1.png',
}

const mdArtifact: ArtifactData = {
  artifact_id: 'art-2',
  filename: 'structure.md',
  file_type: 'md',
}

const versionedArtifact: ArtifactData = {
  artifact_id: 'art-3',
  filename: 'slides.html',
  file_type: 'html',
  current_version: 3,
}

describe('ArtifactCard', () => {
  it('renders with data-testid', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByTestId('artifact-card')).toBeInTheDocument()
  })

  it('shows filename', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByText('presentation.html')).toBeInTheDocument()
  })

  it('shows file type label for html', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByText('HTML-слайды')).toBeInTheDocument()
  })

  it('shows file type label for md', () => {
    render(<ArtifactCard artifact={mdArtifact} onClick={vi.fn()} />)
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('shows icon', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByTestId('artifact-icon')).toBeInTheDocument()
  })

  it('shows preview image when preview_url is set', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByTestId('artifact-preview')).toBeInTheDocument()
    expect(screen.getByAltText('Превью presentation.html')).toBeInTheDocument()
  })

  it('does not show preview when preview_url is absent', () => {
    render(<ArtifactCard artifact={mdArtifact} onClick={vi.fn()} />)
    expect(screen.queryByTestId('artifact-preview')).not.toBeInTheDocument()
  })

  it('calls onClick with artifact data when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<ArtifactCard artifact={htmlArtifact} onClick={onClick} />)

    await user.click(screen.getByTestId('artifact-card'))
    expect(onClick).toHaveBeenCalledWith(htmlArtifact)
  })

  it('shows version number when current_version > 1', () => {
    render(<ArtifactCard artifact={versionedArtifact} onClick={vi.fn()} />)
    expect(screen.getByTestId('artifact-version')).toBeInTheDocument()
    expect(screen.getByText('Версия 3')).toBeInTheDocument()
  })

  it('does not show version when current_version is 1 or absent', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.queryByTestId('artifact-version')).not.toBeInTheDocument()
  })

  it('sets data-artifact-id attribute', () => {
    render(<ArtifactCard artifact={htmlArtifact} onClick={vi.fn()} />)
    expect(screen.getByTestId('artifact-card')).toHaveAttribute('data-artifact-id', 'art-1')
  })
})
