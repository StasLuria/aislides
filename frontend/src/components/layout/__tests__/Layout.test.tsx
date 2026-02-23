import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AppLayout } from '../AppLayout'
import { Sidebar } from '../Sidebar'
import { ChatPanel } from '../ChatPanel'
import { ArtifactPanel } from '../ArtifactPanel'
import type { ArtifactData } from '../../../types'

const mockArtifact: ArtifactData = {
  artifact_id: 'art-1',
  filename: 'presentation.html',
  file_type: 'html',
  current_version: 2,
}

const mockArtifacts: ArtifactData[] = [
  mockArtifact,
  { artifact_id: 'art-2', filename: 'structure.md', file_type: 'md' },
  { artifact_id: 'art-3', filename: 'design.json', file_type: 'json' },
]

describe('Sidebar', () => {
  it('renders with data-testid', () => {
    render(<Sidebar />)
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<Sidebar><span>Test Content</span></Sidebar>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('displays the app name', () => {
    render(<Sidebar />)
    expect(screen.getByText('AI Presentations')).toBeInTheDocument()
  })
})

describe('ChatPanel', () => {
  it('renders with data-testid', () => {
    render(<ChatPanel />)
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<ChatPanel><span>Chat Content</span></ChatPanel>)
    expect(screen.getByText('Chat Content')).toBeInTheDocument()
  })
})

describe('ArtifactPanel', () => {
  it('renders nothing when closed', () => {
    render(<ArtifactPanel isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(<ArtifactPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('artifact-panel')).toBeInTheDocument()
  })

  it('shows default placeholder when no artifact', () => {
    render(<ArtifactPanel isOpen={true} onClose={vi.fn()} />)
    expect(
      screen.getByText('Артефакты появятся здесь после генерации'),
    ).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <ArtifactPanel isOpen={true} onClose={vi.fn()}>
        <span>Artifact Content</span>
      </ArtifactPanel>,
    )
    expect(screen.getByText('Artifact Content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ArtifactPanel isOpen={true} onClose={onClose} />)
    await user.click(screen.getByTestId('btn-close-panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows artifact filename as title', () => {
    render(
      <ArtifactPanel isOpen={true} onClose={vi.fn()} artifact={mockArtifact} />,
    )
    expect(screen.getByTestId('artifact-panel-title')).toHaveTextContent(
      'presentation.html',
    )
  })

  it('shows file type and version in subtitle', () => {
    render(
      <ArtifactPanel isOpen={true} onClose={vi.fn()} artifact={mockArtifact} />,
    )
    expect(screen.getByText('HTML · v2')).toBeInTheDocument()
  })

  it('shows download button when onDownload is provided', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onDownload={vi.fn()}
      />,
    )
    expect(screen.getByTestId('btn-download')).toBeInTheDocument()
  })

  it('calls onDownload when download button is clicked', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onDownload={onDownload}
      />,
    )
    await user.click(screen.getByTestId('btn-download'))
    expect(onDownload).toHaveBeenCalledWith(mockArtifact)
  })

  it('shows open-new-tab button when onOpenNewTab is provided', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onOpenNewTab={vi.fn()}
      />,
    )
    expect(screen.getByTestId('btn-open-new-tab')).toBeInTheDocument()
  })

  it('calls onOpenNewTab when button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenNewTab = vi.fn()
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        onOpenNewTab={onOpenNewTab}
      />,
    )
    await user.click(screen.getByTestId('btn-open-new-tab'))
    expect(onOpenNewTab).toHaveBeenCalledWith(mockArtifact)
  })

  it('shows artifact tabs when multiple artifacts', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        artifacts={mockArtifacts}
      />,
    )
    expect(screen.getByTestId('artifact-tabs')).toBeInTheDocument()
    const tabs = screen.getAllByTestId('artifact-tab')
    expect(tabs).toHaveLength(3)
  })

  it('highlights active artifact tab', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        artifacts={mockArtifacts}
      />,
    )
    const tabs = screen.getAllByTestId('artifact-tab')
    expect(tabs[0]).toHaveAttribute('data-active', 'true')
    expect(tabs[1]).toHaveAttribute('data-active', 'false')
  })

  it('calls onSelectArtifact when tab is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        artifacts={mockArtifacts}
        onSelectArtifact={onSelect}
      />,
    )
    const tabs = screen.getAllByTestId('artifact-tab')
    await user.click(tabs[1])
    expect(onSelect).toHaveBeenCalledWith(mockArtifacts[1])
  })

  it('does not show tabs when only one artifact', () => {
    render(
      <ArtifactPanel
        isOpen={true}
        onClose={vi.fn()}
        artifact={mockArtifact}
        artifacts={[mockArtifact]}
      />,
    )
    expect(screen.queryByTestId('artifact-tabs')).not.toBeInTheDocument()
  })
})

describe('AppLayout', () => {
  it('renders all three zones', () => {
    render(
      <AppLayout
        sidebarContent={<span>Sidebar</span>}
        chatContent={<span>Chat</span>}
      />,
    )
    expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
  })

  it('artifact panel is hidden by default', () => {
    render(<AppLayout />)
    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument()
  })
})
