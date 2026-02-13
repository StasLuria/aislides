/**
 * ChatPage — Chat-based presentation creation with SSE streaming + sidebar history.
 * Clean Light Design: white canvas, blue accent, settings in input toolbar.
 *
 * Settings (mode, theme, slide count) are configured via a toolbar above the input,
 * similar to how Manus/ChatGPT handle model/tool settings.
 * When the user sends the first message, settings are automatically applied.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send,
  Sparkles,
  ExternalLink,
  User,
  StopCircle,
  Settings2,
  Palette,
  SlidersHorizontal,
  Zap,
  Target,
  ChevronDown,
  X,
  Check,
} from "lucide-react";
import { useSSEChat, type ChatMessage, type ChatAction, type SlidePreview } from "@/hooks/useSSEChat";
import ChatSidebar from "@/components/ChatSidebar";
import { THEME_PRESETS } from "@/lib/constants";

// ═══════════════════════════════════════════════════════
// SETTINGS TYPES
// ═══════════════════════════════════════════════════════

interface ChatSettings {
  mode: "quick" | "step";
  themePreset: string;
  slideCount: number;
}

const DEFAULT_SETTINGS: ChatSettings = {
  mode: "quick",
  themePreset: "auto",
  slideCount: 10,
};

// ═══════════════════════════════════════════════════════
// STREAMING TEXT
// ═══════════════════════════════════════════════════════

function StreamingText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-sm text-foreground">
      {content}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════

function ProgressBar({ percent, message }: { percent: number; message: string }) {
  return (
    <div className="my-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{message}</span>
        <span className="font-medium text-primary">{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
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

  // Filter out mode selection buttons — they're now in settings
  const filteredActions = actions.filter(
    (a) => a.id !== "mode_quick" && a.id !== "mode_step"
  );

  if (!filteredActions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {filteredActions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant === "outline" ? "outline" : "default"}
          size="sm"
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className="text-xs gap-1.5"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEW CARD
// ═══════════════════════════════════════════════════════

function SlidePreviewCard({ preview }: { preview: SlidePreview }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (iframeRef.current && preview.html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1280" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  .slide { width: 1280px; height: 720px; transform-origin: top left; transform: scale(${expanded ? 0.5 : 0.25}); }
</style>
</head>
<body><div class="slide">${preview.html}</div></body></html>`);
        doc.close();
      }
    }
  }, [preview.html, expanded]);

  return (
    <div
      className={`group relative rounded-lg overflow-hidden border border-border bg-white cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/30 ${
        expanded ? "w-[640px] h-[360px]" : "w-[320px] h-[180px]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <iframe
        ref={iframeRef}
        className="w-full h-full pointer-events-none"
        sandbox="allow-same-origin"
        title={`Slide ${preview.slideNumber}`}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
        <span className="text-[10px] text-white font-medium">
          Слайд {preview.slideNumber}{preview.title && preview.title !== `Слайд ${preview.slideNumber}` ? ` — ${preview.title}` : ""}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEWS GALLERY
// ═══════════════════════════════════════════════════════

function SlidePreviewsGallery({ previews }: { previews: SlidePreview[] }) {
  if (!previews || previews.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-2">
        Превью слайдов ({previews.length})
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {previews.map((preview, i) => (
          <SlidePreviewCard key={`${preview.slideNumber}-${i}`} preview={preview} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-secondary/60 text-foreground rounded-bl-md"
          }`}
        >
          <StreamingText content={message.content} isStreaming={message.isStreaming} />
        </div>

        {/* Slide previews gallery */}
        {!isUser && message.slidePreviews && message.slidePreviews.length > 0 && (
          <SlidePreviewsGallery previews={message.slidePreviews} />
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS PANEL (dropdown above input)
// ═══════════════════════════════════════════════════════

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: ChatSettings;
  onChange: (s: ChatSettings) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Настройки генерации</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-2 block">Режим</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ ...settings, mode: "quick" })}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
              settings.mode === "quick"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <div className="text-left">
              <div className="font-medium">Быстрый</div>
              <div className="text-[10px] opacity-70">~60 сек, автоматически</div>
            </div>
          </button>
          <button
            onClick={() => onChange({ ...settings, mode: "step" })}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
              settings.mode === "step"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <div className="text-left">
              <div className="font-medium">Пошаговый</div>
              <div className="text-[10px] opacity-70">Утверждение структуры</div>
            </div>
          </button>
        </div>
      </div>

      {/* Theme */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-2 block">Тема дизайна</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onChange({ ...settings, themePreset: "auto" })}
            className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
              settings.themePreset === "auto"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            Авто
          </button>
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange({ ...settings, themePreset: t.id })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                settings.themePreset === t.id
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border hover:border-primary/30 text-muted-foreground"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: t.color }}
              />
              {t.nameRu}
            </button>
          ))}
        </div>
      </div>

      {/* Slide count */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">Количество слайдов</label>
          <span className="text-xs font-medium text-primary">{settings.slideCount}</span>
        </div>
        <input
          type="range"
          min={5}
          max={20}
          value={settings.slideCount}
          onChange={(e) => onChange({ ...settings, slideCount: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>5</span>
          <span>20</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS CHIPS (shown below input when settings differ from defaults)
// ═══════════════════════════════════════════════════════

function SettingsChips({ settings }: { settings: ChatSettings }) {
  const chips: { label: string; icon: React.ReactNode }[] = [];

  if (settings.mode === "step") {
    chips.push({ label: "Пошаговый", icon: <Target className="w-3 h-3" /> });
  }

  if (settings.themePreset !== "auto") {
    const preset = THEME_PRESETS.find((t) => t.id === settings.themePreset);
    if (preset) {
      chips.push({
        label: preset.nameRu,
        icon: <span className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block" style={{ backgroundColor: preset.color }} />,
      });
    }
  }

  if (settings.slideCount !== 10) {
    chips.push({ label: `${settings.slideCount} слайдов`, icon: <SlidersHorizontal className="w-3 h-3" /> });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/15 text-[10px] text-primary"
        >
          {chip.icon}
          {chip.label}
        </span>
      ))}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsApplied, setSettingsApplied] = useState(false);

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

  // Handle send — applies settings on first message
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    setShowSettings(false);

    // First message: send topic, then auto-trigger mode based on settings
    if (messages.length === 0 && !settingsApplied) {
      setSettingsApplied(true);
      // Send the topic message first
      await sendMessage(trimmed);
      // Wait a moment, then auto-select the mode
      setTimeout(async () => {
        const modeAction = settings.mode === "quick" ? "mode_quick" : "mode_step";
        await triggerAction(modeAction);
        setRefreshTrigger((p) => p + 1);
      }, 500);
    } else {
      await sendMessage(trimmed);
    }

    setRefreshTrigger((p) => p + 1);
  }, [input, isStreaming, sendMessage, messages.length, settingsApplied, settings.mode, triggerAction]);

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
        setRefreshTrigger((p) => p + 1);
        setSettingsApplied(false);
        return;
      }
      await triggerAction(actionId);
      setRefreshTrigger((p) => p + 1);
    },
    [triggerAction, presentationLink, navigate, createSession],
  );

  // Handle new chat from sidebar
  const handleNewChat = useCallback(async () => {
    const newId = await createSession();
    navigate(`/chat/${newId}`, { replace: true });
    setRefreshTrigger((p) => p + 1);
    setSettingsApplied(false);
    setSettings(DEFAULT_SETTINGS);
  }, [createSession, navigate]);

  // Handle select session from sidebar
  const handleSelectSession = useCallback(
    (id: string) => {
      if (id !== sessionId) {
        navigate(`/chat/${id}`, { replace: true });
        setSettingsApplied(true); // Existing sessions already have settings
      }
    },
    [sessionId, navigate],
  );

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Filter out mode selection actions (they're handled by settings now)
  const filteredActions = useMemo(
    () => currentActions.filter((a) => a.id !== "mode_quick" && a.id !== "mode_step"),
    [currentActions],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <ChatSidebar
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
        refreshTrigger={refreshTrigger}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Empty state */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight mb-2 text-foreground">
                  Создайте презентацию
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Опишите тему — AI создаст структуру, контент и дизайн.
                  Настройте режим и тему через <Settings2 className="w-3.5 h-3.5 inline-block align-text-bottom" /> рядом с полем ввода.
                </p>
              </div>
            </div>
          ) : (
            /* Messages list */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
              ))}

              {/* Progress bar */}
              {progress && (
                <div className="pl-10">
                  <ProgressBar percent={progress.percent} message={progress.message} />
                </div>
              )}

              {/* Action buttons (filtered — no mode buttons) */}
              {!isStreaming && filteredActions.length > 0 && (
                <div className="pl-10">
                  <ActionButtons
                    actions={filteredActions}
                    onAction={handleAction}
                    disabled={isStreaming}
                  />
                </div>
              )}

              {/* Presentation link */}
              {presentationLink && !isStreaming && (
                <div className="pl-10">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(`/view/${presentationLink.presentationId}`)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Открыть презентацию
                    {presentationLink.slideCount && (
                      <span className="opacity-70 text-[10px]">
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

        {/* Input area with settings toolbar */}
        <div className="border-t border-border bg-background">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="relative">
              {/* Settings panel (dropdown) */}
              {showSettings && (
                <SettingsPanel
                  settings={settings}
                  onChange={setSettings}
                  onClose={() => setShowSettings(false)}
                />
              )}

              {/* Settings chips (shown when non-default settings are active) */}
              {!settingsApplied && <SettingsChips settings={settings} />}

              {/* Input row */}
              <div className="flex gap-2 items-end">
                {/* Settings toggle button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings((p) => !p)}
                  className={`h-10 w-10 shrink-0 rounded-xl transition-colors ${
                    showSettings
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  title="Настройки генерации"
                  disabled={settingsApplied}
                >
                  <Settings2 className="w-4.5 h-4.5" />
                </Button>

                {/* Textarea */}
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      hasMessages
                        ? "Напишите сообщение..."
                        : "Опишите тему презентации..."
                    }
                    disabled={isStreaming}
                    className="min-h-[44px] max-h-[160px] resize-none bg-secondary/40 border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 text-sm leading-relaxed rounded-xl pr-4"
                    rows={1}
                  />
                </div>

                {/* Send / Stop button */}
                {isStreaming ? (
                  <Button
                    onClick={cancelStream}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                    title="Остановить"
                  >
                    <StopCircle className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-30"
                    title="Отправить (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>

            </div>

            <p className="text-[10px] text-center text-muted-foreground/50 mt-2">
              Enter — отправить · Shift+Enter — новая строка
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
