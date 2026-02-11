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
