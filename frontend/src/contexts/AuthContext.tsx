/**
 * AuthContext — React-контекст для глобального состояния авторизации.
 *
 * Предоставляет:
 * - Данные текущего пользователя и токен.
 * - Функции login, register, logout.
 * - Автоматическую проверку токена при загрузке.
 * - Флаг isLoading для отображения состояния загрузки.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import type {
  AuthResponse,
  AuthState,
  LoginRequest,
  RegisterRequest,
  User,
} from '../types/auth'
import { loginUser, registerUser } from '../services/authApi'
import { getToken, removeToken, saveToken } from '../services/tokenStorage'

/** Интерфейс контекста авторизации. */
export interface AuthContextValue extends AuthState {
  /** Авторизация пользователя. */
  login: (data: LoginRequest) => Promise<AuthResponse>
  /** Регистрация нового пользователя. */
  register: (data: RegisterRequest) => Promise<AuthResponse>
  /** Выход из аккаунта. */
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Props для AuthProvider. */
export interface AuthProviderProps {
  children: ReactNode
}

/**
 * Декодирует payload JWT-токена (без валидации подписи).
 *
 * @param token - JWT-токен.
 * @returns Распарсенный payload или null при ошибке.
 */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Проверяет, не истёк ли токен.
 *
 * @param token - JWT-токен.
 * @returns true если токен валиден (не истёк).
 */
function isTokenValid(token: string): boolean {
  const payload = decodeTokenPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  // Добавляем буфер в 60 секунд
  return payload.exp * 1000 > Date.now() + 60_000
}

/**
 * Извлекает данные пользователя из payload токена.
 *
 * @param token - JWT-токен.
 * @returns Данные пользователя или null.
 */
function extractUserFromToken(token: string): User | null {
  const payload = decodeTokenPayload(token)
  if (!payload) return null

  const userId = payload.sub ?? payload.user_id
  const email = payload.email
  const username = payload.username ?? (typeof email === 'string' ? email.split('@')[0] : '')

  if (typeof userId !== 'string' || typeof email !== 'string') return null

  return {
    id: userId,
    email,
    username: typeof username === 'string' ? username : '',
    is_active: true,
  }
}

/**
 * AuthProvider — провайдер контекста авторизации.
 *
 * Оборачивает дерево компонентов и предоставляет доступ к
 * состоянию авторизации через useAuth().
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Восстанавливаем сессию из localStorage при монтировании
  useEffect(() => {
    const storedToken = getToken()
    if (storedToken && isTokenValid(storedToken)) {
      const userData = extractUserFromToken(storedToken)
      if (userData) {
        setToken(storedToken)
        setUser(userData)
      } else {
        removeToken()
      }
    } else if (storedToken) {
      // Токен истёк — удаляем
      removeToken()
    }
    setIsLoading(false)
  }, [])

  /**
   * Обрабатывает успешный ответ авторизации.
   */
  const handleAuthSuccess = useCallback((response: AuthResponse) => {
    saveToken(response.access_token)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  /**
   * Авторизация пользователя.
   */
  const login = useCallback(
    async (data: LoginRequest): Promise<AuthResponse> => {
      const response = await loginUser(data)
      handleAuthSuccess(response)
      return response
    },
    [handleAuthSuccess],
  )

  /**
   * Регистрация нового пользователя.
   */
  const register = useCallback(
    async (data: RegisterRequest): Promise<AuthResponse> => {
      const response = await registerUser(data)
      handleAuthSuccess(response)
      return response
    },
    [handleAuthSuccess],
  )

  /**
   * Выход из аккаунта.
   */
  const logout = useCallback(() => {
    removeToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth — хук для доступа к контексту авторизации.
 *
 * @returns Значение AuthContext.
 * @throws Error если используется вне AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
