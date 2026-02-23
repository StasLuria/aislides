/**
 * Тесты для корневого компонента App.
 *
 * Проверяет маршрутизацию и интеграцию с AuthProvider.
 * Рендерим структуру App вручную, чтобы моки tokenStorage
 * корректно подхватывались AuthProvider и ProtectedRoute.
 */

import { render, screen, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

const mockGetToken = vi.fn<() => string | null>(() => null)

vi.mock('./services/tokenStorage', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  saveToken: vi.fn(),
  removeToken: vi.fn(),
  hasToken: () => mockGetToken() !== null,
}))

vi.mock('./services/authApi', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  ApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { AuthProvider } from './contexts/AuthContext'
import { AuthPage, ProtectedRoute } from './components/auth'
import { AppLayout } from './components/layout'

/** Create a fake JWT token with given payload. */
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
  return `${header}.${body}.fake-signature`
}

/** Renders the same structure as App component. */
function renderApp() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout
                  sidebarContent={
                    <div className="p-4 text-sm text-gray-400">
                      Проекты появятся здесь
                    </div>
                  }
                  chatContent={
                    <div className="flex items-center justify-center flex-1 text-gray-400">
                      Напишите сообщение, чтобы начать
                    </div>
                  }
                />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetToken.mockReturnValue(null)
  // Reset URL to / before each test (BrowserRouter uses window.location)
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('redirects to auth page when not authenticated', async () => {
    mockGetToken.mockReturnValue(null)
    await act(async () => {
      renderApp()
    })
    expect(screen.getByText('Вход в аккаунт')).toBeInTheDocument()
  })

  it('shows main layout when authenticated via stored token', async () => {
    const token = createFakeJwt({
      sub: 'user-1',
      email: 'test@test.com',
      username: 'Test',
    })
    mockGetToken.mockReturnValue(token)

    await act(async () => {
      renderApp()
    })

    expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('shows placeholder text in chat area when authenticated', async () => {
    const token = createFakeJwt({
      sub: 'user-1',
      email: 'test@test.com',
      username: 'Test',
    })
    mockGetToken.mockReturnValue(token)

    await act(async () => {
      renderApp()
    })

    expect(
      screen.getByText('Напишите сообщение, чтобы начать'),
    ).toBeInTheDocument()
  })
})
