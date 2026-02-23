import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlidePreview } from '../SlidePreview'

// Mock ResizeObserver as a proper class
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

class MockResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: ResizeObserverCallback) {
    // Store callback if needed
  }
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  mockObserve.mockClear()
  mockDisconnect.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SlidePreview', () => {
  it('renders with data-testid', () => {
    render(<SlidePreview content="<h1>Hello</h1>" />)
    expect(screen.getByTestId('slide-preview')).toBeInTheDocument()
  })

  it('shows empty state when no url or content', () => {
    render(<SlidePreview />)
    expect(screen.getByTestId('slide-preview-empty')).toBeInTheDocument()
    expect(screen.getByText('Нет слайда для отображения')).toBeInTheDocument()
  })

  it('renders iframe with srcdoc when content is provided', () => {
    render(<SlidePreview content="<h1>Slide</h1>" />)
    const iframe = screen.getByTestId('slide-preview-iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('srcdoc', '<h1>Slide</h1>')
  })

  it('renders iframe with src when url is provided', () => {
    render(<SlidePreview url="/api/artifacts/art-1/preview" />)
    const iframe = screen.getByTestId('slide-preview-iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', '/api/artifacts/art-1/preview')
  })

  it('shows loading indicator initially', () => {
    render(<SlidePreview content="<h1>Hello</h1>" />)
    expect(screen.getByTestId('slide-preview-loading')).toBeInTheDocument()
    expect(screen.getByText('Загрузка превью...')).toBeInTheDocument()
  })

  it('hides loading after iframe loads', () => {
    render(<SlidePreview content="<h1>Hello</h1>" />)
    const iframe = screen.getByTestId('slide-preview-iframe')
    fireEvent.load(iframe)
    expect(screen.queryByTestId('slide-preview-loading')).not.toBeInTheDocument()
  })

  it('hides loading and shows no error after successful load', () => {
    render(<SlidePreview url="/good-url" />)
    const iframe = screen.getByTestId('slide-preview-iframe')
    // Before load — loading is visible
    expect(screen.getByTestId('slide-preview-loading')).toBeInTheDocument()
    fireEvent.load(iframe)
    // After load — no loading, no error
    expect(screen.queryByTestId('slide-preview-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slide-preview-error')).not.toBeInTheDocument()
  })

  it('sets iframe title for accessibility', () => {
    render(<SlidePreview content="<h1>Test</h1>" title="Слайд 1" />)
    expect(screen.getByTitle('Слайд 1')).toBeInTheDocument()
  })

  it('uses default title when not provided', () => {
    render(<SlidePreview content="<h1>Test</h1>" />)
    expect(screen.getByTitle('Превью слайда')).toBeInTheDocument()
  })

  it('applies sandbox attribute to iframe', () => {
    render(<SlidePreview content="<h1>Test</h1>" />)
    const iframe = screen.getByTestId('slide-preview-iframe')
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
  })

  it('applies custom className', () => {
    render(<SlidePreview content="<h1>Test</h1>" className="custom-class" />)
    expect(screen.getByTestId('slide-preview')).toHaveClass('custom-class')
  })

  it('renders frame wrapper with transform styles', () => {
    render(<SlidePreview content="<h1>Test</h1>" />)
    const wrapper = screen.getByTestId('slide-preview-frame-wrapper')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.style.width).toBe('1920px')
    expect(wrapper.style.height).toBe('1080px')
  })

  it('observes container for resize', () => {
    render(<SlidePreview content="<h1>Test</h1>" />)
    expect(mockObserve).toHaveBeenCalled()
  })

  it('disconnects observer on unmount', () => {
    const { unmount } = render(<SlidePreview content="<h1>Test</h1>" />)
    unmount()
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
