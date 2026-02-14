/**
 * analyticsExport.ts — CSV and PDF export for analytics data.
 * Generates downloadable reports from analytics metrics.
 */

import {
  getOverviewMetrics,
  getDailyCreationCounts,
  getStatusDistribution,
  getThemeDistribution,
  getModeDistribution,
  getSlideCountDistribution,
  getRecentPresentations,
} from "./analyticsDb";

// ─── CSV Export ───────────────────────────────────────────────

function escapeCsvField(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRows(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function generateAnalyticsCsv(
  dateFrom?: Date,
  dateTo?: Date
): Promise<string> {
  const [overview, statuses, themes, modes, slideCounts, recent] = await Promise.all([
    getOverviewMetrics(dateFrom, dateTo),
    getStatusDistribution(dateFrom, dateTo),
    getThemeDistribution(dateFrom, dateTo),
    getModeDistribution(dateFrom, dateTo),
    getSlideCountDistribution(dateFrom, dateTo),
    getRecentPresentations(50),
  ]);

  const sections: string[] = [];

  // Section 1: Overview
  sections.push("# Overview Metrics");
  sections.push(
    toCsvRows(
      ["Metric", "Value"],
      [
        ["Total Presentations", overview.totalPresentations],
        ["Completed", overview.completedPresentations],
        ["Failed", overview.failedPresentations],
        ["Average Slide Count", overview.averageSlideCount],
        ["Success Rate (%)", overview.successRate],
      ]
    )
  );

  // Section 2: Status Distribution
  sections.push("\n# Status Distribution");
  sections.push(
    toCsvRows(
      ["Status", "Count"],
      statuses.map((s) => [s.status, s.count])
    )
  );

  // Section 3: Theme Distribution
  sections.push("\n# Theme Distribution");
  sections.push(
    toCsvRows(
      ["Theme", "Count"],
      themes.map((t) => [t.theme, t.count])
    )
  );

  // Section 4: Mode Distribution
  sections.push("\n# Mode Distribution");
  sections.push(
    toCsvRows(
      ["Mode", "Count"],
      modes.map((m) => [m.mode, m.count])
    )
  );

  // Section 5: Slide Count Distribution
  sections.push("\n# Slide Count Distribution");
  sections.push(
    toCsvRows(
      ["Slide Count", "Presentations"],
      slideCounts.map((s) => [s.slideCount, s.count])
    )
  );

  // Section 6: Recent Presentations
  sections.push("\n# Recent Presentations");
  sections.push(
    toCsvRows(
      ["ID", "Title", "Status", "Mode", "Slides", "Created At"],
      recent.map((p) => [
        p.presentationId,
        p.title || p.prompt?.slice(0, 80) || "",
        p.status,
        p.mode,
        p.slideCount ?? 0,
        p.createdAt ? new Date(p.createdAt).toISOString() : "",
      ])
    )
  );

  return sections.join("\n");
}

// ─── PDF Export (HTML-based) ──────────────────────────────────

export async function generateAnalyticsPdfHtml(
  dateFrom?: Date,
  dateTo?: Date
): Promise<string> {
  const [overview, statuses, themes, modes, slideCounts, recent] = await Promise.all([
    getOverviewMetrics(dateFrom, dateTo),
    getStatusDistribution(dateFrom, dateTo),
    getThemeDistribution(dateFrom, dateTo),
    getModeDistribution(dateFrom, dateTo),
    getSlideCountDistribution(dateFrom, dateTo),
    getRecentPresentations(20),
  ]);

  const dateRange = dateFrom && dateTo
    ? `${dateFrom.toLocaleDateString("ru-RU")} — ${dateTo.toLocaleDateString("ru-RU")}`
    : "Все время";

  const statusColors: Record<string, string> = {
    completed: "#22c55e",
    failed: "#ef4444",
    pending: "#f59e0b",
    processing: "#3b82f6",
    cancelled: "#6b7280",
    assembling: "#8b5cf6",
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Аналитика — AI Slides</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 13px; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #1a1a2e; }
    .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
    h2 { font-size: 16px; margin: 24px 0 12px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #1a1a2e; }
    .kpi-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) { background: #fafbfc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; color: white; }
    .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .bar-label { width: 120px; font-size: 12px; color: #374151; }
    .bar-track { flex: 1; height: 20px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .bar-value { width: 60px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Аналитика генерации презентаций</h1>
  <div class="subtitle">Период: ${dateRange} · Сгенерировано: ${new Date().toLocaleString("ru-RU")}</div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${overview.totalPresentations}</div>
      <div class="kpi-label">Всего</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${overview.completedPresentations}</div>
      <div class="kpi-label">Завершено</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${overview.averageSlideCount}</div>
      <div class="kpi-label">Ср. слайдов</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${overview.successRate}%</div>
      <div class="kpi-label">Успешность</div>
    </div>
  </div>

  <h2>Распределение по статусам</h2>
  ${statuses
    .map((s) => {
      const total = statuses.reduce((sum, x) => sum + x.count, 0);
      const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
      const color = statusColors[s.status] || "#6b7280";
      return `<div class="bar-row">
        <div class="bar-label">${s.status}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bar-value">${s.count} (${pct}%)</div>
      </div>`;
    })
    .join("")}

  <h2>Распределение по темам дизайна</h2>
  <table>
    <tr><th>Тема</th><th>Количество</th><th>Доля</th></tr>
    ${themes
      .map((t) => {
        const total = themes.reduce((sum, x) => sum + x.count, 0);
        const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
        return `<tr><td>${t.theme}</td><td>${t.count}</td><td>${pct}%</td></tr>`;
      })
      .join("")}
  </table>

  <h2>Режимы генерации</h2>
  <table>
    <tr><th>Режим</th><th>Количество</th><th>Доля</th></tr>
    ${modes
      .map((m) => {
        const total = modes.reduce((sum, x) => sum + x.count, 0);
        const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
        return `<tr><td>${m.mode === "batch" ? "Автоматический" : "Интерактивный"}</td><td>${m.count}</td><td>${pct}%</td></tr>`;
      })
      .join("")}
  </table>

  <h2>Распределение по количеству слайдов</h2>
  <table>
    <tr><th>Слайдов</th><th>Презентаций</th></tr>
    ${slideCounts.map((s) => `<tr><td>${s.slideCount}</td><td>${s.count}</td></tr>`).join("")}
  </table>

  <h2>Последние генерации</h2>
  <table>
    <tr><th>Название</th><th>Статус</th><th>Режим</th><th>Слайдов</th><th>Дата</th></tr>
    ${recent
      .map((p) => {
        const title = p.title || (p.prompt ? p.prompt.slice(0, 50) + "..." : "—");
        const color = statusColors[p.status] || "#6b7280";
        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("ru-RU") : "—";
        return `<tr>
          <td>${title}</td>
          <td><span class="badge" style="background:${color}">${p.status}</span></td>
          <td>${p.mode === "batch" ? "авто" : "интер."}</td>
          <td>${p.slideCount ?? 0}</td>
          <td>${date}</td>
        </tr>`;
      })
      .join("")}
  </table>

  <div class="footer">AI Slides Analytics Report · ${new Date().toLocaleDateString("ru-RU")}</div>
</body>
</html>`;
}
