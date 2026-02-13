import { describe, it, expect } from "vitest";
import {
  checkVisualDensity,
  checkContentDiversity,
  checkTextConciseness,
  checkTextOverflow,
  type SlideDesignData,
} from "./pipeline/designCriticAgent";

// ═══════════════════════════════════════════════════════
// VALIDATOR 8: VISUAL DENSITY
// ═══════════════════════════════════════════════════════

describe("checkVisualDensity", () => {
  it("should flag sparse content slides", () => {
    const issues = checkVisualDensity(3, { title: "Test" }, "text-slide", "<div>short</div>");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].category).toBe("balance");
    expect(issues[0].message).toContain("sparse");
  });

  it("should flag text-heavy slides without visuals", () => {
    const longBullets = Array.from({ length: 6 }, (_, i) => ({
      title: `Bullet ${i + 1} with a medium title`,
      description: "A".repeat(120),
    }));
    const issues = checkVisualDensity(
      3,
      { title: "Dense Slide", bullets: longBullets },
      "text-slide",
      "<div>text only no svg</div>",
    );
    expect(issues.some((i) => i.message.includes("text-heavy"))).toBe(true);
  });

  it("should NOT flag slides with visual elements", () => {
    const longBullets = Array.from({ length: 6 }, (_, i) => ({
      title: `Bullet ${i + 1}`,
      description: "A".repeat(120),
    }));
    const issues = checkVisualDensity(
      3,
      { title: "Chart Slide", bullets: longBullets },
      "chart-slide",
      '<div><svg class="chart">...</svg></div>',
    );
    expect(issues.filter((i) => i.message.includes("text-heavy")).length).toBe(0);
  });

  it("should skip exempt layouts", () => {
    const issues = checkVisualDensity(1, { title: "Title" }, "title-slide", "<div></div>");
    expect(issues.length).toBe(0);
  });

  it("should skip big-statement layout", () => {
    const issues = checkVisualDensity(5, { title: "Big" }, "big-statement", "<div></div>");
    expect(issues.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// VALIDATOR 9: CONTENT SHAPE DIVERSITY
// ═══════════════════════════════════════════════════════

describe("checkContentDiversity", () => {
  it("should flag bullet-dominated presentations", () => {
    const slides: SlideDesignData[] = [
      { slideNumber: 1, layoutId: "title-slide", data: {}, html: "" },
      ...Array.from({ length: 8 }, (_, i) => ({
        slideNumber: i + 2,
        layoutId: "text-slide",
        data: { bullets: [{ title: "A", description: "B" }] },
        html: "<div>text</div>",
      })),
      { slideNumber: 10, layoutId: "final-slide", data: {}, html: "" },
    ];
    const issues = checkContentDiversity(slides);
    expect(issues.some((i) => i.message.includes("bullet-point"))).toBe(true);
  });

  it("should flag low unique structure count", () => {
    const slides: SlideDesignData[] = [
      { slideNumber: 1, layoutId: "title-slide", data: {}, html: "" },
      ...Array.from({ length: 8 }, (_, i) => ({
        slideNumber: i + 2,
        layoutId: "text-slide",
        data: { bullets: [{ title: "A", description: "B" }] },
        html: "<div>text</div>",
      })),
      { slideNumber: 10, layoutId: "final-slide", data: {}, html: "" },
    ];
    const issues = checkContentDiversity(slides);
    expect(issues.some((i) => i.message.includes("unique content structure"))).toBe(true);
  });

  it("should NOT flag diverse presentations", () => {
    const slides: SlideDesignData[] = [
      { slideNumber: 1, layoutId: "title-slide", data: {}, html: "" },
      { slideNumber: 2, layoutId: "text-slide", data: { bullets: [{ title: "A" }] }, html: "" },
      { slideNumber: 3, layoutId: "icons-numbers", data: { metrics: [{ value: "10" }] }, html: "" },
      { slideNumber: 4, layoutId: "process-steps", data: { steps: [{ title: "S1" }] }, html: "" },
      { slideNumber: 5, layoutId: "timeline", data: { events: [{ year: "2024" }] }, html: "" },
      { slideNumber: 6, layoutId: "data-table", data: { rows: [["a", "b"]] }, html: "" },
      { slideNumber: 7, layoutId: "final-slide", data: {}, html: "" },
    ];
    const issues = checkContentDiversity(slides);
    expect(issues.filter((i) => i.message.includes("bullet-point")).length).toBe(0);
  });

  it("should skip short presentations", () => {
    const slides: SlideDesignData[] = [
      { slideNumber: 1, layoutId: "title-slide", data: {}, html: "" },
      { slideNumber: 2, layoutId: "text-slide", data: { bullets: [] }, html: "" },
      { slideNumber: 3, layoutId: "final-slide", data: {}, html: "" },
    ];
    const issues = checkContentDiversity(slides);
    expect(issues.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// VALIDATOR 10: TEXT CONCISENESS
// ═══════════════════════════════════════════════════════

describe("checkTextConciseness", () => {
  it("should flag verbose bullets", () => {
    const bullets = Array.from({ length: 4 }, (_, i) => ({
      title: `Point ${i + 1}`,
      description: "A".repeat(150),
    }));
    const issues = checkTextConciseness(3, { bullets }, "text-slide");
    expect(issues.some((i) => i.message.includes("over 120 chars"))).toBe(true);
  });

  it("should flag monotonous bullet lengths", () => {
    const bullets = Array.from({ length: 5 }, (_, i) => ({
      title: `Point ${i + 1}`,
      description: "A".repeat(100),
    }));
    const issues = checkTextConciseness(3, { bullets }, "text-slide");
    expect(issues.some((i) => i.message.includes("similar length"))).toBe(true);
  });

  it("should NOT flag short bullets", () => {
    const bullets = [
      { title: "Point 1", description: "Short text" },
      { title: "Point 2", description: "Also short" },
    ];
    const issues = checkTextConciseness(3, { bullets }, "text-slide");
    expect(issues.length).toBe(0);
  });

  it("should skip exempt layouts", () => {
    const bullets = Array.from({ length: 4 }, () => ({
      title: "Long",
      description: "A".repeat(200),
    }));
    const issues = checkTextConciseness(1, { bullets }, "quote-slide");
    expect(issues.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// NEW TEMPLATE TEXT LIMITS
// ═══════════════════════════════════════════════════════

describe("checkTextOverflow for new templates", () => {
  it("should check card-grid title limits", () => {
    const issues = checkTextOverflow(
      3,
      { title: "A".repeat(80), bullets: [] },
      "card-grid",
    );
    expect(issues.some((i) => i.message.includes("Title too long"))).toBe(true);
  });

  it("should check financial-formula title limits", () => {
    const issues = checkTextOverflow(
      3,
      { title: "A".repeat(80), bullets: [] },
      "financial-formula",
    );
    expect(issues.some((i) => i.message.includes("Title too long"))).toBe(true);
  });

  it("should check big-statement title limits", () => {
    const issues = checkTextOverflow(
      3,
      { title: "A".repeat(100), bullets: [] },
      "big-statement",
    );
    expect(issues.some((i) => i.message.includes("Title too long"))).toBe(true);
  });

  it("should check verdict-analysis title limits", () => {
    const issues = checkTextOverflow(
      3,
      { title: "A".repeat(80), bullets: [] },
      "verdict-analysis",
    );
    expect(issues.some((i) => i.message.includes("Title too long"))).toBe(true);
  });
});
