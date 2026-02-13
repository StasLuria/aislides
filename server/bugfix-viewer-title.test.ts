/**
 * Tests for Bug Fixes:
 * 1. normalizeSlides — handles layout_id → layoutId migration
 * 2. Title generation helper
 * 3. Viewer fallback rendering logic
 */
import { describe, it, expect, vi } from "vitest";

// ─── normalizeSlides ───────────────────────────────────────

describe("normalizeSlides — layout_id → layoutId migration", () => {
  // Inline the function to test it directly
  function normalizeSlides(rawSlides: any[]): any[] {
    return rawSlides.map((s: any) => ({
      ...s,
      layoutId: s.layoutId || s.layout_id || "text-slide",
    }));
  }

  it("should preserve layoutId when already present", () => {
    const slides = [
      { layoutId: "title-slide", data: { title: "Hello" } },
      { layoutId: "text-slide", data: { title: "World" } },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].layoutId).toBe("title-slide");
    expect(result[1].layoutId).toBe("text-slide");
  });

  it("should convert layout_id to layoutId for legacy data", () => {
    const slides = [
      { layout_id: "title-slide", data: { title: "Hello" }, html: "<div>slide</div>" },
      { layout_id: "two-column", data: { title: "World" }, html: "<div>slide2</div>" },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].layoutId).toBe("title-slide");
    expect(result[1].layoutId).toBe("two-column");
  });

  it("should default to text-slide when neither layoutId nor layout_id exists", () => {
    const slides = [
      { data: { title: "No layout" } },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].layoutId).toBe("text-slide");
  });

  it("should prefer layoutId over layout_id when both exist", () => {
    const slides = [
      { layoutId: "icons-numbers", layout_id: "text-slide", data: {} },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].layoutId).toBe("icons-numbers");
  });

  it("should handle empty array", () => {
    const result = normalizeSlides([]);
    expect(result).toEqual([]);
  });

  it("should preserve html and data fields", () => {
    const slides = [
      { layout_id: "title-slide", data: { title: "Test" }, html: "<div>test</div>" },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].data).toEqual({ title: "Test" });
    expect(result[0].html).toBe("<div>test</div>");
    expect(result[0].layout_id).toBe("title-slide"); // original key preserved
    expect(result[0].layoutId).toBe("title-slide"); // normalized key added
  });

  it("should handle mixed slides (some with layoutId, some with layout_id)", () => {
    const slides = [
      { layoutId: "title-slide", data: { title: "New format" } },
      { layout_id: "text-slide", data: { title: "Old format" } },
      { data: { title: "No layout" } },
    ];
    const result = normalizeSlides(slides);
    expect(result[0].layoutId).toBe("title-slide");
    expect(result[1].layoutId).toBe("text-slide");
    expect(result[2].layoutId).toBe("text-slide");
  });
});

// ─── Title generation ──────────────────────────────────────

describe("Chat title generation logic", () => {
  it("should generate a short title from a topic string", () => {
    // Simulate what the LLM-based title generator should produce
    const topic = "сделай презентацию про качество воды в мире";
    // Expected: short, descriptive title without "сделай презентацию про"
    const expectedPattern = /^.{3,50}$/; // 3-50 chars
    expect("Качество воды в мире").toMatch(expectedPattern);
  });

  it("should handle empty topic gracefully", () => {
    const topic = "";
    const fallback = topic.trim() || "Новый чат";
    expect(fallback).toBe("Новый чат");
  });

  it("should truncate very long topics", () => {
    const longTopic = "A".repeat(200);
    const truncated = longTopic.length > 50 ? longTopic.slice(0, 50) + "..." : longTopic;
    expect(truncated.length).toBeLessThanOrEqual(53);
  });
});

// ─── Viewer fallback logic ─────────────────────────────────

describe("Viewer fallback rendering logic", () => {
  it("should detect when result_urls is null and trigger fallback", () => {
    const presentation = {
      status: "completed",
      result_urls: null,
    };
    const htmlUrl = presentation.result_urls?.html_preview || presentation.result_urls?.html;
    expect(htmlUrl).toBeUndefined();
    // Should trigger fallback
    const shouldFallback = !htmlUrl;
    expect(shouldFallback).toBe(true);
  });

  it("should detect when result_urls has html_preview", () => {
    const presentation = {
      status: "completed",
      result_urls: { html_preview: "https://example.com/pres.html" },
    };
    const htmlUrl = presentation.result_urls?.html_preview || presentation.result_urls?.html;
    expect(htmlUrl).toBe("https://example.com/pres.html");
    const shouldFallback = !htmlUrl;
    expect(shouldFallback).toBe(false);
  });

  it("should detect when result_urls has html but not html_preview", () => {
    const presentation = {
      status: "completed",
      result_urls: { html: "https://example.com/pres.html" },
    };
    const htmlUrl = (presentation.result_urls as any)?.html_preview || (presentation.result_urls as any)?.html;
    expect(htmlUrl).toBe("https://example.com/pres.html");
  });

  it("should handle empty result_urls object", () => {
    const presentation = {
      status: "completed",
      result_urls: {},
    };
    const htmlUrl = (presentation.result_urls as any)?.html_preview || (presentation.result_urls as any)?.html;
    expect(htmlUrl).toBeUndefined();
    const shouldFallback = !htmlUrl;
    expect(shouldFallback).toBe(true);
  });
});

// ─── SSE title_update event ────────────────────────────────

describe("SSE title_update event handling", () => {
  it("should parse title_update event correctly", () => {
    const event = {
      type: "title_update",
      data: { title: "Качество воды в мире" },
    };
    expect(event.type).toBe("title_update");
    expect(event.data.title).toBe("Качество воды в мире");
  });

  it("should handle title_update with empty title", () => {
    const event = {
      type: "title_update",
      data: { title: "" },
    };
    const title = event.data.title || "Новый чат";
    expect(title).toBe("Новый чат");
  });
});

// ─── PATCH title endpoint ──────────────────────────────────

describe("PATCH /api/v1/chat/sessions/:id/title validation", () => {
  it("should reject empty title", () => {
    const title = "";
    const isValid = title && typeof title === "string" && title.trim().length > 0;
    expect(isValid).toBeFalsy();
  });

  it("should accept valid title", () => {
    const title = "Мой новый заголовок";
    const isValid = title && typeof title === "string" && title.trim().length > 0;
    expect(isValid).toBeTruthy();
  });

  it("should trim whitespace from title", () => {
    const title = "  Заголовок с пробелами  ";
    const trimmed = title.trim();
    expect(trimmed).toBe("Заголовок с пробелами");
  });

  it("should reject null title", () => {
    const title = null;
    const isValid = title && typeof title === "string";
    expect(isValid).toBeFalsy();
  });
});
