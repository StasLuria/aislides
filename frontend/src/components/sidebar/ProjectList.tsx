/**
 * ProjectList — список проектов в боковой панели.
 *
 * По PRD 5.2: «Sidebar — список проектов».
 *
 * Отображает список проектов с возможностью:
 * - Выбора активного проекта
 * - Создания нового проекта
 */

export interface Project {
  /** Уникальный ID проекта. */
  id: string
  /** Название проекта. */
  title: string
  /** Дата последнего обновления (ISO 8601). */
  updatedAt: string
}

export interface ProjectListProps {
  /** Список проектов. */
  projects: Project[]
  /** ID активного проекта. */
  activeProjectId?: string
  /** Callback при выборе проекта. */
  onSelect: (projectId: string) => void
  /** Callback при создании нового проекта. */
  onCreate: () => void
}

export function ProjectList({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
}: ProjectListProps) {
  return (
    <div data-testid="project-list" className="flex flex-col h-full">
      {/* Заголовок + кнопка создания */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Проекты</h2>
        <button
          onClick={onCreate}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Новый проект"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Список проектов */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div data-testid="empty-state" className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">Нет проектов</p>
            <button
              onClick={onCreate}
              className="mt-2 text-sm text-blue-500 hover:text-blue-600 transition-colors"
            >
              Создать первый проект
            </button>
          </div>
        ) : (
          <ul className="py-1">
            {projects.map((project) => {
              const isActive = project.id === activeProjectId
              return (
                <li key={project.id}>
                  <button
                    onClick={() => onSelect(project.id)}
                    data-testid="project-item"
                    data-active={isActive}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      isActive
                        ? 'bg-blue-50 border-r-2 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`text-sm truncate ${
                        isActive
                          ? 'text-blue-700 font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {project.title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatDate(project.updatedAt)}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Форматирует ISO-дату в читаемый формат.
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Сегодня'
    if (diffDays === 1) return 'Вчера'
    if (diffDays < 7) return `${diffDays} дн. назад`

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}
