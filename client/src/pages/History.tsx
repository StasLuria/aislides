/**
 * History Page — List of all generated presentations
 * Swiss Precision: Table-like layout with status indicators
 * Horizontal lines, monospaced data, clean information hierarchy
 */

import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import api from "@/lib/api";
import type { PresentationDetail, PresentationStatus } from "@/lib/api";

const EMPTY_STATE_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/KBKMulqyrRTtBkQ7DeuSuk/sandbox/fEV2zCiRVgoVEHmhF3i7FE-img-3_1770801491000_na1fn_ZW1wdHktc3RhdGUtaWxsdXN0cmF0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvS0JLTXVscXlyUlR0QmtRN0RldVN1ay9zYW5kYm94L2ZFVjJ6Q2lSVmdvVkVIbWhGM2k3RkUtaW1nLTNfMTc3MDgwMTQ5MTAwMF9uYTFmbl9aVzF3ZEhrdGMzUmhkR1V0YVd4c2RYTjBjbUYwYVc5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=aEh9GJsl1B5QhxaJSEO4n4BBfkfng8KQkfdIkgpP3B5XJ9G6bHfUBhBFGo5AvoK3njkFcW2BpdN8FDRWUmn5NPJ2Rzh1A3tLfRc310bB1upPmpEau3FiTfPuIWvvkyi~vFsf1boUH99p4QcFbGXJkmglJZ6Kv8KhBPAfp-t95WvSuV9vhuKIcSO1qymVHHUGxoJO52ZV~iEKzOdxO55gMba-RrolPLRS-eQO2kUi-3EnBYUKySmTly8GiXrOoURjkzco1beU33UaAG3EzfQrspx-6B4WlERbi~UbMhz~6iezGmiBzBu~iB4nkN7eA8PEnW5fEDprm~~cKD55Cfq5Hw__";

const STATUS_CONFIG: Record<
  PresentationStatus,
  { label: string; icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
  completed: {
    label: "Готово",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
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
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
  failed: {
    label: "Ошибка",
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
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
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  awaiting_content_approval: {
    label: "Контент",
    icon: Clock,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
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
      // Show empty state instead of error for demo
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
    interactive: "Интерактивный",
    design_only: "Только дизайн",
  };

  return (
    <div className="container py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="section-number mb-3">02 — ИСТОРИЯ</div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Мои презентации
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} презентаций`
              : "Здесь появятся ваши презентации"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchPresentations}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Link href="/">
            <Button size="sm" className="gap-2">
              <Plus className="w-3.5 h-3.5" />
              Создать
            </Button>
          </Link>
        </div>
      </div>

      <div className="swiss-divider mb-6" />

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
          <img
            src={EMPTY_STATE_IMG}
            alt="No presentations"
            className="w-32 h-32 opacity-40 mb-6"
          />
          <h3
            className="text-lg font-medium mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Пока нет презентаций
          </h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Создайте первую презентацию — опишите тему, и AI-агенты сделают
            остальное
          </p>
          <Link href="/">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Создать презентацию
            </Button>
          </Link>
        </div>
      )}

      {/* Presentations list */}
      {!isLoading && presentations.length > 0 && (
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_80px_80px_120px_80px] gap-4 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>ID</span>
              <span>Статус</span>
              <span>Режим</span>
              <span>Слайды</span>
              <span>Дата</span>
              <span className="text-right">Действия</span>
            </div>

            <div className="swiss-divider" />

            {presentations.map((p) => {
              const statusConfig = STATUS_CONFIG[p.status];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={p.presentation_id}
                  className="grid grid-cols-[1fr_100px_80px_80px_120px_80px] gap-4 items-center px-4 py-3 rounded-md hover:bg-secondary/30 transition-colors group cursor-pointer"
                  onClick={() => handleView(p)}
                >
                  {/* ID */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-secondary/50 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-mono truncate">
                        {p.presentation_id.slice(0, 12)}...
                      </p>
                      {p.progress_percent > 0 && p.status === "processing" && (
                        <p className="text-[10px] text-primary font-mono">
                          {Math.round(p.progress_percent)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="outline"
                    className={`${statusConfig.bgColor} ${statusConfig.color} border-0 gap-1 text-[10px] font-mono w-fit`}
                  >
                    <StatusIcon
                      className={`w-3 h-3 ${
                        p.status === "processing" ? "animate-spin" : ""
                      }`}
                    />
                    {statusConfig.label}
                  </Badge>

                  {/* Mode */}
                  <span className="text-xs text-muted-foreground font-mono">
                    {modeLabels[p.mode] || p.mode}
                  </span>

                  {/* Slides */}
                  <span className="text-xs text-muted-foreground font-mono">
                    {p.slide_count || "—"}
                  </span>

                  {/* Date */}
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatDate(p.created_at)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
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
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.presentation_id);
                      }}
                      className="text-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
