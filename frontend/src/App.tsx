/**
 * App — корневой компонент приложения.
 *
 * Настраивает маршрутизацию:
 * - /auth — страница авторизации (LoginForm / RegisterForm).
 * - / — защищённый основной layout (по PRD 5.2).
 *
 * Оборачивает дерево в AuthProvider для глобального
 * состояния авторизации.
 *
 * Главная страница интегрирует:
 * - ProjectList (sidebar) — список проектов с API
 * - ChatInput + ChatMessage — чат с WebSocket
 * - StatusCard — прогресс генерации
 * - ArtifactPanel + SlidePreview — просмотр артефактов
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { AuthPage, ProtectedRoute } from './components/auth'
import { AppLayout } from './components/layout'
import { ChatMessage } from './components/chat'
import { ChatInput } from './components/chat'
import { StatusCard, createInitialSteps } from './components/status'
import { ArtifactCard, SlidePreview, MarkdownViewer } from './components/artifact'
import { ProjectList } from './components/sidebar'
import type { Project } from './components/sidebar/ProjectList'
import { useWebSocket } from './hooks'
import { useArtifactPanel, useArtifactActions } from './hooks'
import type {
  ChatMessageData,
  GenerationStep,
  ArtifactData,
  ServerMessage,
} from './types'

/** API helper — fetch с авторизацией. */
async function apiFetch<T>(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return response.json() as Promise<T>
}

/**
 * MainPage — основная рабочая страница приложения.
 *
 * Управляет:
 * - Списком проектов (REST API)
 * - Активным проектом и WebSocket-подключением
 * - Чатом (сообщения, статус генерации)
 * - Панелью артефактов
 */
function MainPage() {
  const { token } = useAuth()

  // --- Projects ---
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  // --- Chat ---
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [steps, setSteps] = useState<GenerationStep[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showStatus, setShowStatus] = useState(false)

  // --- Artifacts ---
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([])
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactData | null>(null)
  const artifactPanel = useArtifactPanel()
  const artifactActions = useArtifactActions()

  // --- Auto-scroll ---
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showStatus])

  // --- Load projects on mount ---
  useEffect(() => {
    if (!token) return
    apiFetch<{ projects: Array<{ id: string; title: string; updated_at: string }> }>(
      '/api/projects',
      token,
    )
      .then((data) => {
        setProjects(
          data.projects.map((p) => ({
            id: p.id,
            title: p.title,
            updatedAt: p.updated_at,
          })),
        )
      })
      .catch((err) => console.error('Failed to load projects:', err))
  }, [token])

  // --- WebSocket ---
  const wsUrl = activeProjectId
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/projects/${activeProjectId}`
    : null

  const handleWsMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case 'connected':
          console.log('[WS] Connected to project:', message.payload.project_id)
          break

        case 'ai_message':
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}-${Math.random()}`,
              role: 'ai',
              text: message.payload.text,
              timestamp: new Date().toISOString(),
            },
          ])
          // If generation complete message, stop loading
          if (
            message.payload.text.includes('Генерация завершена') ||
            message.payload.text.includes('Генерация отменена')
          ) {
            setIsGenerating(false)
          }
          break

        case 'status_update': {
          setShowStatus(true)
          const { step, status, message: msg } = message.payload
          setSteps((prev) => {
            const updated = [...prev]
            const idx = updated.findIndex((s) => s.name === step)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], status, message: msg }
            } else {
              // Unknown step — append it
              updated.push({ name: step, status, message: msg })
            }
            return updated
          })
          break
        }

        case 'artifact_generated': {
          const artifact: ArtifactData = {
            artifact_id: message.payload.artifact_id,
            filename: message.payload.filename,
            file_type: message.payload.file_type,
            preview_url: message.payload.preview_url,
            content: (message.payload as Record<string, unknown>).content as
              | string
              | undefined,
          }
          setArtifacts((prev) => [...prev, artifact])
          setCurrentArtifact(artifact)
          artifactPanel.open()
          break
        }

        case 'artifact_edited':
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-edit-${Date.now()}`,
              role: 'ai',
              text: message.payload.message,
              timestamp: new Date().toISOString(),
            },
          ])
          break

        case 'error':
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'ai',
              text: `⚠️ ${message.payload.message}`,
              timestamp: new Date().toISOString(),
            },
          ])
          setIsGenerating(false)
          break
      }
    },
    [artifactPanel],
  )

  const { send, status: wsStatus } = useWebSocket({
    url: wsUrl,
    token,
    onMessage: handleWsMessage,
    onConnect: () => console.log('[WS] Connected'),
    onDisconnect: () => console.log('[WS] Disconnected'),
  })

  // --- Create project ---
  const handleCreateProject = useCallback(async () => {
    if (!token) return
    try {
      const project = await apiFetch<{
        id: string
        title: string
        updated_at: string
      }>('/api/projects', token, {
        method: 'POST',
        body: JSON.stringify({ title: 'Новый проект' }),
      })
      const newProject: Project = {
        id: project.id,
        title: project.title,
        updatedAt: project.updated_at,
      }
      setProjects((prev) => [newProject, ...prev])
      handleSelectProject(project.id)
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }, [token])

  // --- Select project ---
  const handleSelectProject = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId)
      // Reset chat state for new project
      setMessages([])
      setSteps([])
      setArtifacts([])
      setCurrentArtifact(null)
      setShowStatus(false)
      setIsGenerating(false)
      artifactPanel.close()
    },
    [artifactPanel],
  )

  // --- Send message ---
  const handleSend = useCallback(
    async (text: string) => {
      if (!token) return

      // Auto-create project if none selected
      let projectId = activeProjectId
      if (!projectId) {
        try {
          const project = await apiFetch<{
            id: string
            title: string
            updated_at: string
          }>('/api/projects', token, {
            method: 'POST',
            body: JSON.stringify({ title: text.slice(0, 50) }),
          })
          const newProject: Project = {
            id: project.id,
            title: project.title,
            updatedAt: project.updated_at,
          }
          setProjects((prev) => [newProject, ...prev])
          projectId = project.id
          setActiveProjectId(projectId)
        } catch (err) {
          console.error('Failed to create project:', err)
          return
        }
        // Wait for WebSocket to connect
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Add user message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text,
          timestamp: new Date().toISOString(),
        },
      ])

      // Initialize steps
      setSteps(createInitialSteps())
      setShowStatus(true)
      setIsGenerating(true)

      // Send via WebSocket
      send({
        type: 'user_message',
        payload: { text },
      })
    },
    [token, activeProjectId, send],
  )

  // --- Open artifact ---
  const handleOpenArtifact = useCallback(
    (artifact: ArtifactData) => {
      setCurrentArtifact(artifact)
      artifactPanel.open()
    },
    [artifactPanel],
  )

  // --- Render artifact viewer ---
  const renderArtifactViewer = () => {
    if (!currentArtifact) return null

    if (currentArtifact.file_type === 'html') {
      return (
        <SlidePreview
          content={currentArtifact.content}
          url={currentArtifact.preview_url}
          title={currentArtifact.filename}
        />
      )
    }

    if (currentArtifact.file_type === 'md' && currentArtifact.content) {
      return <MarkdownViewer content={currentArtifact.content} />
    }

    // Fallback: show content as text
    if (currentArtifact.content) {
      return (
        <pre className="p-4 text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
          {currentArtifact.content}
        </pre>
      )
    }

    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Нет содержимого для отображения
      </div>
    )
  }

  // --- Sidebar content ---
  const sidebarContent = (
    <ProjectList
      projects={projects}
      activeProjectId={activeProjectId ?? undefined}
      onSelect={handleSelectProject}
      onCreate={handleCreateProject}
    />
  )

  // --- Chat content ---
  const chatContent = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !showStatus ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <p className="text-lg font-medium mb-2">AI Presentation Generator</p>
              <p className="text-sm">
                Напишите тему презентации, чтобы начать генерацию
              </p>
              {wsStatus === 'connected' && activeProjectId && (
                <p className="text-xs text-green-500 mt-2">● Подключено</p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                id={msg.id}
                role={msg.role}
                text={msg.text}
                timestamp={msg.timestamp}
              />
            ))}

            {/* Status card */}
            {showStatus && <StatusCard steps={steps} />}

            {/* Artifact cards in chat */}
            {artifacts.map((artifact) => (
              <div key={artifact.artifact_id} className="px-4 py-2">
                <ArtifactCard artifact={artifact} onClick={handleOpenArtifact} />
              </div>
            ))}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isGenerating}
        placeholder={
          activeProjectId
            ? 'Напишите сообщение...'
            : 'Напишите тему презентации, чтобы начать...'
        }
      />
    </div>
  )

  return (
    <AppLayout
      sidebarContent={sidebarContent}
      chatContent={chatContent}
      artifactContent={renderArtifactViewer()}
      isArtifactPanelOpen={artifactPanel.isOpen}
      onArtifactPanelClose={artifactPanel.close}
      currentArtifact={currentArtifact}
      artifacts={artifacts}
      onSelectArtifact={handleOpenArtifact}
      onDownload={artifactActions.download}
      onOpenNewTab={artifactActions.openNewTab}
    />
  )
}

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
                <MainPage />
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
