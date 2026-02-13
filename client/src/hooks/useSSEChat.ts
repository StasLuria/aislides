/**
 * useSSEChat — React hook for SSE-based chat with streaming AI responses.
 * Handles connection lifecycle, token accumulation, progress events, and actions.
 * Includes polling fallback when SSE connection drops during long-running generation.
 */
import { useState, useCallback, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ChatAction {
  id: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}

export interface SlidePreview {
  slideNumber: number;
  title: string;
  html: string;
}

export interface ChatFileRef {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  s3Url: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actions?: ChatAction[];
  progress?: { percent: number; message: string };
  presentationLink?: string;
  slidePreviews?: SlidePreview[];
  isStreaming?: boolean;
  files?: ChatFileRef[];
}

export interface PresentationLink {
  presentationId: string;
  title?: string;
  slideCount?: number;
}

interface SSEEvent {
  type: "token" | "actions" | "slide_preview" | "progress" | "done" | "error" | "presentation_link" | "title_update";
  data: any;
}

// ═══════════════════════════════════════════════════════
// SSE PARSER
// ═══════════════════════════════════════════════════════

async function readSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const event = JSON.parse(jsonStr) as SSEEvent;
        onEvent(event);
      } catch {
        // Skip malformed events
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════

const API_BASE = "/api/v1/chat";
const POLL_INTERVAL_MS = 5000;

export function useSSEChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const [currentActions, setCurrentActions] = useState<ChatAction[]>([]);
  const [presentationLink, setPresentationLink] = useState<PresentationLink | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");

  // Polling fallback state
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProgressRef = useRef<{ percent: number; message: string } | null>(null);
  const receivedDoneRef = useRef(false);

  /**
   * Stop polling if running.
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Start polling the session status to detect when generation completes.
   */
  const startPolling = useCallback(
    (sid: string) => {
      if (pollingRef.current) return; // Already polling

      setIsPolling(true);
      console.log("[useSSEChat] SSE dropped during generation, starting polling fallback");

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/sessions/${sid}`);
          if (!res.ok) return;
          const data = await res.json();

          const phase = data.phase as string;

          // Update progress message while still generating
          if (phase === "generating") {
            setProgress((prev) => ({
              percent: prev?.percent || lastProgressRef.current?.percent || 50,
              message: "Генерация продолжается на сервере...",
            }));
            return;
          }

          // Generation completed or moved to a different phase
          if (phase === "completed" || phase === "mode_selection" || phase === "step_structure" || phase === "idle") {
            console.log("[useSSEChat] Polling detected phase change:", phase);
            stopPolling();

            // Reload the full session to get all messages
            const allMessages = (data.messages || []).map((m: any) => ({
              ...m,
              isStreaming: false,
            }));
            setMessages(allMessages);

            // Restore actions from last assistant message
            const lastAssistant = [...allMessages].reverse().find(
              (m: any) => m.role === "assistant" && m.actions?.length,
            );
            if (lastAssistant?.actions) {
              setCurrentActions(lastAssistant.actions);
            }

            // Restore presentation link
            if (data.presentation_id && phase === "completed") {
              setPresentationLink({
                presentationId: data.presentation_id,
                title: data.topic || "",
              });
            }

            setIsStreaming(false);
            setProgress(null);
            setError(null);
          }
        } catch {
          // Polling error — just continue
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  /**
   * Reset to empty state (no session, no messages). Used when navigating to /chat without ID.
   */
  const resetSession = useCallback(() => {
    stopPolling();
    setSessionId(null);
    setMessages([]);
    setCurrentActions([]);
    setPresentationLink(null);
    setSessionTitle(null);
    setProgress(null);
    setError(null);
    setIsStreaming(false);
  }, [stopPolling]);

  /**
   * Create a new chat session.
   */
  const createSession = useCallback(async (): Promise<string> => {
    stopPolling();
    try {
      const res = await fetch(`${API_BASE}/sessions`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages([]);
      setCurrentActions([]);
      setPresentationLink(null);
      setSessionTitle(null);
      setProgress(null);
      setError(null);
      return data.session_id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [stopPolling]);

  /**
   * Load an existing session.
   */
  const loadSession = useCallback(async (id: string): Promise<void> => {
    stopPolling();
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      if (res.status === 404) throw new Error("SESSION_NOT_FOUND");
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages(
        (data.messages || []).map((m: any) => ({
          ...m,
          isStreaming: false,
        })),
      );
      setProgress(null);
      setError(null);

      // Restore last actions if any
      const lastAssistantMsg = [...(data.messages || [])].reverse().find((m: any) => m.role === "assistant" && m.actions?.length);
      if (lastAssistantMsg?.actions) {
        setCurrentActions(lastAssistantMsg.actions);
      } else {
        setCurrentActions([]);
      }

      // Restore presentation link
      const lastLink = [...(data.messages || [])].reverse().find((m: any) => m.presentationLink);
      if (lastLink?.presentationLink) {
        setPresentationLink({
          presentationId: data.presentation_id || "",
          title: "",
        });
      }

      // If session is in "generating" phase, start polling
      if (data.phase === "generating") {
        setIsStreaming(true);
        setProgress({ percent: 50, message: "Генерация продолжается на сервере..." });
        startPolling(id);
      }
    } catch (err: any) {
      setError(err.message);
      // Re-throw SESSION_NOT_FOUND so caller (ChatPage) can redirect
      if (err.message === "SESSION_NOT_FOUND") throw err;
    }
  }, [stopPolling, startPolling]);

  /**
   * Common SSE event handler factory.
   */
  const createSSEHandler = useCallback(() => {
    return (event: SSEEvent) => {
      switch (event.type) {
        case "token":
          streamingContentRef.current += event.data;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: streamingContentRef.current,
                isStreaming: true,
              };
            }
            return updated;
          });
          break;

        case "progress":
          setProgress(event.data);
          lastProgressRef.current = event.data;
          break;

        case "actions":
          setCurrentActions(event.data || []);
          break;

        case "presentation_link":
          setPresentationLink(event.data);
          break;

        case "slide_preview":
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              const existing = updated[lastIdx].slidePreviews || [];
              updated[lastIdx] = {
                ...updated[lastIdx],
                slidePreviews: [...existing, event.data],
              };
            }
            return updated;
          });
          break;

        case "title_update":
          setSessionTitle(typeof event.data === "string" ? event.data : event.data?.title || null);
          break;

        case "error":
          setError(typeof event.data === "string" ? event.data : event.data?.message || "Unknown error");
          break;

        case "done":
          receivedDoneRef.current = true;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                isStreaming: false,
              };
            }
            return updated;
          });
          break;
      }
    };
  }, []);

  /**
   * Send a message and stream the AI response via SSE.
   * @param overrideSessionId - Optional session ID to use instead of the state value
   *   (needed when sending right after createSession, before React state updates)
   */
  const sendMessage = useCallback(
    async (message: string, overrideSessionId?: string): Promise<void> => {
      const sid = overrideSessionId || sessionId;
      if (!sid || isStreaming) return;

      setError(null);
      setCurrentActions([]);
      setPresentationLink(null);
      setIsStreaming(true);
      streamingContentRef.current = "";
      lastProgressRef.current = null;
      receivedDoneRef.current = false;

      // Add user message immediately
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add empty assistant message for streaming
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_BASE}/sessions/${sid}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        await readSSEStream(res, createSSEHandler());
      } catch (err: any) {
        if (err.name === "AbortError") return;

        // If we had progress updates, SSE likely dropped during generation
        const lastProg = lastProgressRef.current as { percent: number; message: string } | null;
        const gotDone = receivedDoneRef.current;

        if (lastProg && lastProg.percent > 0 && !gotDone) {
          // SSE dropped during generation — start polling
          console.log("[useSSEChat] SSE connection dropped during generation, switching to polling");
          setError(null); // Don't show error
          setProgress({
            percent: lastProg.percent,
            message: "Соединение прервалось, но генерация продолжается...",
          });
          startPolling(sid);
          return; // Don't reset isStreaming — polling will handle it
        }

        // Regular error
        setError(err.message);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content || "Произошла ошибка при обработке запроса.",
              isStreaming: false,
            };
          }
          return updated;
        });
      } finally {
        // Only cleanup if not polling (polling handles its own cleanup)
        if (!pollingRef.current) {
          setIsStreaming(false);
          setProgress(null);
        }
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming, createSSEHandler, startPolling],
  );

  /**
   * Trigger an action button click.
   */
  const triggerAction = useCallback(
    async (actionId: string): Promise<void> => {
      if (!sessionId || isStreaming) return;

      setError(null);
      setCurrentActions([]);
      setIsStreaming(true);
      streamingContentRef.current = "";
      lastProgressRef.current = null;
      receivedDoneRef.current = false;

      // Add empty assistant message for streaming
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action_id: actionId }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        await readSSEStream(res, createSSEHandler());
      } catch (err: any) {
        if (err.name === "AbortError") return;

        // If we had progress updates, SSE likely dropped during generation
        const lastProg2 = lastProgressRef.current as { percent: number; message: string } | null;
        const gotDone2 = receivedDoneRef.current;

        if (lastProg2 && lastProg2.percent > 0 && !gotDone2) {
          // SSE dropped during generation — start polling
          console.log("[useSSEChat] SSE connection dropped during action, switching to polling");
          setError(null);
          setProgress({
            percent: lastProg2.percent,
            message: "Соединение прервалось, но генерация продолжается...",
          });
          startPolling(sessionId);
          return;
        }

        // Regular error
        setError(err.message);
      } finally {
        if (!pollingRef.current) {
          setIsStreaming(false);
          setProgress(null);
        }
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming, createSSEHandler, startPolling],
  );

  /**
   * Cancel ongoing streaming.
   */
  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    stopPolling();
    setIsStreaming(false);
    setProgress(null);
  }, [stopPolling]);

  /**
   * List all sessions.
   */
  const listSessions = useCallback(async () => {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error("Failed to list sessions");
    return res.json();
  }, []);

  /**
   * Delete a session.
   */
  const deleteSession = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
  }, []);

  return {
    // State
    messages,
    sessionId,
    isStreaming,
    isPolling,
    progress,
    currentActions,
    presentationLink,
    sessionTitle,
    error,

    // Actions
    resetSession,
    createSession,
    loadSession,
    sendMessage,
    triggerAction,
    cancelStream,
    listSessions,
    deleteSession,
  };
}
