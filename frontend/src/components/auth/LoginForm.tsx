/**
 * LoginForm — форма авторизации пользователя.
 *
 * Содержит поля email и password, кнопку входа,
 * отображение ошибок и ссылку на регистрацию.
 */

import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { ApiError } from '../../services/authApi'

/** Props для LoginForm. */
export interface LoginFormProps {
  /** Callback при переключении на форму регистрации. */
  onSwitchToRegister?: () => void
}

/**
 * LoginForm — компонент формы входа.
 *
 * Позволяет пользователю ввести email и пароль для авторизации.
 * При успехе AuthContext автоматически обновляет состояние.
 */
export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      setIsSubmitting(true)

      try {
        await login({ email, password })
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Произошла ошибка. Попробуйте позже.')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [email, password, login],
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Вход в аккаунт
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Пароль
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {onSwitchToRegister && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Нет аккаунта?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Зарегистрироваться
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
