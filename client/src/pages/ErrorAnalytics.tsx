/**
 * ErrorAnalytics — Error monitoring dashboard for generation pipeline.
 * Shows error overview, timeline, breakdown by stage/type, and recent errors feed.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Activity,
  ArrowLeft,
  Info,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  fatal: "hsl(0, 72%, 51%)",
  warning: "hsl(38, 92%, 50%)",
  info: "hsl(217, 91%, 60%)",
};

const SEVERITY_LABELS: Record<string, string> = {
  fatal: "Критическая",
  warning: "Предупреждение",
  info: "Информация",
};

const STAGE_LABELS: Record<string, string> = {
  research_agent: "Исследование",
  analysis_agent: "Анализ",
  outline_critic: "Критик структуры",
  content_writer: "Генерация контента",
  storytelling_agent: "Нарратив",
  content_evaluator: "Оценка контента",
  image_generation: "Генерация изображений",
  speaker_coach: "Заметки спикера",
  data_viz_agent: "Визуализация данных",
  design_critic: "Критик дизайна",
  chat_orchestrator: "Оркестратор чата",
  quick_generation: "Быстрая генерация",
  step_structure: "Структура (пошаговый)",
  step_theme_init: "Инициализация темы",
  structure_edit: "Редактирование структуры",
  slide_content_gen: "Контент слайда",
  slide_content_edit: "Редактирование контента",
  slide_design_gen: "Дизайн слайда",
  slide_design_edit: "Редактирование дизайна",
  step_finalization: "Финализация",
  s3_upload: "Загрузка в S3",
  step_s3_upload: "Загрузка в S3 (пошаговый)",
  title_generation: "Генерация заголовка",
  file_parser: "Парсинг файлов",
};

type DateRange = "7d" | "30d" | "90d" | "all";

function getDateRange(range: DateRange): { dateFrom?: string; dateTo?: string } {
  if (range === "all") return {};
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    dateFrom: from.toISOString(),
    dateTo: now.toISOString(),
  };
}

function getTimelineRange(range: DateRange): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const days = range === "all" ? 365 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    dateFrom: from.toISOString(),
    dateTo: now.toISOString(),
  };
}

// ─── Main Component ──────────────────────────────────────────

export default function ErrorAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [range, setRange] = useState<DateRange>("30d");

  const dateRange = useMemo(() => getDateRange(range), [range]);
  const timelineRange = useMemo(() => getTimelineRange(range), [range]);

  const overview = trpc.errorAnalytics.overview.useQuery(dateRange, { enabled: !!user });
  const byStage = trpc.errorAnalytics.byStage.useQuery(dateRange, { enabled: !!user });
  const byType = trpc.errorAnalytics.byType.useQuery(dateRange, { enabled: !!user });
  const timeline = trpc.errorAnalytics.timeline.useQuery(timelineRange, { enabled: !!user });
  const recent = trpc.errorAnalytics.recent.useQuery({ limit: 20 }, { enabled: !!user });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Войдите для просмотра аналитики ошибок</p>
      </div>
    );
  }

  const metrics = overview.data;
  const isLoading = overview.isLoading;

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/analytics">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Мониторинг ошибок</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Аналитика ошибок генерации по этапам пайплайна
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              overview.refetch();
              byStage.refetch();
              byType.refetch();
              timeline.refetch();
              recent.refetch();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить
          </Button>
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Последние 7 дней</SelectItem>
              <SelectItem value="30d">Последние 30 дней</SelectItem>
              <SelectItem value="90d">Последние 90 дней</SelectItem>
              <SelectItem value="all">Всё время</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Всего ошибок"
          value={metrics?.totalErrors ?? 0}
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Критические"
          value={metrics?.fatalErrors ?? 0}
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          loading={isLoading}
          highlight={!!metrics?.fatalErrors && metrics.fatalErrors > 0}
        />
        <MetricCard
          title="Предупреждения"
          value={metrics?.warnings ?? 0}
          icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Восстановлено"
          value={metrics?.recoveredErrors ?? 0}
          icon={<ShieldCheck className="w-4 h-4 text-green-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="% восстановления"
          value={`${metrics?.recoveryRate ?? 0}%`}
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          loading={isLoading}
        />
      </div>

      {/* Top problem indicators */}
      {metrics && (metrics.topStage || metrics.topErrorType) && (
        <div className="flex flex-wrap gap-3">
          {metrics.topStage && (
            <Badge variant="outline" className="text-xs py-1 px-3 gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Проблемный этап: <strong>{STAGE_LABELS[metrics.topStage] || metrics.topStage}</strong>
            </Badge>
          )}
          {metrics.topErrorType && (
            <Badge variant="outline" className="text-xs py-1 px-3 gap-1.5">
              <XCircle className="w-3 h-3 text-red-500" />
              Частая ошибка: <strong>{metrics.topErrorType}</strong>
            </Badge>
          )}
        </div>
      )}

      {/* Charts row: Timeline + Stage breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Error timeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Ошибки по дням
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <ChartSkeleton />
            ) : (timeline.data?.length ?? 0) === 0 ? (
              <EmptyState message="Нет ошибок за выбранный период" icon="success" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeline.data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getDate()}.${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString("ru-RU")}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs">
                        {value === "fatal" ? "Критические" : value === "warning" ? "Предупреждения" : "Информация"}
                      </span>
                    )}
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    dataKey="fatal"
                    stroke={SEVERITY_COLORS.fatal}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="fatal"
                  />
                  <Line
                    type="monotone"
                    dataKey="warning"
                    stroke={SEVERITY_COLORS.warning}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="warning"
                  />
                  <Line
                    type="monotone"
                    dataKey="info"
                    stroke={SEVERITY_COLORS.info}
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    strokeDasharray="4 4"
                    name="info"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Errors by stage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              По этапам пайплайна
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byStage.isLoading ? (
              <ChartSkeleton />
            ) : (byStage.data?.length ?? 0) === 0 ? (
              <EmptyState message="Нет данных" />
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {byStage.data?.map((s) => (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate max-w-[160px]" title={s.stage}>
                        {STAGE_LABELS[s.stage] || s.stage}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {s.fatal > 0 && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            {s.fatal}
                          </Badge>
                        )}
                        {s.warning > 0 && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
                            {s.warning}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{s.total}</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary/50 rounded-full h-1.5">
                      <div className="flex h-full rounded-full overflow-hidden">
                        {s.fatal > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(s.fatal / s.total) * 100}%`,
                              backgroundColor: SEVERITY_COLORS.fatal,
                            }}
                          />
                        )}
                        {s.warning > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(s.warning / s.total) * 100}%`,
                              backgroundColor: SEVERITY_COLORS.warning,
                            }}
                          />
                        )}
                        {s.info > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(s.info / s.total) * 100}%`,
                              backgroundColor: SEVERITY_COLORS.info,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Восстановлено: {s.recoveryRate}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error types bar chart */}
      {(byType.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Типы ошибок
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, (byType.data?.length ?? 0) * 36)}>
              <BarChart
                data={byType.data?.slice(0, 15)}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="errorType"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  width={160}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, props: any) => {
                    const severity = props.payload?.severity || "warning";
                    return [value, SEVERITY_LABELS[severity] || severity];
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Количество"
                  radius={[0, 4, 4, 0]}
                  fill="hsl(220, 70%, 55%)"
                >
                  {byType.data?.slice(0, 15).map((entry: { severity: string }, i: number) => {
                    const color = SEVERITY_COLORS[entry.severity] || "hsl(220, 70%, 55%)";
                    return <rect key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent errors feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Последние ошибки
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-secondary/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <EmptyState message="Нет ошибок — всё работает отлично!" icon="success" />
          ) : (
            <div className="divide-y divide-border">
              {recent.data?.map((err) => (
                <div key={err.id} className="py-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <SeverityIcon severity={err.severity} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {STAGE_LABELS[err.stage] || err.stage}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0"
                          >
                            {err.errorType}
                          </Badge>
                          {err.mode && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {err.mode === "quick" ? "быстрый" : "пошаговый"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[500px]">
                          {err.message}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(err.createdAt).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {err.recovered && (
                        <Badge className="text-[9px] px-1.5 py-0 mt-1 bg-green-100 text-green-800 hover:bg-green-100">
                          Восстановлено
                        </Badge>
                      )}
                    </div>
                  </div>
                  {err.recoveryAction && (
                    <p className="text-[10px] text-muted-foreground/70 ml-6 italic">
                      → {err.recoveryAction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon,
  loading,
  highlight,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-red-200 bg-red-50/30" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          {icon}
        </div>
        {loading ? (
          <div className="h-8 w-20 bg-secondary/50 rounded animate-pulse" />
        ) : (
          <p className={`text-2xl font-semibold tracking-tight ${highlight ? "text-red-600" : ""}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "fatal":
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    default:
      return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
  }
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: "success" }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] gap-2">
      {icon === "success" ? (
        <ShieldCheck className="w-8 h-8 text-green-400" />
      ) : (
        <Info className="w-8 h-8 text-muted-foreground/40" />
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
