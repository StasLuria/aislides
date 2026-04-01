/**
 * Тесты для кнопки Redesign в ArtifactPanel (CJM 5).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArtifactPanel } from '../ArtifactPanel'
import type { ArtifactData } from '../../../types'

const mockArtifact: ArtifactData = {
  artifact_id: 'art-1',
  filename: 'Test Slide',
  content: '<div>Hello</div>',
  file_type: 'html',
}

describe('ArtifactPanel — Redesign button', () => {
  it('renders redesign button when onRedesign is provided', () => {
    const onRedesign = vi.fn()
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onRedesign={onRedesign}
      />
    )

    const btn = screen.getByTestId('btn-redesign')
    expect(btn).toBeInTheDocument()
  })

  it('does not render redesign button when onRedesign is not provided', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
      />
    )

    expect(screen.queryByTestId('btn-redesign')).not.toBeInTheDocument()
  })

  it('calls onRedesign when button is clicked', () => {
    const onRedesign = vi.fn()
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onRedesign={onRedesign}
      />
    )

    fireEvent.click(screen.getByTestId('btn-redesign'))
    expect(onRedesign).toHaveBeenCalledTimes(1)
  })

  it('redesign button has correct aria-label', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onRedesign={vi.fn()}
      />
    )

    const btn = screen.getByTestId('btn-redesign')
    expect(btn).toHaveAttribute('aria-label', 'Сменить стиль')
  })
})
