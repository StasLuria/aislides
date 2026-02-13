/**
 * SharedViewer — Public presentation viewer (no auth required).
 * Accessed via /shared/:token
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileDown,
  Download,
  Loader2,
  Layers,
} from "lucide-react";
import api from "@/lib/api";

export default function SharedViewer() {
  const { token } = useParams<{ token: string }>();
  const [presentation, setPresentation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [slideTransition, setSlideTransition] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);

  // Load presentation data
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getSharedPresentation(token)
      .then((data) => {
        setPresentation(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load shared presentation:", err);
        setError("Презентация не найдена или доступ отключён");
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Load HTML
  useEffect(() => {
    if (!token || !presentation) return;
    const htmlUrl = presentation.result_urls?.html_preview || presentation.result_urls?.html;
    if (htmlUrl) {
      fetch(htmlUrl)
        .then((r) => r.text())
        .then(setFullHtml)
        .catch(() => {});
    }
  }, [token, presentation]);

  // Slide count from HTML
  const totalSlides = (() => {
    if (!fullHtml) return presentation?.slide_count || 0;
    const matches = fullHtml.match(/class="slide"/g);
    return matches ? matches.length : presentation?.slide_count || 0;
  })();

  // Navigate slides via postMessage to iframe
  const navigateToSlide = useCallback(
    (index: number) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "navigateToSlide", slideIndex: index },
          "*",
        );
      }
    },
    [],
  );

  useEffect(() => {
    navigateToSlide(currentSlide);
  }, [currentSlide, navigateToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSlideTransition("slide-left");
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSlideTransition("slide-right");
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "f" || e.key === "F") {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSlides, isFullscreen]);

  // Download HTML
  const handleDownloadHtml = () => {
    if (!fullHtml) return;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML скачан");
  };

  // Download PPTX
  const handleDownloadPptx = async () => {
    if (!token) return;
    setIsExportingPptx(true);
    try {
      const blob = await api.exportSharedPptx(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentation?.title || "presentation"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PPTX файл скачан");
    } catch {
      toast.error("Не удалось экспортировать в PPTX");
    } finally {
      setIsExportingPptx(false);
    }
  };

  // Scale iframe
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      if (!mainAreaRef.current) return;
      const rect = mainAreaRef.current.getBoundingClientRect();
      const padding = isFullscreen ? 0 : 48;
      const availW = rect.width - padding;
      const availH = rect.height - padding;
      const scaleW = availW / 1280;
      const scaleH = availH / 720;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const observer = new ResizeObserver(updateScale);
    if (mainAreaRef.current) observer.observe(mainAreaRef.current);
    return () => {
      window.removeEventListener("resize", updateScale);
      observer.disconnect();
    };
  }, [isFullscreen]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Загрузка презентации...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h1 className="text-xl font-semibold">Презентация недоступна</h1>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div
          style={{
            width: 1280 * scale,
            height: 720 * scale,
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={fullHtml || ""}
            className="border-0"
            style={{
              width: 1280,
              height: 720,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-white/60 text-sm font-mono">
            {currentSlide + 1} / {totalSlides}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/80 hover:text-white"
            onClick={() => setIsFullscreen(false)}
          >
            <Minimize2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold truncate max-w-md">
              {presentation?.title || "Презентация"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {totalSlides} слайдов • Публичный просмотр
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPptx}
            disabled={isExportingPptx}
            className="gap-1.5 text-xs"
          >
            {isExportingPptx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            {isExportingPptx ? "Экспорт..." : "PPTX"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadHtml}
            disabled={!fullHtml}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            HTML
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/30">
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
              <span className="text-foreground font-medium">{currentSlide + 1}</span> /{" "}
              {totalSlides}
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
              ← → навигация • F полноэкранный
            </span>
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
            className="rounded-lg overflow-hidden border border-border/30 shadow-2xl bg-white"
            style={{
              width: 1280 * scale,
              height: 720 * scale,
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={fullHtml || ""}
              className="border-0"
              style={{
                width: 1280,
                height: 720,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
