/**
 * Analytics Dashboard — Usage metrics and generation statistics.
 * Clean Light Design: card-based layout with Recharts visualizations.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, CheckCircle, XCircle, Layers, Percent } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(260, 60%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(300, 50%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(180, 55%, 45%)",
];

const STATUS_COLORS: Record<string, string> = {
  completed: "hsl(142, 71%, 45%)",
  failed: "hsl(0, 72%, 51%)",
  processing: "hsl(217, 91%, 60%)",
  pending: "hsl(45, 93%, 47%)",
  cancelled: "hsl(0, 0%, 60%)",
  awaiting_outline_approval: "hsl(280, 60%, 55%)",
  awaiting_content_approval: "hsl(260, 60%, 55%)",
  assembling: "hsl(200, 70%, 50%)",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Завершено",
  failed: "Ошибка",
  processing: "В процессе",
  pending: "Ожидание",
  cancelled: "Отменено",
  awaiting_outline_approval: "Ожидание утверждения структуры",
  awaiting_content_approval: "Ожидание утверждения контента",
  assembling: "Сборка",
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

function getDateRangeForDaily(range: DateRange): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const days = range === "all" ? 365 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    dateFrom: from.toISOString(),
    dateTo: now.toISOString(),
  };
}

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const [range, setRange] = useState<DateRange>("30d");

  const dateRange = useMemo(() => getDateRange(range), [range]);
  const dailyRange = useMemo(() => getDateRangeForDaily(range), [range]);

  const overview = trpc.analytics.overview.useQuery(dateRange, { enabled: !!user });
  const dailyCounts = trpc.analytics.dailyCounts.useQuery(dailyRange, { enabled: !!user });
  const statusDist = trpc.analytics.statusDistribution.useQuery(dateRange, { enabled: !!user });
  const themeDist = trpc.analytics.themeDistribution.useQuery(dateRange, { enabled: !!user });
  const modeDist = trpc.analytics.modeDistribution.useQuery(dateRange, { enabled: !!user });
  const slideDist = trpc.analytics.slideCountDistribution.useQuery(dateRange, { enabled: !!user });
  const recent = trpc.analytics.recentPresentations.useQuery({ limit: 8 }, { enabled: !!user });

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
        <p className="text-muted-foreground">Войдите для просмотра аналитики</p>
      </div>
    );
  }

  const isLoading = overview.isLoading;
  const metrics = overview.data;

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Статистика генерации презентаций
          </p>
        </div>
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

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Всего"
          value={metrics?.totalPresentations ?? 0}
          icon={<BarChart3 className="w-4 h-4" />}
          loading={isLoading}
        />
        <MetricCard
          title="Завершено"
          value={metrics?.completedPresentations ?? 0}
          icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Ср. слайдов"
          value={metrics?.averageSlideCount ?? 0}
          icon={<Layers className="w-4 h-4 text-blue-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Успешность"
          value={`${metrics?.successRate ?? 0}%`}
          icon={<Percent className="w-4 h-4 text-purple-500" />}
          loading={isLoading}
        />
      </div>

      {/* Charts row 1: Daily trend + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily creation trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Генерации по дням
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCounts.isLoading ? (
              <ChartSkeleton />
            ) : (dailyCounts.data?.length ?? 0) === 0 ? (
              <EmptyChart message="Нет данных за выбранный период" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyCounts.data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                  <Bar dataKey="count" name="Генерации" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Статусы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.isLoading ? (
              <ChartSkeleton />
            ) : (statusDist.data?.length ?? 0) === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusDist.data?.map((d) => ({
                      ...d,
                      label: STATUS_LABELS[d.status] || d.status,
                    }))}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {statusDist.data?.map((entry, i) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Theme + Mode + Slide count */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Theme distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Популярные темы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {themeDist.isLoading ? (
              <ChartSkeleton />
            ) : (themeDist.data?.length ?? 0) === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={themeDist.data?.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="theme"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Генерации" fill="hsl(260, 60%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mode distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Режимы генерации
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modeDist.isLoading ? (
              <ChartSkeleton />
            ) : (modeDist.data?.length ?? 0) === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <div className="space-y-4 pt-4">
                {modeDist.data?.map((item) => {
                  const total = modeDist.data?.reduce((s, d) => s + d.count, 0) || 1;
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.mode} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {item.mode === "batch" ? "Автоматический" : "Интерактивный"}
                        </span>
                        <span className="text-muted-foreground">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.mode === "batch" ? "hsl(220, 70%, 55%)" : "hsl(280, 60%, 55%)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slide count distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Количество слайдов
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slideDist.isLoading ? (
              <ChartSkeleton />
            ) : (slideDist.data?.length ?? 0) === 0 ? (
              <EmptyChart message="Нет данных" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={slideDist.data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="slideCount"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Слайдов", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Презентации" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Последние генерации
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-secondary/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Нет генераций
            </p>
          ) : (
            <div className="divide-y divide-border">
              {recent.data?.map((p) => (
                <div key={p.presentationId} className="flex items-center justify-between py-2.5 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {p.title || p.prompt?.slice(0, 60) || "Без названия"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.createdAt).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {p.slideCount || 0} слайдов
                      {" · "}
                      {p.mode === "batch" ? "авто" : "интерактивный"}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
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
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] shrink-0">
      {label}
    </Badge>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
