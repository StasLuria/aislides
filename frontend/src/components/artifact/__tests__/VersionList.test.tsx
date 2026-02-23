import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { VersionList } from '../VersionList'
import type { ArtifactVersion } from '../../../types'

const versions: ArtifactVersion[] = [
  { version: 1, created_at: '2025-01-15T10:00:00Z' },
  { version: 2, created_at: '2025-01-15T12:00:00Z' },
  { version: 3, created_at: '2025-01-15T14:00:00Z' },
]

describe('VersionList', () => {
  it('renders with data-testid', () => {
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByTestId('version-list')).toBeInTheDocument()
  })

  it('shows empty state when no versions', () => {
    render(
      <VersionList versions={[]} currentVersion={1} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByTestId('version-list-empty')).toBeInTheDocument()
    expect(screen.getByText('Нет версий')).toBeInTheDocument()
  })

  it('renders all versions', () => {
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByTestId('version-item-1')).toBeInTheDocument()
    expect(screen.getByTestId('version-item-2')).toBeInTheDocument()
    expect(screen.getByTestId('version-item-3')).toBeInTheDocument()
  })

  it('shows version count', () => {
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByText('Версии (3)')).toBeInTheDocument()
  })

  it('displays version numbers', () => {
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
  })

  it('sorts versions in descending order (newest first)', () => {
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={vi.fn()} />,
    )
    const items = screen.getAllByRole('button')
    expect(items[0]).toHaveTextContent('v3')
    expect(items[1]).toHaveTextContent('v2')
    expect(items[2]).toHaveTextContent('v1')
  })

  it('highlights current version', () => {
    render(
      <VersionList versions={versions} currentVersion={2} onSelectVersion={vi.fn()} />,
    )
    const activeItem = screen.getByTestId('version-item-2')
    expect(activeItem).toHaveClass('bg-blue-50')
    expect(activeItem).toHaveClass('text-blue-700')
  })

  it('does not highlight non-current versions', () => {
    render(
      <VersionList versions={versions} currentVersion={2} onSelectVersion={vi.fn()} />,
    )
    const inactiveItem = screen.getByTestId('version-item-1')
    expect(inactiveItem).not.toHaveClass('bg-blue-50')
  })

  it('calls onSelectVersion when clicking a version', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <VersionList versions={versions} currentVersion={3} onSelectVersion={onSelect} />,
    )
    await user.click(screen.getByTestId('version-item-1'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('calls onSelectVersion with correct version number', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <VersionList versions={versions} currentVersion={1} onSelectVersion={onSelect} />,
    )
    await user.click(screen.getByTestId('version-item-2'))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('applies custom className', () => {
    render(
      <VersionList
        versions={versions}
        currentVersion={3}
        onSelectVersion={vi.fn()}
        className="custom-class"
      />,
    )
    expect(screen.getByTestId('version-list')).toHaveClass('custom-class')
  })

  it('handles single version', () => {
    const single: ArtifactVersion[] = [
      { version: 1, created_at: '2025-01-15T10:00:00Z' },
    ]
    render(
      <VersionList versions={single} currentVersion={1} onSelectVersion={vi.fn()} />,
    )
    expect(screen.getByText('Версии (1)')).toBeInTheDocument()
    expect(screen.getByTestId('version-item-1')).toBeInTheDocument()
  })
})
