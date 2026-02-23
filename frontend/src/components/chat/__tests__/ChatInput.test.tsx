import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatInput } from '../ChatInput'

describe('ChatInput', () => {
  it('renders textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Напишите сообщение...')).toBeInTheDocument()
    expect(screen.getByLabelText('Отправить сообщение')).toBeInTheDocument()
  })

  it('calls onSend with text when send button is clicked', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Hello world')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    expect(onSend).toHaveBeenCalledWith('Hello world', undefined)
  })

  it('calls onSend on Enter key press', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Test message{Enter}')

    expect(onSend).toHaveBeenCalledWith('Test message', undefined)
  })

  it('does not call onSend on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    await user.click(screen.getByLabelText('Отправить сообщение'))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears text after sending', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Hello')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    expect(textarea).toHaveValue('')
  })

  it('disables input when isLoading is true', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />)
    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    expect(textarea).toBeDisabled()
  })

  it('does not send when isLoading', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} isLoading={true} />)

    // Textarea is disabled, so we can't type. Just verify send button is disabled.
    const sendBtn = screen.getByLabelText('Отправить сообщение')
    expect(sendBtn).toBeDisabled()
  })

  it('shows file attachment button', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByLabelText('Прикрепить файл')).toBeInTheDocument()
  })

  it('shows attached files and allows removal', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, file)

    expect(screen.getByTestId('file-list')).toBeInTheDocument()
    expect(screen.getByText('test.pdf')).toBeInTheDocument()

    // Remove file
    await user.click(screen.getByLabelText('Удалить test.pdf'))
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
  })

  it('sends files along with text', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    // Attach file
    const fileInput = screen.getByTestId('file-input')
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, file)

    // Type message
    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Analyze this')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    expect(onSend).toHaveBeenCalledWith('Analyze this', [file])
  })

  it('uses custom placeholder', () => {
    render(<ChatInput onSend={vi.fn()} placeholder="Custom placeholder" />)
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })
})
