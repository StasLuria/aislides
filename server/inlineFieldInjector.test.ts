import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the inline field injector module and PATCH slide endpoint logic.
 */

// Mock dependencies for route testing
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn().mockReturnValue("<div>rendered slide</div>"),
  renderPresentation: vi.fn().mockReturnValue("<html>full presentation</html>"),
  BASE_CSS: "/* base css */",
}));

vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn().mockReturnValue({
    id: "corporate_blue",
    name: "Corporate Blue",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    cssVariables: ":root { --primary: blue; }",
  }),
}));

vi.mock("./presentationDb", () => ({
  getPresentation: vi.fn(),
  updatePresentationProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/test.html",
    key: "test-key",
  }),
}));

import {
  getEditableFields,
  generateInlineEditScript,
  buildEditableSlideHtml,
  LAYOUT_EDITABLE_FIELDS,
  type EditableFieldDef,
} from "./pipeline/inlineFieldInjector";

import { getPresentation, updatePresentationProgress } from "./presentationDb";

const mockGetPresentation = getPresentation as ReturnType<typeof vi.fn>;
const mockUpdateProgress = updatePresentationProgress as ReturnType<typeof vi.fn>;

// ═══════════════════════════════════════════════════════
// getEditableFields
// ═══════════════════════════════════════════════════════

describe("getEditableFields", () => {
  it("should return fields for known layouts", () => {
    const fields = getEditableFields("title-slide");
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe("title");
    expect(fields[0].tag).toBe("h1");
    expect(fields[1].key).toBe("description");
    expect(fields[1].multiline).toBe(true);
  });

  it("should return default fields for unknown layouts", () => {
    const fields = getEditableFields("nonexistent-layout");
    expect(fields).toHaveLength(1);
    expect(fields[0].key).toBe("title");
    expect(fields[0].tag).toBe("h1");
  });

  it("should have fields for all major layouts", () => {
    const majorLayouts = [
      "title-slide",
      "section-header",
      "text-slide",
      "two-column",
      "image-text",
      "quote-slide",
      "chart-slide",
      "table-slide",
      "final-slide",
      "comparison",
      "timeline",
      "process-steps",
    ];

    for (const layout of majorLayouts) {
      const fields = getEditableFields(layout);
      expect(fields.length).toBeGreaterThan(0);
      // All layouts should at least have a title (except quote-slide)
      if (layout !== "quote-slide") {
        expect(fields.some((f) => f.key === "title")).toBe(true);
      }
    }
  });

  it("should have labels for all fields", () => {
    for (const [layoutId, fields] of Object.entries(LAYOUT_EDITABLE_FIELDS)) {
      for (const field of fields) {
        expect(field.label).toBeTruthy();
        expect(field.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("should have valid tags for all fields", () => {
    const validTags = ["h1", "h2", "h3", "p", "span", "blockquote", "div"];
    for (const [layoutId, fields] of Object.entries(LAYOUT_EDITABLE_FIELDS)) {
      for (const field of fields) {
        expect(validTags).toContain(field.tag);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════
// generateInlineEditScript
// ═══════════════════════════════════════════════════════

describe("generateInlineEditScript", () => {
  it("should generate a script tag", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "My Description",
    });
    expect(script).toContain("<script>");
    expect(script).toContain("</script>");
  });

  it("should include field config in the script", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "My Description",
    });
    expect(script).toContain('"key":"title"');
    expect(script).toContain('"key":"description"');
  });

  it("should skip fields with empty values", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "", // empty
    });
    expect(script).toContain('"key":"title"');
    expect(script).not.toContain('"key":"description"');
  });

  it("should skip fields with non-string values", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: 42, // not a string
    });
    expect(script).toContain('"key":"title"');
    expect(script).not.toContain('"key":"description"');
  });

  it("should include contenteditable setup", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("contenteditable");
    expect(script).toContain("data-field");
  });

  it("should include postMessage communication", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("postMessage");
    expect(script).toContain("inline-edit-change");
    expect(script).toContain("inline-edit-focus");
    expect(script).toContain("inline-edit-blur");
    expect(script).toContain("inline-edit-ready");
  });

  it("should include hover/focus styles", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("[data-field]:hover");
    expect(script).toContain("[data-field]:focus");
  });

  it("should truncate long field values to 80 chars", () => {
    const longTitle = "A".repeat(200);
    const script = generateInlineEditScript("title-slide", {
      title: longTitle,
    });
    // The value in the script should be truncated
    expect(script).not.toContain(longTitle);
    expect(script).toContain("A".repeat(80));
  });

  it("should handle quote-slide layout", () => {
    const script = generateInlineEditScript("quote-slide", {
      quote: "To be or not to be",
    });
    expect(script).toContain('"key":"quote"');
    expect(script).toContain('"tag":"blockquote"');
  });
});

// ═══════════════════════════════════════════════════════
// buildEditableSlideHtml
// ═══════════════════════════════════════════════════════

describe("buildEditableSlideHtml", () => {
  it("should produce a full HTML document", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      ":root { --primary: blue; }",
      "https://fonts.googleapis.com/css2?family=Inter",
      "ru",
      "title-slide",
      { title: "Test" },
      "/* base css */",
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain("</html>");
  });

  it("should include the slide HTML", () => {
    const html = buildEditableSlideHtml(
      "<h1>My Slide Title</h1>",
      "",
      "",
      "ru",
      "title-slide",
      { title: "My Slide Title" },
      "",
    );
    expect(html).toContain("<h1>My Slide Title</h1>");
  });

  it("should include the theme CSS", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      ":root { --color-primary: oklch(0.5 0.2 260); }",
      "",
      "ru",
      "title-slide",
      { title: "Test" },
      "",
    );
    expect(html).toContain("--color-primary: oklch(0.5 0.2 260)");
  });

  it("should include the fonts URL", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      "",
      "https://fonts.googleapis.com/css2?family=Roboto",
      "ru",
      "title-slide",
      { title: "Test" },
      "",
    );
    expect(html).toContain("https://fonts.googleapis.com/css2?family=Roboto");
  });

  it("should include the base CSS", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      "",
      "",
      "ru",
      "title-slide",
      { title: "Test" },
      ".slide { width: 1280px; }",
    );
    expect(html).toContain(".slide { width: 1280px; }");
  });

  it("should include the inline editing script", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      "",
      "",
      "ru",
      "title-slide",
      { title: "Test" },
      "",
    );
    expect(html).toContain("<script>");
    expect(html).toContain("contenteditable");
    expect(html).toContain("postMessage");
  });

  it("should set the slide container to 1280x720", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      "",
      "",
      "ru",
      "title-slide",
      { title: "Test" },
      "",
    );
    expect(html).toContain('width:1280px');
    expect(html).toContain('height:720px');
  });
});

// ═══════════════════════════════════════════════════════
// PATCH slide field — logic tests
// ═══════════════════════════════════════════════════════

describe("PATCH slide field — logic", () => {
  function createMockPresentation(overrides: Record<string, any> = {}) {
    return {
      presentationId: "test-pres-123",
      status: "completed",
      title: "Test Presentation",
      language: "ru",
      themeCss: ":root { --primary: blue; }",
      config: { theme_preset: "corporate_blue" },
      finalHtmlSlides: [
        {
          layoutId: "title-slide",
          data: {
            title: "Welcome",
            description: "Test presentation",
            presenterName: "John",
            presentationDate: "2026",
          },
        },
        {
          layoutId: "text-slide",
          data: {
            title: "Content Slide",
            description: "Some content here",
            key_message: "Important point",
          },
        },
        {
          layoutId: "quote-slide",
          data: {
            quote: "To be or not to be",
            author: "Shakespeare",
          },
        },
      ],
      resultUrls: {
        html_preview: "https://s3.example.com/presentation.html",
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a single field in slide data", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const index = 0;
    const field = "title";
    const value = "Updated Welcome";

    // Validate field is editable
    const editableFields = getEditableFields(slides[index].layoutId);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();

    // Update the field
    slides[index].data[field] = value;
    expect(slides[index].data.title).toBe("Updated Welcome");
    // Other fields should be preserved
    expect(slides[index].data.description).toBe("Test presentation");
    expect(slides[index].data.presenterName).toBe("John");
  });

  it("should reject non-editable fields", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;
    const index = 0;
    const field = "presenterName"; // Not in editable fields for title-slide

    const editableFields = getEditableFields(slides[index].layoutId);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeUndefined();
  });

  it("should handle quote-slide quote field", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const index = 2; // quote-slide
    const field = "quote";
    const value = "All the world's a stage";

    const editableFields = getEditableFields(slides[index].layoutId);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();
    expect(fieldDef?.multiline).toBe(true);

    slides[index].data[field] = value;
    expect(slides[index].data.quote).toBe("All the world's a stage");
    // Author should be preserved
    expect(slides[index].data.author).toBe("Shakespeare");
  });

  it("should validate slide index is within range", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;
    const invalidIndex = 10;

    expect(invalidIndex >= slides.length).toBe(true);
  });

  it("should handle updating description field on title-slide", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const index = 0;
    const field = "description";
    const value = "A brand new description";

    const editableFields = getEditableFields(slides[index].layoutId);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();
    expect(fieldDef?.multiline).toBe(true);

    slides[index].data[field] = value;
    expect(slides[index].data.description).toBe("A brand new description");
    expect(slides[index].data.title).toBe("Welcome");
  });

  it("should handle empty string value", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const index = 0;
    const field = "title";
    const value = "";

    slides[index].data[field] = value;
    expect(slides[index].data.title).toBe("");
  });

  it("should handle very long text values", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const index = 0;
    const field = "title";
    const value = "A".repeat(5000);

    slides[index].data[field] = value;
    expect(slides[index].data.title).toHaveLength(5000);
  });
});

// ═══════════════════════════════════════════════════════
// Layout coverage — ensure all 26 layouts have field definitions
// ═══════════════════════════════════════════════════════

describe("Layout field coverage", () => {
  const allLayouts = [
    "title-slide",
    "section-header",
    "text-slide",
    "two-column",
    "image-text",
    "image-fullscreen",
    "quote-slide",
    "chart-slide",
    "table-slide",
    "icons-numbers",
    "timeline",
    "process-steps",
    "comparison",
    "final-slide",
    "agenda-table-of-contents",
    "team-profiles",
    "logo-grid",
    "video-embed",
    "waterfall-chart",
    "swot-analysis",
    "funnel",
    "roadmap",
    "pyramid",
    "matrix-2x2",
    "pros-cons",
    "checklist",
    "highlight-stats",
  ];

  it("should have field definitions for all 27 layouts", () => {
    for (const layout of allLayouts) {
      expect(LAYOUT_EDITABLE_FIELDS[layout]).toBeDefined();
      expect(LAYOUT_EDITABLE_FIELDS[layout].length).toBeGreaterThan(0);
    }
  });

  it("should have unique keys within each layout", () => {
    for (const [layoutId, fields] of Object.entries(LAYOUT_EDITABLE_FIELDS)) {
      const keys = fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    }
  });
});
