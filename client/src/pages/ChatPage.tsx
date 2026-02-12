/**
 * ChatPage — Unified chat-based presentation creator.
 * Supports both "quick" (batch) and "step-by-step" (interactive) modes
 * within a single conversational interface.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Plus,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import api, {
  type ChatMessage,
  type ChatSessionResponse,
  type ChatSessionSummary,
} from "@/lib/api";
import { Streamdown } from "streamdown";

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEW COMPONENT
// ═══════════════════════════════════════════════════════

function SlidePreviewInChat({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; overflow: hidden; }
              .slide { transform-origin: top left; }
            </style>
          </head>
          <body>${html}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [html]);

  return (
    <div className="rounded-lg overflow-hidden border border-border/50 bg-white my-2">
      <iframe
        ref={iframeRef}
        className="w-full pointer-events-none"
        style={{ height: "280px" }}
        title="Slide Preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-secondary/50 rounded-full h-2 my-2">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════

function MessageBubble({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction: (action: string) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary/10 text-primary" : "bg-indigo-500/10 text-indigo-500"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-secondary/60 text-foreground rounded-bl-md"
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
              <Streamdown>{message.content}</Streamdown>
            </div>
          )}
        </div>

        {/* Slide preview */}
        {message.data?.slideHtml && (
          <SlidePreviewInChat html={message.data.slideHtml} />
        )}

        {/* Progress bar */}
        {message.data?.type === "progress" && message.data.progress !== undefined && (
          <ProgressBar progress={message.data.progress} />
        )}

        {/* Action buttons */}
        {message.data?.buttons && message.data.buttons.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.data.buttons.map((btn, i) => (
              <Button
                key={i}
                variant={btn.variant === "outline" ? "outline" : "default"}
                size="sm"
                className="text-xs"
                onClick={() => onAction(btn.action)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-[10px] text-muted-foreground mt-1 ${isUser ? "text-right" : ""}`}>
          {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SESSION SIDEBAR
// ═══════════════════════════════════════════════════════

function SessionSidebar({
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onClose,
}: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-72 border-r border-border/50 bg-secondary/20 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Диалоги</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNew}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Нет диалогов
          </p>
        )}
        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onSelect(s.session_id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              s.session_id === currentSessionId
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary/60 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span className="truncate font-medium">
                {s.topic || "Новый диалог"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">
              {new Date(s.created_at).toLocaleDateString("ru-RU")}
              {s.phase === "completed" && " ✓"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CHAT PAGE
// ═══════════════════════════════════════════════════════

export default function ChatPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ sessionId?: string }>();

  // State
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    try {
      const result = await api.listChatSessions();
      setSessions(result.sessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load or create session
  useEffect(() => {
    const sessionId = params.sessionId;
    if (sessionId) {
      loadSession(sessionId);
    } else {
      createNewSession();
    }
  }, [params.sessionId]);

  const loadSession = async (id: string) => {
    setIsLoading(true);
    try {
      const session = await api.getChatSession(id);
      setCurrentSession(session);
      setMessages(session.messages || []);
    } catch (err) {
      console.error("Failed to load session:", err);
      toast.error("Не удалось загрузить диалог");
      createNewSession();
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async () => {
    setIsLoading(true);
    try {
      const session = await api.createChatSession();
      setCurrentSession(session);
      setMessages(session.messages || []);
      navigate(`/chat/${session.session_id}`, { replace: true });
      loadSessions();
    } catch (err) {
      console.error("Failed to create session:", err);
      toast.error("Не удалось создать диалог");
    } finally {
      setIsLoading(false);
    }
  };

  // Send message with optional display label (for action buttons)
  const sendMessageWithLabel = async (text: string, displayLabel?: string) => {
    if (!text.trim() || !currentSession || isSending) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: displayLabel || text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const result = await api.sendChatMessage(currentSession.session_id, text.trim());

      // Add assistant messages
      setMessages((prev) => [...prev, ...result.messages]);

      // Update session state
      setCurrentSession((prev) =>
        prev ? { ...prev, phase: result.phase, presentation_id: result.presentation_id } : prev,
      );

      // Refresh sessions list (topic may have been updated)
      loadSessions();

      // If quick generation started, poll for progress
      if (result.phase === "generating_quick" && result.presentation_id) {
        pollQuickProgress(currentSession.session_id, result.presentation_id);
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Ошибка при отправке сообщения. Попробуйте ещё раз.",
        data: { type: "error" },
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Send message (public API)
  const sendMessage = async (text: string) => {
    if (!text.trim() || !currentSession || isSending) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const result = await api.sendChatMessage(currentSession.session_id, text.trim());

      // Add assistant messages
      setMessages((prev) => [...prev, ...result.messages]);

      // Update session state
      setCurrentSession((prev) =>
        prev ? { ...prev, phase: result.phase, presentation_id: result.presentation_id } : prev,
      );

      // Refresh sessions list (topic may have been updated)
      loadSessions();

      // If quick generation started, poll for progress
      if (result.phase === "generating_quick" && result.presentation_id) {
        pollQuickProgress(currentSession.session_id, result.presentation_id);
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Ошибка при отправке сообщения. Попробуйте ещё раз.",
        data: { type: "error" },
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Poll for quick generation progress
  const pollQuickProgress = async (sessionId: string, presentationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const session = await api.getChatSession(sessionId);
        setMessages(session.messages || []);
        setCurrentSession(session);

        if (session.phase === "completed" || session.phase === "error") {
          clearInterval(pollInterval);
          loadSessions();
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Action label map for user-friendly display
  const ACTION_LABELS: Record<string, string> = {
    quick: "⚡ Быстро",
    stepbystep: "🔄 Пошагово",
    approve_structure: "✅ Структура утверждена",
    approve_content: "✅ Контент утверждён",
    approve_design: "✅ Дизайн утверждён",
    regenerate_content: "🔄 Перегенерировать контент",
    regenerate_design: "🔄 Перегенерировать дизайн",
    new_presentation: "Новая презентация",
  };

  // Handle button actions from messages
  const handleAction = (action: string) => {
    if (action.startsWith("open_presentation:")) {
      const presId = action.replace("open_presentation:", "");
      navigate(`/viewer/${presId}`);
    } else if (action === "new_presentation") {
      createNewSession();
    } else {
      // Send action as message but display friendly label
      sendMessageWithLabel(action, ACTION_LABELS[action] || action);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Handle session selection
  const handleSelectSession = (id: string) => {
    navigate(`/chat/${id}`);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Sidebar */}
      {showSidebar && (
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSession?.session_id || null}
          onSelect={handleSelectSession}
          onNew={createNewSession}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 border-b border-border/50 flex items-center px-4 gap-3 shrink-0">
          {!showSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(true)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {currentSession?.topic || "Новая презентация"}
            </span>
          </div>
          {currentSession?.phase && (
            <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
              {getPhaseLabel(currentSession.phase)}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Sparkles className="w-10 h-10 text-primary/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AI Презентации</h3>
                <p className="text-sm text-muted-foreground">
                  Опишите тему презентации, и я помогу её создать.
                  Вы можете выбрать быструю генерацию или пошаговую работу.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onAction={handleAction} />
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getInputPlaceholder(currentSession?.phase || "greeting")}
              className="min-h-[44px] max-h-[120px] resize-none bg-secondary/30 border-border/50 text-sm"
              rows={1}
              disabled={isSending}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isSending}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Enter — отправить • Shift+Enter — новая строка
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    greeting: "Начало",
    topic_received: "Тема получена",
    mode_selection: "Выбор режима",
    generating_quick: "Генерация...",
    structure_review: "Структура",
    slide_content: "Контент",
    slide_design: "Дизайн",
    completed: "Готово",
    error: "Ошибка",
  };
  return labels[phase] || phase;
}

function getInputPlaceholder(phase: string): string {
  const placeholders: Record<string, string> = {
    greeting: "Опишите тему презентации...",
    topic_received: "Опишите тему презентации...",
    mode_selection: "Выберите режим или напишите...",
    generating_quick: "Генерация идёт, подождите...",
    structure_review: "Внесите изменения или напишите «готово»...",
    slide_content: "Отредактируйте контент или напишите «готово»...",
    slide_design: "Опишите изменения или напишите «готово»...",
    completed: "Напишите новую тему или задайте вопрос...",
  };
  return placeholders[phase] || "Напишите сообщение...";
}
