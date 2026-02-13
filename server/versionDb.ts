/**
 * Slide version database helpers — CRUD operations for slide_versions table.
 * Saves a snapshot of each slide before every edit, enabling rollback.
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { slideVersions, type SlideVersion } from "../drizzle/schema";

/**
 * Save a version snapshot of a slide before it is modified.
 */
export async function saveSlideVersion(data: {
  presentationId: string;
  slideIndex: number;
  slideHtml: string;
  slideData: any;
  changeType?: string;
  changeDescription?: string;
}): Promise<SlideVersion | null> {
  const db = await getDb();
  if (!db) return null;

  // Get the next version number for this slide
  const existing = await db
    .select({ versionNumber: slideVersions.versionNumber })
    .from(slideVersions)
    .where(
      and(
        eq(slideVersions.presentationId, data.presentationId),
        eq(slideVersions.slideIndex, data.slideIndex),
      ),
    )
    .orderBy(desc(slideVersions.versionNumber))
    .limit(1);

  const nextVersion = existing.length > 0 ? existing[0].versionNumber + 1 : 1;

  await db.insert(slideVersions).values({
    presentationId: data.presentationId,
    slideIndex: data.slideIndex,
    versionNumber: nextVersion,
    slideHtml: data.slideHtml,
    slideData: data.slideData,
    changeType: data.changeType || "edit",
    changeDescription: data.changeDescription || null,
  });

  // Fetch and return the inserted version
  const result = await db
    .select()
    .from(slideVersions)
    .where(
      and(
        eq(slideVersions.presentationId, data.presentationId),
        eq(slideVersions.slideIndex, data.slideIndex),
        eq(slideVersions.versionNumber, nextVersion),
      ),
    )
    .limit(1);

  return result[0] || null;
}

/**
 * List all versions for a specific slide, newest first.
 */
export async function listSlideVersions(
  presentationId: string,
  slideIndex: number,
): Promise<SlideVersion[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(slideVersions)
    .where(
      and(
        eq(slideVersions.presentationId, presentationId),
        eq(slideVersions.slideIndex, slideIndex),
      ),
    )
    .orderBy(desc(slideVersions.versionNumber));
}

/**
 * Get a specific version by ID.
 */
export async function getSlideVersion(versionId: number): Promise<SlideVersion | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(slideVersions)
    .where(eq(slideVersions.id, versionId))
    .limit(1);

  return result[0];
}

/**
 * List all versions for all slides of a presentation, newest first.
 */
export async function listAllVersions(presentationId: string): Promise<SlideVersion[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(slideVersions)
    .where(eq(slideVersions.presentationId, presentationId))
    .orderBy(desc(slideVersions.createdAt));
}
