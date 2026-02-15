import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Share token for public access */
  shareToken: varchar("shareToken", { length: 64 }),
  /** Whether sharing is enabled */
  shareEnabled: boolean("shareEnabled").default(false).notNull(),
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
  /** Chat topic / presentation title (text for long prompts) */
  topic: text("topic").default(""),
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
  /** Optional: attached files */
  files?: ChatFileRef[];
}

export interface ChatFileRef {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  s3Url: string;
}

export interface ChatAction {
  id: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat files table — stores uploaded files for chat sessions.
 */
export const chatFiles = mysqlTable("chat_files", {
  id: int("id").autoincrement().primaryKey(),
  /** Public-facing file ID */
  fileId: varchar("fileId", { length: 64 }).notNull().unique(),
  /** Linked session ID */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Original filename */
  filename: varchar("filename", { length: 512 }).notNull(),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  /** File size in bytes */
  fileSize: int("fileSize").notNull(),
  /** S3 URL */
  s3Url: text("s3Url").notNull(),
  /** Extracted text content (for PDF, DOCX, TXT, PPTX) */
  extractedText: text("extractedText"),
  /** Status: uploading, ready, error */
  status: mysqlEnum("status", ["uploading", "ready", "error"]).default("uploading").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatFile = typeof chatFiles.$inferSelect;
export type InsertChatFile = typeof chatFiles.$inferInsert;

/**
 * Custom templates table — stores user-uploaded presentation templates.
 * Templates are analyzed by LLM to extract CSS variables, fonts, and style metadata.
 */
export const customTemplates = mysqlTable("custom_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Public-facing template ID */
  templateId: varchar("templateId", { length: 64 }).notNull().unique(),
  /** Owner user ID (nullable for anonymous) */
  userId: int("userId"),
  /** Template display name */
  name: varchar("name", { length: 256 }).notNull(),
  /** Template description */
  description: text("description"),
  /** Original uploaded file URL in S3 */
  sourceFileUrl: text("sourceFileUrl").notNull(),
  /** Original filename */
  sourceFilename: varchar("sourceFilename", { length: 512 }).notNull(),
  /** MIME type of source file */
  sourceMimeType: varchar("sourceMimeType", { length: 128 }).notNull(),
  /** Thumbnail preview URL in S3 */
  thumbnailUrl: text("thumbnailUrl"),
  /** Extracted CSS variables (full :root block) */
  cssVariables: text("cssVariables"),
  /** Google Fonts URL for the template fonts */
  fontsUrl: text("fontsUrl"),
  /** Extracted color palette as JSON [{name, hex}] */
  colorPalette: json("colorPalette").$type<Array<{name: string; hex: string}>>(),
  /** Extracted font families as JSON */
  fontFamilies: json("fontFamilies").$type<Array<string>>(),
  /** LLM-generated mood/style description */
  mood: text("mood"),
  /** Processing status */
  status: mysqlEnum("status", ["uploading", "analyzing", "ready", "error"]).default("uploading").notNull(),
  /** Error message if processing failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type InsertCustomTemplate = typeof customTemplates.$inferInsert;

/**
 * Slide versions table — stores version history for each slide edit.
 * Each time a slide is edited, the previous state is saved as a version.
 */
export const slideVersions = mysqlTable("slide_versions", {
  id: int("id").autoincrement().primaryKey(),
  /** Linked presentation ID (public UUID) */
  presentationId: varchar("presentationId", { length: 64 }).notNull(),
  /** Slide index (0-based) */
  slideIndex: int("slideIndex").notNull(),
  /** Version number (auto-incremented per slide) */
  versionNumber: int("versionNumber").notNull(),
  /** Snapshot of the slide HTML at this version */
  slideHtml: text("slideHtml").notNull(),
  /** Snapshot of the slide data JSON at this version */
  slideData: json("slideData"),
  /** What triggered this version: 'edit', 'regenerate', 'initial' */
  changeType: varchar("changeType", { length: 32 }).default("edit").notNull(),
  /** Optional description of what changed */
  changeDescription: varchar("changeDescription", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SlideVersion = typeof slideVersions.$inferSelect;
export type InsertSlideVersion = typeof slideVersions.$inferInsert;

/**
 * Export events table — tracks PPTX/PDF downloads for A/B theme quality metrics.
 * Each download is logged with the presentation ID, format, and theme used.
 */
export const exportEvents = mysqlTable("export_events", {
  id: int("id").autoincrement().primaryKey(),
  /** Linked presentation ID (public UUID) */
  presentationId: varchar("presentationId", { length: 64 }).notNull(),
  /** Export format: pptx or pdf */
  format: mysqlEnum("format", ["pptx", "pdf"]).notNull(),
  /** Theme preset used in the presentation */
  themePreset: varchar("themePreset", { length: 64 }),
  /** Whether this was a shared link export */
  isShared: boolean("isShared").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExportEvent = typeof exportEvents.$inferSelect;
export type InsertExportEvent = typeof exportEvents.$inferInsert;
