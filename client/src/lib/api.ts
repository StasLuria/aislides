/**
 * API Client for AI Presentation Generator Backend
 * Swiss Precision Frontend — API Integration Layer
 *
 * Connects to FastAPI backend.
 * Field names match backend Pydantic schemas and WS manager exactly.
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";

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
  source_structured_content?: Record<string, unknown> | null;
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
  action: "approve" | "edit" | "regenerate" | "finalize";
  payload?: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════
// WebSocket event types — matching ws_manager.py broadcast format
// ═══════════════════════════════════════════════════════

/**
 * WS events from backend ws_manager.py:
 *
 * "generation.progress" → data: {
 *   presentation_id, node_name, current_step,
 *   progress_percentage (int), phase
 * }
 *
 * "generation.slide_preview" → data: {
 *   presentation_id, slide_number, slide_title,
 *   layout_name, html_content
 * }
 *
 * "generation.completed" → data: {
 *   presentation_id, slide_count, result_urls,
 *   generation_time_seconds
 * }
 *
 * "generation.failed" → data: {
 *   presentation_id, error_type, error_message,
 *   failed_at_node, partial_result
 * }
 *
 * "generation.interrupt" → data: {
 *   presentation_id, step, step_description,
 *   available_actions, preview_data
 * }
 *
 * "connection.established" → data: {
 *   presentation_id, heartbeat_interval
 * }
 *
 * "heartbeat" → data: {}
 */
export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

// Typed event data interfaces
export interface WSProgressData {
  presentation_id: string;
  node_name: string;
  current_step: string;
  progress_percentage: number;
  phase: string;
}

export interface WSSlidePreviewData {
  presentation_id: string;
  slide_number: number;
  slide_title: string;
  layout_name: string;
  html_content: string;
}

export interface WSCompletedData {
  presentation_id: string;
  slide_count: number;
  result_urls: Record<string, string>;
  generation_time_seconds: number;
}

export interface WSFailedData {
  presentation_id: string;
  error_type: string;
  error_message: string;
  failed_at_node: string;
  partial_result: boolean;
}

export interface WSInterruptData {
  presentation_id: string;
  step: number;
  step_description: string;
  available_actions: string[];
  preview_data: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════

/**
 * API base URL — points to FastAPI backend.
 * In dev: Vite proxy forwards /api/v1/* to backend.
 * In prod: nginx or Docker network handles routing.
 */
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * WebSocket base URL.
 * Auto-detects protocol (ws/wss) from current page.
 * In dev: Vite proxy forwards /ws/* to backend.
 * In prod: nginx handles WebSocket upgrade.
 */
function getWsBaseUrl(): string {
  const envUrl = import.meta.env.VITE_WS_BASE_URL;
  if (envUrl) return envUrl;

  // Auto-detect from current page location
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

/**
 * Build full URL for files served by backend.
 * result_urls from backend contain paths like "/api/v1/files/presentations/..."
 * If the URL is relative, prepend the backend origin.
 */
function resolveFileUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Relative URL — use current origin (proxy will forward to backend)
  return `${window.location.origin}${url}`;
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

    // Add response interceptor for error handling
    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const detail =
          (error.response?.data as Record<string, string>)?.detail ||
          error.message;

        console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}: ${detail}`);
        return Promise.reject(error);
      }
    );
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

  // — Files —

  /**
   * Fetch presentation HTML from result_urls.html_preview.
   * The URL is relative (e.g., "/api/v1/files/presentations/{id}/output/presentation.html")
   * and served by the backend files endpoint.
   */
  async fetchPresentationHtml(htmlUrl: string): Promise<string> {
    const fullUrl = resolveFileUrl(htmlUrl);
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Get the resolved file URL for use in iframes or downloads.
   */
  getFileUrl(relativePath: string): string {
    return resolveFileUrl(relativePath);
  }

  // — WebSocket —

  connectWebSocket(
    presentationId: string,
    onEvent: (event: WSEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
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

        // Skip heartbeat events
        if (parsed.event === "heartbeat") return;

        console.log(`[WS] Event: ${parsed.event}`, parsed.data);
        onEvent(parsed);
      } catch {
        // Non-JSON message (e.g., "pong")
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
      console.log(`[WS] Closed for ${presentationId} (code: ${event.code})`);
      onClose?.();
    };

    // Start heartbeat (ping every 25s to keep connection alive)
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
      // Health endpoint is at root level, not under /api/v1
      const baseOrigin = window.location.origin;
      const { data } = await axios.get(`${baseOrigin}/health`);
      return data;
    } catch {
      return { status: "unreachable" };
    }
  }
}

export const api = new ApiClient();
export default api;
