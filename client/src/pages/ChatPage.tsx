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
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Upload,
  Trash2,
  Loader2,
  FileUp,
  LayoutTemplate,
  Layers,
  Maximize2,
  Copy,
  ClipboardCheck,
  MessageSquare,
  MessageSquarePlus,
  Quote,
  Highlighter,
  StickyNote,
} from "lucide-react";
import { useSSEChat, type ChatMessage, type ChatAction, type SlidePreview, type SlideProgress, type MessageComment, type MessageAnnotation } from "@/hooks/useSSEChat";
import ChatSidebar from "@/components/ChatSidebar";
import FileUploadButton, { FileChips, validateFiles, type AttachedFile } from "@/components/FileUploadButton";
import api, { type CustomTemplateListItem } from "@/lib/api";
import { THEME_PRESETS, THEME_CATEGORIES } from "@/lib/constants";
import { Streamdown } from 'streamdown';

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
  themePreset: "bspb_corporate",
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

function StreamingText({ content, isStreaming, isUser, annotations }: { content: string; isStreaming?: boolean; isUser?: boolean; annotations?: MessageAnnotation[] }) {
  // Show typing indicator when streaming but no content yet
  if (isStreaming && !content) {
    return <TypingIndicator />;
  }

  // If there are annotations and not streaming, render with highlights
  if (annotations && annotations.length > 0 && !isStreaming) {
    return (
      <div className={`leading-relaxed text-sm ${isUser ? 'chat-md-user' : 'chat-md-ai'}`}>
        <AnnotatedContent content={content} annotations={annotations} isUser={isUser} />
      </div>
    );
  }

  return (
    <div className={`leading-relaxed text-sm ${isUser ? 'chat-md-user' : 'chat-md-ai'}`}>
      <Streamdown>{content}</Streamdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm" />
      )}
    </div>
  );
}

/**
 * AnnotatedContent — renders message content with highlighted annotation fragments.
 * Each annotated fragment gets a colored background and a tooltip on hover.
 */
function AnnotatedContent({ content, annotations, isUser }: { content: string; annotations: MessageAnnotation[]; isUser?: boolean }) {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Build segments: split content into annotated and non-annotated parts
  const segments = useMemo(() => {
    if (!annotations.length) return [{ text: content, annotation: null }];

    // Sort annotations by their position in the text (find by text match)
    const positioned = annotations.map(a => {
      const idx = content.indexOf(a.selectedText);
      return { ...a, foundAt: idx };
    }).filter(a => a.foundAt >= 0).sort((a, b) => a.foundAt - b.foundAt);

    if (!positioned.length) return [{ text: content, annotation: null }];

    const result: { text: string; annotation: MessageAnnotation | null }[] = [];
    let cursor = 0;

    for (const ann of positioned) {
      // Skip overlapping annotations
      if (ann.foundAt < cursor) continue;

      // Add non-annotated text before this annotation
      if (ann.foundAt > cursor) {
        result.push({ text: content.slice(cursor, ann.foundAt), annotation: null });
      }

      // Add annotated segment
      result.push({ text: ann.selectedText, annotation: ann });
      cursor = ann.foundAt + ann.selectedText.length;
    }

    // Add remaining text
    if (cursor < content.length) {
      result.push({ text: content.slice(cursor), annotation: null });
    }

    return result;
  }, [content, annotations]);

  return (
    <div className="relative">
      {segments.map((seg, i) => {
        if (!seg.annotation) {
          // Render non-annotated text with Streamdown
          return <Streamdown key={i}>{seg.text}</Streamdown>;
        }

        const ann = seg.annotation;
        const isHovered = hoveredAnnotation === ann.id;

        return (
          <span
            key={ann.id}
            className={`relative inline annotation-highlight cursor-help transition-colors duration-150 ${
              isUser
                ? "bg-amber-300/40 hover:bg-amber-300/60 border-b border-amber-300/80"
                : "bg-amber-200/50 hover:bg-amber-200/80 border-b border-amber-400/60"
            } rounded-sm px-0.5 -mx-0.5`}
            onMouseEnter={() => setHoveredAnnotation(ann.id)}
            onMouseLeave={() => setHoveredAnnotation(null)}
          >
            <Streamdown>{seg.text}</Streamdown>
            {/* Tooltip */}
            {isHovered && (
              <div
                ref={tooltipRef}
                className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-foreground text-background text-xs shadow-lg max-w-[280px] whitespace-normal pointer-events-none"
                style={{ minWidth: 120 }}
              >
                <div className="flex items-start gap-1.5">
                  <StickyNote className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{ann.note}</span>
                </div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-foreground" />
              </div>
            )}
          </span>
        );
      })}
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
// SLIDE PROGRESS BAR
// ═══════════════════════════════════════════════════════

function SlideProgressBar({ progress }: { progress: SlideProgress }) {
  const { currentSlide, totalSlides, phase, slideTitle } = progress;
  const phaseLabel = phase === "content" ? "Контент" : "Дизайн";
  const completedSlides = currentSlide - 1;
  const progressPercent = Math.round((completedSlides / totalSlides) * 100);

  return (
    <div className="my-4 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">
              Слайд {currentSlide} из {totalSlides}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              «{slideTitle}»
            </span>
          </div>
        </div>
        <span className={
          `text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
            phase === "content"
              ? "bg-blue-500/10 text-blue-600"
              : "bg-violet-500/10 text-violet-600"
          }`
        }>
          {phaseLabel}
        </span>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSlides }, (_, i) => {
          const slideNum = i + 1;
          const isCompleted = slideNum < currentSlide;
          const isCurrent = slideNum === currentSlide;
          return (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: isCompleted
                  ? "oklch(0.65 0.19 260)"  /* primary completed */
                  : isCurrent
                    ? phase === "content"
                      ? "oklch(0.65 0.19 260 / 0.5)"  /* half-progress for content */
                      : "oklch(0.65 0.19 260 / 0.75)"  /* more progress for design */
                    : "oklch(0.92 0.01 260)",  /* muted for future */
              }}
            />
          );
        })}
      </div>

      {/* Bottom label */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {phase === "content"
            ? "Разработка контента → утвердите или отредактируйте"
            : "Разработка дизайна → утвердите или отредактируйте"}
        </span>
        <span className="font-mono">{progressPercent}%</span>
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
  const [clickedId, setClickedId] = useState<string | null>(null);

  if (!actions.length) return null;

  const handleClick = (id: string) => {
    setClickedId(id);
    onAction(id);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant === "outline" ? "outline" : "default"}
          size="sm"
          onClick={() => handleClick(action.id)}
          disabled={disabled || clickedId !== null}
          className="text-xs gap-1.5"
        >
          {clickedId === action.id && (
            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          )}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEW CARD
// ═══════════════════════════════════════════════════════

/**
 * Prepare slide HTML for iframe rendering.
 * Handles both full documents and fragments.
 */
function prepareSlideHtml(html: string): string {
  const isFullDoc = html.trimStart().startsWith('<!DOCTYPE') || html.trimStart().startsWith('<html');
  if (isFullDoc) {
    const overrideCss = `<style>body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important;display:block!important;gap:0!important;}.slide-container{margin:0!important;}.slide-number{display:none!important;}</style>`;
    return html.replace('</head>', `${overrideCss}</head>`);
  }
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1280" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  .slide { width: 1280px; height: 720px; overflow: hidden; }
</style>
</head>
<body><div class="slide">${html}</div></body></html>`;
}

function SlidePreviewCard({ preview, onClick }: { preview: SlidePreview; onClick?: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && preview.html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(prepareSlideHtml(preview.html));
        doc.close();
      }
    }
  }, [preview.html]);

  return (
    <div
      className="group relative rounded-lg border border-border bg-white cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/30 shrink-0"
      style={{ width: 320, height: 180, overflow: "hidden" }}
      onClick={onClick}
    >
      <iframe
        ref={iframeRef}
        className="pointer-events-none"
        style={{
          width: "1280px",
          height: "720px",
          transform: "scale(0.25)",
          transformOrigin: "top left",
          border: "none",
          display: "block",
        }}
        sandbox="allow-same-origin"
        title={`Slide ${preview.slideNumber}`}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
        <span className="text-[10px] text-white font-medium">
          Слайд {preview.slideNumber}{preview.title && preview.title !== `Слайд ${preview.slideNumber}` ? ` — ${preview.title}` : ""}
        </span>
      </div>
      {/* Expand icon on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/50 rounded-md p-1">
          <Maximize2 className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FULLSCREEN SLIDE LIGHTBOX
// ═══════════════════════════════════════════════════════

function FullscreenSlideLightbox({
  previews,
  initialIndex,
  onClose,
}: {
  previews: SlidePreview[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const current = previews[currentIndex];
  const total = previews.length;

  // Write HTML to iframe when slide changes
  useEffect(() => {
    if (iframeRef.current && current?.html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(prepareSlideHtml(current.html));
        doc.close();
      }
    }
  }, [currentIndex, current?.html]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setCurrentIndex((prev) => Math.min(prev + 1, total - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, total]);

  // Calculate scale to fit viewport
  const viewW = typeof window !== "undefined" ? window.innerWidth - 120 : 1280;
  const viewH = typeof window !== "undefined" ? window.innerHeight - 120 : 720;
  const scale = Math.min(viewW / 1280, viewH / 720);
  const displayW = 1280 * scale;
  const displayH = 720 * scale;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Slide counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-3">
          <span className="text-sm text-white font-mono">
            <span className="text-white font-semibold">{currentIndex + 1}</span>
            <span className="text-white/50"> / {total}</span>
          </span>
        </div>
      </div>

      {/* Slide title */}
      {current?.title && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 max-w-lg">
            <span className="text-sm text-white/90">
              Слайд {current.slideNumber}{current.title !== `Слайд ${current.slideNumber}` ? ` — ${current.title}` : ""}
            </span>
          </div>
        </div>
      )}

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((prev) => prev - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6 text-white/80" />
        </button>
      )}
      {currentIndex < total - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((prev) => prev + 1);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6 text-white/80" />
        </button>
      )}

      {/* Slide iframe */}
      <div
        className="rounded-lg overflow-hidden shadow-2xl bg-white"
        style={{ width: displayW, height: displayH }}
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          ref={iframeRef}
          className="pointer-events-none"
          style={{
            width: "1280px",
            height: "720px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: "none",
            display: "block",
          }}
          sandbox="allow-same-origin allow-scripts"
          title={`Slide ${current?.slideNumber || currentIndex + 1}`}
        />
      </div>

      {/* Bottom thumbnail strip */}
      {total > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 flex gap-2 max-w-[80vw] overflow-x-auto">
            {previews.map((p, i) => (
              <button
                key={`thumb-${p.slideNumber}-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`w-16 h-9 rounded border-2 transition-all shrink-0 ${
                  i === currentIndex
                    ? "border-primary shadow-md shadow-primary/30"
                    : "border-white/20 hover:border-white/40 opacity-60 hover:opacity-100"
                }`}
                style={{
                  background: `linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))`,
                }}
              >
                <span className="text-[9px] text-white font-mono">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEWS GALLERY
// ═══════════════════════════════════════════════════════

function SlidePreviewsGallery({ previews }: { previews: SlidePreview[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!previews || previews.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-2">
        Превью слайдов ({previews.length})
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {previews.map((preview, i) => (
          <SlidePreviewCard
            key={`${preview.slideNumber}-${i}`}
            preview={preview}
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      {/* Fullscreen lightbox */}
      {lightboxIndex !== null && (
        <FullscreenSlideLightbox
          previews={previews}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLIDE PREVIEWS GALLERY WITH COMMENTS
// ═══════════════════════════════════════════════════════

function SlidePreviewsGalleryWithComments({
  previews,
  slideComments,
  sessionId,
  messageIndex,
  onSlideCommentsUpdate,
  onQuoteSlide,
  presentationId,
}: {
  previews: SlidePreview[];
  slideComments?: Record<number, MessageComment[]>;
  sessionId: string | null;
  messageIndex: number;
  onSlideCommentsUpdate: (messageIndex: number, slideNumber: number, comments: MessageComment[]) => void;
  onQuoteSlide: (slideNumber: number, slideTitle: string, slideHtml: string) => void;
  presentationId?: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [, navigate] = useLocation();

  if (!previews || previews.length === 0) return null;

  const coverSlide = previews[0];
  const totalSlides = previews.length;

  const handleOpenViewer = () => {
    if (presentationId) {
      navigate(`/view/${presentationId}?from=chat/${sessionId}`);
    } else {
      // Fallback: open lightbox if no presentationId
      setLightboxIndex(0);
    }
  };

  return (
    <div className="mt-3">
      {/* Cover slide card — only the first slide */}
      <div
        className="group relative rounded-xl border border-border bg-white cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/30 overflow-hidden"
        style={{ width: 420, height: 236 }}
        onClick={handleOpenViewer}
      >
        {/* Iframe preview of first slide */}
        <CoverSlideIframe html={coverSlide.html} />

        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              {coverSlide.title && coverSlide.title !== `Слайд 1` && (
                <div className="text-xs text-white/90 font-medium mb-0.5 line-clamp-1">
                  {coverSlide.title}
                </div>
              )}
              <div className="text-[10px] text-white/60 font-mono">
                {totalSlides} {totalSlides === 1 ? 'слайд' : totalSlides < 5 ? 'слайда' : 'слайдов'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/80 group-hover:text-white transition-colors">
              <span className="text-[11px] font-medium">Открыть</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Hover expand icon */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-1.5">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Slide count badge */}
        <div className="absolute top-3 left-3">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-white/80" />
            <span className="text-[11px] text-white font-medium">{totalSlides}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen lightbox — still available for browsing all slides */}
      {lightboxIndex !== null && (
        <FullscreenSlideLightbox
          previews={previews}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/** Renders the first slide HTML in an iframe for the cover card */
function CoverSlideIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(prepareSlideHtml(html));
        doc.close();
      }
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="pointer-events-none"
      style={{
        width: "1280px",
        height: "720px",
        transform: "scale(0.328125)",
        transformOrigin: "top left",
        border: "none",
        display: "block",
      }}
      sandbox="allow-same-origin"
      title="Cover slide"
    />
  );
}

// ═══════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════

function MessageBubble({
  message,
  messageIndex,
  sessionId,
  onCommentsUpdate,
  onSlideCommentsUpdate,
  onAnnotationsUpdate,
  onQuoteReply,
  onQuoteSlide,
  previousMessage,
  presentationId,
}: {
  message: ChatMessage;
  messageIndex: number;
  sessionId: string | null;
  onCommentsUpdate: (messageIndex: number, comments: MessageComment[]) => void;
  onSlideCommentsUpdate: (messageIndex: number, slideNumber: number, comments: MessageComment[]) => void;
  onAnnotationsUpdate: (messageIndex: number, annotations: MessageAnnotation[]) => void;
  onQuoteReply: (text: string) => void;
  onQuoteSlide: (slideNumber: number, slideTitle: string, slideHtml: string) => void;
  previousMessage?: ChatMessage;
  presentationId?: string;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Text selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number; y: number; text: string;
  } | null>(null);
  // Annotation input state
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [annotationNote, setAnnotationNote] = useState("");
  const [annotationSelectedText, setAnnotationSelectedText] = useState("");
  const annotationInputRef = useRef<HTMLInputElement>(null);
  // Active annotation tooltip
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }, [message.content]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await api.addMessageComment(sessionId, messageIndex, commentText.trim());
      onCommentsUpdate(messageIndex, result.comments);
      setCommentText("");
      setShowCommentInput(false);
    } catch {
      toast.error("Не удалось добавить комментарий");
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, sessionId, messageIndex, isSubmitting, onCommentsUpdate]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!sessionId) return;
    try {
      await api.deleteMessageComment(sessionId, messageIndex, commentId);
      const updated = (message.comments || []).filter(c => c.id !== commentId);
      onCommentsUpdate(messageIndex, updated);
    } catch {
      toast.error("Не удалось удалить комментарий");
    }
  }, [sessionId, messageIndex, message.comments, onCommentsUpdate]);

  useEffect(() => {
    if (showCommentInput && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [showCommentInput]);

  useEffect(() => {
    if (showAnnotationInput && annotationInputRef.current) {
      annotationInputRef.current.focus();
    }
  }, [showAnnotationInput]);

  // Handle text selection within the bubble
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !bubbleRef.current) {
      return;
    }
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    // Check if selection is within this bubble
    const range = selection.getRangeAt(0);
    if (!bubbleRef.current.contains(range.commonAncestorContainer)) return;

    // Get position for popup
    const rect = range.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    setSelectionPopup({
      x: rect.left - bubbleRect.left + rect.width / 2,
      y: rect.top - bubbleRect.top - 8,
      text: selectedText,
    });
  }, []);

  // Close selection popup when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      // Small delay to allow button clicks to register
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          setSelectionPopup(null);
        }
      }, 200);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle quote reply
  const handleQuote = useCallback(() => {
    if (!selectionPopup) return;
    onQuoteReply(selectionPopup.text);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopup, onQuoteReply]);

  // Handle start annotation
  const handleStartAnnotation = useCallback(() => {
    if (!selectionPopup) return;
    setAnnotationSelectedText(selectionPopup.text);
    setShowAnnotationInput(true);
    setAnnotationNote("");
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopup]);

  // Handle add annotation
  const handleAddAnnotation = useCallback(async () => {
    if (!annotationNote.trim() || !sessionId || isSubmitting || !annotationSelectedText) return;
    setIsSubmitting(true);
    try {
      // Find offset in content
      const startOffset = message.content.indexOf(annotationSelectedText);
      const endOffset = startOffset >= 0 ? startOffset + annotationSelectedText.length : 0;
      const result = await api.addAnnotation(
        sessionId, messageIndex, annotationSelectedText, annotationNote.trim(), startOffset, endOffset
      );
      onAnnotationsUpdate(messageIndex, result.annotations);
      setAnnotationNote("");
      setAnnotationSelectedText("");
      setShowAnnotationInput(false);
    } catch {
      toast.error("Не удалось добавить аннотацию");
    } finally {
      setIsSubmitting(false);
    }
  }, [annotationNote, sessionId, messageIndex, isSubmitting, annotationSelectedText, message.content, onAnnotationsUpdate]);

  // Handle delete annotation
  const handleDeleteAnnotation = useCallback(async (annotationId: string) => {
    if (!sessionId) return;
    try {
      await api.deleteAnnotation(sessionId, messageIndex, annotationId);
      const updated = (message.annotations || []).filter(a => a.id !== annotationId);
      onAnnotationsUpdate(messageIndex, updated);
    } catch {
      toast.error("Не удалось удалить аннотацию");
    }
  }, [sessionId, messageIndex, message.annotations, onAnnotationsUpdate]);

  const comments = message.comments || [];
  const hasComments = comments.length > 0;
  const annotations = message.annotations || [];
  const hasAnnotations = annotations.length > 0;

  return (
    <div className={`group/msg flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
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

        <div className="relative" ref={bubbleRef} onMouseUp={handleMouseUp}>
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-secondary/60 text-foreground rounded-bl-md"
            }`}
          >
            <StreamingText content={message.content} isStreaming={message.isStreaming} isUser={isUser} annotations={message.annotations} />
          </div>

          {/* Text selection popup */}
          {selectionPopup && !message.isStreaming && (
            <div
              className="absolute z-50 flex items-center gap-0.5 bg-background border border-border rounded-lg shadow-lg px-1 py-0.5 -translate-x-1/2"
              style={{ left: selectionPopup.x, top: selectionPopup.y }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                onClick={handleQuote}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-primary/10 text-foreground transition-colors"
                title="Цитировать"
              >
                <Quote className="w-3 h-3 text-primary" />
                <span>Цитата</span>
              </button>
              {sessionId && (
                <button
                  onClick={handleStartAnnotation}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-amber-50 text-foreground transition-colors"
                  title="Добавить аннотацию"
                >
                  <Highlighter className="w-3 h-3 text-amber-500" />
                  <span>Заметка</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (selectionPopup) {
                    navigator.clipboard.writeText(selectionPopup.text);
                    toast.success("Скопировано");
                    setSelectionPopup(null);
                    window.getSelection()?.removeAllRanges();
                  }
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-secondary text-foreground transition-colors"
                title="Скопировать фрагмент"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Action buttons — appear on hover */}
          {!message.isStreaming && message.content && (
            <div
              className={`absolute flex gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 ${
                isUser
                  ? "-left-20 top-1"
                  : "-right-20 top-1"
              }`}
            >
              <button
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-black/5 text-muted-foreground hover:text-foreground"
                title="Скопировать текст"
              >
                {copied ? (
                  <ClipboardCheck className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => onQuoteReply(message.content)}
                className="p-1 rounded-md hover:bg-black/5 text-muted-foreground hover:text-foreground"
                title="Цитировать всё сообщение"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              {sessionId && (
                <button
                  onClick={() => setShowCommentInput(!showCommentInput)}
                  className={`p-1 rounded-md hover:bg-black/5 text-muted-foreground hover:text-foreground ${
                    hasComments ? "text-primary" : ""
                  }`}
                  title="Комментировать"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>


        {/* Comments section */}
        {(hasComments || showCommentInput) && (
          <div className={`mt-1.5 w-full ${isUser ? "pl-4" : "pr-4"}`}>
            {/* Existing comments */}
            {comments.map((c) => (
              <div
                key={c.id}
                className="group/comment flex items-start gap-2 py-1 px-2.5 rounded-lg bg-amber-50 border border-amber-200/60 mb-1 text-xs"
              >
                <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-foreground/80 flex-1 leading-relaxed">{c.text}</span>
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="opacity-0 group-hover/comment:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 shrink-0"
                  title="Удалить комментарий"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Comment input */}
            {showCommentInput && (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                    if (e.key === "Escape") {
                      setShowCommentInput(false);
                      setCommentText("");
                    }
                  }}
                  placeholder="Добавить комментарий..."
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || isSubmitting}
                  className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  title="Отправить"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => { setShowCommentInput(false); setCommentText(""); }}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                  title="Отмена"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Annotations section */}
        {(hasAnnotations || showAnnotationInput) && (
          <div className={`mt-1.5 w-full ${isUser ? "pl-4" : "pr-4"}`}>
            {/* Existing annotations */}
            {annotations.map((a) => (
              <div
                key={a.id}
                className="group/annotation mb-1 rounded-lg border border-amber-300/60 bg-amber-50/80 overflow-hidden"
                onMouseEnter={() => setActiveAnnotation(a.id)}
                onMouseLeave={() => setActiveAnnotation(null)}
              >
                {/* Highlighted text */}
                <div className="px-2.5 pt-1.5 pb-1">
                  <div className="flex items-start gap-1.5">
                    <Highlighter className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-foreground/60 italic line-clamp-2 leading-relaxed">
                      «{a.selectedText}»
                    </span>
                  </div>
                </div>
                {/* Note */}
                <div className="flex items-start gap-2 px-2.5 pb-1.5">
                  <StickyNote className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-foreground/80 flex-1 leading-relaxed">{a.note}</span>
                  <button
                    onClick={() => handleDeleteAnnotation(a.id)}
                    className="opacity-0 group-hover/annotation:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 shrink-0"
                    title="Удалить аннотацию"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Annotation input */}
            {showAnnotationInput && (
              <div className="mb-1 rounded-lg border border-amber-300/60 bg-amber-50/80 p-2.5">
                <div className="flex items-start gap-1.5 mb-2">
                  <Highlighter className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-foreground/60 italic line-clamp-2">
                    «{annotationSelectedText}»
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={annotationInputRef}
                    type="text"
                    value={annotationNote}
                    onChange={(e) => setAnnotationNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddAnnotation();
                      }
                      if (e.key === "Escape") {
                        setShowAnnotationInput(false);
                        setAnnotationNote("");
                        setAnnotationSelectedText("");
                      }
                    }}
                    placeholder="Ваша заметка..."
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-muted-foreground/50"
                    disabled={isSubmitting}
                  />
                  <button
                    onClick={handleAddAnnotation}
                    disabled={!annotationNote.trim() || isSubmitting}
                    className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                    title="Сохранить"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => { setShowAnnotationInput(false); setAnnotationNote(""); setAnnotationSelectedText(""); }}
                    className="p-1.5 rounded-lg hover:bg-amber-100 text-muted-foreground transition-colors"
                    title="Отмена"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Slide previews gallery */}
        {!isUser && message.slidePreviews && message.slidePreviews.length > 0 && (
          <SlidePreviewsGalleryWithComments
            previews={message.slidePreviews}
            slideComments={message.slideComments}
            sessionId={sessionId}
            messageIndex={messageIndex}
            onSlideCommentsUpdate={onSlideCommentsUpdate}
            onQuoteSlide={onQuoteSlide}
            presentationId={presentationId}
          />
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
  const [showGallery, setShowGallery] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<string>("all");

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
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[500px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Настройки генерации</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme Gallery */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">Тема дизайна</label>
          <button
            onClick={() => setShowGallery(!showGallery)}
            className="text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            {showGallery ? "Свернуть" : "Галерея"}
          </button>
        </div>

        {!showGallery ? (
          /* Compact view — small chips */
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
        ) : (
          /* Gallery view — visual preview cards */
          <div>
            {/* Category filter tabs */}
            <div className="flex gap-1 mb-3">
              {THEME_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setGalleryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] border transition-colors ${
                    galleryFilter === cat.id
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  {cat.nameRu}
                </button>
              ))}
            </div>

            {/* Auto option */}
            <button
              onClick={() => { clearCustomTemplate(); onChange({ ...settings, themePreset: "auto", customTemplateId: null, customTemplateName: null, customCssVariables: null, customFontsUrl: null }); }}
              className={`w-full mb-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                settings.themePreset === "auto" && !settings.customTemplateId
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-7 rounded bg-gradient-to-br from-blue-400 via-purple-400 to-orange-400 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-foreground">Автоматический выбор</div>
                  <div className="text-[10px] text-muted-foreground">AI подберёт тему под контент</div>
                </div>
              </div>
            </button>

            {/* Theme cards grid */}
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS
                .filter((t) => galleryFilter === "all" || t.category === galleryFilter)
                .map((t) => {
                  const isSelected = settings.themePreset === t.id && !settings.customTemplateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onChange({ ...settings, themePreset: t.id, customTemplateId: null, customTemplateName: null, customCssVariables: null, customFontsUrl: null })}
                      className={`group relative rounded-lg border-2 overflow-hidden transition-all text-left ${
                        isSelected
                          ? "border-primary shadow-md ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:shadow-sm"
                      }`}
                    >
                      {/* Gradient preview */}
                      <div
                        className="h-16 w-full relative"
                        style={{ background: t.gradient }}
                      >
                        {/* Mini slide mockup */}
                        <div className="absolute inset-2 flex flex-col justify-between">
                          <div className="flex gap-1">
                            <div className={`h-1 rounded-full ${t.dark ? 'bg-white/40' : 'bg-white/70'}`} style={{ width: '60%' }} />
                          </div>
                          <div className="flex gap-1">
                            <div className={`h-0.5 rounded-full ${t.dark ? 'bg-white/25' : 'bg-white/50'}`} style={{ width: '40%' }} />
                            <div className={`h-0.5 rounded-full ${t.dark ? 'bg-white/15' : 'bg-white/30'}`} style={{ width: '25%' }} />
                          </div>
                        </div>
                        {/* Selected checkmark */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2">
                        <div className="text-[11px] font-medium text-foreground truncate">{t.nameRu}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{t.descRu}</div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
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
    slideProgress,
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
    updateMessageComments,
    updateSlideComments,
    updateAnnotations,
  } = useSSEChat();

  // Quote-reply state
  const [quoteReply, setQuoteReply] = useState<{ text: string; messageIndex: number } | null>(null);

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
          toast.error("Чат не найден или был удалён");
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
  }, [messages, progress, slideProgress]);

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
    const messageToSend = trimmed;
    const currentQuote = quoteReply;
    setInput("");
    setQuoteReply(null);
    setShowSettings(false);
    const filesToUpload = [...attachedFiles];

    // If no session yet (fresh /chat page), create one first
    if (!sessionId) {
      const newId = await createSession();
      // Set flag BEFORE navigate to prevent the useEffect from calling loadSession
      justCreatedSessionRef.current = true;
      navigate(`/chat/${newId}`, { replace: true });

      // Apply settings metadata to the session before first message
      try {
        await api.setSessionMetadata(newId, {
          slideCount: settings.slideCount,
          themePreset: settings.themePreset,
          ...(settings.customTemplateId ? {
            customTemplateId: settings.customTemplateId,
            customCssVariables: settings.customCssVariables || null,
            customFontsUrl: settings.customFontsUrl || null,
          } : {}),
        });
      } catch (err) {
        console.error("[ChatPage] Failed to set session metadata:", err);
      }

      // Upload files first if any
      if (filesToUpload.length > 0) {
        await uploadFilesToSession(newId, filesToUpload);
        // Wait a bit for text extraction to start
        await new Promise(r => setTimeout(r, 1500));
      }

      // Send message directly with the newId — don't rely on pendingMessageRef
      // because the useEffect may fire before pendingMessageRef is set (race condition)
      await sendMessage(messageToSend, newId, currentQuote || undefined);
      setRefreshTrigger((p) => p + 1);
      return;
    }

    // Upload files first if any
    if (filesToUpload.length > 0) {
      await uploadFilesToSession(sessionId, filesToUpload);
      // Wait a bit for text extraction to start
      await new Promise(r => setTimeout(r, 1500));
    }

    await sendMessage(messageToSend, sessionId, currentQuote || undefined);
    setRefreshTrigger((p) => p + 1);
  }, [input, isStreaming, isUploading, sendMessage, sessionId, createSession, navigate, attachedFiles, uploadFilesToSession, settings, quoteReply]);

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
      sendMessage(msg, sessionId).then(() => setRefreshTrigger((p) => p + 1)).catch(console.error);
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
  // Filter out view_presentation and new_presentation from actions when presentationLink exists,
  // since they are shown as dedicated buttons in the presentationLink section below
  const filteredActions = presentationLink
    ? currentActions.filter(a => a.id !== "view_presentation" && a.id !== "new_presentation")
    : currentActions;

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
                <MessageBubble
                  key={`${msg.timestamp}-${i}`}
                  message={msg}
                  messageIndex={i}
                  sessionId={sessionId}
                  onCommentsUpdate={updateMessageComments}
                  onSlideCommentsUpdate={updateSlideComments}
                  onAnnotationsUpdate={updateAnnotations}
                  onQuoteReply={(text) => {
                    setQuoteReply({ text, messageIndex: i });
                    textareaRef.current?.focus();
                  }}
                  onQuoteSlide={(slideNumber, slideTitle, slideHtml) => {
                    const slideRef = `[Слайд ${slideNumber}: ${slideTitle}]`;
                    setQuoteReply({ text: slideRef, messageIndex: i });
                    textareaRef.current?.focus();
                  }}
                  previousMessage={i > 0 ? messages[i - 1] : undefined}
                  presentationId={presentationLink?.presentationId}
                />
              ))}

              {/* Slide progress indicator */}
              {slideProgress && (
                <div className="pl-10">
                  <SlideProgressBar progress={slideProgress} />
                </div>
              )}

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

              {/* Presentation link — single button, no duplication with actions */}
              {presentationLink && !isStreaming && (
                <div className="pl-10 flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 text-xs"
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
                  {/* Show "Create new" alongside if available */}
                  {currentActions.filter(a => a.id === "new_presentation").map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => handleAction(action.id)}
                    >
                      {action.label}
                    </Button>
                  ))}
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

              {/* Quote reply preview */}
              {quoteReply && (
                <div className="mb-2 flex items-start gap-2 px-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
                  <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary font-medium uppercase tracking-wider mb-0.5">Цитата</p>
                    <p className="text-xs text-foreground/70 line-clamp-3 leading-relaxed">{quoteReply.text}</p>
                  </div>
                  <button
                    onClick={() => setQuoteReply(null)}
                    className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground shrink-0"
                    title="Убрать цитату"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
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
