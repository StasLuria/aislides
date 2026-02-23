import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMessage } from '../ChatMessage'

const userMsg = {
  id: 'msg-1',
  role: 'user' as const,
  text: 'Сделай презентацию на 10 слайдов',
  timestamp: '2026-02-23T10:00:00Z',
}

const aiMsg = {
  id: 'msg-2',
  role: 'ai' as const,
  text: 'Начинаю работу над презентацией.',
  timestamp: '2026-02-23T10:00:05Z',
}

describe('ChatMessage', () => {
  it('renders user message text', () => {
    render(<ChatMessage {...userMsg} />)
    expect(
      screen.getByText('Сделай презентацию на 10 слайдов')
    ).toBeInTheDocument()
  })

  it('renders ai message text', () => {
    render(<ChatMessage {...aiMsg} />)
    expect(
      screen.getByText('Начинаю работу над презентацией.')
    ).toBeInTheDocument()
  })

  it('sets data-role attribute for user', () => {
    render(<ChatMessage {...userMsg} />)
    const el = screen.getByTestId('chat-message')
    expect(el).toHaveAttribute('data-role', 'user')
  })

  it('sets data-role attribute for ai', () => {
    render(<ChatMessage {...aiMsg} />)
    const el = screen.getByTestId('chat-message')
    expect(el).toHaveAttribute('data-role', 'ai')
  })

  it('shows user avatar "Вы"', () => {
    render(<ChatMessage {...userMsg} />)
    expect(screen.getByText('Вы')).toBeInTheDocument()
  })

  it('shows AI avatar "AI"', () => {
    render(<ChatMessage {...aiMsg} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders timestamp as <time> element', () => {
    render(<ChatMessage {...userMsg} />)
    const timeEl = screen.getByRole('time')
    expect(timeEl).toHaveAttribute('datetime', '2026-02-23T10:00:00Z')
  })

  it('preserves whitespace in multiline text', () => {
    const multilineMsg = {
      ...aiMsg,
      text: 'Строка 1\nСтрока 2\nСтрока 3',
    }
    render(<ChatMessage {...multilineMsg} />)
    expect(screen.getByText(/Строка 1/)).toBeInTheDocument()
    expect(screen.getByText(/Строка 2/)).toBeInTheDocument()
  })
})
