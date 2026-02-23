/**
 * ChatPanel — центральная область чата.
 *
 * По PRD 5.2: «Область чата — основная лента сообщений».
 *
 * Содержит сообщения пользователя и AI, карточки статуса,
 * карточки артефактов и поле ввода.
 */

interface ChatPanelProps {
  /** Дочерние элементы (ChatMessage[], StatusCard, ChatInput). */
  children?: React.ReactNode
}

export function ChatPanel({ children }: ChatPanelProps) {
  return (
    <main
      data-testid="chat-panel"
      className="flex flex-col flex-1 min-w-0 bg-white"
    >
      {children}
    </main>
  )
}
