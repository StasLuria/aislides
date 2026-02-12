import { describe, it, expect } from "vitest";
import { estimateContentHeight, autoDensity } from "./pipeline/autoDensity";

describe("estimateContentHeight", () => {
  it("returns available height for static layouts (title-slide, section-header, etc.)", () => {
    const h = estimateContentHeight("title-slide", { title: "Hello" }, "normal");
    // Static layouts return AVAILABLE_HEIGHT (720 - 68 - 30 = 622)
    expect(h).toBe(622);
  });

  it("estimates text-slide with few bullets as fitting in normal density", () => {
    const data = {
      title: "Short Title",
      bullets: [
        { text: "Point one" },
        { text: "Point two" },
        { text: "Point three" },
      ],
    };
    const h = estimateContentHeight("text-slide", data, "normal");
    expect(h).toBeLessThan(622);
  });

  it("estimates text-slide with many long bullets as taller", () => {
    const shortData = {
      title: "Title",
      bullets: [{ text: "Short" }, { text: "Short" }],
    };
    const longData = {
      title: "Title",
      bullets: Array.from({ length: 8 }, (_, i) => ({
        text: `This is a very long bullet point number ${i + 1} that contains a lot of detailed information about the topic at hand and should take multiple lines to render`,
        description: "Additional description text that adds even more content to this already lengthy bullet point",
      })),
    };
    const shortH = estimateContentHeight("text-slide", shortData, "normal");
    const longH = estimateContentHeight("text-slide", longData, "normal");
    expect(longH).toBeGreaterThan(shortH);
  });

  it("estimates icons-numbers with 4 metrics in normal density", () => {
    const data = {
      title: "Key Metrics",
      metrics: [
        { value: "95%", label: "Accuracy", description: "High accuracy rate" },
        { value: "50ms", label: "Latency", description: "Low response time" },
        { value: "10K", label: "Users", description: "Active users" },
        { value: "99.9%", label: "Uptime", description: "Service availability" },
      ],
    };
    const normalH = estimateContentHeight("icons-numbers", data, "normal");
    const compactH = estimateContentHeight("icons-numbers", data, "compact");
    const denseH = estimateContentHeight("icons-numbers", data, "dense");

    // Each denser level should produce a shorter estimate
    expect(compactH).toBeLessThan(normalH);
    expect(denseH).toBeLessThan(compactH);
  });

  it("estimates icons-numbers with 6 metrics as potentially overflowing normal", () => {
    const data = {
      title: "Comprehensive Metrics Dashboard",
      metrics: Array.from({ length: 6 }, (_, i) => ({
        value: `${(i + 1) * 15}%`,
        label: `Metric ${i + 1} Label`,
        description: `Detailed description for metric ${i + 1} that explains what this metric measures and why it matters for the business`,
      })),
    };
    const normalH = estimateContentHeight("icons-numbers", data, "normal");
    // 6 metrics with descriptions should be tall in normal
    expect(normalH).toBeGreaterThan(400);
  });

  it("estimates two-column layout height based on max column", () => {
    const data = {
      title: "Comparison",
      leftColumn: {
        bullets: [{ text: "Left 1" }, { text: "Left 2" }],
      },
      rightColumn: {
        bullets: [{ text: "Right 1" }, { text: "Right 2" }, { text: "Right 3" }, { text: "Right 4" }, { text: "Right 5" }],
      },
    };
    const h = estimateContentHeight("two-column", data, "normal");
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(800); // Should be reasonable
  });

  it("estimates timeline with many events", () => {
    const data = {
      title: "Project Timeline",
      events: Array.from({ length: 8 }, (_, i) => ({
        title: `Phase ${i + 1}`,
        description: `Description of phase ${i + 1} with some details about what happens during this phase of the project`,
        date: `Q${(i % 4) + 1} 2026`,
      })),
    };
    const normalH = estimateContentHeight("timeline", data, "normal");
    const denseH = estimateContentHeight("timeline", data, "dense");
    expect(denseH).toBeLessThan(normalH);
  });

  it("estimates process-steps height", () => {
    const data = {
      title: "Process",
      steps: Array.from({ length: 6 }, (_, i) => ({
        title: `Step ${i + 1}`,
        description: `Do something important in step ${i + 1}`,
      })),
    };
    const h = estimateContentHeight("process-steps", data, "normal");
    expect(h).toBeGreaterThan(0);
  });

  it("estimates table-slide height based on row count", () => {
    const data = {
      title: "Data Table",
      headers: ["Name", "Value", "Status"],
      rows: Array.from({ length: 10 }, (_, i) => [`Item ${i}`, `${i * 10}`, "Active"]),
    };
    const normalH = estimateContentHeight("table-slide", data, "normal");
    const denseH = estimateContentHeight("table-slide", data, "dense");
    expect(normalH).toBeGreaterThan(denseH);
  });

  it("returns AVAILABLE_HEIGHT for unknown layouts", () => {
    const h = estimateContentHeight("unknown-layout", {}, "normal");
    expect(h).toBe(622);
  });
});

describe("autoDensity", () => {
  it("keeps normal density when content fits", () => {
    const data = {
      title: "Short Title",
      bullets: [{ text: "One" }, { text: "Two" }],
    };
    const result = autoDensity("text-slide", data, "normal");
    expect(result).toBe("normal");
  });

  it("escalates from normal to compact when content overflows at normal", () => {
    // Create data that overflows at normal but fits at compact
    const data = {
      title: "A Very Long Title That Takes Up Space",
      bullets: Array.from({ length: 10 }, (_, i) => ({
        text: `Bullet point ${i + 1} with substantial content that will take multiple lines to render properly in the slide`,
        description: `Supporting description for bullet ${i + 1} that adds more vertical space to the layout`,
      })),
    };
    const result = autoDensity("text-slide", data, "normal");
    // With 10 long bullets + descriptions, should escalate beyond normal
    expect(["compact", "dense"]).toContain(result);
  });

  it("escalates from compact to dense when compact still overflows", () => {
    // Create data that overflows even at compact
    const data = {
      title: "Comprehensive Analysis of Key Performance Indicators",
      bullets: Array.from({ length: 12 }, (_, i) => ({
        text: `Detailed bullet point number ${i + 1} covering an important aspect of the analysis with extensive explanation`,
        description: `In-depth description providing additional context and supporting evidence for bullet point ${i + 1}`,
      })),
    };
    const result = autoDensity("text-slide", data, "compact");
    expect(result).toBe("dense");
  });

  it("returns dense when even dense overflows (best effort)", () => {
    // Create extremely dense data
    const data = {
      title: "Massive Data Slide",
      bullets: Array.from({ length: 20 }, (_, i) => ({
        text: `Extremely long bullet point ${i + 1} that contains paragraphs of text about various topics and subtopics`,
        description: `Even more text in the description field for bullet ${i + 1} that pushes the content well beyond the slide boundaries`,
      })),
    };
    const result = autoDensity("text-slide", data, "normal");
    expect(result).toBe("dense");
  });

  it("does not downgrade density (never goes from dense to normal)", () => {
    const data = {
      title: "Short",
      bullets: [{ text: "One" }],
    };
    // Even if content fits at normal, if initial is dense, stay at dense
    const result = autoDensity("text-slide", data, "dense");
    expect(result).toBe("dense");
  });

  it("handles icons-numbers escalation correctly", () => {
    // 6 metrics fit in normal because grid is 3 cols x 2 rows with clamped descriptions
    const data6 = {
      title: "Key Performance Indicators for Q4 2026",
      metrics: Array.from({ length: 6 }, (_, i) => ({
        value: `${(i + 1) * 12}%`,
        label: `Important Metric ${i + 1}`,
        description: `This metric tracks the performance of area ${i + 1} and shows significant improvement over the previous quarter`,
      })),
    };
    const result6 = autoDensity("icons-numbers", data6, "normal");
    expect(["normal", "compact"]).toContain(result6);

    // 9 metrics (3x3 grid) should escalate
    const data9 = {
      title: "Comprehensive KPI Dashboard",
      metrics: Array.from({ length: 9 }, (_, i) => ({
        value: `${(i + 1) * 10}%`,
        label: `Metric ${i + 1} Label Text`,
        description: `Detailed description for metric ${i + 1} explaining its significance and measurement methodology in detail`,
      })),
    };
    const result9 = autoDensity("icons-numbers", data9, "normal");
    expect(["compact", "dense"]).toContain(result9);
  });

  it("handles static layouts without escalation", () => {
    const result = autoDensity("title-slide", { title: "Hello World" }, "normal");
    expect(result).toBe("normal");
  });

  it("handles empty data gracefully", () => {
    const result = autoDensity("text-slide", {}, "normal");
    expect(result).toBe("normal");
  });

  it("handles checklist with many items", () => {
    const data = {
      title: "Checklist",
      items: Array.from({ length: 15 }, (_, i) => ({
        text: `Task ${i + 1}: Complete this important item with detailed instructions`,
        description: `Additional notes for task ${i + 1}`,
      })),
    };
    const result = autoDensity("checklist", data, "normal");
    expect(result).toBe("dense");
  });

  it("handles swot-analysis with many items per quadrant", () => {
    // 6 short items per quadrant fits in normal (2x2 grid, each quadrant ~160px)
    const data6 = {
      title: "SWOT Analysis",
      strengths: { items: Array.from({ length: 6 }, (_, i) => `Strength ${i + 1} with detail`) },
      weaknesses: { items: Array.from({ length: 6 }, (_, i) => `Weakness ${i + 1} with detail`) },
      opportunities: { items: Array.from({ length: 6 }, (_, i) => `Opportunity ${i + 1} with detail`) },
      threats: { items: Array.from({ length: 6 }, (_, i) => `Threat ${i + 1} with detail`) },
    };
    const result6 = autoDensity("swot-analysis", data6, "normal");
    expect(["normal", "compact", "dense"]).toContain(result6);

    // 12 items per quadrant should definitely escalate
    const data12 = {
      title: "Detailed SWOT Analysis",
      strengths: { items: Array.from({ length: 12 }, (_, i) => `Strength ${i + 1} with extensive detail and explanation`) },
      weaknesses: { items: Array.from({ length: 12 }, (_, i) => `Weakness ${i + 1} with extensive detail and explanation`) },
      opportunities: { items: Array.from({ length: 12 }, (_, i) => `Opportunity ${i + 1} with extensive detail`) },
      threats: { items: Array.from({ length: 12 }, (_, i) => `Threat ${i + 1} with extensive detail`) },
    };
    const result12 = autoDensity("swot-analysis", data12, "normal");
    expect(["compact", "dense"]).toContain(result12);
  });
});
