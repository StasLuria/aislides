/**
 * App — корневой компонент приложения.
 *
 * Настраивает маршрутизацию:
 * - /auth — страница авторизации (LoginForm / RegisterForm).
 * - / — защищённый основной layout (по PRD 5.2).
 *
 * Оборачивает дерево в AuthProvider для глобального
 * состояния авторизации.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import { AuthPage, ProtectedRoute } from './components/auth'
import { AppLayout } from './components/layout'

function App() {
  return (
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

export default App
