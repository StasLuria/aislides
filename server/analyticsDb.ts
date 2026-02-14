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
