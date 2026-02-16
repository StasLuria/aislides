/**
 * History Page — Grid of presentation cards
 * Each card shows the first slide (cover) as a scaled iframe preview.
 * Clicking a card navigates to the Viewer for full slide browsing.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Trash2,
  Layers,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/lib/api";
import type { PresentationDetail, PresentationStatus } from "@/lib/api";

// ─── Status config ───────────────────────────────────────
const STATUS_CONFIG: Record<
  PresentationStatus,
  { label: string; icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
  completed: {
    label: "Готово",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  processing: {
    label: "Генерация",
    icon: Loader2,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  pending: {
    label: "В очереди",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  failed: {
    label: "Ошибка",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  cancelled: {
    label: "Отменено",
    icon: AlertCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  awaiting_outline_approval: {
    label: "Структура",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  awaiting_content_approval: {
    label: "Контент",
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  assembling: {
    label: "Сборка",
    icon: Loader2,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
};

// ─── Cover slide preview component ──────────────────────
function CoverSlidePreview({ htmlUrl }: { htmlUrl: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!htmlUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(htmlUrl);
        const fullHtml = await resp.text();
        if (cancelled) return;

        // Extract just the first slide-container from the full HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullHtml, "text/html");
        const headContent = doc.head.innerHTML;

        // Find first slide-container via regex (more reliable than DOM for nested divs)
        const regex = /<div class="slide-container">/g;
        const match = regex.exec(fullHtml);
        if (match) {
          const start = match.index;
          const nextMatch = regex.exec(fullHtml);
          const end = nextMatch
            ? nextMatch.index
            : fullHtml.indexOf("</body>") !== -1
              ? fullHtml.indexOf("</body>")
              : fullHtml.length;
          const firstSlideHtml = fullHtml.substring(start, end).trim();

          const slideDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  ${headContent}
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 1280px; height: 720px; background: #fff; }
    .slide-container { margin: 0 !important; padding: 0 !important; }
    .slide-number { display: none !important; }
  </style>
</head>
<body>${firstSlideHtml}</body>
</html>`;
          setHtml(slideDoc);
        }
      } catch (err) {
        console.error("Failed to load cover slide:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [htmlUrl]);

  if (loading) {
    return (
      <div className="w-full aspect-[16/9] bg-muted/30 rounded-t-xl flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
      </div>
    );
  }

  if (!html) {
    return (
      <div className="w-full aspect-[16/9] bg-gradient-to-br from-primary/5 to-primary/10 rounded-t-xl flex items-center justify-center">
        <Layers className="w-8 h-8 text-primary/20" />
      </div>
    );
  }

  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  return (
    <div
      ref={containerRef}
      className="w-full aspect-[16/9] rounded-t-xl overflow-hidden relative bg-white"
    >
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${320 / SLIDE_W})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <iframe
          srcDoc={html}
          className="border-0"
          style={{ width: SLIDE_W, height: SLIDE_H }}
          sandbox="allow-same-origin"
          tabIndex={-1}
          title="Cover slide"
          loading="lazy"
        />
        {/* Click-through overlay */}
        <div className="absolute inset-0" style={{ pointerEvents: "all" }} />
      </div>
    </div>
  );
}

// ─── Main History component ─────────────────────────────
export default function History() {
  const [, navigate] = useLocation();
  const [presentations, setPresentations] = useState<PresentationDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchPresentations = useCallback(async () => {
    try {
      const items = await api.listPresentations();
      setPresentations(items);
      setTotal(items.length);
    } catch (error) {
      console.error("Failed to fetch presentations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deletePresentation(id);
      setPresentations((prev) => prev.filter((p) => p.presentation_id !== id));
      setTotal((prev) => prev - 1);
      toast.success("Презентация удалена");
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const handleCardClick = (p: PresentationDetail) => {
    if (p.status === "completed") {
      navigate(`/view/${p.presentation_id}`);
    } else if (
      p.status === "awaiting_outline_approval" ||
      p.status === "awaiting_content_approval" ||
      (p.status === "assembling" && p.mode === "interactive") ||
      (p.status === "processing" && p.mode === "interactive")
    ) {
      navigate(`/interactive/${p.presentation_id}`);
    } else if (p.status === "processing" || p.status === "pending") {
      navigate(`/generate/${p.presentation_id}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const modeLabels: Record<string, string> = {
    batch: "Авто",
    interactive: "Пошаговый",
    design_only: "Дизайн",
  };

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Мои презентации
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} ${total === 1 ? "презентация" : total < 5 ? "презентации" : "презентаций"}`
              : "Здесь появятся ваши презентации"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchPresentations}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Link href="/chat">
            <Button size="sm" className="gap-1.5 h-9">
              <Plus className="w-3.5 h-3.5" />
              Создать
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && presentations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <FileText className="w-8 h-8 text-primary/60" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">
            Пока нет презентаций
          </h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Создайте первую презентацию — опишите тему, и AI создаст контент и
            дизайн
          </p>
          <Link href="/chat">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Создать презентацию
            </Button>
          </Link>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && presentations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {presentations.map((p) => {
            const statusConfig = STATUS_CONFIG[p.status];
            const StatusIcon = statusConfig.icon;
            const htmlUrl = p.result_urls?.html_preview as string | undefined;

            return (
              <div
                key={p.presentation_id}
                className="group rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
                onClick={() => handleCardClick(p)}
              >
                {/* Cover slide preview */}
                <CoverSlidePreview htmlUrl={htmlUrl || null} />

                {/* Card info */}
                <div className="p-4">
                  {/* Title */}
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
                    {p.title || p.prompt.slice(0, 80)}
                  </h3>

                  {/* Meta row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Status badge */}
                      <Badge
                        variant="outline"
                        className={`${statusConfig.bgColor} ${statusConfig.color} border-0 gap-1 text-[10px] font-medium px-1.5 py-0.5`}
                      >
                        <StatusIcon
                          className={`w-2.5 h-2.5 ${
                            p.status === "processing" ||
                            p.status === "assembling"
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        {statusConfig.label}
                      </Badge>

                      {/* Slide count */}
                      {p.slide_count > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {p.slide_count} сл.
                        </span>
                      )}
                    </div>

                    {/* Date + actions */}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(p.created_at)}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) =>
                              handleDelete(p.presentation_id, e as unknown as React.MouseEvent)
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
