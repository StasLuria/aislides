/**
 * errorAnalyticsDb.ts — Database queries for error analytics dashboard.
 * Aggregates generation error data from the generation_errors table.
 */

import { sql, and, gte, lte, count, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { generationErrors } from "../drizzle/schema";

// ─── Interfaces ──────────────────────────────────────────────

export interface ErrorOverview {
  totalErrors: number;
  fatalErrors: number;
  warnings: number;
  recoveredErrors: number;
  recoveryRate: number; // percentage
  topStage: string | null;
  topErrorType: string | null;
}

export interface ErrorsByStage {
  stage: string;
  total: number;
  fatal: number;
  warning: number;
  info: number;
  recoveryRate: number;
}

export interface ErrorsByType {
  errorType: string;
  count: number;
  severity: string;
  lastOccurred: string;
}

export interface ErrorTimeline {
  date: string; // YYYY-MM-DD
  fatal: number;
  warning: number;
  info: number;
}

export interface RecentError {
  id: number;
  presentationId: string | null;
  sessionId: string | null;
  severity: string;
  stage: string;
  errorType: string;
  message: string;
  recovered: boolean;
  recoveryAction: string | null;
  mode: string | null;
  context: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Helper ──────────────────────────────────────────────────

function buildDateConditions(dateFrom?: Date, dateTo?: Date) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(generationErrors.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(generationErrors.createdAt, dateTo));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ─── Queries ─────────────────────────────────────────────────

/**
 * Overview metrics for error analytics.
 */
export async function getErrorOverview(
  dateFrom?: Date,
  dateTo?: Date,
): Promise<ErrorOverview> {
  const db = await getDb();
  if (!db) {
    return {
      totalErrors: 0,
      fatalErrors: 0,
      warnings: 0,
      recoveredErrors: 0,
      recoveryRate: 0,
      topStage: null,
      topErrorType: null,
    };
  }

  const where = buildDateConditions(dateFrom, dateTo);

  // Aggregate counts
  const [agg] = await db
    .select({
      total: count(),
      fatal: sql<number>`SUM(CASE WHEN ${generationErrors.severity} = 'fatal' THEN 1 ELSE 0 END)`,
      warning: sql<number>`SUM(CASE WHEN ${generationErrors.severity} = 'warning' THEN 1 ELSE 0 END)`,
      recovered: sql<number>`SUM(CASE WHEN ${generationErrors.recovered} = true THEN 1 ELSE 0 END)`,
    })
    .from(generationErrors)
    .where(where);

  const total = agg.total || 0;
  const fatal = Number(agg.fatal) || 0;
  const warning = Number(agg.warning) || 0;
  const recovered = Number(agg.recovered) || 0;

  // Top stage by error count
  const topStageResult = await db
    .select({
      stage: generationErrors.stage,
      cnt: count(),
    })
    .from(generationErrors)
    .where(where)
    .groupBy(generationErrors.stage)
    .orderBy(desc(count()))
    .limit(1);

  // Top error type
  const topTypeResult = await db
    .select({
      errorType: generationErrors.errorType,
      cnt: count(),
    })
    .from(generationErrors)
    .where(where)
    .groupBy(generationErrors.errorType)
    .orderBy(desc(count()))
    .limit(1);

  return {
    totalErrors: total,
    fatalErrors: fatal,
    warnings: warning,
    recoveredErrors: recovered,
    recoveryRate: total > 0 ? Math.round((recovered / total) * 1000) / 10 : 0,
    topStage: topStageResult[0]?.stage || null,
    topErrorType: topTypeResult[0]?.errorType || null,
  };
}

/**
 * Errors grouped by pipeline stage.
 */
export async function getErrorsByStage(
  dateFrom?: Date,
  dateTo?: Date,
): Promise<ErrorsByStage[]> {
  const db = await getDb();
  if (!db) return [];

  const where = buildDateConditions(dateFrom, dateTo);

  const rows = await db
    .select({
      stage: generationErrors.stage,
      total: count(),
      fatal: sql<number>`SUM(CASE WHEN ${generationErrors.severity} = 'fatal' THEN 1 ELSE 0 END)`,
      warning: sql<number>`SUM(CASE WHEN ${generationErrors.severity} = 'warning' THEN 1 ELSE 0 END)`,
      info: sql<number>`SUM(CASE WHEN ${generationErrors.severity} = 'info' THEN 1 ELSE 0 END)`,
      recovered: sql<number>`SUM(CASE WHEN ${generationErrors.recovered} = true THEN 1 ELSE 0 END)`,
    })
    .from(generationErrors)
    .where(where)
    .groupBy(generationErrors.stage)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    stage: r.stage,
    total: r.total || 0,
    fatal: Number(r.fatal) || 0,
    warning: Number(r.warning) || 0,
    info: Number(r.info) || 0,
    recoveryRate:
      r.total > 0
        ? Math.round((Number(r.recovered || 0) / r.total) * 1000) / 10
        : 0,
  }));
}

/**
 * Errors grouped by error type.
 */
export async function getErrorsByType(
  dateFrom?: Date,
  dateTo?: Date,
): Promise<ErrorsByType[]> {
  const db = await getDb();
  if (!db) return [];

  const where = buildDateConditions(dateFrom, dateTo);

  const rows = await db
    .select({
      errorType: generationErrors.errorType,
      cnt: count(),
      severity: sql<string>`(SELECT severity FROM generation_errors ge2 WHERE ge2.errorType = ${generationErrors.errorType} ORDER BY ge2.createdAt DESC LIMIT 1)`,
      lastOccurred: sql<string>`MAX(${generationErrors.createdAt})`,
    })
    .from(generationErrors)
    .where(where)
    .groupBy(generationErrors.errorType)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    errorType: r.errorType,
    count: r.cnt || 0,
    severity: r.severity || "warning",
    lastOccurred: r.lastOccurred || "",
  }));
}

/**
 * Daily error timeline for charts.
 */
export async function getErrorTimeline(
  dateFrom: Date,
  dateTo: Date,
): Promise<ErrorTimeline[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT
      DATE(createdAt) as date,
      SUM(CASE WHEN severity = 'fatal' THEN 1 ELSE 0 END) as fatal,
      SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info
    FROM generation_errors
    WHERE createdAt >= ${dateFrom} AND createdAt <= ${dateTo}
    GROUP BY DATE(createdAt)
    ORDER BY date ASC
  `);

  return (rows as any[]).map((r: any) => ({
    date: String(r.date),
    fatal: Number(r.fatal) || 0,
    warning: Number(r.warning) || 0,
    info: Number(r.info) || 0,
  }));
}

/**
 * Recent errors list (for activity feed).
 */
export async function getRecentErrors(limit = 20): Promise<RecentError[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(generationErrors)
    .orderBy(desc(generationErrors.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    presentationId: r.presentationId,
    sessionId: r.sessionId,
    severity: r.severity,
    stage: r.stage,
    errorType: r.errorType,
    message: r.message,
    recovered: r.recovered,
    recoveryAction: r.recoveryAction,
    mode: r.mode,
    context: r.context as Record<string, unknown> | null,
    createdAt: r.createdAt,
  }));
}
