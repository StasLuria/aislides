import { describe, it, expect } from "vitest";
import { generatePptx } from "./pptxExport";

const TEST_CSS = `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f0f4ff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f8faff 0%, #e8f0fe 50%, #f0f4ff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
  --text-heading-color: #0f172a;
  --text-body-color: #475569;
  --primary-accent-color: #2563eb;
  --primary-accent-light: #93bbfd;
  --secondary-accent-color: #0ea5e9;
  --heading-font-family: 'Inter';
  --body-font-family: 'Source Sans 3';
  --decorative-shape-color: rgba(37, 99, 235, 0.06);
  --card-border-color: rgba(37, 99, 235, 0.12);
  --card-shadow: 0 4px 24px rgba(37, 99, 235, 0.08);
}`;

function makeSlide(layoutId: string, data: Record<string, any>) {
  return { layoutId, data };
}

function expectValidPptx(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.length).toBeGreaterThan(100);
  expect(buf[0]).toBe(0x50); // P
  expect(buf[1]).toBe(0x4b); // K
}

describe("PPTX Export — generatePptx", () => {
  it("generates a valid PPTX buffer from a title slide", async () => {
    const slides = [
      makeSlide("title-slide", { title: "Welcome", subtitle: "Introduction", author: "Author", date: "2025-12-01" }),
    ];
    const buf = await generatePptx(slides, "Test Presentation", TEST_CSS);
    expectValidPptx(buf);
  });

  it("generates PPTX with multiple layout types", async () => {
    const slides = [
      makeSlide("title-slide", { title: "Title", subtitle: "Sub" }),
      makeSlide("text-slide", { title: "Text Slide", bullets: [{ title: "Point 1", description: "Desc 1" }] }),
      makeSlide("highlight-stats", { title: "Stats", mainStat: { value: "42%", label: "Growth" }, supportingStats: [{ value: "100", label: "Users" }] }),
      makeSlide("section-header", { title: "Section Title", subtitle: "Section subtitle" }),
      makeSlide("final-slide", { title: "Thank You", subtitle: "Questions?" }),
    ];
    const buf = await generatePptx(slides, "Multi Layout", TEST_CSS);
    expectValidPptx(buf);
    expect(buf.length).toBeGreaterThan(5000);
  });

  it("handles comparison-table layout", async () => {
    const slides = [
      makeSlide("comparison-table", {
        title: "Comparison",
        headers: ["Feature", "Plan A", "Plan B"],
        features: [
          { name: "Price", values: ["$10", "$20"] },
          { name: "Storage", values: ["10GB", "50GB"] },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Comparison", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles comparison-table with empty headers (columns fallback)", async () => {
    const slides = [
      makeSlide("comparison-table", {
        title: "Comparison",
        headers: [],
        columns: [
          { header: "Metric", rows: ["Speed", "Cost"] },
          { header: "Plan A", rows: ["Fast", "$10"] },
          { header: "Plan B", rows: ["Slow", "$5"] },
        ],
        features: [],
      }),
    ];
    const buf = await generatePptx(slides, "Comparison Columns", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles financial-formula layout", async () => {
    const slides = [
      makeSlide("financial-formula", {
        title: "EBITDA",
        formulaParts: [
          { value: "850M", label: "Revenue", operator: "" },
          { value: "340M", label: "COGS", operator: "-" },
          { value: "153M", label: "EBITDA", operator: "=" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Financial", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles verdict-analysis layout with severity colors", async () => {
    const slides = [
      makeSlide("verdict-analysis", {
        title: "Risk Analysis",
        verdictTitle: "Key Findings",
        verdictDetails: ["Risk elevated", "Stability needs improvement"],
        criteria: [
          { name: "Churn Rate", value: "HIGH", description: "Increased to 4.2%" },
          { name: "Incidents", value: "MEDIUM", description: "7 incidents" },
          { name: "Revenue", value: "LOW", description: "On track" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Verdict", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles card-grid layout with icon objects", async () => {
    const slides = [
      makeSlide("card-grid", {
        title: "Features",
        cards: [
          { icon: { name: "rocket", url: "" }, title: "Fast", description: "Lightning speed" },
          { icon: { name: "shield", url: "" }, title: "Secure", description: "Enterprise grade" },
          { icon: { name: "chart", url: "" }, title: "Analytics", description: "Deep insights" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Cards", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles empty slides array", async () => {
    const buf = await generatePptx([], "Empty", TEST_CSS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("handles unknown layout type gracefully", async () => {
    const slides = [
      makeSlide("unknown-layout-xyz", { title: "Unknown", description: "Some content" }),
    ];
    const buf = await generatePptx(slides, "Unknown", TEST_CSS);
    expectValidPptx(buf);
  });

  it("strips markdown from text content", async () => {
    const slides = [
      makeSlide("text-slide", {
        title: "**Bold Title** with *italic*",
        bullets: [{ title: "**Point 1**", description: "*Description* with `code`" }],
      }),
    ];
    const buf = await generatePptx(slides, "Markdown", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles image-text layout without external image (fallback placeholder)", async () => {
    const slides = [
      makeSlide("image-text", {
        title: "Image Slide",
        image: { url: "" },
        bullets: [{ title: "Point", description: "Description" }],
      }),
    ];
    const buf = await generatePptx(slides, "Image", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles process-steps layout", async () => {
    const slides = [
      makeSlide("process-steps", {
        title: "Process",
        steps: [
          { number: 1, title: "Step 1", description: "First step" },
          { number: 2, title: "Step 2", description: "Second step" },
          { number: 3, title: "Step 3", description: "Third step" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Process", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles timeline layout", async () => {
    const slides = [
      makeSlide("timeline", {
        title: "Timeline",
        events: [
          { date: "Q1 2025", title: "Launch", description: "Product launch" },
          { date: "Q2 2025", title: "Growth", description: "Scale up" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Timeline", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles two-column layout", async () => {
    const slides = [
      makeSlide("two-column", {
        title: "Two Columns",
        leftColumn: { title: "Left", bullets: [{ title: "L1", description: "Left desc" }] },
        rightColumn: { title: "Right", bullets: [{ title: "R1", description: "Right desc" }] },
      }),
    ];
    const buf = await generatePptx(slides, "Two Column", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles SWOT analysis layout", async () => {
    const slides = [
      makeSlide("swot-analysis", {
        title: "SWOT",
        quadrants: [
          { label: "Strengths", items: ["Strong brand", "Good team"] },
          { label: "Weaknesses", items: ["Limited budget"] },
          { label: "Opportunities", items: ["New market"] },
          { label: "Threats", items: ["Competition"] },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "SWOT", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles quote-slide layout", async () => {
    const slides = [
      makeSlide("quote-slide", {
        title: "Quote",
        quote: "Innovation distinguishes between a leader and a follower.",
        author: "Steve Jobs",
        role: "Co-founder, Apple",
      }),
    ];
    const buf = await generatePptx(slides, "Quote", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles agenda layout", async () => {
    const slides = [
      makeSlide("agenda", {
        title: "Agenda",
        items: [
          { number: 1, title: "Introduction", duration: "5 min" },
          { number: 2, title: "Main Topic", duration: "20 min" },
          { number: 3, title: "Q&A", duration: "10 min" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Agenda", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles non-string data gracefully (numbers, objects in stripMd)", async () => {
    const slides = [
      makeSlide("highlight-stats", {
        title: 12345,
        mainStat: { value: 42, label: "Count" },
        supportingStats: [{ value: 100, label: "Total" }],
      }),
    ];
    const buf = await generatePptx(slides, "Non-string", TEST_CSS);
    expectValidPptx(buf);
  });

  it("handles icons-numbers layout", async () => {
    const slides = [
      makeSlide("icons-numbers", {
        title: "Key Metrics",
        items: [
          { icon: { name: "users" }, number: "10K", title: "Users", description: "Active monthly" },
          { icon: { name: "revenue" }, number: "$5M", title: "Revenue", description: "Annual" },
        ],
      }),
    ];
    const buf = await generatePptx(slides, "Icons Numbers", TEST_CSS);
    expectValidPptx(buf);
  });
});
