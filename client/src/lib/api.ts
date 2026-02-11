/**
 * API Client for AI Presentation Generator
 * Swiss Precision Frontend — API Integration Layer
 *
 * Connects to the integrated Node.js backend (Express + invokeLLM pipeline).
 * All endpoints are served from the same origin — no external backend needed.
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type PresentationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type GenerationMode = "batch" | "interactive";

export interface CreatePresentationRequest {
  prompt: string;
  mode?: GenerationMode;
  config?: {
    slide_count?: number;
    theme_preset?: string;
  } | null;
}

export interface PresentationResponse {
  presentation_id: string;
  status: PresentationStatus;
  prompt: string;
  mode: GenerationMode;
  config: Record<string, unknown>;
  created_at: string;
}

export interface PresentationDetail {
  presentation_id: string;
  title: string;
  prompt: string;
  status: PresentationStatus;
  mode: GenerationMode;
  current_step: string | null;
  slide_count: number;
  progress_percent: number;
  config: Record<string, unknown> | null;
  result_urls: Record<string, string> | null;
  error_info: Record<string, unknown> | null;
  pipeline_state?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

// ═══════════════════════════════════════════════════════
// WebSocket event types — matching wsManager.ts broadcast format
// ═══════════════════════════════════════════════════════

/**
 * WS events from wsManager.ts:
 *
 * { type: "generation.progress", data: {
 *     presentation_id, node_name, current_step,
 *     progress_percentage, html_content?, message?
 * }}
 *
 * { type: "generation.completed", data: {
 *     presentation_id, result_urls, slide_count, title
 * }}
 *
 * { type: "generation.error", data: {
 *     presentation_id, error_message, error_type
 * }}
 *
 * { type: "connection.established", data: {
 *     presentation_id
 * }}
 */
export interface WSEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface WSProgressData {
  presentation_id: string;
  node_name: string;
  current_step: string;
  progress_percentage: number;
  html_content?: string;
  message?: string;
}

export interface WSCompletedData {
  presentation_id: string;
  slide_count: number;
  result_urls: Record<string, string>;
  title: string;
}

export interface WSErrorData {
  presentation_id: string;
  error_type: string;
  error_message: string;
}

// ═══════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════

/**
 * API base URL — all endpoints are on the same origin.
 * Express serves /api/v1/* and /health alongside the frontend.
 */
const API_BASE_URL = "/api/v1";

/**
 * WebSocket base URL — auto-detect from current page.
 */
function getWsBaseUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

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

    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const detail =
          (error.response?.data as Record<string, string>)?.detail ||
          error.message;

        console.error(
          `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}: ${detail}`,
        );
        return Promise.reject(error);
      },
    );
  }

  // — Presentations —

  async createPresentation(
    req: CreatePresentationRequest,
  ): Promise<PresentationResponse> {
    const { data } = await this.http.post<PresentationResponse>(
      "/presentations",
      req,
    );
    return data;
  }

  async getPresentation(id: string): Promise<PresentationDetail> {
    const { data } = await this.http.get<PresentationDetail>(
      `/presentations/${id}`,
    );
    return data;
  }

  /**
   * List presentations — backend returns a flat array (not paginated).
   */
  async listPresentations(): Promise<PresentationDetail[]> {
    const { data } = await this.http.get<PresentationDetail[]>(
      "/presentations",
    );
    return data;
  }

  async deletePresentation(id: string): Promise<void> {
    await this.http.delete(`/presentations/${id}`);
  }

  // — Files —

  /**
   * Fetch presentation HTML from result_urls.html_preview.
   * The URL may be an S3 URL or a relative path.
   */
  async fetchPresentationHtml(htmlUrl: string): Promise<string> {
    const response = await fetch(htmlUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status}`);
    }
    return response.text();
  }

  // — WebSocket —

  connectWebSocket(
    presentationId: string,
    onEvent: (event: WSEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void,
  ): WebSocket {
    const wsBase = getWsBaseUrl();
    const url = `${wsBase}/ws/${presentationId}`;
    console.log(`[WS] Connecting to ${url}`);

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`[WS] Connected to ${presentationId}`);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSEvent;

        // The backend sends { type: "...", data: {...} }
        console.log(`[WS] Event: ${parsed.type}`, parsed.data);
        onEvent(parsed);
      } catch {
        if (event.data !== "pong") {
          console.warn(`[WS] Non-JSON message: ${event.data}`);
        }
      }
    };

    ws.onerror = (event) => {
      console.error(`[WS] Error for ${presentationId}`, event);
      onError?.(event);
    };

    ws.onclose = (event) => {
      console.log(
        `[WS] Closed for ${presentationId} (code: ${event.code})`,
      );
      onClose?.();
    };

    // Heartbeat ping every 25s
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

  async checkHealth(): Promise<{ status: string; version?: string }> {
    try {
      const { data } = await axios.get("/health");
      return data;
    } catch {
      return { status: "unreachable" };
    }
  }
}

export const api = new ApiClient();
export default api;
