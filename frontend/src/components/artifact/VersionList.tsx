/**
 * VersionList — список версий артефакта.
 *
 * По roadmap 7.6: «Реализовать версионирование артефактов (список версий)».
 * По PRD 5.4: «Версии: переключение между версиями артефакта».
 *
 * Отображает список версий с датами, позволяет выбрать версию.
 * Текущая версия подсвечена.
 */

import type { ArtifactVersion } from '../../types'

export interface VersionListProps {
  /** Список версий артефакта. */
  versions: ArtifactVersion[]
  /** Текущая выбранная версия. */
  currentVersion: number
  /** Callback при выборе версии. */
  onSelectVersion: (version: number) => void
  /** Дополнительные CSS-классы. */
  className?: string
}

export function VersionList({
  versions,
  currentVersion,
  onSelectVersion,
  className = '',
}: VersionListProps) {
  if (versions.length === 0) {
    return (
      <div
        data-testid="version-list-empty"
        className="text-sm text-gray-400 p-3"
      >
        Нет версий
      </div>
    )
  }

  // Сортируем по убыванию (новые сверху)
  const sorted = [...versions].sort((a, b) => b.version - a.version)

  return (
    <div
      data-testid="version-list"
      className={`flex flex-col gap-1 p-2 ${className}`}
    >
      <div className="text-xs font-medium text-gray-500 px-2 mb-1">
        Версии ({versions.length})
      </div>
      {sorted.map((v) => {
        const isActive = v.version === currentVersion
        return (
          <button
            key={v.version}
            data-testid={`version-item-${v.version}`}
            onClick={() => onSelectVersion(v.version)}
            className={`
              flex items-center justify-between px-3 py-2 rounded-md text-sm
              transition-colors cursor-pointer
              ${isActive
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <span>v{v.version}</span>
            <span className="text-xs text-gray-400">
              {formatDate(v.created_at)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Форматирует дату для отображения. */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
