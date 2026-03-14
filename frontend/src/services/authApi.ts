/**
 * authApi — HTTP-клиент для endpoints авторизации.
 *
 * Предоставляет функции для регистрации, логина и получения
 * данных текущего пользователя через REST API.
 */

import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth'

/** Базовый URL API. */
const API_BASE = '/api'

/** Ошибка API с кодом статуса и сообщением. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Выполняет fetch-запрос и обрабатывает ошибки.
 *
 * @param url - URL запроса.
 * @param options - Параметры fetch.
 * @returns Распарсенный JSON-ответ.
 * @throws ApiError при HTTP-ошибке.
 */
async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = await response.json()
      message = body.detail ?? message
    } catch {
      // Игнорируем ошибку парсинга
    }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}

/**
 * Регистрирует нового пользователя.
 *
 * @param data - Данные для регистрации (email, username, password).
 * @returns AuthResponse с access_token и данными пользователя.
 * @throws ApiError 409 если email уже занят.
 */
export async function registerUser(data: RegisterRequest): Promise<AuthResponse> {
  return fetchJson<AuthResponse>(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Авторизует пользователя.
 *
 * @param data - Данные для входа (email, password).
 * @returns AuthResponse с access_token и данными пользователя.
 * @throws ApiError 401 если email или пароль неверны.
 */
export async function loginUser(data: LoginRequest): Promise<AuthResponse> {
  return fetchJson<AuthResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Получает данные текущего пользователя по токену.
 *
 * @param token - JWT access-токен.
 * @returns Данные пользователя.
 * @throws ApiError 401 если токен невалиден.
 */
export async function getCurrentUser(token: string): Promise<User> {
  return fetchJson<User>(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
