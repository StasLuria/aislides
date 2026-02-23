/**
 * Тесты для хука useWebSocket.
 *
 * Используем mock WebSocket для изоляции от реального сервера.
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWebSocket } from '../useWebSocket'
import type { ConnectionStatus } from '../useWebSocket'

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
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  })

  constructor(url: string) {
    this.url = url
    // Store instance for test access
    MockWebSocket.instances.push(this)
  }

  // Helpers for tests
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  simulateError() {
    this.onerror?.({} as Event)
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  static instances: MockWebSocket[] = []
  static clearInstances() {
    MockWebSocket.instances = []
  }
}

// Replace global WebSocket
const OriginalWebSocket = globalThis.WebSocket

beforeEach(() => {
  MockWebSocket.clearInstances()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any
  vi.useFakeTimers()
})

afterEach(() => {
  globalThis.WebSocket = OriginalWebSocket
  vi.useRealTimers()
})

function getLatestWS(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]
}

describe('useWebSocket', () => {
  it('starts with disconnected status when url is null', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: null })
    )
    expect(result.current.status).toBe('disconnected' satisfies ConnectionStatus)
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('connects when url is provided', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8000/ws/projects/1' })
    )
    expect(result.current.status).toBe('connecting')
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(getLatestWS().url).toBe('ws://localhost:8000/ws/projects/1')
  })

  it('transitions to connected on open', () => {
    const onConnect = vi.fn()
    const { result } = renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        onConnect,
      })
    )

    act(() => getLatestWS().simulateOpen())

    expect(result.current.status).toBe('connected')
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('calls onMessage with parsed JSON', () => {
    const onMessage = vi.fn()
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        onMessage,
      })
    )

    act(() => getLatestWS().simulateOpen())
    act(() =>
      getLatestWS().simulateMessage({
        type: 'ai_message',
        payload: { text: 'Hello' },
      })
    )

    expect(onMessage).toHaveBeenCalledWith({
      type: 'ai_message',
      payload: { text: 'Hello' },
    })
  })

  it('sends JSON messages', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8000/ws/projects/1' })
    )

    act(() => getLatestWS().simulateOpen())
    act(() =>
      result.current.send({
        type: 'user_message',
        payload: { text: 'Test' },
      })
    )

    expect(getLatestWS().send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'user_message', payload: { text: 'Test' } })
    )
  })

  it('does not send when WebSocket is not open', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8000/ws/projects/1' })
    )

    // Still connecting, not open
    act(() =>
      result.current.send({
        type: 'user_message',
        payload: { text: 'Test' },
      })
    )

    expect(getLatestWS().send).not.toHaveBeenCalled()
  })

  it('transitions to error on WebSocket error', () => {
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        onError,
      })
    )

    act(() => getLatestWS().simulateError())

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('transitions to disconnected on close', () => {
    const onDisconnect = vi.fn()
    const { result } = renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        onDisconnect,
        autoReconnect: false,
      })
    )

    act(() => getLatestWS().simulateOpen())
    act(() => getLatestWS().simulateClose())

    expect(result.current.status).toBe('disconnected')
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('auto-reconnects with exponential backoff', () => {
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        autoReconnect: true,
        reconnectDelay: 1000,
        maxReconnectAttempts: 3,
      })
    )

    expect(MockWebSocket.instances).toHaveLength(1)

    // First close → reconnect after 1000ms
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(1000))
    expect(MockWebSocket.instances).toHaveLength(2)

    // Second close → reconnect after 2000ms
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(2000))
    expect(MockWebSocket.instances).toHaveLength(3)

    // Third close → reconnect after 4000ms
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(4000))
    expect(MockWebSocket.instances).toHaveLength(4)

    // Fourth close → no more reconnects (maxReconnectAttempts = 3)
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(10000))
    expect(MockWebSocket.instances).toHaveLength(4)
  })

  it('does not auto-reconnect on manual disconnect', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        autoReconnect: true,
      })
    )

    act(() => getLatestWS().simulateOpen())
    act(() => result.current.disconnect())

    act(() => vi.advanceTimersByTime(10000))
    // Only 1 instance — no reconnect attempts
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('reconnect resets attempts counter', () => {
    const { result } = renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8000/ws/projects/1',
        autoReconnect: true,
        maxReconnectAttempts: 1,
        reconnectDelay: 1000,
      })
    )

    // First close → reconnect
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(1000))
    expect(MockWebSocket.instances).toHaveLength(2)

    // Second close → no more auto-reconnect (maxReconnectAttempts = 1)
    act(() => getLatestWS().simulateClose())
    act(() => vi.advanceTimersByTime(10000))
    expect(MockWebSocket.instances).toHaveLength(2)

    // Manual reconnect
    act(() => result.current.reconnect())
    expect(MockWebSocket.instances).toHaveLength(3)
  })

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8000/ws/projects/1' })
    )

    const ws = getLatestWS()
    act(() => ws.simulateOpen())

    unmount()

    expect(ws.close).toHaveBeenCalled()
  })
})
