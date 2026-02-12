import { describe, it, expect } from "vitest";
import { renderSlide, listLayouts } from "./templateEngine";

/**
 * Template Overflow Audit Tests
 * 
 * Verifies that all 23 templates have proper overflow protection:
 * 1. Root containers have overflow: hidden
 * 2. Titles have line-clamp for text truncation
 * 3. Dynamic grids are capped (process-steps, team-profiles, roadmap)
 * 4. Long text content is truncated with -webkit-line-clamp
 * 5. Padding is reduced to maximize content area
 */

// Helper: check that rendered HTML contains overflow protection patterns
function expectOverflowProtection(html: string, layoutId: string) {
  // Every template should have overflow: hidden somewhere in its root
  expect(html, `${layoutId}: should contain overflow: hidden`).toContain("overflow: hidden");
}

function expectTitleClamp(html: string, layoutId: string) {
  // Most templates should have line-clamp on their title
  expect(html, `${layoutId}: should have -webkit-line-clamp on title`).toContain("-webkit-line-clamp");
}

describe("Template Overflow Protection — All Templates", () => {
  // ═══════════════════════════════════════════════════════
  // Universal: Every template should have overflow: hidden
  // ═══════════════════════════════════════════════════════
  describe("Universal overflow protection", () => {
    const allLayouts = listLayouts();
    
    for (const layout of allLayouts) {
      it(`${layout}: should have overflow: hidden in rendered output`, () => {
        const html = renderSlide(layout, getMinimalData(layout));
        expectOverflowProtection(html, layout);
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Title truncation with line-clamp
  // ═══════════════════════════════════════════════════════
  describe("Title truncation", () => {
    const layoutsWithTitles = [
      "text-slide", "two-column", "image-text", "chart-slide",
      "table-slide", "timeline", "process-steps", "comparison",
      "agenda-table-of-contents", "team-profiles", "logo-grid",
      "video-embed", "waterfall-chart", "swot-analysis", "funnel",
      "roadmap", "pyramid", "matrix-2x2", "pros-cons", "checklist",
      "highlight-stats",
    ];

    for (const layout of layoutsWithTitles) {
      it(`${layout}: should truncate very long titles`, () => {
        const longTitle = "A".repeat(300);
        const data = { ...getMinimalData(layout), title: longTitle };
        const html = renderSlide(layout, data);
        expectTitleClamp(html, layout);
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Dynamic grid capping
  // ═══════════════════════════════════════════════════════
  describe("Dynamic grid capping", () => {
    it("process-steps: should cap columns at 5 even with 8 steps", () => {
      const html = renderSlide("process-steps", {
        title: "Process",
        steps: Array.from({ length: 8 }, (_, i) => ({
          number: i + 1,
          title: `Step ${i + 1}`,
          description: `Description ${i + 1}`,
        })),
      });
      // Should contain repeat(5, 1fr) not repeat(8, 1fr)
      expect(html).toContain("repeat(5, 1fr)");
      expect(html).not.toContain("repeat(8, 1fr)");
    });

    it("team-profiles: should cap columns at 5 even with 10 members", () => {
      const html = renderSlide("team-profiles", {
        title: "Team",
        teamMembers: Array.from({ length: 10 }, (_, i) => ({
          name: `Person ${i + 1}`,
          role: `Role ${i + 1}`,
        })),
      });
      expect(html).toContain("repeat(5, 1fr)");
      expect(html).not.toContain("repeat(10, 1fr)");
    });

    it("roadmap: should cap columns at 5 even with 7 milestones", () => {
      const html = renderSlide("roadmap", {
        title: "Roadmap",
        milestones: Array.from({ length: 7 }, (_, i) => ({
          date: `Q${i + 1}`,
          title: `Milestone ${i + 1}`,
        })),
      });
      expect(html).toContain("repeat(5, 1fr)");
      expect(html).not.toContain("repeat(7, 1fr)");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Long content truncation in body text
  // ═══════════════════════════════════════════════════════
  describe("Long content truncation", () => {
    it("text-slide: should truncate long bullet descriptions", () => {
      const html = renderSlide("text-slide", {
        title: "Test",
        bullets: [
          { title: "Point 1", description: "D".repeat(500) },
          { title: "Point 2", description: "E".repeat(500) },
        ],
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("two-column: should truncate long bullet items", () => {
      const html = renderSlide("two-column", {
        title: "Test",
        leftColumn: { title: "Left", bullets: ["X".repeat(300)] },
        rightColumn: { title: "Right", bullets: ["Y".repeat(300)] },
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("swot-analysis: should truncate long items in all quadrants", () => {
      const longItem = "Very long SWOT item that should be truncated ".repeat(10);
      const html = renderSlide("swot-analysis", {
        title: "SWOT",
        strengths: { title: "S", items: [longItem] },
        weaknesses: { title: "W", items: [longItem] },
        opportunities: { title: "O", items: [longItem] },
        threats: { title: "T", items: [longItem] },
      });
      // Should have line-clamp for each quadrant's items (may use CSS variable or hardcoded)
      const clampCount = (html.match(/-webkit-line-clamp:/g) || []).length;
      expect(clampCount).toBeGreaterThanOrEqual(4); // At least one per quadrant item
    });

    it("pros-cons: should truncate long items", () => {
      const longItem = "Very long pro/con item ".repeat(20);
      const html = renderSlide("pros-cons", {
        title: "Test",
        pros: { title: "Pros", items: [longItem, longItem] },
        cons: { title: "Cons", items: [longItem, longItem] },
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("timeline: should truncate long event descriptions", () => {
      const html = renderSlide("timeline", {
        title: "Timeline",
        events: [
          { date: "2024", title: "Event", description: "D".repeat(500) },
          { date: "2025", title: "Event 2", description: "E".repeat(500) },
        ],
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("comparison: should truncate long comparison points", () => {
      const longPoint = "Very long comparison point ".repeat(20);
      const html = renderSlide("comparison", {
        title: "Compare",
        optionA: { title: "A", points: [longPoint], color: "#22c55e" },
        optionB: { title: "B", points: [longPoint], color: "#ef4444" },
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("checklist: should truncate long item titles", () => {
      const html = renderSlide("checklist", {
        title: "Checklist",
        items: Array.from({ length: 12 }, (_, i) => ({
          title: `Task ${i + 1}: ${"X".repeat(100)}`,
          description: "D".repeat(200),
          done: i % 2 === 0,
        })),
      });
      expect(html).toContain("overflow: hidden");
      expect(html).toContain("text-overflow: ellipsis");
    });

    it("quote-slide: should truncate very long quotes", () => {
      const html = renderSlide("quote-slide", {
        quote: "Q".repeat(1000),
        author: "Author Name",
        role: "CEO",
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("funnel: should truncate long stage titles", () => {
      const html = renderSlide("funnel", {
        title: "Funnel",
        stages: [
          { title: "Very Long Stage Name That Should Be Truncated", value: "100", color: "#333" },
        ],
      });
      expect(html).toContain("text-overflow: ellipsis");
      expect(html).toContain("white-space: nowrap");
    });

    it("pyramid: should truncate long level descriptions", () => {
      const html = renderSlide("pyramid", {
        title: "Pyramid",
        levels: [
          { title: "Level 1", description: "D".repeat(300), color: "#333" },
          { title: "Level 2", description: "E".repeat(300), color: "#666" },
        ],
      });
      expect(html).toContain("-webkit-line-clamp");
    });

    it("matrix-2x2: should truncate long quadrant items", () => {
      const html = renderSlide("matrix-2x2", {
        title: "Matrix",
        quadrants: [
          { title: "Q1", items: ["Very long item ".repeat(20)] },
          { title: "Q2", items: ["Another long item ".repeat(20)] },
          { title: "Q3", items: [] },
          { title: "Q4", items: [] },
        ],
      });
      expect(html).toContain("text-overflow: ellipsis");
    });

    it("highlight-stats: should truncate long stat labels", () => {
      const html = renderSlide("highlight-stats", {
        title: "Stats",
        mainStat: { value: "100K", label: "Very Long Label Name That Should Be Truncated" },
        supportingStats: [
          { value: "50%", label: "Another Very Long Supporting Stat Label" },
        ],
      });
      expect(html).toContain("text-overflow: ellipsis");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Reduced padding verification (36px 48px 32px standard)
  // ═══════════════════════════════════════════════════════
  describe("Compact padding", () => {
    const compactLayouts = [
      "text-slide", "two-column", "chart-slide", "table-slide",
      "timeline", "process-steps", "comparison",
      "agenda-table-of-contents", "team-profiles", "logo-grid",
      "video-embed", "waterfall-chart", "swot-analysis", "funnel",
      "roadmap", "pyramid", "matrix-2x2", "pros-cons", "checklist",
      "highlight-stats",
    ];

    for (const layout of compactLayouts) {
      it(`${layout}: should use compact padding (36px or less top)`, () => {
        const html = renderSlide(layout, getMinimalData(layout));
        // Should NOT have 48px top padding (old value)
        // Should have 36px or less
        const hasPadding36 = html.includes("padding: 36px");
        const hasPadding32 = html.includes("padding: 32px");
        const hasCompact = hasPadding36 || hasPadding32;
        expect(hasCompact, `${layout}: should have compact padding`).toBe(true);
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Table slide: scrollable table wrapper
  // ═══════════════════════════════════════════════════════
  describe("Table slide overflow", () => {
    it("table-slide: should have overflow: auto on table wrapper", () => {
      const html = renderSlide("table-slide", {
        title: "Large Table",
        headers: ["Col1", "Col2", "Col3", "Col4", "Col5"],
        rows: Array.from({ length: 20 }, (_, i) => 
          [`R${i}C1`, `R${i}C2`, `R${i}C3`, `R${i}C4`, `R${i}C5`]
        ),
      });
      expect(html).toContain("overflow: auto");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Image-text: overflow protection on text side
  // ═══════════════════════════════════════════════════════
  describe("Image-text overflow", () => {
    it("image-text: should have overflow protection on text content", () => {
      const html = renderSlide("image-text", {
        title: "Very Long Title ".repeat(10),
        description: "D".repeat(500),
        bullets: Array.from({ length: 10 }, (_, i) => `Bullet ${i}: ${"X".repeat(100)}`),
        image: { url: "https://example.com/img.jpg", alt: "test" },
      });
      expect(html).toContain("overflow: hidden");
      expect(html).toContain("-webkit-line-clamp");
    });
  });
});

// ═══════════════════════════════════════════════════════
// Helper: minimal data for each layout
// ═══════════════════════════════════════════════════════
function getMinimalData(layoutId: string): Record<string, any> {
  const base = { title: "Test Title", _slideNumber: 1, _totalSlides: 10, _presentationTitle: "Test" };
  
  switch (layoutId) {
    case "title-slide":
      return { ...base, subtitle: "Subtitle", author: "Author" };
    case "section-header":
      return { ...base, subtitle: "Subtitle", sectionNumber: "01" };
    case "text-slide":
      return { ...base, bullets: [{ title: "A", description: "B" }] };
    case "two-column":
      return { ...base, leftColumn: { title: "L", bullets: ["a"] }, rightColumn: { title: "R", bullets: ["b"] } };
    case "image-text":
      return { ...base, image: { url: "https://example.com/img.jpg", alt: "test" }, bullets: ["a"] };
    case "image-fullscreen":
      return { ...base, image: { url: "https://example.com/img.jpg", alt: "test" } };
    case "quote-slide":
      return { quote: "Quote text", author: "Author", role: "CEO" };
    case "chart-slide":
      return { ...base, description: "Desc" };
    case "table-slide":
      return { ...base, headers: ["A", "B"], rows: [["1", "2"]] };
    case "icons-numbers":
      return { ...base, metrics: [{ label: "M", value: "1", icon: { name: "star", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/star.svg" } }] };
    case "timeline":
      return { ...base, events: [{ date: "2024", title: "E1", description: "D1" }] };
    case "process-steps":
      return { ...base, steps: [{ number: 1, title: "S1", description: "D1" }] };
    case "comparison":
      return { ...base, optionA: { title: "A", points: ["p1"], color: "#22c55e" }, optionB: { title: "B", points: ["p2"], color: "#ef4444" } };
    case "final-slide":
      return { ...base, thankYouText: "Thanks" };
    case "agenda-table-of-contents":
      return { ...base, sections: [{ number: 1, title: "S1", description: "D1" }] };
    case "team-profiles":
      return { ...base, teamMembers: [{ name: "N1", role: "R1" }] };
    case "logo-grid":
      return { ...base, logos: [{ name: "L1", url: "https://example.com/logo.png" }] };
    case "video-embed":
      return { ...base, videoUrl: "https://youtube.com/watch?v=test", description: "Desc" };
    case "waterfall-chart":
      return { ...base, bars: [{ label: "A", value: "1", height: 50 }] };
    case "swot-analysis":
      return { ...base, strengths: { title: "S", items: ["a"] }, weaknesses: { title: "W", items: ["b"] }, opportunities: { title: "O", items: ["c"] }, threats: { title: "T", items: ["d"] } };
    case "funnel":
      return { ...base, stages: [{ title: "S1", value: "100", color: "#333" }] };
    case "roadmap":
      return { ...base, milestones: [{ date: "Q1", title: "M1" }] };
    case "pyramid":
      return { ...base, levels: [{ title: "L1", color: "#333" }] };
    case "matrix-2x2":
      return { ...base, quadrants: [{ title: "Q1" }, { title: "Q2" }, { title: "Q3" }, { title: "Q4" }] };
    case "pros-cons":
      return { ...base, pros: { title: "P", items: ["a"] }, cons: { title: "C", items: ["b"] } };
    case "checklist":
      return { ...base, items: [{ title: "I1", done: false }] };
    case "highlight-stats":
      return { ...base, mainStat: { value: "1", label: "L" }, supportingStats: [{ value: "2", label: "L2" }] };
    default:
      return base;
  }
}
