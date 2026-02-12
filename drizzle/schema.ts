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
  /** Source file URL (S3) */
  sourceFileUrl: text("sourceFileUrl"),
  /** Source file name */
  sourceFileName: varchar("sourceFileName", { length: 512 }),
  /** Source file type */
  sourceFileType: varchar("sourceFileType", { length: 16 }),
  /** Extracted text content from source file (for pipeline context) */
  sourceContent: text("sourceContent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Presentation = typeof presentations.$inferSelect;
export type InsertPresentation = typeof presentations.$inferInsert;

/**
 * Chat sessions — stores conversation history and state for the unified chat-based creator.
 * Each chat session can optionally link to a presentation once generation starts.
 */
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Public-facing session ID */
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  /** Owner user ID (nullable for anonymous) */
  userId: int("userId"),
  /** Linked presentation ID (set when generation starts) */
  presentationId: varchar("presentationId", { length: 64 }),
  /** Chat state machine phase */
  phase: mysqlEnum("phase", [
    "greeting",
    "topic_received",
    "mode_selection",
    "generating_quick",
    "structure_review",
    "slide_content",
    "slide_design",
    "completed",
    "error",
  ]).default("greeting").notNull(),
  /** Selected generation mode */
  mode: mysqlEnum("chatMode", ["quick", "stepbystep"]),
  /** Full message history as JSON array */
  messages: json("messages"),
  /** Working state: outline, current slide index, accumulated slides, theme, etc. */
  workingState: json("workingState"),
  /** User's original prompt/topic */
  topic: text("topic"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;
