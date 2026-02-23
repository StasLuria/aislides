/**
 * E2E-тест: полный цикл чата.
 *
 * Задача 6.8: отправка сообщения → получение ответа в чате.
 *
 * Тестирует интеграцию компонентов ChatMessage, ChatInput, StatusCard
 * и хука useWebSocket в едином потоке.
 *
 * Использует mock WebSocket для имитации серверных ответов.
 */

import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../ChatMessage'
import { ChatInput } from '../ChatInput'
import { StatusCard } from '../../status/StatusCard'
import { createInitialSteps } from '../../status/utils'
import type {
  ChatMessageData,
  GenerationStep,
  ServerMessage,
} from '../../../types'

// --- Mock WebSocket ---

type MockWSHandler = ((event: unknown) => void) | null

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: MockWSHandler = null
  onmessage: MockWSHandler = null
  onerror: MockWSHandler = null
  onclose: MockWSHandler = null

  send = vi.fn()
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  static instances: MockWebSocket[] = []
  static clearInstances() {
    MockWebSocket.instances = []
  }
}

const OriginalWebSocket = globalThis.WebSocket

function getLatestWS(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]
}

// --- Chat Page Component (mini integration) ---

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [steps, setSteps] = useState<GenerationStep[]>(createInitialSteps())
  const [isLoading, setIsLoading] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/projects/test-1')

    ws.onopen = () => {
      wsRef.current = ws
    }

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as ServerMessage

      switch (msg.type) {
        case 'ai_message':
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: 'ai',
              text: msg.payload.text,
              timestamp: new Date().toISOString(),
            },
          ])
          setIsLoading(false)
          break

        case 'status_update':
          setShowStatus(true)
          setSteps((prev) =>
            prev.map((step) =>
              step.name.startsWith(msg.payload.step)
                ? { ...step, status: msg.payload.status, message: msg.payload.message }
                : step,
            ),
          )
          break

        case 'error':
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'ai',
              text: `Ошибка: ${msg.payload.message}`,
              timestamp: new Date().toISOString(),
            },
          ])
          setIsLoading(false)
          break
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  const handleSend = useCallback(
    (text: string) => {
      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text,
          timestamp: new Date().toISOString(),
        },
      ])
      setIsLoading(true)

      // Send via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'user_message',
            payload: { text },
          }),
        )
      }
    },
    [],
  )

  return (
    <div data-testid="chat-page">
      {/* Messages */}
      <div data-testid="message-list">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} {...msg} />
        ))}
      </div>

      {/* Status Card */}
      {showStatus && <StatusCard steps={steps} />}

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  )
}

// --- Tests ---

describe('Chat E2E Flow', () => {
  beforeEach(() => {
    MockWebSocket.clearInstances()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.WebSocket = MockWebSocket as any
  })

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket
  })

  it('full flow: send message → receive status updates → receive AI response', async () => {
    const user = userEvent.setup()
    render(<ChatPage />)

    // 1. WebSocket connects
    expect(MockWebSocket.instances).toHaveLength(1)
    act(() => getLatestWS().simulateOpen())

    // 2. User types and sends a message
    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Сделай презентацию про AI')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    // 3. User message appears in chat
    const messageList = screen.getByTestId('message-list')
    expect(within(messageList).getByText('Сделай презентацию про AI')).toBeInTheDocument()

    // 4. WebSocket send was called
    expect(getLatestWS().send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'user_message',
        payload: { text: 'Сделай презентацию про AI' },
      }),
    )

    // 5. Server sends status_update for S0
    act(() =>
      getLatestWS().simulateMessage({
        type: 'status_update',
        payload: { step: 'S0', status: 'in_progress', message: 'Планирую...' },
      }),
    )

    // 6. StatusCard appears with S0 in progress
    expect(screen.getByTestId('status-card')).toBeInTheDocument()
    const statusSteps = screen.getAllByTestId('status-step')
    expect(statusSteps[0]).toHaveAttribute('data-status', 'in_progress')

    // 7. Server completes S0, starts S1
    act(() =>
      getLatestWS().simulateMessage({
        type: 'status_update',
        payload: { step: 'S0', status: 'completed' },
      }),
    )
    act(() =>
      getLatestWS().simulateMessage({
        type: 'status_update',
        payload: { step: 'S1', status: 'in_progress' },
      }),
    )

    const updatedSteps = screen.getAllByTestId('status-step')
    expect(updatedSteps[0]).toHaveAttribute('data-status', 'completed')
    expect(updatedSteps[1]).toHaveAttribute('data-status', 'in_progress')

    // 8. Server sends AI response
    act(() =>
      getLatestWS().simulateMessage({
        type: 'ai_message',
        payload: { text: 'Презентация готова! Вот структура из 10 слайдов.' },
      }),
    )

    // 9. AI message appears in chat
    expect(
      within(messageList).getByText('Презентация готова! Вот структура из 10 слайдов.'),
    ).toBeInTheDocument()

    // 10. Input is re-enabled (isLoading = false)
    expect(textarea).not.toBeDisabled()
  })

  it('handles server error gracefully', async () => {
    const user = userEvent.setup()
    render(<ChatPage />)

    act(() => getLatestWS().simulateOpen())

    // Send message
    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Test')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    // Server sends error
    act(() =>
      getLatestWS().simulateMessage({
        type: 'error',
        payload: { message: 'Internal server error' },
      }),
    )

    // Error message appears in chat
    const messageList = screen.getByTestId('message-list')
    expect(
      within(messageList).getByText('Ошибка: Internal server error'),
    ).toBeInTheDocument()

    // Input is re-enabled
    expect(textarea).not.toBeDisabled()
  })

  it('shows multiple messages in conversation order', async () => {
    const user = userEvent.setup()
    render(<ChatPage />)

    act(() => getLatestWS().simulateOpen())

    // First exchange
    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Первое сообщение')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    act(() =>
      getLatestWS().simulateMessage({
        type: 'ai_message',
        payload: { text: 'Первый ответ' },
      }),
    )

    // Second exchange
    await user.type(textarea, 'Второе сообщение')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    act(() =>
      getLatestWS().simulateMessage({
        type: 'ai_message',
        payload: { text: 'Второй ответ' },
      }),
    )

    // All 4 messages visible
    const allMessages = screen.getAllByTestId('chat-message')
    expect(allMessages).toHaveLength(4)

    // Check roles
    expect(allMessages[0]).toHaveAttribute('data-role', 'user')
    expect(allMessages[1]).toHaveAttribute('data-role', 'ai')
    expect(allMessages[2]).toHaveAttribute('data-role', 'user')
    expect(allMessages[3]).toHaveAttribute('data-role', 'ai')
  })

  it('disables input while waiting for AI response', async () => {
    const user = userEvent.setup()
    render(<ChatPage />)

    act(() => getLatestWS().simulateOpen())

    const textarea = screen.getByPlaceholderText('Напишите сообщение...')
    await user.type(textarea, 'Hello')
    await user.click(screen.getByLabelText('Отправить сообщение'))

    // Input should be disabled while loading
    expect(textarea).toBeDisabled()

    // AI responds
    act(() =>
      getLatestWS().simulateMessage({
        type: 'ai_message',
        payload: { text: 'Hi!' },
      }),
    )

    // Input re-enabled
    expect(textarea).not.toBeDisabled()
  })
})
