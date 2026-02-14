/**
 * analyticsDb.ts — Database queries for the analytics dashboard.
 * Aggregates presentation generation metrics from the presentations table.
 */

import { sql, eq, and, gte, lte, count, avg } from "drizzle-orm";
import { getDb } from "./db";
import { presentations } from "../drizzle/schema";

export interface OverviewMetrics {
  totalPresentations: number;
  completedPresentations: number;
  failedPresentations: number;
  averageSlideCount: number;
  successRate: number;
}

export interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface ThemeDistribution {
  theme: string;
  count: number;
}

export interface ModeDistribution {
  mode: string;
  count: number;
}

export interface SlideCountDistribution {
  slideCount: number;
  count: number;
}

/**
 * Get overview metrics for the analytics dashboard.
 */
export async function getOverviewMetrics(
  dateFrom?: Date,
  dateTo?: Date
): Promise<OverviewMetrics> {
  const db = await getDb();
  if (!db) {
    return {
      totalPresentations: 0,
      completedPresentations: 0,
      failedPresentations: 0,
      averageSlideCount: 0,
      successRate: 0,
    };
  }

  const conditions = [];
  if (dateFrom) conditions.push(gte(presentations.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(presentations.createdAt, dateTo));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [result] = await db
    .select({
      total: count(),
      completed: sql<number>`SUM(CASE WHEN ${presentations.status} = 'completed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${presentations.status} = 'failed' THEN 1 ELSE 0 END)`,
      avgSlides: sql<number>`COALESCE(AVG(CASE WHEN ${presentations.slideCount} > 0 THEN ${presentations.slideCount} END), 0)`,
    })
    .from(presentations)
    .where(whereClause);

  const total = result.total || 0;
  const completed = Number(result.completed) || 0;
  const failed = Number(result.failed) || 0;

  return {
    totalPresentations: total,
    completedPresentations: completed,
    failedPresentations: failed,
    averageSlideCount: Math.round((Number(result.avgSlides) || 0) * 10) / 10,
    successRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
  };
}

/**
 * Get daily presentation creation counts for a date range.
 */
export async function getDailyCreationCounts(
  dateFrom: Date,
  dateTo: Date
): Promise<DailyCount[]> {
  const db = await getDb();
  if (!db) return [];

  // Use raw SQL to avoid drizzle-orm GROUP BY expression mismatch with only_full_group_by
  const rows = await db.execute(
    sql.raw(
      `SELECT DATE(createdAt) AS date_val, COUNT(*) AS cnt FROM presentations WHERE createdAt >= '${dateFrom.toISOString().slice(0, 19).replace("T", " ")}' AND createdAt <= '${dateTo.toISOString().slice(0, 19).replace("T", " ")}' GROUP BY date_val ORDER BY date_val`
    )
  );

  const data = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) as Array<{ date_val: string; cnt: number }>;

  return data.map((r) => ({
    date: String(r.date_val),
    count: Number(r.cnt),
  }));
}

/**
 * Get presentation count grouped by status.
 */
export async function getStatusDistribution(
  dateFrom?: Date,
  dateTo?: Date
): Promise<StatusDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (dateFrom) conditions.push(gte(presentations.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(presentations.createdAt, dateTo));

  const rows = await db
    .select({
      status: presentations.status,
      count: count(),
    })
    .from(presentations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(presentations.status)
    .orderBy(sql`count(*) DESC`);

  return rows.map((r) => ({ status: r.status, count: r.count }));
}

/**
 * Get presentation count grouped by theme preset.
 */
export async function getThemeDistribution(
  dateFrom?: Date,
  dateTo?: Date
): Promise<ThemeDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (dateFrom) conditions.push(gte(presentations.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(presentations.createdAt, dateTo));

  // Use raw SQL to avoid drizzle-orm GROUP BY expression mismatch with only_full_group_by
  let whereSQL = "";
  const params: Date[] = [];
  if (dateFrom) {
    whereSQL += " AND created_at >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    whereSQL += " AND created_at <= ?";
    params.push(dateTo);
  }

  const rows = await db.execute(
    sql.raw(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(config, '$.theme_preset')) AS theme, COUNT(*) AS cnt FROM presentations WHERE 1=1${whereSQL} GROUP BY theme ORDER BY cnt DESC`
    )
  );

  // drizzle raw execute returns [rows, fields]
  const data = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) as Array<{ theme: string; cnt: number }>;
  return data
    .filter((r) => r.theme && r.theme !== "null")
    .map((r) => ({ theme: r.theme, count: Number(r.cnt) }));
}

/**
 * Get presentation count grouped by generation mode.
 */
export async function getModeDistribution(
  dateFrom?: Date,
  dateTo?: Date
): Promise<ModeDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (dateFrom) conditions.push(gte(presentations.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(presentations.createdAt, dateTo));

  const rows = await db
    .select({
      mode: presentations.mode,
      count: count(),
    })
    .from(presentations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(presentations.mode)
    .orderBy(sql`count(*) DESC`);

  return rows.map((r) => ({ mode: r.mode, count: r.count }));
}

/**
 * Get slide count distribution (how many presentations have N slides).
 */
export async function getSlideCountDistribution(
  dateFrom?: Date,
  dateTo?: Date
): Promise<SlideCountDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [sql`${presentations.slideCount} > 0`];
  if (dateFrom) conditions.push(gte(presentations.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(presentations.createdAt, dateTo));

  const rows = await db
    .select({
      slideCount: presentations.slideCount,
      count: count(),
    })
    .from(presentations)
    .where(and(...conditions))
    .groupBy(presentations.slideCount)
    .orderBy(presentations.slideCount);

  return rows.map((r) => ({
    slideCount: r.slideCount || 0,
    count: r.count,
  }));
}

/**
 * Get recent presentations (for activity feed).
 */
export async function getRecentPresentations(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      presentationId: presentations.presentationId,
      title: presentations.title,
      prompt: presentations.prompt,
      status: presentations.status,
      mode: presentations.mode,
      slideCount: presentations.slideCount,
      createdAt: presentations.createdAt,
    })
    .from(presentations)
    .orderBy(sql`${presentations.createdAt} DESC`)
    .limit(limit);

  return rows;
}

// ═══════════════════════════════════════════════════════
// EXPORT TRACKING & A/B THEME QUALITY METRICS
// ═══════════════════════════════════════════════════════

import { exportEvents } from "../drizzle/schema";

export interface ThemeQualityMetric {
  theme: string;
  totalPresentations: number;
  completedPresentations: number;
  exportedPresentations: number;
  totalExports: number;
  completionRate: number; // % of presentations that completed
  exportRate: number; // % of completed presentations that were exported
  qualityScore: number; // weighted score combining completion + export rate
}

/**
 * Log an export event (PPTX or PDF download).
 */
export async function logExportEvent(
  presentationId: string,
  format: "pptx" | "pdf",
  themePreset: string | null,
  isShared: boolean = false
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(exportEvents).values({
    presentationId,
    format,
    themePreset,
    isShared,
  });
}

/**
 * Get A/B theme quality metrics — measures which themes lead to more exports.
 * Quality score = 0.4 * completionRate + 0.6 * exportRate
 */
export async function getThemeQualityMetrics(
  dateFrom?: Date,
  dateTo?: Date
): Promise<ThemeQualityMetric[]> {
  const db = await getDb();
  if (!db) return [];

  let dateFilter = "";
  if (dateFrom) {
    dateFilter += ` AND p.createdAt >= '${dateFrom.toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  if (dateTo) {
    dateFilter += ` AND p.createdAt <= '${dateTo.toISOString().slice(0, 19).replace("T", " ")}'`;
  }

  const rows = await db.execute(
    sql.raw(`
      SELECT
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.config, '$.theme_preset')), 'auto') AS theme,
        COUNT(DISTINCT p.presentationId) AS total_presentations,
        COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.presentationId END) AS completed_presentations,
        COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN p.presentationId END) AS exported_presentations,
        COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_exports
      FROM presentations p
      LEFT JOIN export_events e ON e.presentationId = p.presentationId
      WHERE 1=1${dateFilter}
      GROUP BY theme
      HAVING total_presentations >= 1
      ORDER BY total_presentations DESC
    `)
  );

  const data = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) as Array<{
    theme: string;
    total_presentations: number;
    completed_presentations: number;
    exported_presentations: number;
    total_exports: number;
  }>;

  return data
    .filter((r) => r.theme && r.theme !== "null")
    .map((r) => {
      const total = Number(r.total_presentations);
      const completed = Number(r.completed_presentations);
      const exported = Number(r.exported_presentations);
      const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
      const exportRate = completed > 0 ? Math.round((exported / completed) * 1000) / 10 : 0;
      const qualityScore = Math.round((0.4 * completionRate + 0.6 * exportRate) * 10) / 10;

      return {
        theme: r.theme,
        totalPresentations: total,
        completedPresentations: completed,
        exportedPresentations: exported,
        totalExports: Number(r.total_exports),
        completionRate,
        exportRate,
        qualityScore,
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

/**
 * Get export counts grouped by format.
 */
export async function getExportFormatDistribution(
  dateFrom?: Date,
  dateTo?: Date
): Promise<Array<{ format: string; count: number }>> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (dateFrom) conditions.push(gte(exportEvents.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(exportEvents.createdAt, dateTo));

  const rows = await db
    .select({
      format: exportEvents.format,
      count: count(),
    })
    .from(exportEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(exportEvents.format)
    .orderBy(sql`count(*) DESC`);

  return rows.map((r) => ({ format: r.format, count: r.count }));
}
