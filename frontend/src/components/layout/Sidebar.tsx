/**
 * Sidebar — левая панель со списком проектов.
 *
 * По PRD 5.2: «Список проектов — панель слева для навигации
 * между чатами/проектами».
 *
 * Содержит кнопку «+ Новый чат» и список прошлых чатов.
 * Полная реализация ProjectList — в задаче 6.7.
 */

interface SidebarProps {
  /** Дочерние элементы (ProjectList). */
  children?: React.ReactNode
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside
      data-testid="sidebar"
      className="flex flex-col w-64 min-w-64 bg-gray-900 text-gray-100 border-r border-gray-800"
    >
      {/* Заголовок */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-800">
        <svg
          className="w-6 h-6 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span className="text-sm font-semibold tracking-wide">
          AI Presentations
        </span>
      </div>

      {/* Содержимое (ProjectList) */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
