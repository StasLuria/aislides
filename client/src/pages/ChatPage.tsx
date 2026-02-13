/**
 * ChatPage — Chat-based presentation creation with SSE streaming.
 * Swiss Precision Design: Dark canvas, indigo accent, streaming text.
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
  ArrowRight,
  ExternalLink,
  Plus,
  MessageSquare,
  X,
  StopCircle,
} from "lucide-react";
import { useSSEChat, type ChatMessage, type ChatAction } from "@/hooks/useSSEChat";

// ═══════════════════════════════════════════════════════
// STREAMING TEXT COMPONENT
// ═══════════════════════════════════════════════════════

function StreamingText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-sm">
      {content}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-primary/70 animate-pulse rounded-sm" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════

function ProgressBar({ percent, message }: { percent: number; message: string }) {
  return (
    <div className="my-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{message}</span>
        <span className="font-mono font-medium text-primary">{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out glow-indigo"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ACTION BUTTONS
// ═══════════════════════════════════════════════════════

function ActionButtons({
  actions,
  onAction,
  disabled,
}: {
  actions: ChatAction[];
  onAction: (id: string) => void;
  disabled: boolean;
}) {
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant === "outline" ? "outline" : "default"}
          size="sm"
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className={`text-xs gap-1.5 ${
            action.variant === "default"
              ? "bg-primary hover:bg-primary/90 text-primary-foreground glow-indigo"
              : "border-border/50 hover:bg-secondary"
          }`}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════

function MessageBubble({
  message,
  isLast,
}: {
  message: ChatMessage;
  isLast: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary/70" />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary/15 border border-primary/20 text-foreground"
            : "bg-card border border-border/50 text-foreground"
        }`}
      >
        <StreamingText content={message.content} isStreaming={message.isStreaming} />
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-md bg-secondary border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CHAT PAGE
// ═══════════════════════════════════════════════════════

export default function ChatPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    sessionId,
    isStreaming,
    progress,
    currentActions,
    presentationLink,
    error,
    createSession,
    loadSession,
    sendMessage,
    triggerAction,
    cancelStream,
  } = useSSEChat();

  // Initialize session
  useEffect(() => {
    const init = async () => {
      if (params.id) {
        await loadSession(params.id);
      } else {
        const newId = await createSession();
        navigate(`/chat/${newId}`, { replace: true });
      }
    };
    init().catch(console.error);
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, progress]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle action button
  const handleAction = useCallback(
    async (actionId: string) => {
      if (actionId === "view_presentation" && presentationLink?.presentationId) {
        navigate(`/view/${presentationLink.presentationId}`);
        return;
      }
      if (actionId === "new_presentation") {
        const newId = await createSession();
        navigate(`/chat/${newId}`, { replace: true });
        return;
      }
      await triggerAction(actionId);
    },
    [triggerAction, presentationLink, navigate, createSession],
  );

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Empty state — welcome screen */
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg px-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-primary/60" />
              </div>
              <h2
                className="text-2xl font-semibold tracking-tight mb-3"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Создайте презентацию
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                Опишите тему — AI создаст структуру, контент и дизайн.
                Текст будет появляться плавно в реальном времени.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {[
                  { label: "10 AI-агентов", desc: "Контент и дизайн" },
                  { label: "SSE Streaming", desc: "Плавный вывод текста" },
                  { label: "~60 секунд", desc: "Полная генерация" },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-card border border-border/50 hover:border-primary/20 transition-colors"
                  >
                    <div className="text-xs font-medium text-foreground/90 mb-0.5">{f.label}</div>
                    <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Messages list */
          <div className="container max-w-3xl py-6 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={`${msg.timestamp}-${i}`}
                message={msg}
                isLast={i === messages.length - 1}
              />
            ))}

            {/* Progress bar */}
            {progress && (
              <div className="pl-11">
                <ProgressBar percent={progress.percent} message={progress.message} />
              </div>
            )}

            {/* Action buttons */}
            {!isStreaming && currentActions.length > 0 && (
              <div className="pl-11">
                <ActionButtons
                  actions={currentActions}
                  onAction={handleAction}
                  disabled={isStreaming}
                />
              </div>
            )}

            {/* Presentation link */}
            {presentationLink && !isStreaming && (
              <div className="pl-11">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground glow-indigo"
                  onClick={() => navigate(`/view/${presentationLink.presentationId}`)}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Открыть презентацию
                  {presentationLink.slideCount && (
                    <span className="text-primary-foreground/70 font-mono text-[10px]">
                      ({presentationLink.slideCount} слайдов)
                    </span>
                  )}
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container max-w-3xl py-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasMessages
                    ? "Напишите сообщение..."
                    : "Опишите тему презентации, например: Стратегия развития компании на 2026 год"
                }
                disabled={isStreaming}
                className="min-h-[52px] max-h-[200px] resize-none bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-primary/20 text-sm leading-relaxed pr-12"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 text-[10px] text-muted-foreground/40 font-mono">
                {input.length > 0 && `${input.length}/2000`}
              </div>
            </div>

            {isStreaming ? (
              <Button
                onClick={cancelStream}
                variant="outline"
                size="icon"
                className="h-[52px] w-[52px] border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                title="Остановить"
              >
                <StopCircle className="w-5 h-5 text-destructive" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-[52px] w-[52px] bg-primary hover:bg-primary/90 text-primary-foreground glow-indigo disabled:opacity-30 disabled:shadow-none"
                title="Отправить"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
          </div>

          <p className="text-[10px] text-center text-muted-foreground/40 font-mono mt-2">
            Enter — отправить • Shift+Enter — новая строка • SSE Streaming
          </p>
        </div>
      </div>
    </div>
  );
}
