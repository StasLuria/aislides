/**
 * Tests for Data Visualization Agent and SVG Chart Engine
 */
import { describe, it, expect } from "vitest";
import {
  extractFromDataPoints,
  extractFromText,
  parseNumericValue,
  detectUnit,
  analyzeSlideForChart,
  injectChartIntoSlideData,
} from "./dataVizAgent";
import {
  renderChart,
  recommendChartType,
  type ChartConfig,
  type ChartDataPoint,
} from "./svgChartEngine";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// parseNumericValue
// ═══════════════════════════════════════════════════════

describe("parseNumericValue", () => {
  it("should parse plain integers", () => {
    expect(parseNumericValue("42")).toBe(42);
    expect(parseNumericValue("100")).toBe(100);
  });

  it("should parse decimals", () => {
    expect(parseNumericValue("3.14")).toBe(3.14);
    expect(parseNumericValue("0.5")).toBe(0.5);
  });

  it("should parse percentages", () => {
    expect(parseNumericValue("15%")).toBe(15);
    expect(parseNumericValue("99.5%")).toBe(99.5);
  });

  it("should parse K/M/B suffixes", () => {
    expect(parseNumericValue("2.5K")).toBe(2500);
    expect(parseNumericValue("1.2M")).toBe(1200000);
    expect(parseNumericValue("3B")).toBe(3000000000);
  });

  it("should parse Russian suffixes", () => {
    expect(parseNumericValue("5тыс")).toBe(5000);
    expect(parseNumericValue("2.3млн")).toBe(2300000);
    expect(parseNumericValue("1.5млрд")).toBe(1500000000);
  });

  it("should handle commas as decimal separators", () => {
    expect(parseNumericValue("3,14")).toBe(3.14);
  });

  it("should handle currency symbols", () => {
    expect(parseNumericValue("$42")).toBe(42);
    expect(parseNumericValue("€100")).toBe(100);
  });

  it("should return null for non-numeric strings", () => {
    expect(parseNumericValue("")).toBeNull();
    expect(parseNumericValue("abc")).toBeNull();
  });

  it("should handle negative numbers", () => {
    expect(parseNumericValue("-15")).toBe(-15);
    expect(parseNumericValue("-3.5%")).toBe(-3.5);
  });
});

// ═══════════════════════════════════════════════════════
// extractFromDataPoints
// ═══════════════════════════════════════════════════════

describe("extractFromDataPoints", () => {
  it("should extract data from valid data_points", () => {
    const slide: SlideContent = {
      slide_number: 1,
      title: "Revenue",
      text: "",
      notes: "",
      data_points: [
        { label: "Q1", value: "100", unit: "$M" },
        { label: "Q2", value: "150", unit: "$M" },
        { label: "Q3", value: "200", unit: "$M" },
      ],
      key_message: "",
    };

    const result = extractFromDataPoints(slide);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(3);
    expect(result![0]).toEqual({ label: "Q1", value: 100 });
    expect(result![1]).toEqual({ label: "Q2", value: 150 });
  });

  it("should return null for fewer than 2 data points", () => {
    const slide: SlideContent = {
      slide_number: 1,
      title: "Test",
      text: "",
      notes: "",
      data_points: [{ label: "Only one", value: "42", unit: "" }],
      key_message: "",
    };

    expect(extractFromDataPoints(slide)).toBeNull();
  });

  it("should return null for empty data_points", () => {
    const slide: SlideContent = {
      slide_number: 1,
      title: "Test",
      text: "",
      notes: "",
      data_points: [],
      key_message: "",
    };

    expect(extractFromDataPoints(slide)).toBeNull();
  });

  it("should skip non-numeric values", () => {
    const slide: SlideContent = {
      slide_number: 1,
      title: "Test",
      text: "",
      notes: "",
      data_points: [
        { label: "A", value: "100", unit: "" },
        { label: "B", value: "not-a-number", unit: "" },
        { label: "C", value: "200", unit: "" },
      ],
      key_message: "",
    };

    const result = extractFromDataPoints(slide);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// extractFromText
// ═══════════════════════════════════════════════════════

describe("extractFromText", () => {
  it("should extract label: value patterns", () => {
    const text = "• Revenue: 42M\n• Profit: 15M\n• Growth: 25%";
    const result = extractFromText(text);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(2);
  });

  it("should extract dash-separated patterns", () => {
    const text = "Продажи — 150млн\nПрибыль — 45млн\nРост — 30%";
    const result = extractFromText(text);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(2);
  });

  it("should return null for text without numeric data", () => {
    const text = "This is a slide about strategy and vision.\nWe need to focus on growth.";
    const result = extractFromText(text);
    expect(result).toBeNull();
  });

  it("should deduplicate labels", () => {
    const text = "Revenue: 100M\nRevenue: 200M";
    const result = extractFromText(text);
    // Should only have one "Revenue" entry
    if (result) {
      const labels = result.map(p => p.label);
      const unique = new Set(labels);
      expect(unique.size).toBe(labels.length);
    }
  });
});

// ═══════════════════════════════════════════════════════
// detectUnit
// ═══════════════════════════════════════════════════════

describe("detectUnit", () => {
  it("should detect unit from data_points", () => {
    const slide: SlideContent = {
      slide_number: 1, title: "Test", text: "", notes: "",
      data_points: [{ label: "A", value: "100", unit: "%" }],
      key_message: "",
    };
    expect(detectUnit(slide)).toBe("%");
  });

  it("should detect percentage from text", () => {
    const slide: SlideContent = {
      slide_number: 1, title: "Test", text: "Growth rate is 15 percent", notes: "",
      data_points: [],
      key_message: "",
    };
    expect(detectUnit(slide)).toBe("%");
  });

  it("should detect dollar from text", () => {
    const slide: SlideContent = {
      slide_number: 1, title: "Test", text: "Revenue reached $4.2B", notes: "",
      data_points: [],
      key_message: "",
    };
    expect(detectUnit(slide)).toBe("$");
  });

  it("should detect ruble from text", () => {
    const slide: SlideContent = {
      slide_number: 1, title: "Test", text: "Выручка 500 млн руб", notes: "",
      data_points: [],
      key_message: "",
    };
    expect(detectUnit(slide)).toBe("₽");
  });

  it("should return undefined when no unit detected", () => {
    const slide: SlideContent = {
      slide_number: 1, title: "Test", text: "General text", notes: "",
      data_points: [],
      key_message: "",
    };
    expect(detectUnit(slide)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// analyzeSlideForChart
// ═══════════════════════════════════════════════════════

describe("analyzeSlideForChart", () => {
  const makeSlide = (overrides: Partial<SlideContent> = {}): SlideContent => ({
    slide_number: 1,
    title: "Revenue Growth",
    text: "",
    notes: "",
    data_points: [
      { label: "Q1", value: "100", unit: "$M" },
      { label: "Q2", value: "150", unit: "$M" },
      { label: "Q3", value: "200", unit: "$M" },
    ],
    key_message: "Revenue is growing",
    ...overrides,
  });

  it("should detect chart opportunity from data_points", () => {
    const result = analyzeSlideForChart(makeSlide(), "text-slide");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
    expect(result!.source).toBe("data_points");
    expect(result!.data.length).toBe(3);
  });

  it("should skip title-slide layout", () => {
    const result = analyzeSlideForChart(makeSlide(), "title-slide");
    expect(result).toBeNull();
  });

  it("should skip final-slide layout", () => {
    const result = analyzeSlideForChart(makeSlide(), "final-slide");
    expect(result).toBeNull();
  });

  it("should skip section-header layout", () => {
    const result = analyzeSlideForChart(makeSlide(), "section-header");
    expect(result).toBeNull();
  });

  it("should skip quote-slide layout", () => {
    const result = analyzeSlideForChart(makeSlide(), "quote-slide");
    expect(result).toBeNull();
  });

  it("should fall back to text extraction when no data_points", () => {
    const slide = makeSlide({
      data_points: [],
      text: "• Sales: 42M\n• Profit: 15M\n• Growth: 25%",
    });
    const result = analyzeSlideForChart(slide, "text-slide");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("text_extraction");
    expect(result!.confidence).toBe("medium");
  });

  it("should return null for slides without numeric data", () => {
    const slide = makeSlide({
      data_points: [],
      text: "Our strategy focuses on three key areas:\n• Innovation\n• Customer satisfaction\n• Operational excellence",
    });
    const result = analyzeSlideForChart(slide, "text-slide");
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// injectChartIntoSlideData
// ═══════════════════════════════════════════════════════

describe("injectChartIntoSlideData", () => {
  it("should inject SVG chart into slide data", () => {
    const data: Record<string, any> = { title: "Test" };
    const svg = '<svg width="600" height="340"><rect/></svg>';
    
    const result = injectChartIntoSlideData(data, svg, "text-slide");
    expect(result.chartSvg).toBe(svg);
    expect(result.hasChart).toBe(true);
  });

  it("should set usesSvgChart for chart-slide layout", () => {
    const data: Record<string, any> = { title: "Test" };
    const svg = '<svg width="600" height="340"><rect/></svg>';
    
    const result = injectChartIntoSlideData(data, svg, "chart-slide");
    expect(result.usesSvgChart).toBe(true);
  });

  it("should not set usesSvgChart for non-chart layouts", () => {
    const data: Record<string, any> = { title: "Test" };
    const svg = '<svg width="600" height="340"><rect/></svg>';
    
    const result = injectChartIntoSlideData(data, svg, "text-slide");
    expect(result.usesSvgChart).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// SVG Chart Engine — renderChart
// ═══════════════════════════════════════════════════════

describe("SVG Chart Engine — renderChart", () => {
  const sampleData: ChartDataPoint[] = [
    { label: "Q1", value: 100 },
    { label: "Q2", value: 150 },
    { label: "Q3", value: 200 },
    { label: "Q4", value: 180 },
  ];

  describe("Bar Chart", () => {
    it("should render a valid SVG", () => {
      const config: ChartConfig = { type: "bar", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("</svg>");
      expect(result.chartType).toBe("bar");
    });

    it("should include data values when showValues is true", () => {
      const config: ChartConfig = { type: "bar", data: sampleData, showValues: true };
      const result = renderChart(config);
      expect(result.svg).toContain("100");
      expect(result.svg).toContain("200");
    });

    it("should include grid lines when showGrid is true", () => {
      const config: ChartConfig = { type: "bar", data: sampleData, showGrid: true };
      const result = renderChart(config);
      // Grid lines are rendered as <line> elements
      expect(result.svg).toContain("<line");
    });

    it("should respect custom dimensions in viewBox", () => {
      const config: ChartConfig = { type: "bar", data: sampleData, width: 800, height: 400 };
      const result = renderChart(config);
      expect(result.svg).toContain('viewBox="0 0 800 400"');
    });
  });

  describe("Horizontal Bar Chart", () => {
    it("should render a valid SVG", () => {
      const config: ChartConfig = { type: "horizontal-bar", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
      expect(result.chartType).toBe("horizontal-bar");
    });

    it("should include labels", () => {
      const config: ChartConfig = { type: "horizontal-bar", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("Q1");
      expect(result.svg).toContain("Q4");
    });
  });

  describe("Line Chart", () => {
    it("should render a valid SVG with polyline or path", () => {
      const config: ChartConfig = { type: "line", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
      expect(result.chartType).toBe("line");
      // Should have a line path or polyline
      const hasPath = result.svg.includes("<path") || result.svg.includes("<polyline");
      expect(hasPath).toBe(true);
    });

    it("should include data point circles", () => {
      const config: ChartConfig = { type: "line", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<circle");
    });
  });

  describe("Pie Chart", () => {
    it("should render a valid SVG", () => {
      const config: ChartConfig = { type: "pie", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
      expect(result.chartType).toBe("pie");
    });

    it("should include arc paths", () => {
      const config: ChartConfig = { type: "pie", data: sampleData };
      const result = renderChart(config);
      // Pie charts use <path> elements for arcs
      expect(result.svg).toContain("<path");
    });

    it("should include legend when showLegend is true", () => {
      const config: ChartConfig = { type: "pie", data: sampleData, showLegend: true };
      const result = renderChart(config);
      expect(result.svg).toContain("Q1");
      expect(result.svg).toContain("Q4");
    });
  });

  describe("Donut Chart", () => {
    it("should render a valid SVG", () => {
      const config: ChartConfig = { type: "donut", data: sampleData };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
      expect(result.chartType).toBe("donut");
    });

    it("should include center label when provided", () => {
      const config: ChartConfig = {
        type: "donut",
        data: sampleData,
        centerLabel: "Total",
        centerValue: "630",
      };
      const result = renderChart(config);
      expect(result.svg).toContain("Total");
      expect(result.svg).toContain("630");
    });
  });

  describe("Edge cases", () => {
    it("should handle single data point gracefully", () => {
      const config: ChartConfig = { type: "bar", data: [{ label: "Only", value: 42 }] };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
    });

    it("should handle zero values", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 0 },
        { label: "B", value: 100 },
        { label: "C", value: 0 },
      ];
      const config: ChartConfig = { type: "bar", data };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
    });

    it("should handle all-zero values", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ];
      const config: ChartConfig = { type: "bar", data };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
    });

    it("should handle negative values in bar chart", () => {
      const data: ChartDataPoint[] = [
        { label: "A", value: -20 },
        { label: "B", value: 50 },
        { label: "C", value: -10 },
      ];
      const config: ChartConfig = { type: "bar", data };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
    });

    it("should handle large number of data points", () => {
      const data: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        label: `Item ${i}`,
        value: Math.random() * 100,
      }));
      const config: ChartConfig = { type: "bar", data };
      const result = renderChart(config);
      expect(result.svg).toContain("<svg");
    });
  });
});

// ═══════════════════════════════════════════════════════
// recommendChartType
// ═══════════════════════════════════════════════════════

describe("recommendChartType", () => {
  it("should recommend pie for percentage data summing to ~100", () => {
    const data: ChartDataPoint[] = [
      { label: "Segment A", value: 40 },
      { label: "Segment B", value: 35 },
      { label: "Segment C", value: 25 },
    ];
    const result = recommendChartType(data, "Market share distribution");
    expect(["pie", "donut"]).toContain(result);
  });

  it("should recommend line for time series data", () => {
    const data: ChartDataPoint[] = [
      { label: "2020", value: 100 },
      { label: "2021", value: 150 },
      { label: "2022", value: 200 },
      { label: "2023", value: 250 },
    ];
    const result = recommendChartType(data, "Revenue growth over years");
    expect(result).toBe("line");
  });

  it("should recommend bar for comparison data", () => {
    const data: ChartDataPoint[] = [
      { label: "Product A", value: 500 },
      { label: "Product B", value: 300 },
      { label: "Product C", value: 700 },
    ];
    const result = recommendChartType(data, "Product comparison");
    expect(["bar", "horizontal-bar"]).toContain(result);
  });

  it("should recommend horizontal-bar for many items", () => {
    const data: ChartDataPoint[] = Array.from({ length: 8 }, (_, i) => ({
      label: `Category ${i + 1}`,
      value: (i + 1) * 10,
    }));
    const result = recommendChartType(data, "Category ranking");
    expect(result).toBe("horizontal-bar");
  });
});

// ═══════════════════════════════════════════════════════
// Template integration — chart-slide with SVG
// ═══════════════════════════════════════════════════════

describe("Chart-slide SVG template integration", () => {
  it("should render chartSvg in chart-slide template", async () => {
    const { renderSlide } = await import("./templateEngine");
    
    const svgContent = '<svg width="600" height="340"><rect x="0" y="0" width="100" height="100" fill="blue"/></svg>';
    const data = {
      title: "Revenue Chart",
      description: "Quarterly revenue",
      chartSvg: svgContent,
    };

    const html = renderSlide("chart-slide", data);
    expect(html).toContain(svgContent);
    expect(html).toContain("Revenue Chart");
  });

  it("should fall back to canvas when no chartSvg", async () => {
    const { renderSlide } = await import("./templateEngine");
    
    const data = {
      title: "Revenue Chart",
      description: "Quarterly revenue",
    };

    const html = renderSlide("chart-slide", data);
    expect(html).toContain("<canvas");
    expect(html).not.toContain("chartSvg");
  });
});
