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
  | "cancelled"
  | "awaiting_outline_approval"
  | "awaiting_content_approval"
  | "assembling";

export type GenerationMode = "batch" | "interactive";

export interface CustomTemplateListItem {
  template_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  color_palette: Array<{ name: string; hex: string }> | null;
  font_families: string[] | null;
  mood: string | null;
  status: "uploading" | "analyzing" | "ready" | "error";
  css_variables: string | null;
  fonts_url: string | null;
  created_at: string;
}

export interface CustomTemplateDetail extends CustomTemplateListItem {
  source_file_url: string;
  source_filename: string;
  error_message: string | null;
}

export interface CreatePresentationRequest {
  prompt: string;
  mode?: GenerationMode;
  config?: {
    theme_preset?: string;
    enable_images?: boolean;
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

// ═══════════════════════════════════════════════════════
// Interactive Mode Types
// ═══════════════════════════════════════════════════════

export interface OutlineSlideData {
  slide_number: number;
  title: string;
  purpose: string;
  key_points: string[];
  speaker_notes_hint: string;
}

export interface OutlineData {
  presentation_title: string;
  target_audience: string;
  narrative_arc: string;
  slides: OutlineSlideData[];
}

export interface InteractiveStartResponse {
  presentation_id: string;
  status: string;
  title: string;
  language: string;
  outline: OutlineData;
}

export interface SlideContentData {
  slide_number: number;
  title: string;
  text: string;
  notes: string;
  data_points: Array<{ label: string; value: string; unit: string }>;
  key_message: string;
}

export interface InteractiveContentResponse {
  presentation_id: string;
  status: string;
  title: string;
  outline: OutlineData | null;
  content: SlideContentData[] | null;
  images: Record<number, { url: string; prompt: string }>;
}

export interface GenerateImageResponse {
  presentation_id: string;
  slide_number: number;
  image_url: string;
  prompt: string;
}

export interface SuggestImagePromptResponse {
  presentation_id: string;
  slide_number: number;
  suggested_prompt: string;
}

export interface UploadImageResponse {
  presentation_id: string;
  slide_number: number;
  image_url: string;
  filename: string;
  size: number;
}

// ═══════════════════════════════════════════════════════
// Slide Editing Types
// ═══════════════════════════════════════════════════════

export interface SlideData {
  index: number;
  layoutId: string;
  data: Record<string, any>;
}

export interface SlidesResponse {
  presentation_id: string;
  title: string;
  theme_preset: string;
  theme_css: string;
  fonts_url: string;
  language: string;
  slides: SlideData[];
}

export interface SlideEditResponse {
  presentation_id: string;
  index: number;
  layoutId: string;
  data: Record<string, any>;
  html: string;
  image_url?: string;
}

export interface ReassembleResponse {
  presentation_id: string;
  html_url: string;
  slide_count: number;
}

export interface ChangeThemeResponse {
  presentation_id: string;
  theme_preset_id: string;
  theme_name: string;
  html_url: string;
  slide_count: number;
}

export interface PreviewThemeResponse {
  theme_preset_id: string;
  theme_name: string;
  slide_index: number;
  preview_html: string;
}

export interface ReorderResponse {
  presentation_id: string;
  html_url: string;
  slide_count: number;
  order: number[];
}

export interface EditableFieldInfo {
  key: string;
  label: string;
  multiline: boolean;
}

export interface EditableSlideResponse {
  presentation_id: string;
  index: number;
  layoutId: string;
  data: Record<string, any>;
  html: string;
  editableFields: EditableFieldInfo[];
}

export interface InlineFieldPatchResponse {
  presentation_id: string;
  index: number;
  layoutId: string;
  data: Record<string, any>;
  field: string;
  value: string;
  html: string;
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

  async retryPresentation(id: string): Promise<{ presentation_id: string; status: string; message: string }> {
    const { data } = await this.http.post<{ presentation_id: string; status: string; message: string }>(
      `/presentations/${id}/retry`,
    );
    return data;
  }

  // — Interactive Mode —

  async startInteractive(req: { prompt: string; config?: Record<string, unknown> }): Promise<InteractiveStartResponse> {
    const { data } = await this.http.post<InteractiveStartResponse>(
      "/interactive/start",
      req,
    );
    return data;
  }

  async approveOutline(
    id: string,
    outline?: OutlineData,
  ): Promise<{ presentation_id: string; status: string; message: string; slide_count: number }> {
    const { data } = await this.http.post(`/interactive/${id}/approve-outline`, {
      outline: outline || undefined,
    });
    return data;
  }

  async getInteractiveContent(id: string): Promise<InteractiveContentResponse> {
    const { data } = await this.http.get<InteractiveContentResponse>(
      `/interactive/${id}/content`,
    );
    return data;
  }

  async updateSlide(
    id: string,
    slideNumber: number,
    updates: { title?: string; text?: string; key_message?: string; notes?: string },
  ): Promise<{ presentation_id: string; slide_number: number; updated: boolean; slide: SlideContentData }> {
    const { data } = await this.http.post(`/interactive/${id}/update-slide`, {
      slide_number: slideNumber,
      ...updates,
    });
    return data;
  }

  async regenerateSlide(
    id: string,
    slideNumber: number,
  ): Promise<{ presentation_id: string; slide_number: number; regenerated: boolean; slide: SlideContentData }> {
    const { data } = await this.http.post(`/interactive/${id}/regenerate-slide`, {
      slide_number: slideNumber,
    });
    return data;
  }

  async assemblePresentation(
    id: string,
  ): Promise<{ presentation_id: string; status: string; message: string }> {
    const { data } = await this.http.post(`/interactive/${id}/assemble`);
    return data;
  }

  async previewSlide(
    id: string,
    slideNumber: number,
  ): Promise<{ presentation_id: string; slide_number: number; layout: string; html: string }> {
    const { data } = await this.http.post(`/interactive/${id}/preview-slide`, {
      slide_number: slideNumber,
    });
    return data;
  }

  async generateSlideImage(
    id: string,
    slideNumber: number,
    prompt: string,
  ): Promise<GenerateImageResponse> {
    const { data } = await this.http.post<GenerateImageResponse>(
      `/interactive/${id}/generate-image`,
      { slide_number: slideNumber, prompt },
      { timeout: 60000 }, // Image generation can take up to 60s
    );
    return data;
  }

  async suggestImagePrompt(
    id: string,
    slideNumber: number,
  ): Promise<SuggestImagePromptResponse> {
    const { data } = await this.http.post<SuggestImagePromptResponse>(
      `/interactive/${id}/suggest-image-prompt`,
      { slide_number: slideNumber },
    );
    return data;
  }

  async removeSlideImage(
    id: string,
    slideNumber: number,
  ): Promise<{ presentation_id: string; slide_number: number; removed: boolean }> {
    const { data } = await this.http.post(
      `/interactive/${id}/remove-image`,
      { slide_number: slideNumber },
    );
    return data;
  }

  async uploadSlideImage(
    id: string,
    slideNumber: number,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadImageResponse> {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("slide_number", String(slideNumber));

    const { data } = await this.http.post<UploadImageResponse>(
      `/interactive/${id}/upload-image`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      },
    );
    return data;
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

  // — Slide Editing —

  async getSlides(id: string): Promise<SlidesResponse> {
    const { data } = await this.http.get<SlidesResponse>(`/presentations/${id}/slides`);
    return data;
  }

  async getSlide(id: string, index: number): Promise<SlideEditResponse> {
    const { data } = await this.http.get<SlideEditResponse>(`/presentations/${id}/slides/${index}`);
    return data;
  }

  async updateSlideData(
    id: string,
    index: number,
    slideData: Record<string, any>,
  ): Promise<SlideEditResponse> {
    const { data } = await this.http.put<SlideEditResponse>(
      `/presentations/${id}/slides/${index}`,
      { data: slideData },
    );
    return data;
  }

  async uploadSlideEditImage(
    id: string,
    index: number,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<SlideEditResponse> {
    const formData = new FormData();
    formData.append("image", file);

    const { data } = await this.http.post<SlideEditResponse>(
      `/presentations/${id}/slides/${index}/image`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      },
    );
    return data;
  }

  async removeSlideEditImage(id: string, index: number): Promise<SlideEditResponse> {
    const { data } = await this.http.delete<SlideEditResponse>(
      `/presentations/${id}/slides/${index}/image`,
    );
    return data;
  }

  async changeSlideLayout(id: string, index: number, layoutId: string): Promise<SlideEditResponse> {
    const { data } = await this.http.post<SlideEditResponse>(
      `/presentations/${id}/slides/${index}/layout`,
      { layoutId },
    );
    return data;
  }

  async reassemblePresentation(id: string): Promise<ReassembleResponse> {
    const { data } = await this.http.post<ReassembleResponse>(
      `/presentations/${id}/reassemble`,
    );
    return data;
  }

  async changeTheme(id: string, themePresetId: string): Promise<ChangeThemeResponse> {
    const { data } = await this.http.post<ChangeThemeResponse>(
      `/presentations/${id}/change-theme`,
      { theme_preset_id: themePresetId },
      { timeout: 60000 }, // Re-rendering all slides can take time
    );
    return data;
  }

  async previewTheme(id: string, themePresetId: string, slideIndex?: number): Promise<PreviewThemeResponse> {
    const { data } = await this.http.post<PreviewThemeResponse>(
      `/presentations/${id}/preview-theme`,
      { theme_preset_id: themePresetId, slide_index: slideIndex ?? 0 },
    );
    return data;
  }

  async reorderSlides(id: string, order: number[]): Promise<ReorderResponse> {
    const { data } = await this.http.post<ReorderResponse>(
      `/presentations/${id}/reorder`,
      { order },
    );
    return data;
  }

  // — Inline Editing —

  async getEditableSlide(id: string, index: number): Promise<EditableSlideResponse> {
    const { data } = await this.http.get<EditableSlideResponse>(
      `/presentations/${id}/slides/${index}/editable`,
    );
    return data;
  }

  async patchSlideField(
    id: string,
    index: number,
    field: string,
    value: string,
  ): Promise<InlineFieldPatchResponse> {
    const { data } = await this.http.patch<InlineFieldPatchResponse>(
      `/presentations/${id}/slides/${index}`,
      { field, value },
    );
    return data;
  }

  async reorderSlideItems(
    id: string,
    index: number,
    arrayPath: string,
    order: number[],
  ): Promise<{ presentation_id: string; index: number; layoutId: string; data: any; html: string; arrayPath: string; order: number[] }> {
    const { data } = await this.http.post(
      `/presentations/${id}/slides/${index}/reorder-items`,
      { arrayPath, order },
    );
    return data;
  }

  // — Chat File Upload —

  async uploadChatFiles(
    sessionId: string,
    files: File[],
    onProgress?: (percent: number) => void,
  ): Promise<Array<{
    file_id: string;
    filename: string;
    mime_type: string;
    size: number;
    s3_url: string;
    status: string;
  }>> {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const { data } = await axios.post(
      `/api/v1/chat/sessions/${sessionId}/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      },
    );
    return data.files;
  }

  async getChatSessionFiles(
    sessionId: string,
  ): Promise<Array<{
    file_id: string;
    filename: string;
    mime_type: string;
    size: number;
    s3_url: string;
    status: string;
  }>> {
    const { data } = await axios.get(`/api/v1/chat/sessions/${sessionId}/files`);
    return data;
  }

  // — Custom Templates —

  async uploadTemplate(
    file: File,
    name?: string,
    onProgress?: (percent: number) => void,
  ): Promise<{
    template_id: string;
    name: string;
    status: string;
    message: string;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);

    const { data } = await axios.post("/api/v1/templates/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return data;
  }

  async listTemplates(): Promise<Array<CustomTemplateListItem>> {
    const { data } = await axios.get("/api/v1/templates");
    return data;
  }

  async getTemplate(templateId: string): Promise<CustomTemplateDetail> {
    const { data } = await axios.get(`/api/v1/templates/${templateId}`);
    return data;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await axios.delete(`/api/v1/templates/${templateId}`);
  }

  async setSessionTemplate(
    sessionId: string,
    templateId: string | null,
    cssVariables?: string,
    fontsUrl?: string,
  ): Promise<void> {
    await axios.patch(`/api/v1/chat/sessions/${sessionId}/metadata`, {
      customTemplateId: templateId,
      customCssVariables: cssVariables || null,
      customFontsUrl: fontsUrl || null,
    });
  }

  async setSessionMetadata(
    sessionId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    await axios.patch(`/api/v1/chat/sessions/${sessionId}/metadata`, metadata);
  }

  // — Export —

  async exportPptx(id: string): Promise<Blob> {
    const response = await this.http.get(`/presentations/${id}/export/pptx`, {
      responseType: "blob",
    });
    return response.data;
  }

  // — Share —

  async getShareStatus(id: string): Promise<{ shareToken: string | null; shareEnabled: boolean }> {
    const { data } = await this.http.get(`/presentations/${id}/share`);
    return data;
  }

  async toggleShare(id: string, enabled?: boolean): Promise<{ shareToken: string; shareEnabled: boolean }> {
    const { data } = await this.http.post(`/presentations/${id}/share`, { enabled });
    return data;
  }

  // — Shared (public) —

  async getSharedPresentation(token: string): Promise<any> {
    const { data } = await axios.get(`/api/v1/shared/${token}`);
    return data;
  }

  async getSharedSlides(token: string): Promise<any> {
    const { data } = await axios.get(`/api/v1/shared/${token}/slides`);
    return data;
  }

  async getSharedHtml(token: string): Promise<{ html_url: string }> {
    const { data } = await axios.get(`/api/v1/shared/${token}/html`);
    return data;
  }

  async exportSharedPptx(token: string): Promise<Blob> {
    const response = await axios.get(`/api/v1/shared/${token}/export/pptx`, {
      responseType: "blob",
    });
    return response.data;
  }

  // — Version History —
  async getSlideVersions(
    presentationId: string,
    slideIndex: number,
  ): Promise<{
    presentation_id: string;
    slide_index: number;
    versions: Array<{
      id: number;
      version_number: number;
      change_type: string;
      change_description: string | null;
      created_at: string;
    }>;
  }> {
    const { data } = await axios.get(
      `/api/v1/presentations/${presentationId}/slides/${slideIndex}/versions`,
    );
    return data;
  }

  async getSlideVersionPreview(
    presentationId: string,
    slideIndex: number,
    versionId: number,
  ): Promise<{
    id: number;
    version_number: number;
    slide_index: number;
    change_type: string;
    change_description: string | null;
    slide_data: any;
    html: string;
    created_at: string;
  }> {
    const { data } = await axios.get(
      `/api/v1/presentations/${presentationId}/slides/${slideIndex}/versions/${versionId}`,
    );
    return data;
  }

  async restoreSlideVersion(
    presentationId: string,
    slideIndex: number,
    versionId: number,
  ): Promise<any> {
    const { data } = await axios.post(
      `/api/v1/presentations/${presentationId}/slides/${slideIndex}/versions/${versionId}/restore`,
    );
    return data;
  }

  // — PDF Export —
  async exportPdf(presentationId: string): Promise<Blob> {
    const response = await axios.get(
      `/api/v1/presentations/${presentationId}/export/pdf`,
      { responseType: "blob" },
    );
    return response.data;
  }

  async exportSharedPdf(shareToken: string): Promise<Blob> {
    const response = await axios.get(
      `/api/v1/shared/${shareToken}/export/pdf`,
      { responseType: "blob" },
    );
    return response.data;
  }

  // — Message Comments —

  async addMessageComment(
    sessionId: string,
    messageIndex: number,
    text: string,
  ): Promise<{ comments: Array<{ id: string; text: string; createdAt: number }> }> {
    const { data } = await axios.post(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/comments`,
      { text },
    );
    return data;
  }

  async deleteMessageComment(
    sessionId: string,
    messageIndex: number,
    commentId: string,
  ): Promise<void> {
    await axios.delete(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/comments/${commentId}`,
    );
  }

  // — Slide Comments —

  async addSlideComment(
    sessionId: string,
    messageIndex: number,
    slideNumber: number,
    text: string,
  ): Promise<{ comments: Array<{ id: string; text: string; createdAt: number }> }> {
    const { data } = await axios.post(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/slides/${slideNumber}/comments`,
      { text },
    );
    return data;
  }

  async deleteSlideComment(
    sessionId: string,
    messageIndex: number,
    slideNumber: number,
    commentId: string,
  ): Promise<void> {
    await axios.delete(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/slides/${slideNumber}/comments/${commentId}`,
    );
  }

  // — Annotations —
  async addAnnotation(
    sessionId: string,
    messageIndex: number,
    selectedText: string,
    note: string,
    startOffset: number,
    endOffset: number,
  ): Promise<{ annotations: Array<{ id: string; selectedText: string; note: string; startOffset: number; endOffset: number; createdAt: number }> }> {
    const { data } = await axios.post(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/annotations`,
      { selectedText, note, startOffset, endOffset },
    );
    return data;
  }

  async deleteAnnotation(
    sessionId: string,
    messageIndex: number,
    annotationId: string,
  ): Promise<void> {
    await axios.delete(
      `/api/v1/chat/sessions/${sessionId}/messages/${messageIndex}/annotations/${annotationId}`,
    );
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
