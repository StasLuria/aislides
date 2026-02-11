/**
 * API Client for AI Presentation Generator Backend
 * Swiss Precision Frontend — API Integration Layer
 *
 * Connects to FastAPI backend at configurable base URL.
 * All methods return typed responses matching backend schemas.
 */

import axios, { type AxiosInstance } from "axios";

// ═══════════════════════════════════════════════════════
// TYPES — matching backend Pydantic schemas
// ═══════════════════════════════════════════════════════

export type PresentationStatus =
  | "pending"
  | "processing"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled";

export type GenerationMode = "batch" | "interactive" | "design_only";
export type SourceType = "prompt" | "document" | "structured";

export interface CreatePresentationRequest {
  prompt: string;
  mode?: GenerationMode;
  source_type?: SourceType;
  source_content?: string | null;
  config?: Record<string, unknown> | null;
}

export interface PresentationResponse {
  presentation_id: string;
  status: PresentationStatus;
  message: string;
  created_at: string;
}

export interface PresentationDetail {
  presentation_id: string;
  status: PresentationStatus;
  mode: GenerationMode;
  current_step: string | null;
  slide_count: number;
  progress_percent: number;
  result_urls: Record<string, string> | null;
  error_info: Record<string, unknown> | null;
  interactive_state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface PresentationListResponse {
  items: PresentationDetail[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResumeInteractiveRequest {
  action: "approve" | "edit" | "regenerate";
  payload?: Record<string, unknown> | null;
}

// WebSocket event types
export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
  presentation_id?: string;
  timestamp?: string;
}

// ═══════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // — Presentations —

  async createPresentation(
    req: CreatePresentationRequest
  ): Promise<PresentationResponse> {
    const { data } = await this.http.post<PresentationResponse>(
      "/presentations",
      req
    );
    return data;
  }

  async getPresentation(id: string): Promise<PresentationDetail> {
    const { data } = await this.http.get<PresentationDetail>(
      `/presentations/${id}`
    );
    return data;
  }

  async listPresentations(
    page = 1,
    size = 20,
    status?: string,
    mode?: string
  ): Promise<PresentationListResponse> {
    const params: Record<string, unknown> = { page, size };
    if (status) params.status = status;
    if (mode) params.mode = mode;
    const { data } = await this.http.get<PresentationListResponse>(
      "/presentations",
      { params }
    );
    return data;
  }

  async deletePresentation(id: string): Promise<void> {
    await this.http.delete(`/presentations/${id}`);
  }

  async cancelPresentation(id: string): Promise<void> {
    await this.http.post(`/presentations/${id}/cancel`);
  }

  async resumeInteractive(
    id: string,
    req: ResumeInteractiveRequest
  ): Promise<unknown> {
    const { data } = await this.http.post(
      `/presentations/${id}/resume`,
      req
    );
    return data;
  }

  // — WebSocket —

  connectWebSocket(
    presentationId: string,
    onEvent: (event: WSEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): WebSocket {
    const url = `${WS_BASE_URL}/ws/${presentationId}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSEvent;
        onEvent(parsed);
      } catch {
        // Non-JSON message (e.g., "pong")
      }
    };

    ws.onerror = (event) => {
      onError?.(event);
    };

    ws.onclose = () => {
      onClose?.();
    };

    // Start heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 25000);

    return ws;
  }

  // — Health —

  async checkHealth(): Promise<boolean> {
    try {
      await this.http.get("/health");
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient();
export default api;
