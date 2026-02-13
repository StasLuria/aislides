import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Presentations table — stores presentation metadata, generation state, and results.
 */
export const presentations = mysqlTable("presentations", {
  id: int("id").autoincrement().primaryKey(),
  /** Public-facing UUID for API */
  presentationId: varchar("presentationId", { length: 64 }).notNull().unique(),
  /** Owner user ID (nullable for anonymous usage) */
  userId: int("userId"),
  /** User prompt / topic */
  prompt: text("prompt").notNull(),
  /** Generation mode: batch or interactive */
  mode: mysqlEnum("mode", ["batch", "interactive"]).default("batch").notNull(),
  /** Current status */
  status: mysqlEnum("status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
    "awaiting_outline_approval",
    "awaiting_content_approval",
    "assembling",
  ]).default("pending").notNull(),
  /** Current pipeline step name */
  currentStep: varchar("currentStep", { length: 64 }).default("pending"),
  /** Number of slides */
  slideCount: int("slideCount").default(0),
  /** Progress percentage 0-100 */
  progressPercent: int("progressPercent").default(0),
  /** Generation config (slide_count, theme_preset, etc.) */
  config: json("config"),
  /** Pipeline state: outline, content, theme, layout decisions */
  pipelineState: json("pipelineState"),
  /** Final HTML slides array */
  finalHtmlSlides: json("finalHtmlSlides"),
  /** Result URLs (html_preview, pptx, pdf) */
  resultUrls: json("resultUrls"),
  /** Error info if failed */
  errorInfo: json("errorInfo"),
  /** Presentation title (extracted by planner) */
  title: varchar("title", { length: 512 }).default(""),
  /** Language */
  language: varchar("language", { length: 10 }).default("ru"),
  /** Theme CSS variables */
  themeCss: text("themeCss"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Presentation = typeof presentations.$inferSelect;
export type InsertPresentation = typeof presentations.$inferInsert;

/**
 * Chat sessions table — stores chat conversations for presentation creation.
 */
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Public-facing session ID */
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  /** Owner user ID (nullable for anonymous) */
  userId: int("userId"),
  /** Chat topic / presentation title */
  topic: varchar("topic", { length: 512 }).default(""),
  /** Messages array as JSON */
  messages: json("messages").$type<ChatMessage[]>(),
  /** Current phase: idle, topic_received, mode_selection, generating, step_structure, step_content, step_design, completed */
  phase: varchar("phase", { length: 64 }).default("idle"),
  /** Generation mode: quick or step_by_step */
  mode: varchar("mode", { length: 32 }),
  /** Linked presentation ID (once generation starts) */
  presentationId: varchar("presentationId", { length: 64 }),
  /** Metadata: theme, slide count, etc. */
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Optional: action buttons to show */
  actions?: ChatAction[];
  /** Optional: slide preview HTML */
  slidePreview?: string;
  /** Optional: progress info */
  progress?: { percent: number; message: string };
  /** Optional: presentation link */
  presentationLink?: string;
}

export interface ChatAction {
  id: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;
