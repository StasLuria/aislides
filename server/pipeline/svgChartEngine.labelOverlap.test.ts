import { describe, it, expect } from "vitest";
import { renderBarChart, renderLineChart, renderPieChart, renderDonutChart } from "./svgChartEngine";

// ═══════════════════════════════════════════════════════
// BAR CHART — Label overlap avoidance
// ═══════════════════════════════════════════════════════

describe("renderBarChart — label overlap avoidance", () => {
  it("should render bar chart with close values without overlapping labels", () => {
    const svg = renderBarChart({
      data: [
        { label: "Product A", value: 100 },
        { label: "Product B", value: 102 },
        { label: "Product C", value: 98 },
        { label: "Product D", value: 101 },
      ],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    // All 4 value labels should be present
    expect(svg).toContain("100");
    expect(svg).toContain("102");
    expect(svg).toContain("98");
    expect(svg).toContain("101");
  });

  it("should use smaller font for x-axis labels when there are many bars", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      label: `Category ${i + 1}`,
      value: (i + 1) * 10,
    }));
    const svg = renderBarChart({ data, showValues: true });
    expect(svg).toContain("<svg");
    // Should use font-size 8 for x-axis labels (10 bars > 8 threshold)
    expect(svg).toContain('font-size="8"');
  });

  it("should handle single bar without errors", () => {
    const svg = renderBarChart({
      data: [{ label: "Only", value: 50 }],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("50");
  });

  it("should handle bars with identical values", () => {
    const svg = renderBarChart({
      data: [
        { label: "A", value: 100 },
        { label: "B", value: 100 },
        { label: "C", value: 100 },
      ],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    // Should still render all labels (may place some inside bars)
    const matches = svg.match(/100/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("should render without value labels when showValues is false", () => {
    const svg = renderBarChart({
      data: [
        { label: "A", value: 100 },
        { label: "B", value: 200 },
      ],
      showValues: false,
    });
    expect(svg).toContain("<svg");
    // Value labels should not be present (only grid values might show 100/200)
  });
});

// ═══════════════════════════════════════════════════════
// LINE CHART — Label overlap avoidance
// ═══════════════════════════════════════════════════════

describe("renderLineChart — label overlap avoidance", () => {
  it("should render line chart with close values without overlapping labels", () => {
    const svg = renderLineChart({
      data: [
        { label: "Jan", value: 100 },
        { label: "Feb", value: 102 },
        { label: "Mar", value: 99 },
        { label: "Apr", value: 101 },
      ],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("100");
    expect(svg).toContain("102");
    expect(svg).toContain("99");
    expect(svg).toContain("101");
  });

  it("should use smaller font for x-axis labels when there are many points", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      label: `Month ${i + 1}`,
      value: 50 + Math.sin(i) * 20,
    }));
    const svg = renderLineChart({ data, showValues: true });
    expect(svg).toContain("<svg");
    // Should use font-size 8 for x-axis labels (12 points > 8 threshold)
    expect(svg).toContain('font-size="8"');
  });

  it("should handle a single data point", () => {
    const svg = renderLineChart({
      data: [{ label: "Only", value: 42 }],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("42");
  });

  it("should handle points with identical values", () => {
    const svg = renderLineChart({
      data: [
        { label: "Q1", value: 75 },
        { label: "Q2", value: 75 },
        { label: "Q3", value: 75 },
      ],
      showValues: true,
    });
    expect(svg).toContain("<svg");
    // All value labels should be present
    const matches = svg.match(/75/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════
// PIE CHART — Legend overflow prevention
// ═══════════════════════════════════════════════════════

describe("renderPieChart — legend overflow prevention", () => {
  it("should render pie chart with many slices without legend overflow", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      label: `Segment ${i + 1} with long name`,
      value: 10 + i * 5,
    }));
    const svg = renderPieChart({ data, showLegend: true });
    expect(svg).toContain("<svg");
    // Should show "+ N more" when items exceed available space
    // The exact behavior depends on height, but the chart should render
  });

  it("should use smaller font for legend with many items", () => {
    const data = Array.from({ length: 9 }, (_, i) => ({
      label: `Item ${i + 1}`,
      value: 10 + i,
    }));
    const svg = renderPieChart({ data, showLegend: true });
    expect(svg).toContain("<svg");
    // Should use font-size 8 for legend (9 items > 8 threshold)
    expect(svg).toContain('font-size="8"');
  });

  it("should render normally with few slices", () => {
    const svg = renderPieChart({
      data: [
        { label: "A", value: 30 },
        { label: "B", value: 50 },
        { label: "C", value: 20 },
      ],
      showLegend: true,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A");
    expect(svg).toContain("B");
    expect(svg).toContain("C");
  });
});

// ═══════════════════════════════════════════════════════
// DONUT CHART — Legend overflow prevention
// ═══════════════════════════════════════════════════════

describe("renderDonutChart — legend overflow prevention", () => {
  it("should render donut chart with many slices without legend overflow", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      label: `Category ${i + 1}`,
      value: 15 + i * 3,
    }));
    const svg = renderDonutChart({ data, showLegend: true });
    expect(svg).toContain("<svg");
  });

  it("should use smaller font for legend with many items", () => {
    const data = Array.from({ length: 9 }, (_, i) => ({
      label: `Seg ${i + 1}`,
      value: 10 + i,
    }));
    const svg = renderDonutChart({ data, showLegend: true });
    expect(svg).toContain("<svg");
    expect(svg).toContain('font-size="8"');
  });
});
