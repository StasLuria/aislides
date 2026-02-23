/**
 * ProtectedRoute — обёртка маршрута с проверкой авторизации.
 *
 * Если пользователь не авторизован, перенаправляет на страницу входа.
 * Если идёт проверка токена (isLoading), показывает индикатор загрузки.
 */

import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '../../contexts/AuthContext'

/** Props для ProtectedRoute. */
export interface ProtectedRouteProps {
  /** Дочерние компоненты (защищённый контент). */
  children: ReactNode
  /** Путь для перенаправления неавторизованных. По умолчанию '/auth'. */
  redirectTo?: string
}

/**
 * ProtectedRoute — компонент защиты маршрутов.
 *
 * Проверяет авторизацию через AuthContext:
 * - isLoading → показывает спиннер.
 * - Не авторизован → перенаправляет на redirectTo.
 * - Авторизован → рендерит children.
 */
export function ProtectedRoute({
  children,
  redirectTo = '/auth',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
