/**
 * RegisterForm — форма регистрации нового пользователя.
 *
 * Содержит поля email, username, password, подтверждение пароля,
 * кнопку регистрации, отображение ошибок и ссылку на логин.
 */

import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { ApiError } from '../../services/authApi'

/** Props для RegisterForm. */
export interface RegisterFormProps {
  /** Callback при переключении на форму входа. */
  onSwitchToLogin?: () => void
}

/**
 * RegisterForm — компонент формы регистрации.
 *
 * Позволяет пользователю создать новый аккаунт.
 * Валидирует совпадение паролей на клиенте.
 * При успехе AuthContext автоматически обновляет состояние.
 */
export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)

      // Клиентская валидация
      if (password !== confirmPassword) {
        setError('Пароли не совпадают')
        return
      }

      if (password.length < 6) {
        setError('Пароль должен содержать минимум 6 символов')
        return
      }

      if (username.length < 2) {
        setError('Имя должно содержать минимум 2 символа')
        return
      }

      setIsSubmitting(true)

      try {
        await register({ email, username, password })
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
    [email, username, password, confirmPassword, register],
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Создать аккаунт
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
              htmlFor="register-email"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Email
            </label>
            <input
              id="register-email"
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
              htmlFor="register-username"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Имя пользователя
            </label>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ваше имя"
              required
              minLength={2}
              maxLength={100}
              autoComplete="username"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Пароль
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Подтвердите пароль
            </label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        {onSwitchToLogin && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Войти
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
