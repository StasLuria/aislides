import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the inline field injector module.
 * Updated to match the new data-driven architecture where fields
 * are dynamically built from layout + data (no static LAYOUT_EDITABLE_FIELDS).
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
  setFieldValue,
  generateInlineEditScript,
  buildEditableSlideHtml,
} from "./pipeline/inlineFieldInjector";

// ═══════════════════════════════════════════════════════
// setFieldValue — dot-notation path setter
// ═══════════════════════════════════════════════════════

describe("setFieldValue", () => {
  it("sets a top-level string field", () => {
    const data: Record<string, any> = { title: "Old" };
    setFieldValue(data, "title", "New");
    expect(data.title).toBe("New");
  });

  it("sets a nested object field (leftColumn.title)", () => {
    const data: Record<string, any> = { leftColumn: { title: "Old", bullets: [] } };
    setFieldValue(data, "leftColumn.title", "New");
    expect(data.leftColumn.title).toBe("New");
  });

  it("sets an array item field (bullets.0)", () => {
    const data: Record<string, any> = { bullets: ["First", "Second"] };
    setFieldValue(data, "bullets.0", "Updated First");
    expect(data.bullets[0]).toBe("Updated First");
    expect(data.bullets[1]).toBe("Second");
  });

  it("sets a nested array object field (bullets.1.title)", () => {
    const data: Record<string, any> = {
      bullets: [
        { title: "A", description: "Desc A" },
        { title: "B", description: "Desc B" },
      ],
    };
    setFieldValue(data, "bullets.1.title", "Updated B");
    expect(data.bullets[1].title).toBe("Updated B");
    expect(data.bullets[1].description).toBe("Desc B");
  });

  it("sets a deeply nested field (leftColumn.bullets.2)", () => {
    const data: Record<string, any> = {
      leftColumn: { title: "Left", bullets: ["a", "b", "c"] },
    };
    setFieldValue(data, "leftColumn.bullets.2", "updated c");
    expect(data.leftColumn.bullets[2]).toBe("updated c");
  });

  it("creates intermediate objects when they don't exist", () => {
    const data: Record<string, any> = {};
    setFieldValue(data, "leftColumn.title", "New Title");
    expect(data.leftColumn).toBeDefined();
    expect(data.leftColumn.title).toBe("New Title");
  });
});

// ═══════════════════════════════════════════════════════
// getEditableFields — layout + data driven field mapping
// ═══════════════════════════════════════════════════════

describe("getEditableFields", () => {
  describe("title-slide", () => {
    it("returns title and description fields", () => {
      const data = { title: "Hello", description: "World" };
      const fields = getEditableFields("title-slide", data);
      expect(fields.length).toBe(2);
      expect(fields[0].key).toBe("title");
      expect(fields[1].key).toBe("description");
    });

    it("returns only title when no description", () => {
      const data = { title: "Hello" };
      const fields = getEditableFields("title-slide", data);
      expect(fields.length).toBe(1);
      expect(fields[0].key).toBe("title");
    });
  });

  describe("section-header", () => {
    it("returns title and subtitle", () => {
      const data = { title: "Section", subtitle: "Details" };
      const fields = getEditableFields("section-header", data);
      expect(fields.length).toBe(2);
      expect(fields[0].key).toBe("title");
      expect(fields[1].key).toBe("subtitle");
    });
  });

  describe("two-column", () => {
    it("returns title + left/right column fields", () => {
      const data = {
        title: "Comparison",
        leftColumn: {
          title: "Left",
          bullets: ["L1", "L2"],
        },
        rightColumn: {
          title: "Right",
          bullets: ["R1", "R2", "R3"],
        },
      };
      const fields = getEditableFields("two-column", data);

      // title + leftColumn.title + 2 left bullets + rightColumn.title + 3 right bullets = 8
      expect(fields.length).toBe(8);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("leftColumn.title");
      expect(keys).toContain("leftColumn.bullets.0");
      expect(keys).toContain("leftColumn.bullets.1");
      expect(keys).toContain("rightColumn.title");
      expect(keys).toContain("rightColumn.bullets.0");
      expect(keys).toContain("rightColumn.bullets.1");
      expect(keys).toContain("rightColumn.bullets.2");
    });

    it("handles missing right column gracefully", () => {
      const data = {
        title: "One Column",
        leftColumn: { title: "Left", bullets: ["L1"] },
      };
      const fields = getEditableFields("two-column", data);
      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("leftColumn.title");
      expect(keys).toContain("leftColumn.bullets.0");
      expect(keys).not.toContain("rightColumn.title");
    });
  });

  describe("text-slide", () => {
    it("returns title + bullet titles and descriptions for object bullets", () => {
      const data = {
        title: "Key Points",
        bullets: [
          { title: "Point 1", description: "Desc 1" },
          { title: "Point 2", description: "Desc 2" },
        ],
      };
      const fields = getEditableFields("text-slide", data);

      // title + 2 * (title + description) = 5
      expect(fields.length).toBe(5);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("bullets.0.title");
      expect(keys).toContain("bullets.0.description");
      expect(keys).toContain("bullets.1.title");
      expect(keys).toContain("bullets.1.description");
    });

    it("returns title + simple string bullets", () => {
      const data = {
        title: "Simple List",
        bullets: ["Item 1", "Item 2", "Item 3"],
      };
      const fields = getEditableFields("text-slide", data);

      // title + 3 bullets = 4
      expect(fields.length).toBe(4);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("bullets.0");
      expect(keys).toContain("bullets.1");
      expect(keys).toContain("bullets.2");
    });
  });

  describe("image-text", () => {
    it("returns title + bullet titles and descriptions", () => {
      const data = {
        title: "Image Slide",
        bullets: [
          { title: "Feature 1", description: "Desc 1" },
          { title: "Feature 2", description: "Desc 2" },
          { title: "Feature 3", description: "Desc 3" },
        ],
        image: { url: "https://example.com/img.jpg", alt: "test" },
      };
      const fields = getEditableFields("image-text", data);

      // title + 3 * (title + description) = 7
      expect(fields.length).toBe(7);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("bullets.0.title");
      expect(keys).toContain("bullets.0.description");
      expect(keys).toContain("bullets.2.description");
    });
  });

  describe("final-slide", () => {
    it("returns title and thankYouText", () => {
      const data = {
        title: "Thank You",
        thankYouText: "Questions?",
      };
      const fields = getEditableFields("final-slide", data);

      expect(fields.length).toBe(2);
      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("thankYouText");
    });

    it("returns title, subtitle and thankYouText when all present", () => {
      const data = {
        title: "Thank You",
        subtitle: "Subtitle",
        thankYouText: "Questions?",
      };
      const fields = getEditableFields("final-slide", data);

      expect(fields.length).toBe(3);
      const keys = fields.map((f) => f.key);
      expect(keys).toContain("title");
      expect(keys).toContain("subtitle");
      expect(keys).toContain("thankYouText");
    });
  });

  describe("quote-slide", () => {
    it("returns quote and author", () => {
      const data = { quote: "To be or not to be", author: "Shakespeare" };
      const fields = getEditableFields("quote-slide", data);
      expect(fields.length).toBe(2);
      expect(fields[0].key).toBe("quote");
      expect(fields[1].key).toBe("author");
    });
  });

  describe("icons-numbers / highlight-stats", () => {
    it("returns title + metric values and labels", () => {
      const data = {
        title: "Stats",
        metrics: [
          { value: "100+", label: "Users" },
          { value: "50%", label: "Growth" },
        ],
      };
      const fields = getEditableFields("icons-numbers", data);

      // title + 2 * (value + label) = 5
      expect(fields.length).toBe(5);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("metrics.0.value");
      expect(keys).toContain("metrics.0.label");
      expect(keys).toContain("metrics.1.value");
      expect(keys).toContain("metrics.1.label");
    });

    it("works with items array for highlight-stats", () => {
      const data = {
        title: "Stats",
        items: [
          { value: "99%", label: "Uptime" },
        ],
      };
      const fields = getEditableFields("highlight-stats", data);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("items.0.value");
      expect(keys).toContain("items.0.label");
    });
  });

  describe("timeline", () => {
    it("returns title + event titles and descriptions", () => {
      const data = {
        title: "Timeline",
        events: [
          { title: "2020", description: "Started" },
          { title: "2025", description: "Grew" },
        ],
      };
      const fields = getEditableFields("timeline", data);

      // title + 2 * (title + description) = 5
      expect(fields.length).toBe(5);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("events.0.title");
      expect(keys).toContain("events.0.description");
      expect(keys).toContain("events.1.title");
    });
  });

  describe("process-steps", () => {
    it("returns title + step titles and descriptions", () => {
      const data = {
        title: "Process",
        steps: [
          { title: "Step 1", description: "Do this" },
          { title: "Step 2", description: "Do that" },
        ],
      };
      const fields = getEditableFields("process-steps", data);

      // title + 2 * (title + description) = 5
      expect(fields.length).toBe(5);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("steps.0.title");
      expect(keys).toContain("steps.0.description");
    });
  });

  describe("agenda-table-of-contents", () => {
    it("returns title + section titles", () => {
      const data = {
        title: "Agenda",
        sections: [
          { title: "Introduction" },
          { title: "Main Topic" },
          { title: "Conclusion" },
        ],
      };
      const fields = getEditableFields("agenda-table-of-contents", data);

      // title + 3 sections = 4
      expect(fields.length).toBe(4);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("sections.0.title");
      expect(keys).toContain("sections.1.title");
      expect(keys).toContain("sections.2.title");
    });
  });

  describe("funnel", () => {
    it("returns title + stage labels", () => {
      const data = {
        title: "Sales Funnel",
        stages: [
          { label: "Awareness" },
          { label: "Interest" },
          { label: "Decision" },
        ],
      };
      const fields = getEditableFields("funnel", data);

      // title + 3 stages = 4
      expect(fields.length).toBe(4);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("stages.0.label");
      expect(keys).toContain("stages.1.label");
      expect(keys).toContain("stages.2.label");
    });
  });

  describe("chart-slide / table-slide / waterfall-chart", () => {
    it("returns title and description for chart-slide", () => {
      const data = { title: "Chart", description: "Revenue data" };
      const fields = getEditableFields("chart-slide", data);
      expect(fields.length).toBe(2);
      expect(fields[0].key).toBe("title");
      expect(fields[1].key).toBe("description");
    });

    it("returns title and description for table-slide", () => {
      const data = { title: "Table", description: "Comparison data" };
      const fields = getEditableFields("table-slide", data);
      expect(fields.length).toBe(2);
    });
  });

  describe("image-fullscreen", () => {
    it("returns title and subtitle", () => {
      const data = { title: "Full Image", subtitle: "Beautiful landscape" };
      const fields = getEditableFields("image-fullscreen", data);
      expect(fields.length).toBe(2);
      expect(fields[0].key).toBe("title");
      expect(fields[1].key).toBe("subtitle");
    });
  });

  describe("simple layouts (comparison, team-profiles, etc.)", () => {
    it("returns only title for comparison", () => {
      const data = { title: "Comparison" };
      const fields = getEditableFields("comparison", data);
      expect(fields.length).toBe(1);
      expect(fields[0].key).toBe("title");
    });

    it("returns only title for team-profiles", () => {
      const data = { title: "Our Team" };
      const fields = getEditableFields("team-profiles", data);
      expect(fields.length).toBe(1);
      expect(fields[0].key).toBe("title");
    });
  });

  describe("fallback for unknown layout", () => {
    it("returns only title for unknown layout", () => {
      const data = { title: "Unknown" };
      const fields = getEditableFields("some-unknown-layout", data);
      expect(fields.length).toBe(1);
      expect(fields[0].key).toBe("title");
    });
  });

  describe("fallback without data", () => {
    it("returns only title when no data provided", () => {
      const fields = getEditableFields("text-slide");
      expect(fields.length).toBe(1);
      expect(fields[0].key).toBe("title");
    });
  });

  describe("all layouts have at least title", () => {
    const allLayouts = [
      "title-slide",
      "section-header",
      "text-slide",
      "two-column",
      "image-text",
      "image-fullscreen",
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

    for (const layout of allLayouts) {
      it(`${layout} has at least one editable field`, () => {
        const data = { title: "Test Title" };
        const fields = getEditableFields(layout, data);
        expect(fields.length).toBeGreaterThan(0);
        // All layouts except quote-slide should have title
        if (layout !== "quote-slide") {
          expect(fields.some((f) => f.key === "title")).toBe(true);
        }
      });
    }
  });

  describe("fields have labels", () => {
    it("all returned fields have non-empty labels", () => {
      const data = {
        title: "Test",
        description: "Desc",
        bullets: [
          { title: "B1", description: "D1" },
        ],
        leftColumn: { title: "Left", bullets: ["L1"] },
        rightColumn: { title: "Right", bullets: ["R1"] },
      };

      const layouts = ["title-slide", "text-slide", "two-column", "image-text"];
      for (const layout of layouts) {
        const fields = getEditableFields(layout, data);
        for (const field of fields) {
          expect(field.label).toBeTruthy();
          expect(field.label.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("fields have unique keys within each layout", () => {
    it("no duplicate keys for two-column", () => {
      const data = {
        title: "Test",
        leftColumn: { title: "Left", bullets: ["L1", "L2"] },
        rightColumn: { title: "Right", bullets: ["R1", "R2"] },
      };
      const fields = getEditableFields("two-column", data);
      const keys = fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it("no duplicate keys for text-slide with object bullets", () => {
      const data = {
        title: "Test",
        bullets: [
          { title: "B1", description: "D1" },
          { title: "B2", description: "D2" },
        ],
      };
      const fields = getEditableFields("text-slide", data);
      const keys = fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });
});

// ═══════════════════════════════════════════════════════
// generateInlineEditScript
// ═══════════════════════════════════════════════════════

describe("generateInlineEditScript", () => {
  it("generates a script tag", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "My Description",
    });
    expect(script).toContain("<script>");
    expect(script).toContain("</script>");
  });

  it("includes field config in the script", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "My Description",
    });
    expect(script).toContain('"key":"title"');
    expect(script).toContain('"key":"description"');
  });

  it("skips fields with empty values", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
      description: "",
    });
    expect(script).toContain('"key":"title"');
    expect(script).not.toContain('"key":"description"');
  });

  it("includes contenteditable setup", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("contenteditable");
    expect(script).toContain("data-field");
  });

  it("includes postMessage communication", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("postMessage");
    expect(script).toContain("inline-edit-change");
    expect(script).toContain("inline-edit-focus");
    expect(script).toContain("inline-edit-blur");
    expect(script).toContain("inline-edit-ready");
  });

  it("includes hover/focus styles", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "My Title",
    });
    expect(script).toContain("[data-field]:hover");
    expect(script).toContain("[data-field]:focus");
  });

  it("truncates long field values to 80 chars", () => {
    const longTitle = "A".repeat(200);
    const script = generateInlineEditScript("title-slide", {
      title: longTitle,
    });
    expect(script).not.toContain(longTitle);
    expect(script).toContain("A".repeat(80));
  });

  it("includes nested field keys for two-column layout", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Left", bullets: ["L1"] },
      rightColumn: { title: "Right", bullets: ["R1", "R2"] },
    };
    const script = generateInlineEditScript("two-column", data);

    expect(script).toContain('"key":"leftColumn.title"');
    expect(script).toContain('"key":"leftColumn.bullets.0"');
    expect(script).toContain('"key":"rightColumn.title"');
    expect(script).toContain('"key":"rightColumn.bullets.0"');
    expect(script).toContain('"key":"rightColumn.bullets.1"');
  });

  it("includes bullet object fields for text-slide layout", () => {
    const data = {
      title: "Points",
      bullets: [
        { title: "Point 1", description: "Desc 1" },
      ],
    };
    const script = generateInlineEditScript("text-slide", data);

    expect(script).toContain('"key":"bullets.0.title"');
    expect(script).toContain('"key":"bullets.0.description"');
  });
});

// ═══════════════════════════════════════════════════════
// buildEditableSlideHtml
// ═══════════════════════════════════════════════════════

describe("buildEditableSlideHtml", () => {
  it("produces a full HTML document", () => {
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

  it("includes the slide HTML", () => {
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

  it("includes the theme CSS", () => {
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

  it("includes the fonts URL", () => {
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

  it("includes the base CSS", () => {
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

  it("includes the inline editing script", () => {
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

  it("sets the slide container to 1280x720", () => {
    const html = buildEditableSlideHtml(
      "<h1>Test</h1>",
      "",
      "",
      "ru",
      "title-slide",
      { title: "Test" },
      "",
    );
    expect(html).toContain("width:1280px");
    expect(html).toContain("height:720px");
  });
});

// ═══════════════════════════════════════════════════════
// PATCH slide field — logic tests
// ═══════════════════════════════════════════════════════

describe("PATCH slide field — logic", () => {
  function createMockPresentation() {
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
            bullets: [
              { title: "Point 1", description: "Desc 1" },
              { title: "Point 2", description: "Desc 2" },
            ],
          },
        },
        {
          layoutId: "two-column",
          data: {
            title: "Comparison",
            leftColumn: { title: "Left", bullets: ["L1", "L2"] },
            rightColumn: { title: "Right", bullets: ["R1"] },
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
    };
  }

  it("should update a top-level field in slide data", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const field = "title";
    const value = "Updated Welcome";

    const editableFields = getEditableFields(slides[0].layoutId, slides[0].data);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();

    setFieldValue(slides[0].data, field, value);
    expect(slides[0].data.title).toBe("Updated Welcome");
    expect(slides[0].data.description).toBe("Test presentation");
  });

  it("should reject non-editable fields", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;
    const field = "presenterName";

    const editableFields = getEditableFields(slides[0].layoutId, slides[0].data);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeUndefined();
  });

  it("should update a nested bullet field (bullets.0.title)", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const field = "bullets.0.title";
    const value = "Updated Point 1";

    const editableFields = getEditableFields(slides[1].layoutId, slides[1].data);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();

    setFieldValue(slides[1].data, field, value);
    expect(slides[1].data.bullets[0].title).toBe("Updated Point 1");
    expect(slides[1].data.bullets[0].description).toBe("Desc 1");
    expect(slides[1].data.bullets[1].title).toBe("Point 2");
  });

  it("should update a nested column bullet (leftColumn.bullets.1)", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const field = "leftColumn.bullets.1";
    const value = "Updated L2";

    const editableFields = getEditableFields(slides[2].layoutId, slides[2].data);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();

    setFieldValue(slides[2].data, field, value);
    expect(slides[2].data.leftColumn.bullets[1]).toBe("Updated L2");
    expect(slides[2].data.leftColumn.bullets[0]).toBe("L1");
    expect(slides[2].data.rightColumn.bullets[0]).toBe("R1");
  });

  it("should handle quote-slide quote field", () => {
    const pres = createMockPresentation();
    const slides = [...pres.finalHtmlSlides];
    const field = "quote";
    const value = "All the world's a stage";

    const editableFields = getEditableFields(slides[3].layoutId, slides[3].data);
    const fieldDef = editableFields.find((f) => f.key === field);
    expect(fieldDef).toBeDefined();
    expect(fieldDef?.multiline).toBe(true);

    setFieldValue(slides[3].data, field, value);
    expect(slides[3].data.quote).toBe("All the world's a stage");
    expect(slides[3].data.author).toBe("Shakespeare");
  });

  it("should validate slide index is within range", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;
    const invalidIndex = 10;
    expect(invalidIndex >= slides.length).toBe(true);
  });
});
