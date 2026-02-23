/**
 * AuthPage — страница авторизации с переключением между формами.
 *
 * Отображает LoginForm или RegisterForm в зависимости от
 * текущего режима. Позволяет переключаться между формами.
 */

import { useCallback, useState } from 'react'

import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

/** Режим страницы авторизации. */
type AuthMode = 'login' | 'register'

/**
 * AuthPage — компонент страницы авторизации.
 *
 * Управляет переключением между формами входа и регистрации.
 */
export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')

  const switchToRegister = useCallback(() => setMode('register'), [])
  const switchToLogin = useCallback(() => setMode('login'), [])

  if (mode === 'register') {
    return <RegisterForm onSwitchToLogin={switchToLogin} />
  }

  return <LoginForm onSwitchToRegister={switchToRegister} />
}
