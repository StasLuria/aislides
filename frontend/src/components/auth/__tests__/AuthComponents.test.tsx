/**
 * Тесты для компонентов авторизации:
 * LoginForm, RegisterForm, AuthPage, ProtectedRoute.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { LoginForm } from '../LoginForm'
import { RegisterForm } from '../RegisterForm'
import { AuthPage } from '../AuthPage'
import { ProtectedRoute } from '../ProtectedRoute'

// Mock AuthContext
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockLogout = vi.fn()

let mockAuthState = {
  user: null as { id: string; email: string; username: string; is_active: boolean } | null,
  token: null as string | null,
  isLoading: false,
  isAuthenticated: false,
  login: mockLogin,
  register: mockRegister,
  logout: mockLogout,
}

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock authApi for ApiError
vi.mock('../../../services/authApi', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

import { ApiError } from '../../../services/authApi'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthState = {
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
  }
})

// ============================================================
// LoginForm
// ============================================================

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('calls login on form submission', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      access_token: 'token',
      token_type: 'bearer',
      user: { id: '1', email: 'test@test.com', username: 'Test', is_active: true },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      })
    })
  })

  it('displays API error message', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Неверный email или пароль'))

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'bad@test.com')
    await user.type(screen.getByLabelText('Пароль'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Неверный email или пароль')
    })
  })

  it('displays generic error for unknown errors', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Пароль'), 'pass123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Произошла ошибка')
    })
  })

  it('shows switch to register link', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()

    render(
      <MemoryRouter>
        <LoginForm onSwitchToRegister={onSwitch} />
      </MemoryRouter>
    )

    await user.click(screen.getByText('Зарегистрироваться'))
    expect(onSwitch).toHaveBeenCalledOnce()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Make login hang
    mockLogin.mockImplementation(() => new Promise(() => {}))

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Пароль'), 'pass123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Вход...' })).toBeDisabled()
    })
  })
})

// ============================================================
// RegisterForm
// ============================================================

describe('RegisterForm', () => {
  it('renders all registration fields', () => {
    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Имя пользователя')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
    expect(screen.getByLabelText('Подтвердите пароль')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument()
  })

  it('calls register on valid form submission', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({
      access_token: 'token',
      token_type: 'bearer',
      user: { id: '1', email: 'new@test.com', username: 'New', is_active: true },
    })

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'new@test.com')
    await user.type(screen.getByLabelText('Имя пользователя'), 'NewUser')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'new@test.com',
        username: 'NewUser',
        password: 'password123',
      })
    })
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Имя пользователя'), 'Test')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'different')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Пароли не совпадают')
    })
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows error for short password', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Имя пользователя'), 'Test')
    await user.type(screen.getByLabelText('Пароль'), '12345')
    await user.type(screen.getByLabelText('Подтвердите пароль'), '12345')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Пароль должен содержать минимум 6 символов')
    })
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows switch to login link', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()

    render(
      <MemoryRouter>
        <RegisterForm onSwitchToLogin={onSwitch} />
      </MemoryRouter>
    )

    await user.click(screen.getByText('Войти'))
    expect(onSwitch).toHaveBeenCalledOnce()
  })
})

// ============================================================
// AuthPage
// ============================================================

describe('AuthPage', () => {
  it('renders login form by default', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Вход в аккаунт')).toBeInTheDocument()
  })

  it('switches to register form', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    )

    await user.click(screen.getByText('Зарегистрироваться'))

    expect(screen.getByText('Создать аккаунт')).toBeInTheDocument()
  })

  it('switches back to login form', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    )

    await user.click(screen.getByText('Зарегистрироваться'))
    expect(screen.getByText('Создать аккаунт')).toBeInTheDocument()

    await user.click(screen.getByText('Войти'))
    expect(screen.getByText('Вход в аккаунт')).toBeInTheDocument()
  })
})

// ============================================================
// ProtectedRoute
// ============================================================

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    mockAuthState.isAuthenticated = true
    mockAuthState.user = { id: '1', email: 'test@test.com', username: 'Test', is_active: true }
    mockAuthState.token = 'jwt-token'

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects to /auth when not authenticated', () => {
    mockAuthState.isAuthenticated = false

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<div data-testid="auth-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading', () => {
    mockAuthState.isLoading = true

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    // Should not show content or redirect
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('redirects to custom path', () => {
    mockAuthState.isAuthenticated = false

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute redirectTo="/login">
                <div>Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })
})
