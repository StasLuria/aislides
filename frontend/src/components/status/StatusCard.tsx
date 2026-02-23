/**
 * StatusCard — карточка прогресса генерации презентации.
 *
 * По PRD 5.3 (US-1, шаг 5): отображает список шагов S0-S5
 * с их текущим статусом (pending, in_progress, completed, error).
 *
 * Обновляется в реальном времени через WebSocket status_update.
 */

import type { GenerationStep, StepStatus } from '../../types'

export interface StatusCardProps {
  /** Список шагов генерации. */
  steps: GenerationStep[]
}

/** Иконки и стили для каждого статуса. */
const STATUS_CONFIG: Record<
  StepStatus,
  { icon: string; className: string; label: string }
> = {
  pending: {
    icon: '○',
    className: 'text-gray-400',
    label: 'Ожидание',
  },
  in_progress: {
    icon: '◉',
    className: 'text-blue-500 animate-pulse',
    label: 'В процессе',
  },
  completed: {
    icon: '✓',
    className: 'text-green-500',
    label: 'Завершено',
  },
  error: {
    icon: '✕',
    className: 'text-red-500',
    label: 'Ошибка',
  },
}

export function StatusCard({ steps }: StatusCardProps) {
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const totalCount = steps.length
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div
      data-testid="status-card"
      className="mx-4 my-2 rounded-xl border border-gray-200 bg-gray-50 p-4"
    >
      {/* Заголовок с прогрессом */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Генерация презентации
        </h3>
        <span className="text-xs text-gray-500">
          {completedCount}/{totalCount} ({progressPercent}%)
        </span>
      </div>

      {/* Прогресс-бар */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full mb-3">
        <div
          data-testid="progress-bar"
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Список шагов */}
      <div className="space-y-2">
        {steps.map((step) => {
          const config = STATUS_CONFIG[step.status]
          return (
            <div
              key={step.name}
              data-testid="status-step"
              data-status={step.status}
              className="flex items-center gap-2"
            >
              <span
                className={`text-sm font-mono w-5 text-center ${config.className}`}
                aria-label={config.label}
              >
                {config.icon}
              </span>
              <span
                className={`text-sm ${
                  step.status === 'in_progress'
                    ? 'text-gray-900 font-medium'
                    : step.status === 'completed'
                      ? 'text-gray-500'
                      : step.status === 'error'
                        ? 'text-red-600'
                        : 'text-gray-400'
                }`}
              >
                {step.name}
              </span>
              {step.message && (
                <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">
                  {step.message}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
