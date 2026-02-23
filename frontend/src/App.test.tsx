import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the three-zone layout', () => {
    render(<App />)
    expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('shows placeholder text in chat area', () => {
    render(<App />)
    expect(
      screen.getByText('Напишите сообщение, чтобы начать')
    ).toBeInTheDocument()
  })
})
