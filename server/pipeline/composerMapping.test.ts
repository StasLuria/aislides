/**
 * Tests for buildFallbackData mapping from structured_content to template data.
 * Verifies that all content_shape → layout combinations produce correct output.
 */
import { describe, it, expect } from "vitest";
import { buildFallbackData } from "./generator";
import type { SlideContent } from "../../shared/types";

function makeSlide(overrides: Partial<SlideContent>): SlideContent {
  return {
    slide_number: 1,
    title: "Test Slide",
    text: "Test text",
    notes: "",
    key_message: "",
    data_points: [],
    visual_suggestions: [],
    content_shape: "bullet_points",
    slide_category: "CONTENT",
    structured_content: undefined,
    ...overrides,
  };
}

describe("buildFallbackData: structured_content mapping", () => {
  describe("card-grid layout", () => {
    it("maps card_grid structured_content with icon_hint", () => {
      const slide = makeSlide({
        structured_content: {
          cards: [
            { icon_hint: "shield", title: "Security", text: "AES-256 encryption", badge: "CRITICAL" },
            { icon_hint: "zap", title: "Speed", text: "Under 100ms", badge: "HIGH" },
          ],
        },
      });
      const data = buildFallbackData(slide, "card-grid");
      expect(data.cards).toHaveLength(2);
      expect(data.cards[0].icon.name).toBe("shield");
      expect(data.cards[0].icon.url).toContain("shield.svg");
      expect(data.cards[0].description).toBe("AES-256 encryption");
      expect(data.cards[0].badge).toBe("CRITICAL");
      expect(data.cards[1].icon.name).toBe("zap");
    });

    it("falls back to default icons when no icon_hint", () => {
      const slide = makeSlide({
        structured_content: {
          cards: [
            { title: "Feature A", text: "Description A" },
          ],
        },
      });
      const data = buildFallbackData(slide, "card-grid");
      expect(data.cards[0].icon.name).toBe("layers"); // first default icon
    });
  });

  describe("financial-formula layout", () => {
    it("maps Writer's parts format with operator field", () => {
      const slide = makeSlide({
        structured_content: {
          parts: [
            { label: "REVENUE", value: "500₽", operator: "-" },
            { label: "COSTS", value: "200₽" },
            { label: "MARGIN", value: "60%", operator: "=" },
          ],
          bottom_line: "Positive unit economics",
        },
      });
      const data = buildFallbackData(slide, "financial-formula");
      expect(data.formulaParts).toBeDefined();
      expect(data.formulaParts.length).toBeGreaterThan(3);
      // Check that operators use symbol field
      const operators = data.formulaParts.filter((p: any) => p.type === "operator");
      expect(operators.length).toBeGreaterThan(0);
      operators.forEach((op: any) => {
        expect(op.symbol).toBeDefined();
      });
      // Check footnote
      expect(data.footnote).toBe("Positive unit economics");
      // Last value part should be highlighted
      const valueParts = data.formulaParts.filter((p: any) => p.type === "value");
      const lastValue = valueParts[valueParts.length - 1];
      expect(lastValue.highlight).toBe(true);
    });

    it("maps formula_parts format with type field", () => {
      const slide = makeSlide({
        structured_content: {
          formula_parts: [
            { type: "value", value: "A", label: "Revenue" },
            { type: "operator", symbol: "+" },
            { type: "value", value: "B", label: "Growth" },
            { type: "equals" },
            { type: "value", value: "C", label: "Total", highlight: true },
          ],
        },
      });
      const data = buildFallbackData(slide, "financial-formula");
      expect(data.formulaParts).toHaveLength(5);
      expect(data.formulaParts[1].symbol).toBe("+");
      expect(data.formulaParts[3].type).toBe("equals");
    });

    it("falls back to generic formula when no structured_content", () => {
      const slide = makeSlide({ text: "A: Revenue\nB: Costs\nC: Profit" });
      const data = buildFallbackData(slide, "financial-formula");
      expect(data.formulaParts).toBeDefined();
      expect(data.formulaParts.length).toBe(5);
      expect(data.formulaParts[1].symbol).toBe("+");
    });
  });

  describe("verdict-analysis layout", () => {
    it("maps analysis_with_verdict items to criteria", () => {
      const slide = makeSlide({
        structured_content: {
          items: [
            { title: "Technical Maturity", description: "Stable API", severity: "LOW" },
            { title: "Cost", description: "Above market", severity: "MEDIUM" },
          ],
          verdict_title: "RECOMMENDATION",
          verdict_text: "Ready for deployment",
          indicators: [{ label: "RISK", value: "MEDIUM" }],
        },
      });
      const data = buildFallbackData(slide, "verdict-analysis");
      expect(data.criteria).toHaveLength(2);
      expect(data.criteria[0].label).toBe("Technical Maturity");
      expect(data.criteria[0].value).toBe("LOW");
      expect(data.criteria[0].detail).toBe("Stable API");
      expect(data.verdictTitle).toBe("RECOMMENDATION");
      expect(data.verdictText).toBe("Ready for deployment");
      // Indicators mapped to verdictDetails
      expect(data.verdictDetails).toEqual(["RISK: MEDIUM"]);
    });

    it("maps severity name to hex color", () => {
      const slide = makeSlide({
        structured_content: {
          items: [{ title: "Test", severity: "HIGH" }],
          verdict_title: "Alert",
          verdict_text: "High risk",
          verdict_color: "HIGH",
        },
      });
      const data = buildFallbackData(slide, "verdict-analysis");
      expect(data.verdictColor).toBe("#dc2626");
    });

    it("passes through hex colors directly", () => {
      const slide = makeSlide({
        structured_content: {
          items: [{ title: "Test", severity: "LOW" }],
          verdict_title: "OK",
          verdict_text: "All good",
          verdictColor: "#22c55e",
        },
      });
      const data = buildFallbackData(slide, "verdict-analysis");
      expect(data.verdictColor).toBe("#22c55e");
    });
  });

  describe("big-statement layout", () => {
    it("maps structured_content fields", () => {
      const slide = makeSlide({
        key_message: "AI transforms business",
        structured_content: {
          bigNumber: "73%",
          label: "KEY METRIC",
          subtitle: "Companies with AI saw 73% growth",
          source: "McKinsey 2025",
        },
      });
      const data = buildFallbackData(slide, "big-statement");
      expect(data.bigNumber).toBe("73%");
      expect(data.label).toBe("KEY METRIC");
      expect(data.subtitle).toBe("Companies with AI saw 73% growth");
      expect(data.source).toBe("McKinsey 2025");
    });

    it("falls back to key_message for subtitle", () => {
      const slide = makeSlide({
        key_message: "Fallback message",
        structured_content: {},
      });
      const data = buildFallbackData(slide, "big-statement");
      expect(data.subtitle).toBe("Fallback message");
    });
  });
});
