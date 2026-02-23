/**
 * Типы данных для авторизации.
 *
 * Определяет интерфейсы для запросов/ответов auth API,
 * данных пользователя и состояния авторизации.
 */

/** Данные пользователя. */
export interface User {
  id: string
  email: string
  username: string
  is_active: boolean
}

/** Запрос на регистрацию. */
export interface RegisterRequest {
  email: string
  username: string
  password: string
}

/** Запрос на авторизацию. */
export interface LoginRequest {
  email: string
  password: string
}

/** Ответ авторизации: токен + данные пользователя. */
export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

/** Состояние авторизации в контексте. */
export interface AuthState {
  /** Текущий пользователь (null если не авторизован). */
  user: User | null
  /** JWT access-токен. */
  token: string | null
  /** Идёт ли загрузка (проверка токена). */
  isLoading: boolean
  /** Авторизован ли пользователь. */
  isAuthenticated: boolean
}
