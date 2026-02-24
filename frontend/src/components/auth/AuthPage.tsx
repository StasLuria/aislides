/**
 * AuthPage — страница авторизации с переключением между формами.
 *
 * Отображает LoginForm или RegisterForm в зависимости от
 * текущего режима. Позволяет переключаться между формами.
 * Если пользователь уже авторизован — перенаправляет на главную.
 */

import { useCallback, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

/** Режим страницы авторизации. */
type AuthMode = 'login' | 'register'

/**
 * AuthPage — компонент страницы авторизации.
 *
 * Управляет переключением между формами входа и регистрации.
 * Перенаправляет авторизованных пользователей на главную страницу.
 */
export function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')

  const switchToRegister = useCallback(() => setMode('register'), [])
  const switchToLogin = useCallback(() => setMode('login'), [])

  // Если пользователь уже авторизован — перенаправляем на главную
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (mode === 'register') {
    return <RegisterForm onSwitchToLogin={switchToLogin} />
  }

  return <LoginForm onSwitchToRegister={switchToRegister} />
}
