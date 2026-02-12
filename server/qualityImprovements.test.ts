/**
 * Tests for Quality Improvements:
 * 1. QA Agent — validation and auto-fix
 * 2. Writer Context — context building
 * 3. Adaptive Sizing — content density analysis and style generation
 */
import { describe, it, expect } from "vitest";
import { validateSlideData, autoFixSlideData } from "./pipeline/qaAgent";
import { analyzeContentDensity, generateAdaptiveStyles } from "./pipeline/adaptiveSizing";

// ═══════════════════════════════════════════════════════
// QA AGENT TESTS
// ═══════════════════════════════════════════════════════

describe("QA Agent — validateSlideData", () => {
  it("passes valid text-slide data", () => {
    const data = {
      title: "Test Slide",
      bullets: [
        { title: "Point 1", description: "Description 1" },
        { title: "Point 2", description: "Description 2" },
        { title: "Point 3", description: "Description 3" },
      ],
    };
    const result = validateSlideData(data, "text-slide");
    expect(result.passed).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it("fails text-slide with too few bullets", () => {
    const data = {
      title: "Test Slide",
      bullets: [{ title: "Only one", description: "Not enough" }],
    };
    const result = validateSlideData(data, "text-slide");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "bullets" && i.severity === "error")).toBe(true);
  });

  it("fails text-slide with missing title", () => {
    const data = {
      bullets: [
        { title: "A", description: "B" },
        { title: "C", description: "D" },
        { title: "E", description: "F" },
      ],
    };
    const result = validateSlideData(data, "text-slide");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "title")).toBe(true);
  });

  it("warns about string bullets in text-slide", () => {
    const data = {
      title: "Test",
      bullets: ["Just a string", "Another string", "Third string"],
    };
    const result = validateSlideData(data, "text-slide");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field.startsWith("bullets[") && i.severity === "error")).toBe(true);
  });

  it("passes valid icons-numbers data", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual", icon: { name: "dollar-sign", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/dollar-sign.svg" } },
        { label: "Users", value: "150K", description: "Active", icon: { name: "users", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg" } },
        { label: "Growth", value: "85%", description: "YoY", icon: { name: "trending-up", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/trending-up.svg" } },
      ],
    };
    const result = validateSlideData(data, "icons-numbers");
    expect(result.passed).toBe(true);
  });

  it("fails icons-numbers with emoji icons", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual", icon: "💰" },
        { label: "Users", value: "150K", description: "Active", icon: "👥" },
        { label: "Growth", value: "85%", description: "YoY", icon: "📈" },
      ],
    };
    const result = validateSlideData(data, "icons-numbers");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field.includes("icon") && i.severity === "error")).toBe(true);
  });

  it("fails icons-numbers with too few metrics", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual", icon: { name: "dollar-sign", url: "https://example.com/icon.svg" } },
      ],
    };
    const result = validateSlideData(data, "icons-numbers");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "metrics")).toBe(true);
  });

  it("passes valid two-column data", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Pros", bullets: ["Fast", "Reliable"] },
      rightColumn: { title: "Cons", bullets: ["Expensive", "Complex"] },
    };
    const result = validateSlideData(data, "two-column");
    expect(result.passed).toBe(true);
  });

  it("fails two-column with empty column", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Pros", bullets: ["Fast", "Reliable"] },
      rightColumn: { title: "Cons", bullets: [] },
    };
    const result = validateSlideData(data, "two-column");
    expect(result.passed).toBe(false);
  });

  it("passes valid comparison data", () => {
    const data = {
      title: "A vs B",
      optionA: { title: "Option A", points: ["Point 1", "Point 2", "Point 3"], color: "#22c55e" },
      optionB: { title: "Option B", points: ["Point 1", "Point 2", "Point 3"], color: "#ef4444" },
    };
    const result = validateSlideData(data, "comparison");
    expect(result.passed).toBe(true);
  });

  it("fails comparison with too few points", () => {
    const data = {
      title: "A vs B",
      optionA: { title: "Option A", points: ["Only one"], color: "#22c55e" },
      optionB: { title: "Option B", points: ["Only one"], color: "#ef4444" },
    };
    const result = validateSlideData(data, "comparison");
    expect(result.passed).toBe(false);
  });

  it("passes valid process-steps data", () => {
    const data = {
      title: "Process",
      steps: [
        { number: 1, title: "Step 1", description: "Do this" },
        { number: 2, title: "Step 2", description: "Then this" },
        { number: 3, title: "Step 3", description: "Finally this" },
      ],
    };
    const result = validateSlideData(data, "process-steps");
    expect(result.passed).toBe(true);
  });

  it("passes valid timeline data", () => {
    const data = {
      title: "Timeline",
      events: [
        { date: "2024", title: "Event 1", description: "Happened" },
        { date: "2025", title: "Event 2", description: "Happened" },
        { date: "2026", title: "Event 3", description: "Happened" },
      ],
    };
    const result = validateSlideData(data, "timeline");
    expect(result.passed).toBe(true);
  });

  it("passes title-slide with just title", () => {
    const data = { title: "My Presentation" };
    const result = validateSlideData(data, "title-slide");
    expect(result.passed).toBe(true);
  });

  it("generates feedback string for retry", () => {
    const data = {
      title: "",
      bullets: [],
    };
    const result = validateSlideData(data, "text-slide");
    expect(result.passed).toBe(false);
    expect(result.feedbackForRetry).toContain("Fix these data issues");
    expect(result.feedbackForRetry.length).toBeGreaterThan(0);
  });

  it("validates chart-slide data", () => {
    const data = {
      title: "Chart",
      chartData: {
        type: "bar",
        labels: ["A", "B", "C"],
        datasets: [{ label: "Data", data: [1, 2, 3] }],
      },
    };
    const result = validateSlideData(data, "chart-slide");
    expect(result.passed).toBe(true);
  });

  it("fails chart-slide with empty labels", () => {
    const data = {
      title: "Chart",
      chartData: { type: "bar", labels: [], datasets: [] },
    };
    const result = validateSlideData(data, "chart-slide");
    expect(result.passed).toBe(false);
  });
});

describe("QA Agent — autoFixSlideData", () => {
  it("converts string bullets to objects", () => {
    const data = {
      title: "Test",
      bullets: ["Title: Description here", "Another point", "**Bold Title**: Some desc"],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "text-slide");
    expect(wasFixed).toBe(true);
    expect(fixed.bullets[0]).toEqual({ title: "Title", description: "Description here" });
    expect(fixed.bullets[1]).toEqual({ title: "Another point", description: "" });
    expect(fixed.bullets[2]).toEqual({ title: "Bold Title", description: "Some desc" });
  });

  it("fixes emoji icons in metrics", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual", icon: "💰" },
        { label: "Users", value: "150K", description: "Active", icon: "👥" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "icons-numbers");
    expect(wasFixed).toBe(true);
    expect(fixed.metrics[0].icon).toHaveProperty("name");
    expect(fixed.metrics[0].icon).toHaveProperty("url");
    expect(fixed.metrics[0].icon.url).toContain("cdn.jsdelivr.net");
  });

  it("fixes icon objects missing url", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual", icon: { name: "dollar-sign" } },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "icons-numbers");
    expect(wasFixed).toBe(true);
    expect(fixed.metrics[0].icon.url).toContain("dollar-sign.svg");
  });

  it("adds missing step numbers", () => {
    const data = {
      title: "Process",
      steps: [
        { title: "Step A", description: "Do A" },
        { title: "Step B", description: "Do B" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "process-steps");
    expect(wasFixed).toBe(true);
    expect(fixed.steps[0].number).toBe(1);
    expect(fixed.steps[1].number).toBe(2);
  });

  it("adds missing column titles for two-column", () => {
    const data = {
      title: "Comparison",
      leftColumn: { bullets: ["A", "B"] },
      rightColumn: { bullets: ["C", "D"] },
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "two-column");
    expect(wasFixed).toBe(true);
    expect(fixed.leftColumn.title).toBeTruthy();
    expect(fixed.rightColumn.title).toBeTruthy();
  });

  it("does not modify already correct data", () => {
    const data = {
      title: "Test",
      bullets: [
        { title: "Point 1", description: "Desc 1" },
        { title: "Point 2", description: "Desc 2" },
      ],
    };
    const { fixed: wasFixed } = autoFixSlideData(data, "text-slide");
    expect(wasFixed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// WRITER CONTEXT TESTS
// ═══════════════════════════════════════════════════════

describe("Writer Context — buildWriterContext", () => {
  // We test the buildWriterContext function indirectly through the prompt
  // Since it's a private function, we test the writerUser prompt with context
  it("writerUser includes previous context when provided", async () => {
    const { writerUser } = await import("./pipeline/prompts");
    const result = writerUser(3, "AI in Healthcare", "Explore applications", "diagnosis, treatment", "Slide 1 \"Introduction\": AI is transforming industries\nSlide 2 \"Market Overview\": The AI market is worth $150B");
    expect(result).toContain("previous_slides_context");
    expect(result).toContain("AI is transforming industries");
    expect(result).toContain("avoid repeating");
  });

  it("writerUser works without previous context", async () => {
    const { writerUser } = await import("./pipeline/prompts");
    const result = writerUser(1, "Introduction", "Open the presentation", "overview, goals");
    expect(result).not.toContain("previous_slides_context");
    expect(result).toContain("Slide 1: Introduction");
  });
});

// ═══════════════════════════════════════════════════════
// ADAPTIVE SIZING TESTS
// ═══════════════════════════════════════════════════════

describe("Adaptive Sizing — analyzeContentDensity", () => {
  it("classifies sparse text-slide (2 bullets)", () => {
    const data = {
      title: "Test",
      bullets: [
        { title: "Point 1", description: "Short" },
        { title: "Point 2", description: "Short" },
      ],
    };
    const analysis = analyzeContentDensity(data, "text-slide");
    expect(analysis.density).toBe("sparse");
    expect(analysis.itemCount).toBe(2);
  });

  it("classifies normal text-slide (4 bullets)", () => {
    const data = {
      title: "Test",
      bullets: [
        { title: "Point 1", description: "A normal description" },
        { title: "Point 2", description: "A normal description" },
        { title: "Point 3", description: "A normal description" },
        { title: "Point 4", description: "A normal description" },
      ],
    };
    const analysis = analyzeContentDensity(data, "text-slide");
    expect(analysis.density).toBe("normal");
  });

  it("classifies dense text-slide (6 bullets with long text)", () => {
    const data = {
      title: "Test",
      bullets: [
        { title: "Point 1", description: "A very long description that goes on and on with lots of detail about the topic at hand" },
        { title: "Point 2", description: "Another very long description that goes on and on with lots of detail about the topic" },
        { title: "Point 3", description: "Yet another very long description that goes on and on with lots of detail about the topic" },
        { title: "Point 4", description: "Still another very long description that goes on and on with lots of detail about it" },
        { title: "Point 5", description: "One more very long description that goes on and on with lots of detail about the topic" },
        { title: "Point 6", description: "Final very long description that goes on and on with lots of detail about the topic at hand" },
      ],
    };
    const analysis = analyzeContentDensity(data, "text-slide");
    expect(analysis.density).toBe("dense");
  });

  it("classifies sparse icons-numbers (2 metrics)", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "" },
        { label: "Users", value: "150K", description: "" },
      ],
    };
    const analysis = analyzeContentDensity(data, "icons-numbers");
    expect(analysis.density).toBe("sparse");
  });

  it("classifies normal icons-numbers (3-4 metrics)", () => {
    const data = {
      title: "Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual" },
        { label: "Users", value: "150K", description: "Active" },
        { label: "Growth", value: "85%", description: "YoY" },
      ],
    };
    const analysis = analyzeContentDensity(data, "icons-numbers");
    expect(analysis.density).toBe("normal");
  });

  it("classifies sparse process-steps (2 steps)", () => {
    const data = {
      title: "Process",
      steps: [
        { number: 1, title: "Step 1", description: "Do this" },
        { number: 2, title: "Step 2", description: "Then this" },
      ],
    };
    const analysis = analyzeContentDensity(data, "process-steps");
    expect(analysis.density).toBe("sparse");
  });

  it("classifies dense timeline (7 events)", () => {
    const data = {
      title: "Timeline",
      events: Array.from({ length: 7 }, (_, i) => ({
        date: `202${i}`,
        title: `Event ${i + 1}`,
        description: "Something happened",
      })),
    };
    const analysis = analyzeContentDensity(data, "timeline");
    expect(analysis.density).toBe("dense");
  });

  it("returns normal for title-slide (no adaptive needed)", () => {
    const data = { title: "My Presentation" };
    const analysis = analyzeContentDensity(data, "title-slide");
    expect(analysis.density).toBe("normal");
  });

  it("returns normal for section-header (no adaptive needed)", () => {
    const data = { title: "Section 1", subtitle: "Overview" };
    const analysis = analyzeContentDensity(data, "section-header");
    expect(analysis.density).toBe("normal");
  });
});

describe("Adaptive Sizing — generateAdaptiveStyles", () => {
  it("returns no overrides for normal density", () => {
    const analysis = { layoutName: "text-slide", itemCount: 4, avgTextLength: 30, density: "normal" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(false);
    expect(result.cssOverrides).toBe("");
  });

  it("returns sparse overrides for sparse text-slide", () => {
    const analysis = { layoutName: "text-slide", itemCount: 2, avgTextLength: 20, density: "sparse" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("font-size");
    expect(result.cssOverrides).toContain("!important");
  });

  it("returns dense overrides for dense text-slide", () => {
    const analysis = { layoutName: "text-slide", itemCount: 6, avgTextLength: 80, density: "dense" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("font-size");
  });

  it("returns sparse overrides for sparse icons-numbers", () => {
    const analysis = { layoutName: "icons-numbers", itemCount: 2, avgTextLength: 10, density: "sparse" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("52px");
  });

  it("returns dense overrides for dense process-steps", () => {
    const analysis = { layoutName: "process-steps", itemCount: 7, avgTextLength: 40, density: "dense" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("font-size");
  });

  it("returns sparse overrides for sparse timeline", () => {
    const analysis = { layoutName: "timeline", itemCount: 2, avgTextLength: 20, density: "sparse" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("22px");
  });

  it("returns sparse overrides for sparse comparison", () => {
    const analysis = { layoutName: "comparison", itemCount: 3, avgTextLength: 20, density: "sparse" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
  });

  it("returns dense overrides for dense table-slide", () => {
    const analysis = { layoutName: "table-slide", itemCount: 8, avgTextLength: 30, density: "dense" as const };
    const result = generateAdaptiveStyles(analysis);
    expect(result.hasOverrides).toBe(true);
    expect(result.cssOverrides).toContain("13px");
  });
});
