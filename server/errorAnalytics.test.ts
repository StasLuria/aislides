/**
 * Tests for:
 * 1. errorLogger — logError, logWarning, logInfo, withErrorLogging, withFallback
 * 2. errorAnalyticsDb — query functions
 * 3. tRPC errorAnalytics router procedures
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB layer ──

const mockInsertValues: any[] = [];
const mockSelectRows: any[] = [];
const mockExecuteRows: any[] = [];

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    insert: vi.fn(() => ({
      values: vi.fn(async (vals: any) => {
        mockInsertValues.push(vals);
      }),
    })),
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => {
          // When where() is called without further chaining (like groupBy/orderBy/limit),
          // the result is awaited directly as an array via [Symbol.asyncIterator] or then()
          const thenableChain: any = {
            groupBy: vi.fn(() => thenableChain),
            orderBy: vi.fn(() => thenableChain),
            limit: vi.fn(() => Promise.resolve([...mockSelectRows])),
            then: (resolve: any, reject?: any) => Promise.resolve([...mockSelectRows]).then(resolve, reject),
            [Symbol.iterator]: () => mockSelectRows[Symbol.iterator](),
          };
          return thenableChain;
        }),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve([...mockSelectRows])),
        then: (resolve: any, reject?: any) => Promise.resolve([...mockSelectRows]).then(resolve, reject),
        [Symbol.iterator]: () => mockSelectRows[Symbol.iterator](),
      };
      return chain;
    }),
    execute: vi.fn(async () => mockExecuteRows),
  })),
}));

vi.mock("../drizzle/schema", () => ({
  generationErrors: {
    id: "id",
    presentationId: "presentationId",
    sessionId: "sessionId",
    severity: "severity",
    stage: "stage",
    errorType: "errorType",
    message: "message",
    stackTrace: "stackTrace",
    context: "context",
    mode: "mode",
    recovered: "recovered",
    recoveryAction: "recoveryAction",
    createdAt: "createdAt",
  },
}));

// ── Import after mocks ──
import { logError, logWarning, logInfo, withErrorLogging, withFallback } from "./errorLogger";

// ── Tests ──

describe("errorLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.length = 0;
  });

  describe("logError", () => {
    it("persists a fatal error to the database", async () => {
      logError({
        presentationId: "pres-1",
        stage: "content_writer",
        errorType: "LLMError",
        message: "LLM returned empty response",
        error: new Error("Empty response"),
        context: { slideNumber: 3 },
      });

      // Wait for async persist
      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues.length).toBe(1);
      expect(mockInsertValues[0].severity).toBe("fatal");
      expect(mockInsertValues[0].stage).toBe("content_writer");
      expect(mockInsertValues[0].errorType).toBe("LLMError");
      expect(mockInsertValues[0].message).toBe("LLM returned empty response");
      expect(mockInsertValues[0].presentationId).toBe("pres-1");
      expect(mockInsertValues[0].recovered).toBe(false);
    });

    it("captures stack trace from Error objects", async () => {
      const err = new Error("Test error");
      logError({
        stage: "image_generation",
        errorType: "ImageGenFailed",
        message: "Image gen failed",
        error: err,
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues[0].stackTrace).toContain("Error: Test error");
    });

    it("handles non-Error objects as error parameter", async () => {
      logError({
        stage: "s3_upload",
        errorType: "UploadFailed",
        message: "Upload failed",
        error: "string error",
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues[0].stackTrace).toBe("string error");
    });
  });

  describe("logWarning", () => {
    it("persists a warning with recovery info", async () => {
      logWarning({
        presentationId: "pres-2",
        stage: "image_generation",
        errorType: "ImageGenFailed",
        message: "Image generation failed, continuing without images",
        recovered: true,
        recoveryAction: "Skipped image generation for slide 3",
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues[0].severity).toBe("warning");
      expect(mockInsertValues[0].recovered).toBe(true);
      expect(mockInsertValues[0].recoveryAction).toBe("Skipped image generation for slide 3");
    });
  });

  describe("logInfo", () => {
    it("persists an info event", async () => {
      logInfo({
        stage: "quick_generation",
        errorType: "SlowGeneration",
        message: "Generation took longer than expected",
        context: { durationMs: 45000 },
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues[0].severity).toBe("info");
      expect(mockInsertValues[0].stage).toBe("quick_generation");
    });
  });

  describe("withErrorLogging", () => {
    it("returns the result when function succeeds", async () => {
      const result = await withErrorLogging(
        "test_stage",
        "TestError",
        async () => "success",
      );

      expect(result).toBe("success");
      // No error should be logged
      await new Promise((r) => setTimeout(r, 50));
      expect(mockInsertValues.length).toBe(0);
    });

    it("logs error and re-throws when function fails", async () => {
      await expect(
        withErrorLogging(
          "content_writer",
          "LLMError",
          async () => {
            throw new Error("LLM failed");
          },
          { presentationId: "pres-3" },
        ),
      ).rejects.toThrow("LLM failed");

      await new Promise((r) => setTimeout(r, 50));
      expect(mockInsertValues.length).toBe(1);
      expect(mockInsertValues[0].severity).toBe("fatal");
      expect(mockInsertValues[0].presentationId).toBe("pres-3");
    });
  });

  describe("withFallback", () => {
    it("returns the result when function succeeds", async () => {
      const result = await withFallback(
        "test_stage",
        "TestError",
        async () => "success",
        "fallback",
      );

      expect(result).toBe("success");
      await new Promise((r) => setTimeout(r, 50));
      expect(mockInsertValues.length).toBe(0);
    });

    it("returns fallback and logs warning when function fails", async () => {
      const result = await withFallback(
        "image_generation",
        "ImageGenFailed",
        async () => {
          throw new Error("Image gen failed");
        },
        "default-image.png",
        { presentationId: "pres-4" },
      );

      expect(result).toBe("default-image.png");
      await new Promise((r) => setTimeout(r, 50));
      expect(mockInsertValues.length).toBe(1);
      expect(mockInsertValues[0].severity).toBe("warning");
      expect(mockInsertValues[0].recovered).toBe(true);
    });
  });

  describe("Null/undefined handling", () => {
    it("handles missing optional fields gracefully", async () => {
      logError({
        stage: "unknown_stage",
        errorType: "UnknownError",
        message: "Something went wrong",
        // No presentationId, sessionId, error, context, mode
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsertValues[0].presentationId).toBeNull();
      expect(mockInsertValues[0].sessionId).toBeNull();
      expect(mockInsertValues[0].stackTrace).toBeNull();
      expect(mockInsertValues[0].context).toBeNull();
      expect(mockInsertValues[0].mode).toBeNull();
    });
  });
});

describe("errorAnalyticsDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectRows.length = 0;
    mockExecuteRows.length = 0;
  });

  describe("getErrorOverview", () => {
    it("returns zeroed overview when no errors exist", async () => {
      // Mock the aggregate query to return zeros
      mockSelectRows.push({
        total: 0,
        fatal: 0,
        warning: 0,
        recovered: 0,
      });

      const { getErrorOverview } = await import("./errorAnalyticsDb");
      const result = await getErrorOverview();

      expect(result).toBeDefined();
      expect(result.totalErrors).toBe(0);
      expect(result.recoveryRate).toBe(0);
    });
  });

  describe("getRecentErrors", () => {
    it("returns empty array when no errors exist", async () => {
      const { getRecentErrors } = await import("./errorAnalyticsDb");
      const result = await getRecentErrors(10);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getErrorTimeline", () => {
    it("returns timeline data for date range", async () => {
      mockExecuteRows.push(
        { date: "2026-02-15", fatal: 2, warning: 5, info: 1 },
        { date: "2026-02-16", fatal: 0, warning: 3, info: 0 },
      );

      const { getErrorTimeline } = await import("./errorAnalyticsDb");
      const from = new Date("2026-02-15");
      const to = new Date("2026-02-17");
      const result = await getErrorTimeline(from, to);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe("2026-02-15");
      expect(result[0].fatal).toBe(2);
      expect(result[0].warning).toBe(5);
      expect(result[1].fatal).toBe(0);
    });
  });
});
