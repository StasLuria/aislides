/**
 * Viewer Page — Presentation Slide Viewer with Editing
 * Swiss Precision: Split layout with slide list (left), large preview (center),
 * and optional editor panel (right).
 * Keyboard navigation: Left/Right arrows, Escape to exit, E to toggle edit.
 *
 * Editing modes:
 *   - Inline: Click directly on slide text to edit in-place (default when editing)
 *   - Sidebar: Traditional form-based editor panel on the right
 *
 * Key fix: slides are 1280×720 fixed-size elements. We use CSS transform scale
 * to fit them into the viewport. Thumbnails use the same approach at a smaller scale.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Layers,
  ExternalLink,
  Pencil,
  PencilLine,
  PanelRightOpen,
  Save,
  Loader2,
  GripVertical,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "@/lib/api";
import type { PresentationDetail, SlideData, SlideEditResponse, InlineFieldPatchResponse, ReorderResponse } from "@/lib/api";
import SlideEditor from "@/components/SlideEditor";
import InlineEditableSlide from "@/components/InlineEditableSlide";

/**
 * Parse the full HTML presentation into individual slide HTML documents.
 * Each slide is a `.slide-container` wrapping a `.slide` (1280×720).
 * We extract the <head> styles and wrap each slide into a standalone HTML doc.
 */
function parseSlides(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Get all styles from head
  const headContent = doc.head.innerHTML;

  // Strategy: use regex to split on slide-container boundaries in the raw HTML.
  // This avoids DOM nesting issues caused by templates with unclosed divs,
  // where querySelectorAll would find nested containers or :scope > would
  // miss slides that got absorbed into a parent's DOM tree.
  const slideContainerRegex = /<div class="slide-container">/g;
  const matches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = slideContainerRegex.exec(html)) !== null) {
    matches.push(m.index);
  }

  if (matches.length > 1) {
    // Split the raw HTML at each slide-container boundary
    const rawSlides: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i];
      const end = i + 1 < matches.length ? matches[i + 1] : html.indexOf("</body>") !== -1 ? html.indexOf("</body>") : html.length;
      rawSlides.push(html.substring(start, end).trim());
    }

    // Extract Chart.js library and initialization scripts
    const scripts = doc.querySelectorAll("script");
    let chartLibScript = "";
    const chartInitScripts: string[] = [];
    scripts.forEach((s) => {
      if (s.src && s.src.includes("chart.js")) {
        chartLibScript = `<script src="${s.src}"><\/script>`;
      } else if (s.textContent && s.textContent.includes("new Chart")) {
        const initFns = s.textContent.match(/\(function\(\)[\s\S]*?\}\)\(\);/g) || [];
        chartInitScripts.push(...initFns);
      }
    });

    return rawSlides.map((slideHtml, idx) => {
      const hasCanvas = slideHtml.includes("<canvas");
      const chartInit = hasCanvas
        ? chartInitScripts.find((s) => s.includes(`chart-${idx}`))
        : null;

      return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8" />\n  ${headContent}\n  ${hasCanvas ? chartLibScript : ""}\n  <style>\n    html, body { margin: 0; padding: 0; overflow: hidden; width: 1280px; height: 720px; background: #fff; }\n    .slide-container { margin: 0 !important; padding: 0 !important; }\n    .slide-number { display: none !important; }\n  </style>\n</head>\n<body>${slideHtml}</body>\n</html>`;
    });
  }

  // Fallback: try DOM-based extraction for single-slide or non-standard formats
  let slideElements = doc.body.querySelectorAll(":scope > .slide-container");
  if (slideElements.length === 0) {
    slideElements = doc.body.querySelectorAll(".slide-container");
  }
  if (slideElements.length === 0) {
    slideElements = doc.body.querySelectorAll(".slide");
  }
  if (slideElements.length === 0) {
    slideElements = doc.body.querySelectorAll("[data-slide]");
  }

  if (slideElements.length > 0) {
    // Extract Chart.js library and initialization scripts from the original HTML
    const scripts = doc.querySelectorAll("script");
    let chartLibScript = "";
    const chartInitScripts: string[] = [];
    scripts.forEach((s) => {
      if (s.src && s.src.includes("chart.js")) {
        chartLibScript = `<script src="${s.src}"><\/script>`;
      } else if (s.textContent && s.textContent.includes("new Chart")) {
        // Extract individual chart init functions
        const initFns = s.textContent.match(/\(function\(\)[\s\S]*?\}\)\(\);/g) || [];
        chartInitScripts.push(...initFns);
      }
    });

    return Array.from(slideElements).map((el, idx) => {
      const hasCanvas = el.querySelector("canvas") !== null;
      // Find the chart init script that matches this slide's canvas id
      const chartInit = hasCanvas
        ? chartInitScripts.find((s) => s.includes(`chart-${idx}`))
        : null;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  ${headContent}
  ${hasCanvas ? chartLibScript : ""}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      width: 1280px;
      height: 720px;
      background: #fff;
    }
    .slide-container {
      margin: 0 !important;
      padding: 0 !important;
    }
    .slide-number {
      display: none !important;
    }
  </style>
</head>
<body>${el.outerHTML}${chartInit ? `<script>${chartInit}<\/script>` : ""}</body>
</html>`;
    });
  }

  // If no slide markers found, return the full HTML as a single slide
  return [html];
}

/**
 * SlideFrame — renders a single slide in a scaled iframe.
 * The slide is always 1280×720 internally, and we scale it down
 * to fit the container using CSS transform.
 */
function SlideFrame({
  html,
  containerWidth,
  containerHeight,
  className = "",
  interactive = false,
}: {
  html: string;
  containerWidth: number;
  containerHeight: number;
  className?: string;
  interactive?: boolean;
}) {
  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  const scale = Math.min(containerWidth / SLIDE_W, containerHeight / SLIDE_H);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
    >
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: Math.max(0, (containerHeight - SLIDE_H * scale) / 2),
          left: Math.max(0, (containerWidth - SLIDE_W * scale) / 2),
        }}
      >
        <iframe
          srcDoc={html}
          className="border-0"
          style={{ width: SLIDE_W, height: SLIDE_H }}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={interactive ? 0 : -1}
          title="Slide"
        />
        {!interactive && (
          <div className="absolute inset-0" style={{ pointerEvents: "all" }} />
        )}
      </div>
    </div>
  );
}

/**
 * SortableSlideThumb — a draggable thumbnail for the sidebar.
 * Uses @dnd-kit/sortable for drag-and-drop reordering.
 */
function SortableSlideThumb({
  id,
  index,
  isActive,
  hasSlides,
  slideHtml,
  thumbW,
  thumbH,
  onClick,
}: {
  id: string;
  index: number;
  isActive: boolean;
  hasSlides: boolean;
  slideHtml: string | undefined;
  thumbW: number;
  thumbH: number;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        w-full rounded-md overflow-hidden border-2 transition-colors
        ${isActive
          ? "border-primary shadow-md shadow-primary/20"
          : "border-border/30 hover:border-border/60"
        }
        ${isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}
      `}
    >
      <div className="flex items-center gap-1 p-1.5">
        {/* Drag handle */}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors touch-none"
          tabIndex={-1}
          aria-label={`Перетащить слайд ${index + 1}`}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button
          onClick={onClick}
          className="flex-1 rounded overflow-hidden bg-white cursor-pointer"
          style={{ width: thumbW, height: thumbH }}
        >
          {hasSlides && slideHtml ? (
            <SlideFrame
              html={slideHtml}
              containerWidth={thumbW}
              containerHeight={thumbH}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary/50">
              <Layers className="w-3 h-3 text-muted-foreground/30" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

type EditMode = "off" | "inline" | "sidebar";

export default function Viewer() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const presentationId = params.id || "";

  const [presentation, setPresentation] = useState<PresentationDetail | null>(null);
  const [slideHtmls, setSlideHtmls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fullHtml, setFullHtml] = useState<string | null>(null);

  // Editing state — now supports two modes
  const [editMode, setEditMode] = useState<EditMode>("off");
  const [slideDataList, setSlideDataList] = useState<SlideData[]>([]);
  const [hasEdits, setHasEdits] = useState(false);
  const [isReassembling, setIsReassembling] = useState(false);

  // Auto-save state
  type AutoSaveStatus = "idle" | "pending" | "reassembling" | "saved" | "error";
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const reassembleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Backwards compat
  const isEditing = editMode !== "off";

  // DnD reordering state
  const [isReordering, setIsReordering] = useState(false);

  // DnD sensors — require 5px movement to start drag (prevents accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // Slide transition animation
  const [slideTransition, setSlideTransition] = useState<"none" | "fade-in" | "slide-left" | "slide-right">("none");
  const prevSlideRef = useRef(0);

  // Measure the main slide area
  const [mainSize, setMainSize] = useState({ w: 800, h: 500 });

  const mainAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateSize() {
      if (mainAreaRef.current) {
        const rect = mainAreaRef.current.getBoundingClientRect();
        const w = Math.max(rect.width - 48, 400); // subtract padding
        const h = Math.max(rect.height - 48, 300); // subtract padding
        setMainSize({ w: Math.min(w, 1280), h });
      } else {
        // Fallback calculation
        const editorWidth = editMode === "sidebar" ? 360 : 0;
        const w = Math.min(window.innerWidth - 280 - 48 - editorWidth, 1280);
        const h = window.innerHeight - 56 - 48 - 48;
        setMainSize({ w: Math.max(w, 400), h: Math.max(h, 300) });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    // Also observe the container for size changes
    const observer = new ResizeObserver(updateSize);
    if (mainAreaRef.current) observer.observe(mainAreaRef.current);
    return () => {
      window.removeEventListener("resize", updateSize);
      observer.disconnect();
    };
  }, [editMode]);

  // Fetch presentation data
  useEffect(() => {
    if (!presentationId) return;

    const fetchData = async () => {
      try {
        const data = await api.getPresentation(presentationId);
        setPresentation(data);

        if (data.status !== "completed") {
          toast.error("Презентация ещё не готова");
          navigate(`/generate/${presentationId}`);
          return;
        }

        // Fetch the HTML content
        const htmlUrl = data.result_urls?.html_preview || data.result_urls?.html;
        if (htmlUrl) {
          try {
            const html = await api.fetchPresentationHtml(htmlUrl);
            setFullHtml(html);
            const slides = parseSlides(html);
            setSlideHtmls(slides);
          } catch (err) {
            console.error("Failed to fetch HTML:", err);
            toast.error("Не удалось загрузить HTML презентации");
          }
        } else {
          toast.error("URL презентации не найден");
        }

        // Also fetch slide data for editing
        try {
          const slidesData = await api.getSlides(presentationId);
          setSlideDataList(slidesData.slides);
        } catch (err) {
          console.error("Failed to fetch slide data:", err);
        }
      } catch (error) {
        console.error("Failed to fetch presentation:", error);
        toast.error("Презентация не найдена");
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [presentationId, navigate]);

  // Keyboard navigation
  const totalSlides = slideHtmls.length || (presentation?.slide_count || 0);

  // Stable slide IDs for DnD (must be strings)
  const slideIds = useMemo(
    () => Array.from({ length: totalSlides }, (_, i) => `slide-${i}`),
    [totalSlides],
  );

  // Handle drag end — reorder slides
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = parseInt((active.id as string).replace("slide-", ""));
      const newIndex = parseInt((over.id as string).replace("slide-", ""));

      if (isNaN(oldIndex) || isNaN(newIndex)) return;

      // Optimistic local reorder
      setSlideHtmls((prev) => arrayMove(prev, oldIndex, newIndex));
      setSlideDataList((prev) => arrayMove(prev, oldIndex, newIndex));

      // Adjust current slide selection to follow the moved slide
      if (currentSlide === oldIndex) {
        setCurrentSlide(newIndex);
      } else if (oldIndex < currentSlide && newIndex >= currentSlide) {
        setCurrentSlide((prev) => prev - 1);
      } else if (oldIndex > currentSlide && newIndex <= currentSlide) {
        setCurrentSlide((prev) => prev + 1);
      }

      // Build the new order array: maps new position -> old position
      const order = arrayMove(
        Array.from({ length: totalSlides }, (_, i) => i),
        oldIndex,
        newIndex,
      );

      // Call backend
      setIsReordering(true);
      try {
        const result = await api.reorderSlides(presentationId, order);

        // Fetch the new full HTML
        const html = await api.fetchPresentationHtml(result.html_url);
        setFullHtml(html);
        const slides = parseSlides(html);
        setSlideHtmls(slides);

        // Re-fetch slide data to stay in sync
        const slidesData = await api.getSlides(presentationId);
        setSlideDataList(slidesData.slides);

        // Update presentation result URLs
        if (presentation) {
          setPresentation({
            ...presentation,
            result_urls: { ...presentation.result_urls, html_preview: result.html_url },
          });
        }

        toast.success(`Слайд ${oldIndex + 1} → ${newIndex + 1}`);
      } catch (error) {
        console.error("Failed to reorder slides:", error);
        toast.error("Не удалось изменить порядок слайдов");

        // Revert optimistic update — re-fetch from server
        try {
          const htmlUrl = presentation?.result_urls?.html_preview || presentation?.result_urls?.html;
          if (htmlUrl) {
            const html = await api.fetchPresentationHtml(htmlUrl);
            setSlideHtmls(parseSlides(html));
          }
          const slidesData = await api.getSlides(presentationId);
          setSlideDataList(slidesData.slides);
        } catch (revertError) {
          console.error("Failed to revert reorder:", revertError);
        }
      } finally {
        setIsReordering(false);
      }
    },
    [currentSlide, totalSlides, presentationId, presentation],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture keys when editing text in sidebar or inline
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((prev) => {
          const next = Math.min(prev + 1, totalSlides - 1);
          if (next !== prev) setSlideTransition("slide-left");
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((prev) => {
          const next = Math.max(prev - 1, 0);
          if (next !== prev) setSlideTransition("slide-right");
          return next;
        });
      } else if (e.key === "Escape") {
        if (isEditing) {
          setEditMode("off");
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          navigate("/history");
        }
      } else if (e.key === "f" || e.key === "F") {
        if (!isEditing) setIsFullscreen((prev) => !prev);
      } else if (e.key === "e" || e.key === "E") {
        if (!isFullscreen) {
          setEditMode((prev) => prev === "off" ? "inline" : "off");
        }
      }
    },
    [totalSlides, isFullscreen, isEditing, navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reassemble — re-render full HTML and upload to S3
  const handleReassemble = useCallback(async () => {
    setIsReassembling(true);
    setAutoSaveStatus("reassembling");
    try {
      const result = await api.reassemblePresentation(presentationId);

      // Fetch the new HTML
      const html = await api.fetchPresentationHtml(result.html_url);
      setFullHtml(html);
      const slides = parseSlides(html);
      setSlideHtmls(slides);

      // Update presentation result URLs
      setPresentation((prev) => prev ? {
        ...prev,
        result_urls: { ...prev.result_urls, html_preview: result.html_url },
      } : prev);

      setHasEdits(false);
      setAutoSaveStatus("saved");

      // Clear previous status timer
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
      autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Failed to reassemble:", error);
      setAutoSaveStatus("error");
      toast.error("Не удалось пересобрать презентацию");

      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
      autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 5000);
    } finally {
      setIsReassembling(false);
    }
  }, [presentationId]);

  // Schedule auto-reassemble with debounce (2s after last edit)
  const scheduleAutoReassemble = useCallback(() => {
    // Clear any existing timer
    if (reassembleTimerRef.current) {
      clearTimeout(reassembleTimerRef.current);
    }
    setAutoSaveStatus("pending");

    reassembleTimerRef.current = setTimeout(() => {
      handleReassemble();
    }, 2000);
  }, [handleReassemble]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (reassembleTimerRef.current) clearTimeout(reassembleTimerRef.current);
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
    };
  }, []);

  // Handle slide update from sidebar editor
  const handleSlideUpdated = useCallback(
    (index: number, response: SlideEditResponse) => {
      // Update the slide HTML in the viewer
      const newHtml = response.html;
      setSlideHtmls((prev) => {
        const updated = [...prev];
        // Parse the response HTML to extract just the slide content
        const parsed = parseSlides(newHtml);
        if (parsed.length > 0) {
          updated[index] = parsed[0];
        } else {
          updated[index] = newHtml;
        }
        return updated;
      });

      // Update slide data
      setSlideDataList((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            layoutId: response.layoutId,
            data: response.data,
          };
        }
        return updated;
      });

      setHasEdits(true);
      scheduleAutoReassemble();
    },
    [scheduleAutoReassemble],
  );

  // Handle inline image replacement
  const handleImageReplaced = useCallback(
    (index: number, response: SlideEditResponse) => {
      // Update the slide HTML in the viewer
      const newHtml = response.html;
      setSlideHtmls((prev) => {
        const updated = [...prev];
        const parsed = parseSlides(newHtml);
        if (parsed.length > 0) {
          updated[index] = parsed[0];
        } else {
          updated[index] = newHtml;
        }
        return updated;
      });

      // Update slide data
      setSlideDataList((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            layoutId: response.layoutId,
            data: response.data,
          };
        }
        return updated;
      });

      setHasEdits(true);
      scheduleAutoReassemble();
    },
    [scheduleAutoReassemble],
  );

  // Handle inline field save
  const handleInlineFieldSaved = useCallback(
    (index: number, field: string, value: string, response: InlineFieldPatchResponse) => {
      // Update slide data
      setSlideDataList((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            data: response.data,
          };
        }
        return updated;
      });

      // Note: We don't update slideHtmls here because the inline editor
      // already shows the updated text. The slideHtmls will be refreshed
      // automatically by the debounced auto-reassemble.
      setHasEdits(true);
      scheduleAutoReassemble();
    },
    [scheduleAutoReassemble],
  );

  // Download HTML
  const handleDownload = () => {
    if (!fullHtml) {
      toast.error("HTML не доступен для скачивания");
      return;
    }
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation-${presentationId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Файл скачан");
  };

  // Open in new tab
  const handleOpenInTab = () => {
    const htmlUrl = presentation?.result_urls?.html_preview || presentation?.result_urls?.html;
    if (htmlUrl) {
      window.open(htmlUrl, "_blank");
    } else if (fullHtml) {
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  // Toggle edit mode
  const cycleEditMode = () => {
    setEditMode((prev) => {
      if (prev === "off") return "inline";
      if (prev === "inline") return "sidebar";
      return "off";
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Загрузка презентации...</p>
        </div>
      </div>
    );
  }

  const hasSlides = slideHtmls.length > 0;

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        {/* Controls overlay */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="text-xs text-white/50 font-mono mr-2">
            {currentSlide + 1} / {totalSlides}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsFullscreen(false)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation arrows */}
        {currentSlide > 0 && (
          <button
            onClick={() => setCurrentSlide((prev) => prev - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white/80" />
          </button>
        )}
        {currentSlide < totalSlides - 1 && (
          <button
            onClick={() => setCurrentSlide((prev) => prev + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6 text-white/80" />
          </button>
        )}

        {/* Slide — fullscreen */}
        {hasSlides && slideHtmls[currentSlide] ? (
          <SlideFrame
            html={slideHtmls[currentSlide]}
            containerWidth={window.innerWidth - 120}
            containerHeight={window.innerHeight - 80}
            interactive
          />
        ) : (
          <div className="text-white/30 text-lg">Слайд {currentSlide + 1}</div>
        )}
      </div>
    );
  }

  // Thumbnail dimensions
  const THUMB_W = 192;
  const THUMB_H = 108; // 16:9

  // Calculate slide display dimensions
  const slideDisplayH = Math.min(mainSize.w * (720 / 1280), mainSize.h);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex flex-col lg:flex-row h-full">
        {/* Left panel — Slide list */}
        <div className="lg:w-[260px] border-r border-border/50 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Link href="/history" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="section-number">04 — ПРОСМОТР</div>
            </div>
            <h3
              className="text-sm font-semibold truncate"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {presentation?.title || "Презентация"}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {totalSlides} слайдов • ID: {presentationId.slice(0, 8)}
            </p>
          </div>

          {/* Slide thumbnails with drag & drop */}
          <ScrollArea className="flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={slideIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-3 space-y-2">
                  {slideIds.map((id, i) => (
                    <SortableSlideThumb
                      key={id}
                      id={id}
                      index={i}
                      isActive={currentSlide === i}
                      hasSlides={hasSlides}
                      slideHtml={slideHtmls[i]}
                      thumbW={THUMB_W}
                      thumbH={THUMB_H}
                      onClick={() => setCurrentSlide(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {isReordering && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Сохранение...
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <div className="p-3 border-t border-border/50 space-y-2">
            {/* Auto-save status indicator */}
            {autoSaveStatus !== "idle" && (
              <div
                className={`
                  flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-300
                  ${autoSaveStatus === "pending" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : ""}
                  ${autoSaveStatus === "reassembling" ? "bg-primary/10 text-primary border border-primary/20" : ""}
                  ${autoSaveStatus === "saved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : ""}
                  ${autoSaveStatus === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : ""}
                `}
              >
                {autoSaveStatus === "pending" && (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Ожидание сохранения...
                  </>
                )}
                {autoSaveStatus === "reassembling" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Сохранение...
                  </>
                )}
                {autoSaveStatus === "saved" && (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Все изменения сохранены
                  </>
                )}
                {autoSaveStatus === "error" && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    Ошибка сохранения
                  </>
                )}
              </div>
            )}
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              disabled={!fullHtml}
            >
              <Download className="w-3.5 h-3.5" />
              Скачать HTML
            </Button>
            <Button
              onClick={handleOpenInTab}
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-xs"
              disabled={!fullHtml && !presentation?.result_urls?.html_preview}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Открыть в новой вкладке
            </Button>
          </div>
        </div>

        {/* Center panel — Main slide view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setSlideTransition("slide-right");
                  setCurrentSlide((prev) => Math.max(prev - 1, 0));
                }}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-mono text-muted-foreground">
                <span className="text-foreground font-medium">
                  {currentSlide + 1}
                </span>{" "}
                / {totalSlides}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setSlideTransition("slide-left");
                  setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
                }}
                disabled={currentSlide === totalSlides - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                ← → навигация • E редактор • F полноэкранный
              </span>

              {/* Inline edit toggle */}
              <Button
                variant={editMode === "inline" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(editMode === "inline" ? "off" : "inline")}
                className="gap-1.5 text-xs"
                disabled={slideDataList.length === 0}
                title="Inline-редактирование: кликните на текст слайда"
              >
                <PencilLine className="w-3.5 h-3.5" />
                {editMode === "inline" ? "Выкл. редактор" : "Редактировать"}
              </Button>

              {/* Sidebar editor toggle */}
              <Button
                variant={editMode === "sidebar" ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => setEditMode(editMode === "sidebar" ? "off" : "sidebar")}
                disabled={slideDataList.length === 0}
                title="Панель редактирования (все поля)"
              >
                <PanelRightOpen className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsFullscreen(true)}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Slide display */}
          <div ref={mainAreaRef} className="flex-1 flex items-center justify-center p-6 bg-black/20">
            <div
              className={`rounded-lg overflow-hidden border shadow-2xl bg-white slide-transition ${slideTransition} ${
                editMode === "inline" ? "border-primary/40 ring-1 ring-primary/20" : "border-border/30"
              }`}
              style={{
                width: mainSize.w,
                height: slideDisplayH,
                maxHeight: mainSize.h,
              }}
              onAnimationEnd={() => setSlideTransition("none")}
            >
              {editMode === "inline" && slideDataList[currentSlide] ? (
                /* Inline editable slide */
                <InlineEditableSlide
                  presentationId={presentationId}
                  slideIndex={currentSlide}
                  containerWidth={mainSize.w}
                  containerHeight={slideDisplayH}
                  onFieldSaved={handleInlineFieldSaved}
                  onImageReplaced={handleImageReplaced}
                />
              ) : hasSlides && slideHtmls[currentSlide] ? (
                <SlideFrame
                  html={slideHtmls[currentSlide]}
                  containerWidth={mainSize.w}
                  containerHeight={slideDisplayH}
                  interactive={editMode === "off"}
                />
              ) : (
                <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
                  <div className="text-center">
                    <Layers className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground/50">
                      Слайд {currentSlide + 1}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — Sidebar Editor (conditional) */}
        {editMode === "sidebar" && slideDataList[currentSlide] && (
          <SlideEditor
            presentationId={presentationId}
            slide={slideDataList[currentSlide]}
            onClose={() => setEditMode("off")}
            onSlideUpdated={handleSlideUpdated}
          />
        )}
      </div>
    </div>
  );
}
