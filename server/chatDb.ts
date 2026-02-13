/**
 * Chat Database Helpers — CRUD operations for chat_sessions table.
 */
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { chatSessions, type ChatMessage, type ChatSession, type InsertChatSession } from "../drizzle/schema";
import { nanoid } from "nanoid";

export async function createChatSession(userId?: number): Promise<ChatSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionId = nanoid(16);
  const values: InsertChatSession = {
    sessionId,
    userId: userId || null,
    topic: "",
    messages: [],
    phase: "idle",
    mode: null,
    presentationId: null,
    metadata: {},
  };

  await db.insert(chatSessions).values(values);

  const result = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.sessionId, sessionId))
    .limit(1);

  return result[0];
}

export async function getChatSession(sessionId: string): Promise<ChatSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.sessionId, sessionId))
    .limit(1);

  return result[0];
}

export async function listChatSessions(userId?: number, limit = 50): Promise<ChatSession[]> {
  const db = await getDb();
  if (!db) return [];

  if (userId) {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.createdAt))
    .limit(limit);
}

export async function updateChatSession(
  sessionId: string,
  data: {
    topic?: string;
    messages?: ChatMessage[];
    phase?: string;
    mode?: string;
    presentationId?: string;
    metadata?: Record<string, any>;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateSet: Record<string, any> = {};
  if (data.topic !== undefined) updateSet.topic = data.topic;
  if (data.messages !== undefined) updateSet.messages = data.messages;
  if (data.phase !== undefined) updateSet.phase = data.phase;
  if (data.mode !== undefined) updateSet.mode = data.mode;
  if (data.presentationId !== undefined) updateSet.presentationId = data.presentationId;
  if (data.metadata !== undefined) updateSet.metadata = data.metadata;

  if (Object.keys(updateSet).length === 0) return;

  await db
    .update(chatSessions)
    .set(updateSet)
    .where(eq(chatSessions.sessionId, sessionId));
}

export async function appendMessage(sessionId: string, message: ChatMessage): Promise<ChatMessage[]> {
  const session = await getChatSession(sessionId);
  if (!session) throw new Error(`Chat session ${sessionId} not found`);

  const messages = [...(session.messages || []), message];
  await updateChatSession(sessionId, { messages });
  return messages;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(chatSessions).where(eq(chatSessions.sessionId, sessionId));
}
