/**
 * Тесты для tokenStorage — утилит хранения JWT-токена.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveToken, getToken, removeToken, hasToken } from '../tokenStorage'

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and retrieves a token', () => {
    saveToken('test-token-123')
    expect(getToken()).toBe('test-token-123')
  })

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull()
  })

  it('removes a token', () => {
    saveToken('test-token-123')
    removeToken()
    expect(getToken()).toBeNull()
  })

  it('hasToken returns true when token exists', () => {
    saveToken('test-token-123')
    expect(hasToken()).toBe(true)
  })

  it('hasToken returns false when no token', () => {
    expect(hasToken()).toBe(false)
  })

  it('handles localStorage errors gracefully on save', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    // Should not throw
    expect(() => saveToken('token')).not.toThrow()
    spy.mockRestore()
  })

  it('handles localStorage errors gracefully on get', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(getToken()).toBeNull()
    spy.mockRestore()
  })
})
