import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { AppLayout } from '../AppLayout'
import { Sidebar } from '../Sidebar'
import { ChatPanel } from '../ChatPanel'
import { ArtifactPanel } from '../ArtifactPanel'

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
    render(<ArtifactPanel isOpen={false} onClose={() => {}} />)
    expect(screen.queryByTestId('artifact-panel')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(<ArtifactPanel isOpen={true} onClose={() => {}} />)
    expect(screen.getByTestId('artifact-panel')).toBeInTheDocument()
  })

  it('shows default placeholder when no children', () => {
    render(<ArtifactPanel isOpen={true} onClose={() => {}} />)
    expect(
      screen.getByText('Артефакты появятся здесь после генерации')
    ).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <ArtifactPanel isOpen={true} onClose={() => {}}>
        <span>Artifact Content</span>
      </ArtifactPanel>
    )
    expect(screen.getByText('Artifact Content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    let closed = false
    render(
      <ArtifactPanel isOpen={true} onClose={() => { closed = true }} />
    )
    await user.click(screen.getByLabelText('Закрыть панель артефактов'))
    expect(closed).toBe(true)
  })
})

describe('AppLayout', () => {
  it('renders all three zones', () => {
    render(
      <AppLayout
        sidebarContent={<span>Sidebar</span>}
        chatContent={<span>Chat</span>}
      />
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
