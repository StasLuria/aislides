/**
 * SlidePreview — Renders a single slide as a scaled HTML preview in an iframe.
 * Used in Interactive mode Step 2 to show real-time visual preview of slide content.
 *
 * The slide is rendered at 1280×720 and scaled down to fit the container.
 * Uses srcdoc for inline HTML rendering (no external requests).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Eye, EyeOff, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface SlidePreviewProps {
  presentationId: string;
  slideNumber: number;
  /** Trigger re-render when content changes (e.g., after save) */
  refreshKey?: number;
  /** Container width — preview will scale to fit */
  width?: number;
}

export default function SlidePreview({
  presentationId,
  slideNumber,
  refreshKey = 0,
  width = 480,
}: SlidePreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [layout, setLayout] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);

  // Aspect ratio: 16:9 (1280:720)
  const height = Math.round((width * 720) / 1280);
  const scale = width / 1280;

  const loadPreview = useCallback(async () => {
    if (!presentationId || !slideNumber || !isVisible) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.previewSlide(presentationId, slideNumber);
      setHtml(result.html);
      setLayout(result.layout);
    } catch (err: any) {
      console.error("[SlidePreview] Failed to load preview:", err);
      setError("Не удалось загрузить превью");
    } finally {
      setIsLoading(false);
    }
  }, [presentationId, slideNumber, isVisible]);

  // Load preview on mount and when refreshKey changes
  useEffect(() => {
    loadPreview();
  }, [loadPreview, refreshKey]);

  // Close fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (!isVisible) {
    return (
      <div className="flex items-center justify-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="text-xs text-muted-foreground gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          Показать превью
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Превью
            </span>
            {layout && (
              <span className="text-[9px] font-mono text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded">
                {layout}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => loadPreview()}
              disabled={isLoading}
              title="Обновить превью"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsFullscreen(true)}
              disabled={!html}
              title="Полный экран"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsVisible(false)}
              title="Скрыть превью"
            >
              <EyeOff className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Preview container */}
        <div
          className="relative rounded-lg overflow-hidden border border-border/30 bg-[#1a1a2e]"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          {isLoading && !html && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-[10px] text-muted-foreground">Рендеринг...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <span className="text-xs text-muted-foreground">{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPreview}
                  className="text-[10px] h-6"
                >
                  Повторить
                </Button>
              </div>
            </div>
          )}

          {html && (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title={`Slide ${slideNumber} preview`}
              sandbox="allow-same-origin"
              style={{
                width: "1280px",
                height: "720px",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: "none",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Loading overlay when refreshing */}
          {isLoading && html && (
            <div className="absolute top-2 right-2 z-10">
              <div className="bg-background/80 rounded-full p-1">
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && html && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="relative"
            style={{ width: "min(90vw, 1280px)", height: "min(calc(90vw * 720 / 1280), 720px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-10 right-0 text-white/70 hover:text-white z-10"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            <iframe
              ref={fullscreenIframeRef}
              srcDoc={html}
              title={`Slide ${slideNumber} fullscreen`}
              sandbox="allow-same-origin"
              className="w-full h-full rounded-lg"
              style={{ border: "none" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
