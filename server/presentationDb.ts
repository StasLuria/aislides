/**
 * Presentation database helpers — CRUD operations for presentations table.
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { presentations, type InsertPresentation, type Presentation } from "../drizzle/schema";
import { nanoid } from "nanoid";

export async function createPresentation(data: {
  prompt: string;
  mode: "batch" | "interactive";
  config: Record<string, any>;
  userId?: number;
}): Promise<Presentation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const presentationId = nanoid(16);
  const values: InsertPresentation = {
    presentationId,
    prompt: data.prompt,
    mode: data.mode,
    status: "pending",
    currentStep: "pending",
    slideCount: data.config?.slide_count || 10,
    progressPercent: 0,
    config: data.config,
    userId: data.userId || null,
    title: "",
    language: "ru",
  };

  await db.insert(presentations).values(values);

  const result = await db
    .select()
    .from(presentations)
    .where(eq(presentations.presentationId, presentationId))
    .limit(1);

  return result[0];
}

export async function getPresentation(presentationId: string): Promise<Presentation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(presentations)
    .where(eq(presentations.presentationId, presentationId))
    .limit(1);

  return result[0];
}

export async function listPresentations(userId?: number, limit = 50): Promise<Presentation[]> {
  const db = await getDb();
  if (!db) return [];

  if (userId) {
    return db
      .select()
      .from(presentations)
      .where(eq(presentations.userId, userId))
      .orderBy(desc(presentations.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(presentations)
    .orderBy(desc(presentations.createdAt))
    .limit(limit);
}

export async function updatePresentationProgress(
  presentationId: string,
  data: {
    status?: "pending" | "processing" | "completed" | "failed" | "cancelled" | "awaiting_outline_approval" | "awaiting_content_approval" | "assembling";
    currentStep?: string;
    progressPercent?: number;
    title?: string;
    language?: string;
    themeCss?: string;
    pipelineState?: Record<string, any>;
    finalHtmlSlides?: any[];
    resultUrls?: Record<string, any>;
    errorInfo?: Record<string, any>;
    slideCount?: number;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateSet: Record<string, any> = {};
  if (data.status !== undefined) updateSet.status = data.status;
  if (data.currentStep !== undefined) updateSet.currentStep = data.currentStep;
  if (data.progressPercent !== undefined) updateSet.progressPercent = data.progressPercent;
  if (data.title !== undefined) updateSet.title = data.title;
  if (data.language !== undefined) updateSet.language = data.language;
  if (data.themeCss !== undefined) updateSet.themeCss = data.themeCss;
  if (data.pipelineState !== undefined) updateSet.pipelineState = data.pipelineState;
  if (data.finalHtmlSlides !== undefined) updateSet.finalHtmlSlides = data.finalHtmlSlides;
  if (data.resultUrls !== undefined) updateSet.resultUrls = data.resultUrls;
  if (data.errorInfo !== undefined) updateSet.errorInfo = data.errorInfo;
  if (data.slideCount !== undefined) updateSet.slideCount = data.slideCount;

  if (Object.keys(updateSet).length === 0) return;

  await db
    .update(presentations)
    .set(updateSet)
    .where(eq(presentations.presentationId, presentationId));
}

export async function deletePresentation(presentationId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(presentations).where(eq(presentations.presentationId, presentationId));
}
