/**
 * Тесты для AuthContext — контекста авторизации.
 */

import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'
import type { AuthContextValue } from '../AuthContext'

// Mock authApi
vi.mock('../../services/authApi', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

// Mock tokenStorage
vi.mock('../../services/tokenStorage', () => ({
  saveToken: vi.fn(),
  getToken: vi.fn(() => null),
  removeToken: vi.fn(),
}))

import { loginUser, registerUser } from '../../services/authApi'
import { saveToken, getToken, removeToken } from '../../services/tokenStorage'

const mockLoginUser = vi.mocked(loginUser)
const mockRegisterUser = vi.mocked(registerUser)
const mockGetToken = vi.mocked(getToken)
const mockSaveToken = vi.mocked(saveToken)
const mockRemoveToken = vi.mocked(removeToken)

/** Тестовый компонент для доступа к контексту. */
function TestConsumer({ onRender }: { onRender: (value: AuthContextValue) => void }) {
  const auth = useAuth()
  onRender(auth)
  return (
    <div>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="email">{auth.user?.email ?? 'none'}</span>
    </div>
  )
}

/** Создаёт фейковый JWT-токен с заданным payload. */
function createFakeJwt(payload: Record<string, unknown>, expInSeconds?: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(
    JSON.stringify({
      ...payload,
      exp: expInSeconds ?? Math.floor(Date.now() / 1000) + 3600,
    })
  )
  return `${header}.${body}.fake-signature`
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides default unauthenticated state', () => {
    let authValue: AuthContextValue | null = null
    render(
      <AuthProvider>
        <TestConsumer onRender={(v) => { authValue = v }} />
      </AuthProvider>
    )

    expect(authValue!.isAuthenticated).toBe(false)
    expect(authValue!.user).toBeNull()
    expect(authValue!.token).toBeNull()
    expect(authValue!.isLoading).toBe(false)
  })

  it('restores session from valid stored token', async () => {
    const fakeToken = createFakeJwt({
      sub: 'user-1',
      email: 'stored@test.com',
      username: 'Stored',
    })
    mockGetToken.mockReturnValue(fakeToken)

    render(
      <AuthProvider>
        <TestConsumer onRender={() => {}} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
      expect(screen.getByTestId('email').textContent).toBe('stored@test.com')
    })
  })

  it('removes expired token on mount', () => {
    const expiredToken = createFakeJwt(
      { sub: 'user-1', email: 'expired@test.com' },
      Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
    )
    mockGetToken.mockReturnValue(expiredToken)

    render(
      <AuthProvider>
        <TestConsumer onRender={() => {}} />
      </AuthProvider>
    )

    expect(mockRemoveToken).toHaveBeenCalled()
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
  })

  it('login calls loginUser and updates state', async () => {
    const authResponse = {
      access_token: 'new-jwt-token',
      token_type: 'bearer',
      user: { id: 'user-2', email: 'login@test.com', username: 'Login', is_active: true },
    }
    mockLoginUser.mockResolvedValueOnce(authResponse)

    let authValue: AuthContextValue | null = null
    render(
      <AuthProvider>
        <TestConsumer onRender={(v) => { authValue = v }} />
      </AuthProvider>
    )

    await act(async () => {
      await authValue!.login({ email: 'login@test.com', password: 'pass123' })
    })

    expect(mockLoginUser).toHaveBeenCalledWith({
      email: 'login@test.com',
      password: 'pass123',
    })
    expect(mockSaveToken).toHaveBeenCalledWith('new-jwt-token')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('email').textContent).toBe('login@test.com')
  })

  it('register calls registerUser and updates state', async () => {
    const authResponse = {
      access_token: 'reg-jwt-token',
      token_type: 'bearer',
      user: { id: 'user-3', email: 'reg@test.com', username: 'Reg', is_active: true },
    }
    mockRegisterUser.mockResolvedValueOnce(authResponse)

    let authValue: AuthContextValue | null = null
    render(
      <AuthProvider>
        <TestConsumer onRender={(v) => { authValue = v }} />
      </AuthProvider>
    )

    await act(async () => {
      await authValue!.register({
        email: 'reg@test.com',
        username: 'Reg',
        password: 'pass123',
      })
    })

    expect(mockRegisterUser).toHaveBeenCalledWith({
      email: 'reg@test.com',
      username: 'Reg',
      password: 'pass123',
    })
    expect(mockSaveToken).toHaveBeenCalledWith('reg-jwt-token')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
  })

  it('logout clears state and removes token', async () => {
    const authResponse = {
      access_token: 'jwt-token',
      token_type: 'bearer',
      user: { id: 'user-4', email: 'logout@test.com', username: 'Logout', is_active: true },
    }
    mockLoginUser.mockResolvedValueOnce(authResponse)

    let authValue: AuthContextValue | null = null
    render(
      <AuthProvider>
        <TestConsumer onRender={(v) => { authValue = v }} />
      </AuthProvider>
    )

    // Login first
    await act(async () => {
      await authValue!.login({ email: 'logout@test.com', password: 'pass123' })
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('true')

    // Logout
    act(() => {
      authValue!.logout()
    })

    expect(mockRemoveToken).toHaveBeenCalled()
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
    expect(screen.getByTestId('email').textContent).toBe('none')
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadComponent() {
      useAuth()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    )

    consoleSpy.mockRestore()
  })
})
