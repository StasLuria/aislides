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
  Upload,
  Trash2,
  Loader2,
  FileUp,
  LayoutTemplate,
} from "lucide-react";
import { useSSEChat, type ChatMessage, type ChatAction, type SlidePreview } from "@/hooks/useSSEChat";
import ChatSidebar from "@/components/ChatSidebar";
import FileUploadButton, { FileChips, validateFiles, type AttachedFile } from "@/components/FileUploadButton";
import api, { type CustomTemplateListItem } from "@/lib/api";
import { THEME_PRESETS } from "@/lib/constants";

// ═══════════════════════════════════════════════════════
// SETTINGS TYPES
// ═══════════════════════════════════════════════════════

interface ChatSettings {
  mode: "quick" | "step";
  themePreset: string;
  slideCount: number;
  /** Custom template ID (when user selects their own template) */
  customTemplateId?: string | null;
  customTemplateName?: string | null;
  customCssVariables?: string | null;
  customFontsUrl?: string | null;
}

const DEFAULT_SETTINGS: ChatSettings = {
  mode: "quick",
  themePreset: "auto",
  slideCount: 10,
  customTemplateId: null,
  customTemplateName: null,
  customCssVariables: null,
  customFontsUrl: null,
};

const SETTINGS_STORAGE_KEY = "ai-slides-settings";

/** Load saved settings from localStorage, falling back to defaults */
function loadSavedSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === "quick" || parsed.mode === "step" ? parsed.mode : DEFAULT_SETTINGS.mode,
      themePreset: typeof parsed.themePreset === "string" ? parsed.themePreset : DEFAULT_SETTINGS.themePreset,
      slideCount: typeof parsed.slideCount === "number" && parsed.slideCount >= 5 && parsed.slideCount <= 20
        ? parsed.slideCount : DEFAULT_SETTINGS.slideCount,
      // Don't restore custom template — it may have been deleted
      customTemplateId: null,
      customTemplateName: null,
      customCssVariables: null,
      customFontsUrl: null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Save core settings (mode, theme, slideCount) to localStorage */
function saveSettings(s: ChatSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      mode: s.mode,
      themePreset: s.themePreset,
      slideCount: s.slideCount,
    }));
  } catch {}
}

// ═══════════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════════

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-muted-foreground">AI думает</span>
      <span className="flex items-center gap-[3px]">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1.2s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1.2s" }} />
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// STREAMING TEXT
// ═══════════════════════════════════════════════════════

function StreamingText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  // Show typing indicator when streaming but no content yet
  if (isStreaming && !content) {
    return <TypingIndicator />;
  }

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

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action) => (
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
        {/* Attached files */}
        {message.files && message.files.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mb-1.5 ${isUser ? "justify-end" : "justify-start"}`}>
            {message.files.map((f) => (
              <a
                key={f.fileId}
                href={f.s3Url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors hover:opacity-80 ${
                  isUser
                    ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
                    : "bg-secondary border-border text-foreground"
                }`}
              >
                {f.mimeType.startsWith("image/") ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                )}
                <span className="max-w-[120px] truncate font-medium">{f.filename}</span>
              </a>
            ))}
          </div>
        )}

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
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom templates on mount
  useEffect(() => {
    setLoadingTemplates(true);
    api.listTemplates()
      .then((templates) => setCustomTemplates(templates.filter(t => t.status === "ready")))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await api.uploadTemplate(file, undefined, (p) => setUploadProgress(p));
      toast.success(`Шаблон "${result.name}" загружен и анализируется`);
      // Refresh templates list after a delay (analysis takes time)
      setTimeout(async () => {
        const templates = await api.listTemplates();
        setCustomTemplates(templates.filter(t => t.status === "ready"));
      }, 5000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Ошибка загрузки шаблона");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await api.deleteTemplate(templateId);
      setCustomTemplates(prev => prev.filter(t => t.template_id !== templateId));
      if (settings.customTemplateId === templateId) {
        onChange({ ...settings, themePreset: "auto", customTemplateId: null, customTemplateName: null, customCssVariables: null, customFontsUrl: null });
      }
      toast.success("Шаблон удалён");
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const selectCustomTemplate = (template: CustomTemplateListItem) => {
    onChange({
      ...settings,
      themePreset: "custom",
      customTemplateId: template.template_id,
      customTemplateName: template.name,
      customCssVariables: template.css_variables || null,
      customFontsUrl: template.fonts_url || null,
    });
  };

  const clearCustomTemplate = () => {
    onChange({
      ...settings,
      themePreset: "auto",
      customTemplateId: null,
      customTemplateName: null,
      customCssVariables: null,
      customFontsUrl: null,
    });
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[400px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Настройки генерации</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-2 block">Тема дизайна</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { clearCustomTemplate(); onChange({ ...settings, themePreset: "auto", customTemplateId: null, customTemplateName: null, customCssVariables: null, customFontsUrl: null }); }}
            className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
              settings.themePreset === "auto" && !settings.customTemplateId
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            Авто
          </button>
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange({ ...settings, themePreset: t.id, customTemplateId: null, customTemplateName: null, customCssVariables: null, customFontsUrl: null })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                settings.themePreset === t.id && !settings.customTemplateId
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

      {/* Custom Templates */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <LayoutTemplate className="w-3 h-3" />
            Мои шаблоны
          </label>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,.html,.htm"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors cursor-pointer">
              {uploading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {uploadProgress}%</>
              ) : (
                <><Upload className="w-3 h-3" /> Загрузить</>
              )}
            </span>
          </label>
        </div>

        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Загрузка шаблонов...
          </div>
        ) : customTemplates.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/60 py-2">
            Нет загруженных шаблонов. Загрузите PPTX или HTML файл.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {customTemplates.map((t) => (
              <div key={t.template_id} className="group relative">
                <button
                  onClick={() => selectCustomTemplate(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors pr-6 ${
                    settings.customTemplateId === t.template_id
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  {t.color_palette && t.color_palette.length > 0 ? (
                    <span className="flex -space-x-0.5">
                      {t.color_palette.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="w-2.5 h-2.5 rounded-full border border-white/50"
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </span>
                  ) : (
                    <LayoutTemplate className="w-3 h-3" />
                  )}
                  {t.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.template_id); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Удалить шаблон"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
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

  // Mode is selected via chat buttons, not settings

  if (settings.customTemplateId && settings.customTemplateName) {
    chips.push({
      label: `Шаблон: ${settings.customTemplateName}`,
      icon: <LayoutTemplate className="w-3 h-3" />,
    });
  } else if (settings.themePreset !== "auto") {
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
  const [settings, setSettingsRaw] = useState<ChatSettings>(() => loadSavedSettings());
  const setSettings = useCallback((s: ChatSettings | ((prev: ChatSettings) => ChatSettings)) => {
    setSettingsRaw((prev) => {
      const next = typeof s === "function" ? s(prev) : s;
      saveSettings(next);
      return next;
    });
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsApplied, setSettingsApplied] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Flag to prevent loadSession from racing with sendMessage after createSession
  const justCreatedSessionRef = useRef(false);

  const {
    messages,
    sessionId,
    isStreaming,
    isPolling,
    progress,
    currentActions,
    presentationLink,
    sessionTitle,
    error,
    resetSession,
    createSession,
    loadSession,
    sendMessage,
    triggerAction,
    cancelStream,
  } = useSSEChat();

  // Initialize session — only load if URL has an ID, otherwise reset to empty state
  // IMPORTANT: Skip loadSession when we just created the session (to avoid race condition
  // where loadSession wipes messages that sendMessage is about to add)
  useEffect(() => {
    if (params.id) {
      if (justCreatedSessionRef.current) {
        // Session was just created by handleSend — skip loadSession,
        // let the pendingMessage effect handle sending the first message
        justCreatedSessionRef.current = false;
        return;
      }
      loadSession(params.id).catch((err) => {
        if (err?.message === "SESSION_NOT_FOUND") {
          // Session was deleted or doesn't exist — redirect to fresh chat
          console.warn(`[ChatPage] Session ${params.id} not found, redirecting to /chat`);
          navigate("/chat", { replace: true });
        } else {
          console.error(err);
        }
      });
    } else {
      // No ID in URL = fresh chat view, reset state
      // Session will be created lazily on first message (see handleSend)
      resetSession();
    }
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, progress]);

  // Upload attached files to a session
  const uploadFilesToSession = useCallback(async (sid: string, filesToUpload: AttachedFile[]) => {
    if (filesToUpload.length === 0) return;
    setIsUploading(true);
    // Mark all as uploading
    setAttachedFiles(prev => prev.map(f => ({ ...f, uploading: true })));
    try {
      const rawFiles = filesToUpload.map(f => f.file);
      await api.uploadChatFiles(sid, rawFiles);
      // Clear files after successful upload
      setAttachedFiles([]);
    } catch (err: any) {
      console.error("File upload failed:", err);
      toast.error("Не удалось загрузить файлы");
      setAttachedFiles(prev => prev.map(f => ({ ...f, uploading: false, error: "Ошибка загрузки" })));
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Handle send — creates session on first message if needed
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isUploading) return;
    setInput("");
    setShowSettings(false);
    const filesToUpload = [...attachedFiles];

    // If no session yet (fresh /chat page), create one first
    if (!sessionId) {
      const newId = await createSession();
      // Set flag BEFORE navigate to prevent the useEffect from calling loadSession
      justCreatedSessionRef.current = true;
      navigate(`/chat/${newId}`, { replace: true });

      // Apply custom template metadata to the session before first message
      if (settings.customTemplateId) {
        try {
          await api.setSessionTemplate(
            newId,
            settings.customTemplateId,
            settings.customCssVariables || undefined,
            settings.customFontsUrl || undefined,
          );
        } catch (err) {
          console.error("[ChatPage] Failed to set template on session:", err);
        }
      }

      // Upload files first if any, then send message
      if (filesToUpload.length > 0) {
        await uploadFilesToSession(newId, filesToUpload);
        // Wait a bit for text extraction to start
        await new Promise(r => setTimeout(r, 1500));
      }
      pendingMessageRef.current = trimmed;
      return;
    }

    // Upload files first if any
    if (filesToUpload.length > 0) {
      await uploadFilesToSession(sessionId, filesToUpload);
      // Wait a bit for text extraction to start
      await new Promise(r => setTimeout(r, 1500));
    }

    await sendMessage(trimmed);
    setRefreshTrigger((p) => p + 1);
  }, [input, isStreaming, isUploading, sendMessage, sessionId, createSession, navigate, attachedFiles, uploadFilesToSession, settings]);

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
        navigate(`/view/${presentationLink.presentationId}?from=chat/${sessionId}`);
        return;
      }
      if (actionId === "new_presentation") {
        navigate(`/chat`, { replace: true });
        setRefreshTrigger((p) => p + 1);
        setSettingsApplied(false);
        return;
      }
      await triggerAction(actionId);
      setRefreshTrigger((p) => p + 1);
    },
    [triggerAction, presentationLink, navigate, createSession],
  );

  // Handle pending message after session creation
  const pendingMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId && pendingMessageRef.current) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage(msg).then(() => setRefreshTrigger((p) => p + 1)).catch(console.error);
    }
  }, [sessionId, sendMessage]);

  // Handle new chat from sidebar — navigate to /chat without ID
  const handleNewChat = useCallback(async () => {
    navigate(`/chat`, { replace: true });
    setRefreshTrigger((p) => p + 1);
    setSettingsApplied(false);
    setSettingsRaw(loadSavedSettings());
    setAttachedFiles([]);
  }, [navigate]);

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

  // Show all action buttons including mode selection
  const filteredActions = currentActions;

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
        updatedTitle={sessionTitle}
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
                  {isPolling && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Соединение восстанавливается, генерация продолжается на сервере...
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
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
                    onClick={() => navigate(`/view/${presentationLink.presentationId}?from=chat/${sessionId}`)}
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

              {/* Input row with integrated file chips */}
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

                {/* File upload button */}
                <FileUploadButton
                  files={attachedFiles}
                  onFilesChange={setAttachedFiles}
                  disabled={isStreaming || isUploading}
                />

                {/* Unified input container: file chips on top + textarea below */}
                <div className="flex-1 relative">
                  <div className={`rounded-xl border bg-secondary/40 transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 ${
                    attachedFiles.length > 0 ? "border-border" : "border-border"
                  }`}>
                    {/* File chips inside the input box */}
                    {attachedFiles.length > 0 && (
                      <div className="pt-2.5 px-2 pb-1">
                        <FileChips
                          files={attachedFiles}
                          onRemove={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
                        />
                      </div>
                    )}
                    {/* Textarea */}
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        const files: File[] = [];
                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];
                          if (item.kind === "file") {
                            const file = item.getAsFile();
                            if (file) files.push(file);
                          }
                        }
                        if (files.length > 0) {
                          e.preventDefault();
                          const validated = validateFiles(files, attachedFiles.length);
                          if (validated.length > 0) {
                            setAttachedFiles(prev => [...prev, ...validated]);
                          }
                        }
                      }}
                      placeholder={
                        hasMessages
                          ? "Напишите сообщение..."
                          : "Опишите тему презентации..."
                      }
                      disabled={isStreaming}
                      className={`min-h-[44px] max-h-[160px] resize-none bg-transparent border-0 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed pr-4 ${
                        attachedFiles.length > 0 ? "pt-1" : ""
                      }`}
                      rows={1}
                    />
                  </div>
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
                    disabled={!input.trim() || isStreaming || isUploading}
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
              Enter — отправить · Shift+Enter — новая строка · 📎 или Ctrl+V — прикрепить файлы
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
