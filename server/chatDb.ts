/**
 * Chat session database helpers — CRUD for chat_sessions table.
 */
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { chatSessions, type ChatSession, type InsertChatSession } from "../drizzle/schema";
import { nanoid } from "nanoid";

/** Message stored in the chat history */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Optional: structured data attached to this message */
  data?: {
    type?: "slide_preview" | "structure" | "progress" | "mode_selection" | "final_result" | "error";
    slideHtml?: string;
    slideIndex?: number;
    structure?: Array<{ slideNumber: number; title: string; layoutHint: string }>;
    presentationId?: string;
    progress?: number;
    buttons?: Array<{ label: string; action: string; variant?: "default" | "outline" }>;
  };
  timestamp: number;
}

/** Working state persisted between messages */
export interface ChatWorkingState {
  /** Presentation outline from planner */
  outline?: Array<{ slideNumber: number; title: string; description: string; layoutHint: string; speakerNotes?: string }>;
  /** Theme CSS */
  themeCss?: string;
  /** Current slide index being worked on (0-based) */
  currentSlideIndex?: number;
  /** Accumulated slide data for step-by-step mode */
  slides?: Array<{ layoutId: string; data: Record<string, any>; html?: string }>;
  /** Config: slide count, theme preset, etc. */
  config?: Record<string, any>;
  /** Language detected from topic */
  language?: string;
  /** Presentation title */
  title?: string;
  /** Fonts URL for theme */
  fontsUrl?: string;
}

export async function createChatSession(userId?: number): Promise<ChatSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionId = nanoid(16);
  const greeting: ChatMessage = {
    id: nanoid(8),
    role: "assistant",
    content: "Привет! Я помогу создать презентацию. Опишите тему — и мы начнём.",
    timestamp: Date.now(),
  };

  const values: InsertChatSession = {
    sessionId,
    userId: userId || null,
    phase: "greeting",
    messages: [greeting] as any,
    workingState: {} as any,
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

export async function listChatSessions(userId?: number, limit = 20): Promise<ChatSession[]> {
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
    phase?: ChatSession["phase"];
    mode?: "quick" | "stepbystep" | null;
    messages?: ChatMessage[];
    workingState?: ChatWorkingState;
    presentationId?: string;
    topic?: string;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateSet: Record<string, any> = {};
  if (data.phase !== undefined) updateSet.phase = data.phase;
  if (data.mode !== undefined) updateSet.mode = data.mode;
  if (data.messages !== undefined) updateSet.messages = data.messages;
  if (data.workingState !== undefined) updateSet.workingState = data.workingState;
  if (data.presentationId !== undefined) updateSet.presentationId = data.presentationId;
  if (data.topic !== undefined) updateSet.topic = data.topic;

  if (Object.keys(updateSet).length === 0) return;

  await db
    .update(chatSessions)
    .set(updateSet)
    .where(eq(chatSessions.sessionId, sessionId));
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(chatSessions).where(eq(chatSessions.sessionId, sessionId));
}
