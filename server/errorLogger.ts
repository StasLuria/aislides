/**
 * errorLogger.ts — Centralized error logging service for generation pipeline.
 *
 * Captures errors with full context (stage, type, severity, recovery status)
 * and persists them to the generation_errors table for analytics and monitoring.
 *
 * Usage:
 *   import { logError, logWarning, logInfo } from "./errorLogger";
 *
 *   // Fatal error (stops generation)
 *   logError({
 *     presentationId: "abc123",
 *     stage: "content_writer",
 *     errorType: "LLMError",
 *     message: "LLM returned empty response",
 *     error: err,
 *     context: { slideNumber: 3, retryCount: 2 },
 *   });
 *
 *   // Warning (generation continues with fallback)
 *   logWarning({
 *     presentationId: "abc123",
 *     stage: "image_generation",
 *     errorType: "ImageGenFailed",
 *     message: "Image generation failed, continuing without images",
 *     error: err,
 *     recovered: true,
 *     recoveryAction: "Skipped image generation for slide 3",
 *   });
 */

import { getDb } from "./db";
import { generationErrors } from "../drizzle/schema";

export interface ErrorLogEntry {
  presentationId?: string;
  sessionId?: string;
  severity?: "fatal" | "warning" | "info";
  stage: string;
  errorType: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
  mode?: string;
  recovered?: boolean;
  recoveryAction?: string;
}

/**
 * Core logging function — writes error to DB and console.
 * Non-blocking: errors in logging itself are caught and logged to console only.
 */
async function persistError(entry: ErrorLogEntry): Promise<void> {
  const severity = entry.severity ?? "warning";
  const tag = `[ErrorLogger:${severity.toUpperCase()}]`;

  // Always log to console for immediate visibility
  const consoleMsg = `${tag} [${entry.stage}] ${entry.errorType}: ${entry.message}`;
  if (severity === "fatal") {
    console.error(consoleMsg, entry.error || "");
  } else if (severity === "warning") {
    console.warn(consoleMsg, entry.error ? (entry.error as Error).message || "" : "");
  } else {
    console.log(consoleMsg);
  }

  // Persist to DB (non-blocking)
  try {
    const db = await getDb();
    if (!db) return;

    let stackTrace: string | undefined;
    if (entry.error instanceof Error) {
      stackTrace = entry.error.stack;
    } else if (entry.error) {
      stackTrace = String(entry.error);
    }

    await db.insert(generationErrors).values({
      presentationId: entry.presentationId || null,
      sessionId: entry.sessionId || null,
      severity,
      stage: entry.stage,
      errorType: entry.errorType,
      message: entry.message,
      stackTrace: stackTrace || null,
      context: entry.context || null,
      mode: entry.mode || null,
      recovered: entry.recovered ?? false,
      recoveryAction: entry.recoveryAction || null,
    });
  } catch (dbErr) {
    // Don't let logging failures break the app
    console.error(`${tag} Failed to persist error to DB:`, (dbErr as Error).message);
  }
}

/**
 * Log a fatal error (stops generation).
 */
export function logError(entry: Omit<ErrorLogEntry, "severity">): void {
  persistError({ ...entry, severity: "fatal" }).catch(() => {});
}

/**
 * Log a warning (generation continues, possibly with fallback).
 */
export function logWarning(entry: Omit<ErrorLogEntry, "severity">): void {
  persistError({ ...entry, severity: "warning" }).catch(() => {});
}

/**
 * Log an informational event (for monitoring, not an error).
 */
export function logInfo(entry: Omit<ErrorLogEntry, "severity">): void {
  persistError({ ...entry, severity: "info" }).catch(() => {});
}

/**
 * Convenience: wrap a function call with automatic error logging.
 * If the function throws, logs the error and re-throws.
 */
export async function withErrorLogging<T>(
  stage: string,
  errorType: string,
  fn: () => Promise<T>,
  opts?: Partial<ErrorLogEntry>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logError({
      stage,
      errorType,
      message: err instanceof Error ? err.message : String(err),
      error: err,
      ...opts,
    });
    throw err;
  }
}

/**
 * Convenience: wrap a function call with automatic warning logging on failure.
 * Returns the fallback value instead of throwing.
 */
export async function withFallback<T>(
  stage: string,
  errorType: string,
  fn: () => Promise<T>,
  fallback: T,
  opts?: Partial<ErrorLogEntry>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logWarning({
      stage,
      errorType,
      message: err instanceof Error ? err.message : String(err),
      error: err,
      recovered: true,
      recoveryAction: `Used fallback value`,
      ...opts,
    });
    return fallback;
  }
}
