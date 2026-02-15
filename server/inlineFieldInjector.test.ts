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
    it("returns title + stage titles and values", () => {
      const data = {
        title: "Sales Funnel",
        stages: [
          { title: "Awareness", value: "10,000" },
          { title: "Interest", value: "3,500" },
          { title: "Decision", value: "1,200" },
        ],
      };
      const fields = getEditableFields("funnel", data);

      // title + 3 values + 3 titles = 7
      expect(fields.length).toBe(7);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("stages.0.title");
      expect(keys).toContain("stages.1.title");
      expect(keys).toContain("stages.2.title");
      expect(keys).toContain("stages.0.value");
      expect(keys).toContain("stages.1.value");
      expect(keys).toContain("stages.2.value");
    });

    it("returns title + stage titles only when no values", () => {
      const data = {
        title: "Sales Funnel",
        stages: [
          { title: "Awareness" },
          { title: "Interest" },
        ],
      };
      const fields = getEditableFields("funnel", data);

      // title + 2 titles = 3
      expect(fields.length).toBe(3);

      const keys = fields.map((f) => f.key);
      expect(keys).toContain("stages.0.title");
      expect(keys).toContain("stages.1.title");
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

  // ═══════════════════════════════════════════════════════
  // Image editing overlay tests
  // ═══════════════════════════════════════════════════════

  it("includes image editing overlay styles", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
      image: { url: "https://example.com/img.jpg", alt: "test" },
    });
    expect(script).toContain(".img-edit-overlay");
    expect(script).toContain("inline-image-click");
  });

  it("includes drag-and-drop support for images", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
      image: { url: "https://example.com/img.jpg", alt: "test" },
    });
    expect(script).toContain("dragover");
    expect(script).toContain("drop");
    expect(script).toContain("inline-image-drop");
  });

  it("includes gradient placeholder detection for image overlays", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
    });
    expect(script).toContain("linear-gradient");
    expect(script).toContain("img-edit-overlay");
  });

  it("includes replace button text for images", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // All scripts should contain the image overlay code
    expect(script).toContain("\u0417\u0430\u043c\u0435\u043d\u0438\u0442\u044c"); // Заменить
    expect(script).toContain("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c"); // Добавить
  });

  it("includes file type validation for image uploads", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
    });
    expect(script).toContain("image/jpeg");
    expect(script).toContain("image/png");
    expect(script).toContain("image/webp");
    expect(script).toContain("image/gif");
  });

  it("includes file size validation (5MB limit)", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
    });
    expect(script).toContain("5 * 1024 * 1024");
  });

  it("sends image data as base64 via postMessage", () => {
    const script = generateInlineEditScript("image-text", {
      title: "Test",
      bullets: [{ title: "B1", description: "D1" }],
    });
    expect(script).toContain("FileReader");
    expect(script).toContain("readAsDataURL");
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


// ═══════════════════════════════════════════════════════
// Auto-expanding text boxes — CSS overrides during editing
// ═══════════════════════════════════════════════════════

describe("generateInlineEditScript — auto-expand CSS", () => {
  const fields = [
    { key: "title", selector: "h1", label: "Заголовок", multiline: false },
  ];

  it("includes CSS overrides that remove overflow:hidden", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("overflow");
    expect(script).toContain("visible");
  });

  it("includes CSS overrides that remove -webkit-line-clamp", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("line-clamp");
    expect(script).toContain("unset");
  });

  it("includes CSS overrides that remove text-overflow:ellipsis", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("text-overflow");
    expect(script).toContain("unset");
  });

  it("includes CSS overrides for height:auto on slide container", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("height");
    expect(script).toContain("auto");
  });

  it("includes height reporting via postMessage", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("inline-slide-resize");
    expect(script).toContain("scrollHeight");
  });

  it("includes MutationObserver for dynamic height tracking", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("MutationObserver");
  });

  it("reports height on input events", () => {
    const script = generateInlineEditScript(fields);
    expect(script).toContain("reportHeight");
  });
});

describe("buildEditableSlideHtml — auto-expand support", () => {
  it("generates HTML with auto-expand CSS in the inline edit script", () => {
    const fields = [
      { key: "title", selector: "h1", label: "Заголовок", multiline: false },
    ];
    const baseHtml = "<div class='slide'><h1>Test Title</h1></div>";
    const baseCss = "body { margin: 0; }";
    const themeCss = ":root { --primary: blue; }";
    const fontsUrl = "https://fonts.googleapis.com/css2?family=Inter";

    const result = buildEditableSlideHtml(baseHtml, baseCss, themeCss, fontsUrl, fields);

    // Should contain the inline edit script with auto-expand CSS
    expect(result).toContain("inline-slide-resize");
    expect(result).toContain("visible");
  });
});


// ═══════════════════════════════════════════════════════
// Undo / Redo system — inline edit script
// ═══════════════════════════════════════════════════════

describe("generateInlineEditScript — Undo/Redo system", () => {
  it("includes undo/redo stack initialization", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
      description: "Desc",
    });
    expect(script).toContain("undoStack");
    expect(script).toContain("redoStack");
    expect(script).toContain("MAX_HISTORY");
  });

  it("includes pushUndo function", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("function pushUndo");
  });

  it("includes performUndo function that restores old value", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("function performUndo");
    expect(script).toContain("entry.oldValue");
  });

  it("includes performRedo function that restores new value", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("function performRedo");
    expect(script).toContain("entry.newValue");
  });

  it("includes Ctrl+Z keyboard handler for undo", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // Should handle both English and Russian keyboard layouts
    expect(script).toContain("e.key === 'z'");
    expect(script).toContain("e.key === 'я'");
    expect(script).toContain("performUndo()");
  });

  it("includes Ctrl+Shift+Z keyboard handler for redo", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("e.shiftKey");
    expect(script).toContain("performRedo()");
  });

  it("includes Ctrl+Y keyboard handler for redo", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("e.key === 'y'");
    expect(script).toContain("e.key === 'н'");
  });

  it("sends undo state notification via postMessage", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("inline-edit-undo-state");
    expect(script).toContain("canUndo");
    expect(script).toContain("canRedo");
    expect(script).toContain("undoCount");
    expect(script).toContain("redoCount");
  });

  it("listens for undo/redo commands from parent via postMessage", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("inline-edit-undo");
    expect(script).toContain("inline-edit-redo");
  });

  it("pushes to undo stack on blur when text changes", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // The blur handler should call pushUndo before sending inline-edit-change
    expect(script).toContain("pushUndo");
    expect(script).toContain("oldValue");
    expect(script).toContain("newValue");
  });

  it("clears redo stack when new edit is made", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // pushUndo should clear redo stack
    expect(script).toContain("redoStack.length = 0");
  });

  it("uses capture phase for keyboard handler to intercept before contentEditable", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // The addEventListener should use capture: true
    expect(script).toContain("}, true)");
  });

  it("limits undo stack to MAX_HISTORY entries", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("MAX_HISTORY");
    expect(script).toContain("undoStack.shift()");
  });

  it("sends inline-edit-change with isUndo flag during undo", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("isUndo: true");
  });

  it("sends inline-edit-change with isRedo flag during redo", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    expect(script).toContain("isRedo: true");
  });

  it("updates _originalText on undo to keep DOM state consistent", () => {
    const script = generateInlineEditScript("title-slide", {
      title: "Test",
    });
    // Both performUndo and performRedo should update _originalText
    expect(script).toContain("element._originalText = entry.oldValue");
    expect(script).toContain("element._originalText = entry.newValue");
  });
});

// ═══════════════════════════════════════════════════════
// New layout-specific editable fields tests
// ═══════════════════════════════════════════════════════

describe("getEditableFields — complex layouts", () => {
  describe("roadmap", () => {
    it("returns title, description, and milestone fields", () => {
      const data = {
        title: "Roadmap",
        description: "Project timeline",
        milestones: [
          { title: "Phase 1", date: "Q1 2026", description: "Planning" },
          { title: "Phase 2", date: "Q2 2026", description: "Development" },
        ],
      };
      const fields = getEditableFields("roadmap", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("milestones.0.title");
      expect(keys).toContain("milestones.0.date");
      expect(keys).toContain("milestones.0.description");
      expect(keys).toContain("milestones.1.title");
      expect(keys).toContain("milestones.1.date");
      expect(keys).toContain("milestones.1.description");
    });
  });

  describe("pyramid", () => {
    it("returns title, description, and level fields", () => {
      const data = {
        title: "Pyramid",
        description: "Hierarchy",
        levels: [
          { title: "Top", description: "Leadership" },
          { title: "Middle", description: "Management" },
        ],
      };
      const fields = getEditableFields("pyramid", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("levels.0.title");
      expect(keys).toContain("levels.0.description");
      expect(keys).toContain("levels.1.title");
      expect(keys).toContain("levels.1.description");
    });
  });

  describe("checklist", () => {
    it("returns title, description, and item fields", () => {
      const data = {
        title: "Checklist",
        description: "Tasks",
        items: [
          { title: "Task 1", description: "Do this", done: true },
          { title: "Task 2", description: "Do that", done: false },
        ],
      };
      const fields = getEditableFields("checklist", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("items.0.title");
      expect(keys).toContain("items.0.description");
      expect(keys).toContain("items.1.title");
      expect(keys).toContain("items.1.description");
    });
  });

  describe("kanban-board", () => {
    it("returns title, description, column titles, and card fields", () => {
      const data = {
        title: "Board",
        description: "Kanban",
        columns: [
          {
            title: "Todo",
            cards: [
              { title: "Card 1", description: "Desc 1" },
            ],
          },
          {
            title: "Done",
            cards: [
              { title: "Card 2", description: "Desc 2" },
            ],
          },
        ],
      };
      const fields = getEditableFields("kanban-board", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("columns.0.title");
      expect(keys).toContain("columns.0.cards.0.title");
      expect(keys).toContain("columns.0.cards.0.description");
      expect(keys).toContain("columns.1.title");
      expect(keys).toContain("columns.1.cards.0.title");
      expect(keys).toContain("columns.1.cards.0.description");
    });
  });

  describe("comparison-table", () => {
    it("returns title, description, column names, and feature cells", () => {
      const data = {
        title: "Comparison",
        description: "Products",
        columns: [
          { name: "Product A" },
          { name: "Product B" },
        ],
        features: [
          { name: "Price", values: ["$10", "$20"] },
          { name: "Speed", values: ["Fast", "Slow"] },
        ],
      };
      const fields = getEditableFields("comparison-table", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("columns.0.name");
      expect(keys).toContain("columns.1.name");
      expect(keys).toContain("features.0.name");
      expect(keys).toContain("features.0.values.0");
      expect(keys).toContain("features.0.values.1");
      expect(keys).toContain("features.1.name");
      expect(keys).toContain("features.1.values.0");
      expect(keys).toContain("features.1.values.1");
    });
  });

  describe("scenario-cards", () => {
    it("returns title, description, and scenario fields", () => {
      const data = {
        title: "Scenarios",
        description: "Analysis",
        scenarios: [
          {
            label: "Best",
            title: "Optimistic",
            value: "+30%",
            description: "Growth",
            points: ["Point 1", "Point 2"],
          },
        ],
      };
      const fields = getEditableFields("scenario-cards", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("scenarios.0.label");
      expect(keys).toContain("scenarios.0.title");
      expect(keys).toContain("scenarios.0.value");
      expect(keys).toContain("scenarios.0.description");
      expect(keys).toContain("scenarios.0.points.0");
      expect(keys).toContain("scenarios.0.points.1");
    });
  });

  describe("risk-matrix", () => {
    it("returns title, description, matrix cells, legend, and mitigation fields", () => {
      const data = {
        title: "Risk Matrix",
        description: "Assessment",
        matrixColumns: ["Low", "Medium", "High"],
        matrixRows: [
          {
            label: "High Prob",
            cells: [
              { label: "Risk A", value: "30%" },
              null,
              { label: "Risk B", value: "50%" },
            ],
          },
        ],
        matrixLegend: [
          { label: "Low", color: "#green" },
          { label: "High", color: "#red" },
        ],
        mitigations: [
          { title: "Mitigation 1" },
          { title: "Mitigation 2" },
        ],
      };
      const fields = getEditableFields("risk-matrix", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("matrixColumns.0");
      expect(keys).toContain("matrixColumns.1");
      expect(keys).toContain("matrixColumns.2");
      expect(keys).toContain("matrixRows.0.label");
      expect(keys).toContain("matrixRows.0.cells.0.label");
      expect(keys).toContain("matrixRows.0.cells.0.value");
      expect(keys).toContain("matrixRows.0.cells.2.label");
      expect(keys).toContain("matrixRows.0.cells.2.value");
      expect(keys).toContain("matrixLegend.0.label");
      expect(keys).toContain("matrixLegend.1.label");
      expect(keys).toContain("mitigations.0.title");
      expect(keys).toContain("mitigations.1.title");
    });

    it("skips null cells in matrix rows", () => {
      const data = {
        title: "Risk Matrix",
        matrixRows: [
          {
            label: "Row 1",
            cells: [null, { label: "Risk", value: "10%" }, null],
          },
        ],
      };
      const fields = getEditableFields("risk-matrix", data);
      const keys = fields.map((f) => f.key);

      // Should NOT contain keys for null cells
      expect(keys).not.toContain("matrixRows.0.cells.0.label");
      expect(keys).not.toContain("matrixRows.0.cells.2.label");
      // Should contain key for non-null cell
      expect(keys).toContain("matrixRows.0.cells.1.label");
      expect(keys).toContain("matrixRows.0.cells.1.value");
    });
  });

  describe("vertical-timeline", () => {
    it("returns title, description, and event fields including date", () => {
      const data = {
        title: "Timeline",
        description: "Events",
        events: [
          { date: "2020", title: "Event 1", description: "Desc 1" },
          { date: "2021", title: "Event 2", description: "Desc 2" },
        ],
      };
      const fields = getEditableFields("vertical-timeline", data);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain("title");
      expect(keys).toContain("description");
      expect(keys).toContain("events.0.date");
      expect(keys).toContain("events.0.title");
      expect(keys).toContain("events.0.description");
      expect(keys).toContain("events.1.date");
      expect(keys).toContain("events.1.title");
      expect(keys).toContain("events.1.description");
    });
  });

  // ═══════════════════════════════════════════════════════
  // DRAG-AND-DROP TESTS
  // ═══════════════════════════════════════════════════════
  describe("Drag-and-Drop reordering", () => {
    it("includes drag-and-drop initialization code", () => {
      const script = generateInlineEditScript("text-slide", {
        title: "Test",
        bullets: ["A", "B", "C"],
      });
      expect(script).toContain("initDragAndDrop");
      expect(script).toContain("drag-handle");
    });

    it("includes drag-and-drop CSS styles", () => {
      const script = generateInlineEditScript("text-slide", {
        title: "Test",
        bullets: ["A"],
      });
      expect(script).toContain(".drag-handle");
      expect(script).toContain(".drag-drop-indicator");
      expect(script).toContain(".dragging");
    });

    it("sends inline-reorder-items postMessage on drop", () => {
      const script = generateInlineEditScript("text-slide", {
        title: "Test",
        bullets: ["A", "B"],
      });
      expect(script).toContain("inline-reorder-items");
      expect(script).toContain("arrayPath");
    });

    it("groups elements by array path for drag groups", () => {
      const script = generateInlineEditScript("text-slide", {
        title: "Test",
        bullets: ["A", "B"],
      });
      // Should detect array groups from data-field attributes
      expect(script).toContain("arrayGroups");
    });

    it("handles dragstart, dragover, and drop events", () => {
      const script = generateInlineEditScript("text-slide", {
        title: "Test",
        bullets: ["A"],
      });
      expect(script).toContain("dragstart");
      expect(script).toContain("dragover");
      expect(script).toContain("drop");
      expect(script).toContain("dragend");
    });
  });

  // ═══════════════════════════════════════════════════════
  // FORMAT PAINTER TESTS
  // ═══════════════════════════════════════════════════════
  describe("Format Painter", () => {
    it("includes format painter state and activation logic", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("fpState");
      expect(script).toContain("format-painter-activate");
      expect(script).toContain("format-painter-cancel");
    });

    it("includes format painter CSS styles", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain(".format-painter-source");
      expect(script).toContain(".format-painter-target-hover");
      expect(script).toContain(".format-painter-active");
      expect(script).toContain("format-painter-flash");
    });

    it("copies computed styles from source element", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("fpCopyStyles");
      expect(script).toContain("fontSize");
      expect(script).toContain("fontWeight");
      expect(script).toContain("color");
      expect(script).toContain("textAlign");
    });

    it("applies copied styles to target element", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("fpApplyStyles");
    });

    it("sends inline-format-painter-state postMessage", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("inline-format-painter-state");
      expect(script).toContain("pick-source");
      expect(script).toContain("pick-target");
    });

    it("sends inline-style-change postMessage when style is applied", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("inline-style-change");
    });

    it("integrates with undo stack for style changes", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("isStyleChange");
      expect(script).toContain("oldStyles");
      expect(script).toContain("newStyles");
    });

    it("cancels format painter on Escape key", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("Escape");
      expect(script).toContain("fpCleanup");
    });

    it("uses capture phase for click handler to intercept before contenteditable", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      // Format painter click handler should use capture phase
      expect(script).toContain("}, true)");
    });
  });

  // ═══════════════════════════════════════════════════════
  // AUTOSAVE TESTS
  // ═══════════════════════════════════════════════════════
  describe("Debounced Autosave", () => {
    it("includes autosave debounce timer", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("autosaveTimer");
      expect(script).toContain("clearTimeout");
    });

    it("sends inline-edit-autosave postMessage during typing", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("inline-edit-autosave");
    });

    it("sends inline-edit-typing postMessage on input", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("inline-edit-typing");
    });

    it("uses 1500ms debounce delay for autosave", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("1500");
    });

    it("still sends inline-edit-change on blur for immediate save", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      expect(script).toContain("inline-edit-change");
    });

    it("cancels pending autosave on blur to avoid double save", () => {
      const script = generateInlineEditScript("title-slide", {
        title: "Test",
      });
      // Blur handler should clear autosave timer
      expect(script).toContain("autosaveTimer");
    });
  });
});
