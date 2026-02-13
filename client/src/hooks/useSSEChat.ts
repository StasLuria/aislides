/**
 * useSSEChat — React hook for SSE-based chat with streaming AI responses.
 * Handles connection lifecycle, token accumulation, progress events, and actions.
 */
import { useState, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ChatAction {
  id: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actions?: ChatAction[];
  progress?: { percent: number; message: string };
  presentationLink?: string;
  isStreaming?: boolean;
}

export interface PresentationLink {
  presentationId: string;
  title?: string;
  slideCount?: number;
}

interface SSEEvent {
  type: "token" | "actions" | "slide_preview" | "progress" | "done" | "error" | "presentation_link";
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

export function useSSEChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const [currentActions, setCurrentActions] = useState<ChatAction[]>([]);
  const [presentationLink, setPresentationLink] = useState<PresentationLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");

  /**
   * Create a new chat session.
   */
  const createSession = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages([]);
      setCurrentActions([]);
      setPresentationLink(null);
      setProgress(null);
      setError(null);
      return data.session_id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Load an existing session.
   */
  const loadSession = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      if (!res.ok) throw new Error("Session not found");
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
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  /**
   * Send a message and stream the AI response via SSE.
   */
  const sendMessage = useCallback(
    async (message: string): Promise<void> => {
      if (!sessionId || isStreaming) return;

      setError(null);
      setCurrentActions([]);
      setPresentationLink(null);
      setIsStreaming(true);
      streamingContentRef.current = "";

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
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        await readSSEStream(res, (event) => {
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
              break;

            case "actions":
              setCurrentActions(event.data || []);
              break;

            case "presentation_link":
              setPresentationLink(event.data);
              break;

            case "error":
              setError(typeof event.data === "string" ? event.data : event.data?.message || "Unknown error");
              break;

            case "done":
              // Mark streaming as complete
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
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message);
          // Update the assistant message with error
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
        }
      } finally {
        setIsStreaming(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming],
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

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        await readSSEStream(res, (event) => {
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
              break;

            case "actions":
              setCurrentActions(event.data || []);
              break;

            case "presentation_link":
              setPresentationLink(event.data);
              break;

            case "error":
              setError(typeof event.data === "string" ? event.data : event.data?.message || "Unknown error");
              break;

            case "done":
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
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsStreaming(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming],
  );

  /**
   * Cancel ongoing streaming.
   */
  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setProgress(null);
  }, []);

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
    progress,
    currentActions,
    presentationLink,
    error,

    // Actions
    createSession,
    loadSession,
    sendMessage,
    triggerAction,
    cancelStream,
    listSessions,
    deleteSession,
  };
}
