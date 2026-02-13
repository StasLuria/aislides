/**
 * Template Database Helpers — CRUD operations for custom_templates table.
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { customTemplates, type CustomTemplate, type InsertCustomTemplate } from "../drizzle/schema";
import { nanoid } from "nanoid";

export async function createCustomTemplate(
  data: Omit<InsertCustomTemplate, "templateId" | "id">,
): Promise<CustomTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const templateId = nanoid(16);
  const values: InsertCustomTemplate = {
    templateId,
    ...data,
  };

  await db.insert(customTemplates).values(values);

  const result = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.templateId, templateId))
    .limit(1);

  return result[0];
}

export async function getCustomTemplate(templateId: string): Promise<CustomTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.templateId, templateId))
    .limit(1);

  return result[0];
}

export async function listCustomTemplates(userId?: number, limit = 50): Promise<CustomTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  if (userId) {
    return db
      .select()
      .from(customTemplates)
      .where(and(
        eq(customTemplates.userId, userId),
        eq(customTemplates.status, "ready"),
      ))
      .orderBy(desc(customTemplates.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.status, "ready"))
    .orderBy(desc(customTemplates.createdAt))
    .limit(limit);
}

export async function updateCustomTemplate(
  templateId: string,
  data: Partial<InsertCustomTemplate>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(customTemplates)
    .set(data)
    .where(eq(customTemplates.templateId, templateId));
}

export async function deleteCustomTemplate(templateId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(customTemplates)
    .where(eq(customTemplates.templateId, templateId));
}
