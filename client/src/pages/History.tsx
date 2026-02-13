/**
 * History Page — List of all generated presentations
 * Clean light theme with card-based layout
 */

import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Eye,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import type { PresentationDetail, PresentationStatus } from "@/lib/api";

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

  const handleDelete = async (id: string) => {
    try {
      await api.deletePresentation(id);
      setPresentations((prev) => prev.filter((p) => p.presentation_id !== id));
      setTotal((prev) => prev - 1);
      toast.success("Презентация удалена");
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const handleView = (p: PresentationDetail) => {
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
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const modeLabels: Record<string, string> = {
    batch: "Авто",
    interactive: "Пошаговый",
    design_only: "Дизайн",
  };

  return (
    <div className="container py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Мои презентации
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0
              ? `${total} презентаций`
              : "Здесь появятся ваши презентации"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchPresentations}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Link href="/chat">
            <Button size="sm" className="gap-1.5 h-8">
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
            Создайте первую презентацию — опишите тему, и AI создаст контент и дизайн
          </p>
          <Link href="/chat">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Создать презентацию
            </Button>
          </Link>
        </div>
      )}

      {/* Presentations list */}
      {!isLoading && presentations.length > 0 && (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_90px_80px_60px_110px_70px] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
            <span>Презентация</span>
            <span>Статус</span>
            <span>Режим</span>
            <span>Слайды</span>
            <span>Дата</span>
            <span className="text-right">Действия</span>
          </div>

          {presentations.map((p) => {
            const statusConfig = STATUS_CONFIG[p.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={p.presentation_id}
                className="grid grid-cols-[1fr_90px_80px_60px_110px_70px] gap-3 items-center px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors group cursor-pointer border border-transparent hover:border-border/50"
                onClick={() => handleView(p)}
              >
                {/* ID */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-primary/40" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.presentation_id.slice(0, 12)}...
                    </p>
                    {p.progress_percent > 0 && p.status === "processing" && (
                      <p className="text-[10px] text-primary">
                        {Math.round(p.progress_percent)}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <Badge
                  variant="outline"
                  className={`${statusConfig.bgColor} ${statusConfig.color} border-0 gap-1 text-[10px] font-medium w-fit`}
                >
                  <StatusIcon
                    className={`w-3 h-3 ${
                      p.status === "processing" || p.status === "assembling" ? "animate-spin" : ""
                    }`}
                  />
                  {statusConfig.label}
                </Badge>

                {/* Mode */}
                <span className="text-xs text-muted-foreground">
                  {modeLabels[p.mode] || p.mode}
                </span>

                {/* Slides */}
                <span className="text-xs text-muted-foreground">
                  {p.slide_count || "—"}
                </span>

                {/* Date */}
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(p.created_at)}
                </span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/view/${p.presentation_id}`);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.presentation_id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
