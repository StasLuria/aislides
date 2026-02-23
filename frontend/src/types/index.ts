/**
 * Типы данных для AI Presentation Generator.
 *
 * Определяет интерфейсы для сообщений, проектов, артефактов
 * и WebSocket-протокола (PRD, раздел 9.1).
 */

/** Роль отправителя сообщения. */
export type MessageRole = 'user' | 'ai'

/** Статус шага генерации. */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error'

/** Тип файла артефакта. */
export type ArtifactFileType = 'html' | 'md' | 'json' | 'css' | 'txt' | 'pdf' | 'image'

/** Сообщение в чате. */
export interface ChatMessageData {
  id: string
  role: MessageRole
  text: string
  timestamp: string
}

/** Шаг генерации (S0-S5). */
export interface GenerationStep {
  name: string
  status: StepStatus
  message?: string
}

/** Версия артефакта. */
export interface ArtifactVersion {
  version: number
  created_at: string
  preview_url?: string
}

/** Артефакт (сгенерированный файл). */
export interface ArtifactData {
  artifact_id: string
  filename: string
  file_type: string
  preview_url?: string
  download_url?: string
  content?: string
  versions?: ArtifactVersion[]
  current_version?: number
}

/** Проект / чат. */
export interface ProjectData {
  id: string
  title: string
  created_at: string
  updated_at?: string
}

/** Прикреплённый файл. */
export interface AttachmentData {
  file_id: string
  filename: string
  content_type: string
}

// --- WebSocket Messages ---

/** Базовое WebSocket-сообщение. */
export interface WsMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
}

/** Сообщение от клиента: user_message. */
export interface WsUserMessage extends WsMessage {
  type: 'user_message'
  payload: {
    text: string
    attachments?: AttachmentData[]
  }
}

/** Сообщение от клиента: artifact_feedback. */
export interface WsArtifactFeedback extends WsMessage {
  type: 'artifact_feedback'
  payload: {
    artifact_id: string
    feedback_text: string
  }
}

/** Сообщение от клиента: cancel. */
export interface WsCancelMessage extends WsMessage {
  type: 'cancel'
  payload: Record<string, never>
}

/** Сообщение от сервера: ai_message. */
export interface WsAiMessage extends WsMessage {
  type: 'ai_message'
  payload: {
    text: string
  }
}

/** Сообщение от сервера: status_update. */
export interface WsStatusUpdate extends WsMessage {
  type: 'status_update'
  payload: {
    step: string
    status: StepStatus
    message?: string
  }
}

/** Сообщение от сервера: artifact_generated. */
export interface WsArtifactGenerated extends WsMessage {
  type: 'artifact_generated'
  payload: ArtifactData
}

/** Сообщение от сервера: error. */
export interface WsErrorMessage extends WsMessage {
  type: 'error'
  payload: {
    message: string
  }
}

/** Сообщение от сервера: connected. */
export interface WsConnectedMessage extends WsMessage {
  type: 'connected'
  payload: {
    project_id: string
  }
}

/** Все типы серверных сообщений. */
export type ServerMessage =
  | WsAiMessage
  | WsStatusUpdate
  | WsArtifactGenerated
  | WsErrorMessage
  | WsConnectedMessage

/** Все типы клиентских сообщений. */
export type ClientMessage =
  | WsUserMessage
  | WsArtifactFeedback
  | WsCancelMessage
