/**
 * Viewer Page — Presentation Slide Viewer
 * Swiss Precision: Split layout with slide list (left) and large preview (right)
 * Keyboard navigation: Left/Right arrows, Escape to exit
 */

import { useEffect, useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import api from "@/lib/api";
import type { PresentationDetail } from "@/lib/api";

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

  const containerRef = useRef<HTMLDivElement>(null);

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
        if (data.result_urls?.html) {
          try {
            const response = await fetch(data.result_urls.html);
            const html = await response.text();
            setFullHtml(html);
            // Parse individual slides from the HTML
            const slides = parseSlides(html);
            setSlideHtmls(slides);
          } catch {
            // If URL fetch fails, try to get slides from result_urls
            toast.error("Не удалось загрузить HTML презентации");
          }
        }

        // If we have individual slide URLs
        if (data.result_urls?.slides) {
          try {
            const slidesData = JSON.parse(data.result_urls.slides as unknown as string);
            if (Array.isArray(slidesData)) {
              setSlideHtmls(slidesData);
            }
          } catch {
            // Ignore parse errors
          }
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

  // Parse slides from full HTML
  const parseSlides = (html: string): string[] => {
    // Try to split by slide containers
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const slideElements = doc.querySelectorAll(".slide, [data-slide]");

    if (slideElements.length > 0) {
      const head = doc.head.innerHTML;
      return Array.from(slideElements).map((el) => {
        return `<!DOCTYPE html><html><head>${head}</head><body style="margin:0;overflow:hidden;">${el.outerHTML}</body></html>`;
      });
    }

    // If no slide markers, return full HTML as single slide
    return [html];
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(prev + 1, slideHtmls.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          navigate("/history");
        }
      } else if (e.key === "f" || e.key === "F") {
        setIsFullscreen((prev) => !prev);
      }
    },
    [slideHtmls.length, isFullscreen, navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
    if (!fullHtml) return;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
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

  // Demo mode: if no slides loaded, show demo content
  const hasSlides = slideHtmls.length > 0;
  const totalSlides = hasSlides ? slideHtmls.length : (presentation?.slide_count || 0);

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      >
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
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
        )}
        {currentSlide < totalSlides - 1 && (
          <button
            onClick={() => setCurrentSlide((prev) => prev + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white/70" />
          </button>
        )}

        {/* Slide */}
        <div className="w-full max-w-[1280px] aspect-video">
          {hasSlides ? (
            <iframe
              srcDoc={slideHtmls[currentSlide]}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title={`Slide ${currentSlide + 1}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              Слайд {currentSlide + 1}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Left panel — Slide list */}
        <div className="lg:w-[280px] border-r border-border/50 flex flex-col">
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
              Презентация
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {totalSlides} слайдов • ID: {presentationId.slice(0, 8)}
            </p>
          </div>

          {/* Slide thumbnails */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`
                    w-full rounded-md overflow-hidden border transition-all
                    ${
                      currentSlide === i
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border/30 hover:border-border/60"
                    }
                  `}
                >
                  <div className="flex items-center gap-2 p-2">
                    <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 aspect-video bg-secondary/50 rounded overflow-hidden">
                      {hasSlides && slideHtmls[i] ? (
                        <iframe
                          srcDoc={slideHtmls[i]}
                          className="w-[640px] h-[360px] border-0 pointer-events-none"
                          style={{
                            transform: "scale(0.15)",
                            transformOrigin: "top left",
                          }}
                          tabIndex={-1}
                          title={`Thumb ${i + 1}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers className="w-3 h-3 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-3 border-t border-border/50 space-y-2">
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
              disabled={!fullHtml}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Открыть в новой вкладке
            </Button>
          </div>
        </div>

        {/* Right panel — Main slide view */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
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
                onClick={() =>
                  setCurrentSlide((prev) =>
                    Math.min(prev + 1, totalSlides - 1)
                  )
                }
                disabled={currentSlide === totalSlides - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                ← → навигация • F полноэкранный • Esc выход
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
          <div className="flex-1 flex items-center justify-center p-6 bg-black/20">
            <div className="w-full max-w-[960px] aspect-video rounded-lg overflow-hidden border border-border/30 shadow-2xl">
              {hasSlides && slideHtmls[currentSlide] ? (
                <iframe
                  srcDoc={slideHtmls[currentSlide]}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title={`Slide ${currentSlide + 1}`}
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
      </div>
    </div>
  );
}
