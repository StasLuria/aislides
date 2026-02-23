/**
 * useWebSocket — хук для WebSocket-подключения к серверу.
 *
 * По PRD 4.5 и 9.1: устанавливает WebSocket-соединение,
 * обрабатывает серверные сообщения, поддерживает автоматическое
 * переподключение при обрыве связи.
 *
 * Протокол: JSON-сообщения с полями { type, payload }.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { ServerMessage, ClientMessage } from '../types'

/** Состояние WebSocket-подключения. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseWebSocketOptions {
  /** URL WebSocket-сервера (например, ws://localhost:8000/ws/projects/123). */
  url: string | null
  /** Callback при получении серверного сообщения. */
  onMessage?: (message: ServerMessage) => void
  /** Callback при подключении. */
  onConnect?: () => void
  /** Callback при отключении. */
  onDisconnect?: () => void
  /** Callback при ошибке. */
  onError?: (error: Event) => void
  /** Максимальное количество попыток переподключения. По умолчанию 5. */
  maxReconnectAttempts?: number
  /** Базовая задержка переподключения (мс). По умолчанию 1000. */
  reconnectDelay?: number
  /** Автоматическое переподключение. По умолчанию true. */
  autoReconnect?: boolean
}

export interface UseWebSocketReturn {
  /** Текущий статус подключения. */
  status: ConnectionStatus
  /** Отправить сообщение на сервер. */
  send: (message: ClientMessage) => void
  /** Вручную закрыть соединение. */
  disconnect: () => void
  /** Вручную переподключиться. */
  reconnect: () => void
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  maxReconnectAttempts = 5,
  reconnectDelay = 1000,
  autoReconnect = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isManualCloseRef = useRef(false)

  // Refs для callbacks и параметров — обновляются через useEffect
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)
  const autoReconnectRef = useRef(autoReconnect)
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts)
  const reconnectDelayRef = useRef(reconnectDelay)
  const connectRef = useRef<() => void>(() => {})

  // Синхронизируем refs через useEffect (не во время рендера)
  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onErrorRef.current = onError
    autoReconnectRef.current = autoReconnect
    maxReconnectAttemptsRef.current = maxReconnectAttempts
    reconnectDelayRef.current = reconnectDelay
  })

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  // Обновляем connect через useEffect
  useEffect(() => {
    connectRef.current = () => {
      if (!url) return

      // Закрываем существующее соединение
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setStatus('connecting')
      isManualCloseRef.current = false

      const ws = new WebSocket(url)

      ws.onopen = () => {
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        onConnectRef.current?.()
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage
          onMessageRef.current?.(message)
        } catch {
          console.error('[useWebSocket] Failed to parse message:', event.data)
        }
      }

      ws.onerror = (event: Event) => {
        setStatus('error')
        onErrorRef.current?.(event)
      }

      ws.onclose = () => {
        wsRef.current = null
        setStatus('disconnected')
        onDisconnectRef.current?.()

        // Автоматическое переподключение
        if (
          !isManualCloseRef.current &&
          autoReconnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttemptsRef.current
        ) {
          const delay =
            reconnectDelayRef.current *
            Math.pow(2, reconnectAttemptsRef.current)
          reconnectAttemptsRef.current += 1

          reconnectTimerRef.current = setTimeout(() => {
            connectRef.current()
          }, delay)
        }
      }

      wsRef.current = ws
    }
  }, [url])

  const connect = useCallback(() => {
    connectRef.current()
  }, [])

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[useWebSocket] Cannot send: WebSocket is not open')
    }
  }, [])

  const disconnect = useCallback(() => {
    isManualCloseRef.current = true
    clearReconnectTimer()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
  }, [clearReconnectTimer])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    clearReconnectTimer()
    connect()
  }, [connect, clearReconnectTimer])

  // Подключаемся при монтировании / изменении url
  useEffect(() => {
    if (url) {
      connect()
    }

    return () => {
      isManualCloseRef.current = true
      clearReconnectTimer()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [url, connect, clearReconnectTimer])

  return { status, send, disconnect, reconnect }
}
