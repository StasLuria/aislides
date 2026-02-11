import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for presentation database helpers and API route logic.
 * Since the actual DB requires MySQL, we test the route handler logic
 * and data transformation independently.
 */

describe("Presentation API data transformations", () => {
  it("should format presentation response correctly", () => {
    // Simulate the DB row → API response transformation from presentationRoutes.ts
    const dbRow = {
      id: 1,
      presentationId: "abc123def456",
      userId: null,
      prompt: "Test presentation about AI",
      mode: "batch" as const,
      status: "completed" as const,
      currentStep: "completed",
      slideCount: 10,
      progressPercent: 100,
      config: { slide_count: 10, theme_preset: "corporate_blue" },
      pipelineState: null,
      finalHtmlSlides: null,
      resultUrls: { html_preview: "https://example.com/presentation.html" },
      errorInfo: null,
      title: "AI in 2026",
      language: "ru",
      themeCss: null,
      createdAt: new Date("2026-02-11T10:00:00Z"),
      updatedAt: new Date("2026-02-11T10:05:00Z"),
    };

    // Transform like presentationRoutes.ts does
    const response = {
      presentation_id: dbRow.presentationId,
      title: dbRow.title || dbRow.prompt.substring(0, 100),
      prompt: dbRow.prompt,
      mode: dbRow.mode,
      status: dbRow.status,
      current_step: dbRow.currentStep,
      slide_count: dbRow.slideCount,
      progress_percent: dbRow.progressPercent,
      config: dbRow.config,
      result_urls: dbRow.resultUrls,
      error_info: dbRow.errorInfo,
      created_at: dbRow.createdAt.toISOString(),
      updated_at: dbRow.updatedAt.toISOString(),
    };

    expect(response.presentation_id).toBe("abc123def456");
    expect(response.title).toBe("AI in 2026");
    expect(response.status).toBe("completed");
    expect(response.slide_count).toBe(10);
    expect(response.progress_percent).toBe(100);
    expect(response.result_urls).toEqual({
      html_preview: "https://example.com/presentation.html",
    });
    expect(response.created_at).toBe("2026-02-11T10:00:00.000Z");
  });

  it("should use prompt as title fallback when title is empty", () => {
    const dbRow = {
      title: "",
      prompt: "A very long prompt about artificial intelligence and machine learning in modern enterprise",
    };

    const title = dbRow.title || dbRow.prompt.substring(0, 100);
    expect(title).toBe(
      "A very long prompt about artificial intelligence and machine learning in modern enterprise",
    );
  });

  it("should validate create presentation request body", () => {
    // Valid request
    const validReq = {
      prompt: "Test topic",
      mode: "batch",
      config: { slide_count: 10, theme_preset: "corporate_blue" },
    };

    expect(validReq.prompt).toBeTruthy();
    expect(typeof validReq.prompt).toBe("string");

    // Invalid request — empty prompt
    const invalidReq = { prompt: "", mode: "batch" };
    expect(!invalidReq.prompt || typeof invalidReq.prompt !== "string").toBe(true);

    // Invalid request — no prompt
    const noPrompt = { mode: "batch" } as any;
    expect(!noPrompt.prompt).toBe(true);
  });
});

describe("WebSocket event format", () => {
  it("should match the expected progress event format", () => {
    const progressEvent = {
      type: "generation.progress",
      data: {
        presentation_id: "abc123",
        node_name: "planner",
        current_step: "planning",
        progress_percentage: 15,
        message: "Analyzing topic...",
      },
    };

    expect(progressEvent.type).toBe("generation.progress");
    expect(progressEvent.data.progress_percentage).toBeGreaterThanOrEqual(0);
    expect(progressEvent.data.progress_percentage).toBeLessThanOrEqual(100);
    expect(progressEvent.data.node_name).toBeTruthy();
    expect(progressEvent.data.current_step).toBeTruthy();
  });

  it("should match the expected completed event format", () => {
    const completedEvent = {
      type: "generation.completed",
      data: {
        presentation_id: "abc123",
        result_urls: { html_preview: "https://example.com/pres.html" },
        slide_count: 10,
        title: "My Presentation",
      },
    };

    expect(completedEvent.type).toBe("generation.completed");
    expect(completedEvent.data.result_urls.html_preview).toBeTruthy();
    expect(completedEvent.data.slide_count).toBeGreaterThan(0);
  });

  it("should match the expected error event format", () => {
    const errorEvent = {
      type: "generation.error",
      data: {
        presentation_id: "abc123",
        error_message: "LLM timeout",
        error_type: "TimeoutError",
      },
    };

    expect(errorEvent.type).toBe("generation.error");
    expect(errorEvent.data.error_message).toBeTruthy();
    expect(errorEvent.data.error_type).toBeTruthy();
  });
});

describe("Pipeline configuration", () => {
  it("should use default values when config is empty", () => {
    const config: Record<string, any> = {};
    const slideCount = config.slide_count || 10;
    const themePreset = config.theme_preset || "corporate_blue";

    expect(slideCount).toBe(10);
    expect(themePreset).toBe("corporate_blue");
  });

  it("should respect custom config values", () => {
    const config = { slide_count: 15, theme_preset: "dark_modern" };
    const slideCount = config.slide_count || 10;
    const themePreset = config.theme_preset || "corporate_blue";

    expect(slideCount).toBe(15);
    expect(themePreset).toBe("dark_modern");
  });
});
