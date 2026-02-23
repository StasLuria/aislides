/**
 * ChatMessage — компонент отдельного сообщения в чате.
 *
 * По PRD 5.2: «Область чата — сообщения пользователя и AI».
 *
 * Отображает сообщение с аватаром, текстом и временной меткой.
 * Стилизация зависит от роли (user / ai).
 */

import type { MessageRole } from '../../types'

export interface ChatMessageProps {
  /** Уникальный ID сообщения. */
  id: string
  /** Роль отправителя. */
  role: MessageRole
  /** Текст сообщения. */
  text: string
  /** Временная метка (ISO 8601). */
  timestamp: string
}

export function ChatMessage({ role, text, timestamp }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      data-testid="chat-message"
      data-role={role}
      className={`flex gap-3 px-4 py-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Аватар */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-600'
        }`}
      >
        {isUser ? 'Вы' : 'AI'}
      </div>

      {/* Содержимое */}
      <div
        className={`flex flex-col max-w-[70%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Пузырь сообщения */}
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          }`}
        >
          {text}
        </div>

        {/* Время */}
        <time
          dateTime={timestamp}
          className="mt-1 text-xs text-gray-400"
        >
          {formatTime(timestamp)}
        </time>
      </div>
    </div>
  )
}

/**
 * Форматирует ISO-строку времени в HH:MM.
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
