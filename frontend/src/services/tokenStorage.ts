/**
 * tokenStorage — утилиты для хранения JWT-токена в localStorage.
 *
 * Предоставляет функции для сохранения, получения и удаления
 * access-токена. Используется AuthContext для персистентности
 * авторизации между перезагрузками страницы.
 */

const TOKEN_KEY = 'auth_token'

/**
 * Сохраняет токен в localStorage.
 *
 * @param token - JWT access-токен.
 */
export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    console.error('[tokenStorage] Failed to save token')
  }
}

/**
 * Получает токен из localStorage.
 *
 * @returns Токен или null если не найден.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    console.error('[tokenStorage] Failed to get token')
    return null
  }
}

/**
 * Удаляет токен из localStorage.
 */
export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    console.error('[tokenStorage] Failed to remove token')
  }
}

/**
 * Проверяет наличие токена в localStorage.
 *
 * @returns true если токен существует.
 */
export function hasToken(): boolean {
  return getToken() !== null
}
