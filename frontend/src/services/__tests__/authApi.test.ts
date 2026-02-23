/**
 * Тесты для authApi — HTTP-клиента авторизации.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerUser, loginUser, getCurrentUser, ApiError } from '../authApi'

// Mock fetch
const mockFetch = vi.fn()

beforeEach(() => {
  globalThis.fetch = mockFetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

describe('authApi', () => {
  describe('registerUser', () => {
    it('sends POST request and returns AuthResponse', async () => {
      const authResponse = {
        access_token: 'jwt-token',
        token_type: 'bearer',
        user: { id: '1', email: 'test@test.com', username: 'Test', is_active: true },
      }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(201, authResponse))

      const result = await registerUser({
        email: 'test@test.com',
        username: 'Test',
        password: 'password123',
      })

      expect(result).toEqual(authResponse)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          username: 'Test',
          password: 'password123',
        }),
      })
    })

    it('throws ApiError on 409 conflict', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(409, { detail: 'Пользователь с таким email уже существует' })
      )

      try {
        await registerUser({ email: 'dup@test.com', username: 'Dup', password: 'pass123' })
        // Should not reach here
        expect.unreachable('Expected ApiError to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(409)
        expect((err as ApiError).message).toBe('Пользователь с таким email уже существует')
      }
    })
  })

  describe('loginUser', () => {
    it('sends POST request and returns AuthResponse', async () => {
      const authResponse = {
        access_token: 'jwt-token',
        token_type: 'bearer',
        user: { id: '1', email: 'test@test.com', username: 'Test', is_active: true },
      }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(200, authResponse))

      const result = await loginUser({
        email: 'test@test.com',
        password: 'password123',
      })

      expect(result).toEqual(authResponse)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'password123',
        }),
      })
    })

    it('throws ApiError on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(401, { detail: 'Неверный email или пароль' })
      )

      await expect(
        loginUser({ email: 'bad@test.com', password: 'wrong' })
      ).rejects.toThrow(ApiError)
    })
  })

  describe('getCurrentUser', () => {
    it('sends GET request with Authorization header', async () => {
      const user = { id: '1', email: 'test@test.com', username: 'Test', is_active: true }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(200, user))

      const result = await getCurrentUser('my-jwt-token')

      expect(result).toEqual(user)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer my-jwt-token',
        },
      })
    })

    it('throws ApiError on 401', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(401, { detail: 'Token expired' })
      )

      await expect(getCurrentUser('expired-token')).rejects.toThrow(ApiError)
    })
  })

  describe('ApiError', () => {
    it('has correct name and status', () => {
      const err = new ApiError(404, 'Not found')
      expect(err.name).toBe('ApiError')
      expect(err.status).toBe(404)
      expect(err.message).toBe('Not found')
    })
  })

  describe('error handling', () => {
    it('falls back to HTTP status when response body has no detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      try {
        await loginUser({ email: 'test@test.com', password: 'pass' })
        expect.unreachable('Expected ApiError to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(500)
        expect((err as ApiError).message).toBe('HTTP 500')
      }
    })
  })
})
