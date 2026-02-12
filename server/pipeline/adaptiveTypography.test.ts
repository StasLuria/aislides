/**
 * Adaptive Typography Tests
 * Tests for computeDensity function and density class injection in renderSlide.
 */
import { describe, it, expect } from "vitest";
import { computeDensity, renderSlide, BASE_CSS } from "./templateEngine";

// ═══════════════════════════════════════════════════════
// computeDensity — Unit Tests
// ═══════════════════════════════════════════════════════

describe("computeDensity — Content Density Analysis", () => {
  describe("Static layouts always return normal", () => {
    const staticLayouts = ["title-slide", "section-header", "final-slide", "image-fullscreen", "video-embed", "quote-slide"];
    for (const layout of staticLayouts) {
      it(`${layout}: returns normal regardless of content`, () => {
        expect(computeDensity(layout, { title: "A".repeat(200), bullets: Array(20).fill("x") })).toBe("normal");
      });
    }
  });

  describe("text-slide density levels", () => {
    it("normal: 3 short bullets", () => {
      expect(computeDensity("text-slide", {
        title: "Short",
        bullets: ["One", "Two", "Three"],
      })).toBe("normal");
    });

    it("compact: 5 bullets", () => {
      expect(computeDensity("text-slide", {
        title: "Title",
        bullets: Array(5).fill("Bullet text"),
      })).toBe("compact");
    });

    it("dense: 8 bullets", () => {
      expect(computeDensity("text-slide", {
        title: "Title",
        bullets: Array(8).fill("Bullet text"),
      })).toBe("dense");
    });

    it("compact from long text even with few items", () => {
      // totalTextLen for strings in array = 200+200 = 400, plus description 200 = 600
      // textPressure = 600 >= 600 → 2, itemCount = 2, effective = 4 → still < 5 compact threshold
      // Need 5+ effective: 3 bullets + textPressure 2 = 5 → compact
      expect(computeDensity("text-slide", {
        title: "Title",
        bullets: ["A".repeat(250), "B".repeat(250), "C".repeat(150)],
        description: "D".repeat(100),
      })).toBe("compact");
    });
  });

  describe("two-column density levels", () => {
    it("normal: 2 bullets per column", () => {
      expect(computeDensity("two-column", {
        title: "Title",
        leftColumn: { bullets: ["A", "B"] },
        rightColumn: { bullets: ["C", "D"] },
      })).toBe("normal");
    });

    it("compact: 4 bullets per column", () => {
      expect(computeDensity("two-column", {
        title: "Title",
        leftColumn: { bullets: Array(4).fill("Bullet") },
        rightColumn: { bullets: Array(4).fill("Bullet") },
      })).toBe("compact");
    });

    it("dense: 7 bullets per column", () => {
      expect(computeDensity("two-column", {
        title: "Title",
        leftColumn: { bullets: Array(7).fill("Bullet") },
        rightColumn: { bullets: Array(7).fill("Bullet") },
      })).toBe("dense");
    });
  });

  describe("comparison density levels", () => {
    it("normal: 2 points per option", () => {
      expect(computeDensity("comparison", {
        title: "Title",
        optionA: { points: ["A", "B"] },
        optionB: { points: ["C", "D"] },
      })).toBe("normal");
    });

    it("compact: 5 points per option", () => {
      expect(computeDensity("comparison", {
        title: "Title",
        optionA: { points: Array(5).fill("Point") },
        optionB: { points: Array(5).fill("Point") },
      })).toBe("compact");
    });
  });

  describe("pros-cons density levels", () => {
    it("compact: 5 items per side", () => {
      expect(computeDensity("pros-cons", {
        title: "Title",
        pros: { items: Array(5).fill("Pro") },
        cons: { items: Array(5).fill("Con") },
      })).toBe("compact");
    });

    it("dense: 7 items per side", () => {
      expect(computeDensity("pros-cons", {
        title: "Title",
        pros: { items: Array(7).fill("Pro") },
        cons: { items: Array(7).fill("Con") },
      })).toBe("dense");
    });
  });

  describe("icons-numbers density levels", () => {
    it("normal: 3 metrics", () => {
      expect(computeDensity("icons-numbers", {
        title: "Title",
        metrics: [{ value: "1" }, { value: "2" }, { value: "3" }],
      })).toBe("normal");
    });

    it("compact: 5 metrics", () => {
      expect(computeDensity("icons-numbers", {
        title: "Title",
        metrics: Array(5).fill({ value: "99", label: "Label" }),
      })).toBe("compact");
    });

    it("dense: 7 metrics", () => {
      expect(computeDensity("icons-numbers", {
        title: "Title",
        metrics: Array(7).fill({ value: "99", label: "Label" }),
      })).toBe("dense");
    });
  });

  describe("timeline density levels", () => {
    it("compact: 5 events", () => {
      expect(computeDensity("timeline", {
        title: "Title",
        events: Array(5).fill({ title: "Event", description: "Desc" }),
      })).toBe("compact");
    });

    it("dense: 8 events", () => {
      expect(computeDensity("timeline", {
        title: "Title",
        events: Array(8).fill({ title: "Event", description: "Desc" }),
      })).toBe("dense");
    });
  });

  describe("process-steps density levels", () => {
    it("compact: 5 steps", () => {
      expect(computeDensity("process-steps", {
        title: "Title",
        steps: Array(5).fill({ title: "Step", description: "Desc" }),
      })).toBe("compact");
    });
  });

  describe("team-profiles density levels", () => {
    it("compact: 5 members", () => {
      expect(computeDensity("team-profiles", {
        title: "Title",
        members: Array(5).fill({ name: "Name", role: "Role" }),
      })).toBe("compact");
    });
  });

  describe("checklist density levels", () => {
    it("normal: 4 items", () => {
      expect(computeDensity("checklist", {
        title: "Title",
        items: Array(4).fill({ text: "Item" }),
      })).toBe("normal");
    });

    it("compact: 7 items", () => {
      expect(computeDensity("checklist", {
        title: "Title",
        items: Array(7).fill({ text: "Item" }),
      })).toBe("compact");
    });

    it("dense: 11 items", () => {
      expect(computeDensity("checklist", {
        title: "Title",
        items: Array(11).fill({ text: "Item" }),
      })).toBe("dense");
    });
  });

  describe("swot-analysis density levels", () => {
    it("compact: 5 items in one quadrant", () => {
      expect(computeDensity("swot-analysis", {
        title: "SWOT",
        strengths: { items: Array(5).fill("S") },
        weaknesses: { items: ["W"] },
        opportunities: { items: ["O"] },
        threats: { items: ["T"] },
      })).toBe("compact");
    });
  });

  describe("matrix-2x2 density levels", () => {
    it("compact: 4 items in one quadrant", () => {
      // computeDensity uses data.topLeft/topRight/bottomLeft/bottomRight, not data.quadrants
      expect(computeDensity("matrix-2x2", {
        title: "Matrix",
        topLeft: { items: Array(4).fill("Item") },
        topRight: { items: ["I"] },
        bottomLeft: { items: ["I"] },
        bottomRight: { items: ["I"] },
      })).toBe("compact");
    });
  });

  describe("funnel density levels", () => {
    it("compact: 6 stages", () => {
      expect(computeDensity("funnel", {
        title: "Funnel",
        stages: Array(6).fill({ title: "Stage", value: "100" }),
      })).toBe("compact");
    });
  });

  describe("roadmap density levels", () => {
    it("compact: 5 milestones", () => {
      expect(computeDensity("roadmap", {
        title: "Roadmap",
        milestones: Array(5).fill({ title: "Milestone", date: "Q1" }),
      })).toBe("compact");
    });
  });

  describe("table-slide density levels", () => {
    it("compact: 6 rows", () => {
      expect(computeDensity("table-slide", {
        title: "Table",
        headers: ["A", "B", "C"],
        rows: Array(6).fill(["1", "2", "3"]),
      })).toBe("compact");
    });

    it("dense: many columns", () => {
      expect(computeDensity("table-slide", {
        title: "Table",
        headers: Array(9).fill("H"),
        rows: [Array(9).fill("V")],
      })).toBe("dense");
    });
  });

  describe("highlight-stats density levels", () => {
    it("compact: 4 supporting stats", () => {
      expect(computeDensity("highlight-stats", {
        title: "Stats",
        supportingStats: Array(4).fill({ value: "99", label: "L" }),
      })).toBe("compact");
    });
  });

  describe("Title pressure", () => {
    it("long title adds pressure to push toward compact", () => {
      // 3 bullets alone = normal, but with 80+ char title → compact
      expect(computeDensity("text-slide", {
        title: "A".repeat(90),
        bullets: ["One", "Two", "Three", "Four"],
      })).toBe("compact");
    });
  });

  describe("Text length pressure", () => {
    it("very long text in few items pushes toward dense", () => {
      // textPressure: 700 chars > 600 → 2, itemCount: 2, titlePressure: 0
      // effective = 2 + 0 + 2 = 4, but denseThreshold = 7 for text-slide
      // Need effective >= 7: 5 bullets + textPressure 2 = 7 → dense
      expect(computeDensity("text-slide", {
        title: "Title",
        bullets: [
          "A".repeat(150), "B".repeat(150), "C".repeat(150),
          "D".repeat(150), "E".repeat(100),
        ],
      })).toBe("dense");
    });
  });

  describe("Unknown layout returns normal", () => {
    it("returns normal for unknown layout", () => {
      expect(computeDensity("unknown-layout", { title: "Title" })).toBe("normal");
    });
  });
});

// ═══════════════════════════════════════════════════════
// renderSlide — Density Class Injection Tests
// ═══════════════════════════════════════════════════════

describe("renderSlide — Density Class Injection", () => {
  it("normal density: no density class added", () => {
    const html = renderSlide("text-slide", {
      title: "Short Title",
      bullets: ["One", "Two"],
    });
    expect(html).not.toContain("density-compact");
    expect(html).not.toContain("density-dense");
  });

  it("compact density: adds density-compact class", () => {
    const html = renderSlide("text-slide", {
      title: "Title",
      bullets: Array(6).fill("Bullet text here"),
    });
    expect(html).toContain("density-compact");
  });

  it("dense density: adds density-dense class", () => {
    const html = renderSlide("text-slide", {
      title: "Title",
      bullets: Array(9).fill("Bullet text here"),
    });
    expect(html).toContain("density-dense");
  });

  it("static layouts never get density class", () => {
    const html = renderSlide("title-slide", {
      title: "A".repeat(200),
      description: "B".repeat(500),
    });
    expect(html).not.toContain("density-compact");
    expect(html).not.toContain("density-dense");
  });

  it("icons-numbers compact: density class on root div", () => {
    const html = renderSlide("icons-numbers", {
      title: "Metrics",
      metrics: Array(5).fill({ value: "99%", label: "Metric", description: "Description text" }),
    });
    expect(html).toContain("density-compact");
  });

  it("comparison dense: density class applied", () => {
    const html = renderSlide("comparison", {
      title: "Compare",
      optionA: { title: "A", points: Array(7).fill("Point text") },
      optionB: { title: "B", points: Array(7).fill("Point text") },
    });
    expect(html).toContain("density-dense");
  });
});

// ═══════════════════════════════════════════════════════
// CSS Variables — Presence Tests
// ═══════════════════════════════════════════════════════

describe("BASE_CSS — Adaptive Typography CSS Variables", () => {
  it("defines normal density variables", () => {
    expect(BASE_CSS).toContain("--at-title-size: 36px");
    expect(BASE_CSS).toContain("--at-subtitle-size: 20px");
    expect(BASE_CSS).toContain("--at-body-size: 16px");
    expect(BASE_CSS).toContain("--at-small-size: 14px");
    expect(BASE_CSS).toContain("--at-label-size: 13px");
    expect(BASE_CSS).toContain("--at-card-padding: 24px");
    expect(BASE_CSS).toContain("--at-bullet-clamp: 3");
    expect(BASE_CSS).toContain("--at-desc-clamp: 2");
    expect(BASE_CSS).toContain("--at-icon-size: 48px");
    expect(BASE_CSS).toContain("--at-value-size: 28px");
  });

  it("defines compact density variables with reduced sizes", () => {
    expect(BASE_CSS).toContain("density-compact");
    expect(BASE_CSS).toContain("--at-title-size: 30px");
    expect(BASE_CSS).toContain("--at-subtitle-size: 17px");
    expect(BASE_CSS).toContain("--at-body-size: 14px");
    expect(BASE_CSS).toContain("--at-card-padding: 18px");
    expect(BASE_CSS).toContain("--at-icon-size: 40px");
    expect(BASE_CSS).toContain("--at-value-size: 24px");
  });

  it("defines dense density variables with further reduced sizes", () => {
    expect(BASE_CSS).toContain("density-dense");
    expect(BASE_CSS).toContain("--at-title-size: 26px");
    expect(BASE_CSS).toContain("--at-subtitle-size: 15px");
    expect(BASE_CSS).toContain("--at-body-size: 13px");
    expect(BASE_CSS).toContain("--at-card-padding: 14px");
    expect(BASE_CSS).toContain("--at-icon-size: 36px");
    expect(BASE_CSS).toContain("--at-value-size: 20px");
  });
});

// ═══════════════════════════════════════════════════════
// Template CSS Variable Usage — Integration Tests
// ═══════════════════════════════════════════════════════

describe("Templates use CSS variables for adaptive sizing", () => {
  const templatesWithAdaptiveTitle = [
    "text-slide", "two-column", "image-text", "chart-slide", "table-slide",
    "icons-numbers", "timeline", "process-steps", "comparison",
    "agenda-table-of-contents", "team-profiles", "logo-grid", "video-embed",
    "waterfall-chart", "swot-analysis", "funnel", "roadmap", "pyramid",
    "matrix-2x2", "pros-cons", "checklist", "highlight-stats",
  ];

  for (const layout of templatesWithAdaptiveTitle) {
    it(`${layout}: uses var(--at-title-size) for title`, () => {
      const html = renderSlide(layout, {
        title: "Test Title",
        // Provide minimal data for each template
        bullets: [{ title: "B", description: "D" }],
        leftColumn: { title: "L", bullets: ["LB"] },
        rightColumn: { title: "R", bullets: ["RB"] },
        metrics: [{ value: "1", label: "L" }],
        events: [{ title: "E" }],
        steps: [{ title: "S" }],
        optionA: { title: "A", points: ["P"] },
        optionB: { title: "B", points: ["P"] },
        sections: [{ title: "S" }],
        members: [{ name: "N" }],
        strengths: { items: ["S"] },
        weaknesses: { items: ["W"] },
        opportunities: { items: ["O"] },
        threats: { items: ["T"] },
        stages: [{ title: "S", value: "V" }],
        milestones: [{ title: "M" }],
        levels: [{ title: "L" }],
        quadrants: [{ title: "Q" }],
        pros: { items: ["P"] },
        cons: { items: ["C"] },
        items: [{ text: "I" }],
        headers: ["H"],
        rows: [["V"]],
        supportingStats: [{ value: "1", label: "L" }],
        logos: [{ name: "L" }],
        bars: [{ value: "1", label: "L" }],
      });
      expect(html).toContain("var(--at-title-size");
    });
  }

  it("text-slide uses var(--at-small-size) for bullet description", () => {
    const html = renderSlide("text-slide", {
      title: "Title",
      bullets: [{ title: "Bullet", description: "Desc" }],
    });
    expect(html).toContain("var(--at-small-size");
    expect(html).toContain("var(--at-body-size");
  });

  it("image-text uses var(--at-label-size) for bullet description", () => {
    const html = renderSlide("image-text", {
      title: "Title",
      bullets: [{ title: "Bullet", description: "Desc" }],
    });
    expect(html).toContain("var(--at-small-size");
    expect(html).toContain("var(--at-label-size");
  });

  it("icons-numbers uses var(--at-value-size) for metric values", () => {
    const html = renderSlide("icons-numbers", {
      title: "Title",
      metrics: [{ value: "99%", label: "Label" }],
    });
    expect(html).toContain("var(--at-value-size");
  });

  it("two-column uses var(--at-card-padding) for card padding", () => {
    const html = renderSlide("two-column", {
      title: "Title",
      leftColumn: { title: "L", bullets: ["B"] },
      rightColumn: { title: "R", bullets: ["B"] },
    });
    expect(html).toContain("var(--at-card-padding");
  });

  it("text-slide uses var(--at-bullet-clamp) for line-clamp", () => {
    const html = renderSlide("text-slide", {
      title: "Title",
      bullets: [{ title: "B", description: "D" }],
    });
    expect(html).toContain("var(--at-bullet-clamp");
  });
});
