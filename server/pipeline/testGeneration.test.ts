/**
 * Integration test: Verify buildFallbackData produces valid data for all new templates.
 * Tests that the fallback path (which mirrors what the Composer should produce)
 * generates data that passes QA validation.
 */
import { describe, it, expect } from "vitest";
import { validateSlideData, autoFixSlideData } from "./qaAgent";
import { buildFallbackData } from "./generator";
import type { SlideContent } from "./types";

// Helper to create a minimal SlideContent
function makeSlide(overrides: Partial<SlideContent> = {}): SlideContent {
  return {
    slide_number: 1,
    title: "Test Slide",
    text: "Some test content with multiple points about technology and innovation.",
    notes: "Speaker notes here",
    key_message: "Key takeaway",
    slide_category: "CONTENT",
    content_shape: "bullet_points",
    structured_content: undefined,
    ...overrides,
  } as SlideContent;
}

describe("buildFallbackData → validateSlideData integration", () => {
  // Test that fallback data for each new template passes QA validation

  it("vertical-timeline fallback passes validation", () => {
    const slide = makeSlide({
      content_shape: "timeline_events",
      structured_content: {
        events: [
          { date: "2020", title: "Основание", description: "Запуск компании" },
          { date: "2021", title: "Seed-раунд", description: "Привлечение $3M", icon_hint: "dollar-sign" },
          { date: "2023", title: "Series A", description: "Раунд $25M", icon_hint: "trending-up" },
          { date: "2025", title: "Enterprise", description: "150+ клиентов", icon_hint: "rocket" },
        ],
      },
    });

    const data = buildFallbackData(slide, "vertical-timeline");
    
    // Auto-fix should handle any remaining issues
    const { data: fixedData } = autoFixSlideData(data, "vertical-timeline");
    const result = validateSlideData(fixedData, "vertical-timeline");

    expect(result.passed).toBe(true);
    expect(fixedData.events.length).toBeGreaterThanOrEqual(3);
    // Check icon objects are properly formed
    if (fixedData.events[1]?.icon) {
      expect(fixedData.events[1].icon).toHaveProperty("name");
      expect(fixedData.events[1].icon).toHaveProperty("url");
    }
  });

  it("comparison-table fallback passes validation", () => {
    const slide = makeSlide({
      content_shape: "comparison_two_sides",
      structured_content: {
        columns: [
          { name: "On-premise", highlight: false },
          { name: "Облако", highlight: true },
        ],
        features: [
          { name: "Стоимость", values: ["$500K+", "$0"] },
          { name: "Скорость", values: ["3-6 мес", "2 дня"] },
          { name: "Масштаб", values: ["Ручное", "Авто"] },
        ],
        feature_label: "Параметр",
      },
    });

    const data = buildFallbackData(slide, "comparison-table");
    const { data: fixedData } = autoFixSlideData(data, "comparison-table");
    const result = validateSlideData(fixedData, "comparison-table");

    expect(result.passed).toBe(true);
    expect(fixedData.columns.length).toBe(2);
    expect(fixedData.features.length).toBeGreaterThanOrEqual(2);
    // Check values match columns count
    for (const feature of fixedData.features) {
      expect(feature.values.length).toBe(fixedData.columns.length);
    }
  });

  it("quote-highlight fallback passes validation", () => {
    const slide = makeSlide({
      content_shape: "quote_highlight",
      structured_content: {
        text: "AI — это новое электричество",
        attribution: "Эндрю Нг",
        context: "CEO Landing AI",
        source: "Stanford Conference",
      },
    });

    const data = buildFallbackData(slide, "quote-highlight");
    const { data: fixedData } = autoFixSlideData(data, "quote-highlight");
    const result = validateSlideData(fixedData, "quote-highlight");

    expect(result.passed).toBe(true);
    expect(fixedData.quote).toBe("AI — это новое электричество");
    expect(fixedData.author).toBe("Эндрю Нг");
  });

  it("card-grid fallback passes validation after auto-fix", () => {
    const slide = makeSlide({
      content_shape: "card_grid",
      structured_content: {
        cards: [
          { title: "Безопасность", description: "Шифрование данных", icon_hint: "shield" },
          { title: "Скорость", description: "Быстрая обработка", icon_hint: "zap" },
          { title: "Масштаб", description: "Горизонтальное масштабирование", icon_hint: "globe" },
        ],
      },
    });

    const data = buildFallbackData(slide, "card-grid");
    const { data: fixedData } = autoFixSlideData(data, "card-grid");
    const result = validateSlideData(fixedData, "card-grid");

    expect(result.passed).toBe(true);
    expect(fixedData.cards.length).toBeGreaterThanOrEqual(3);
  });

  it("financial-formula fallback passes validation after auto-fix", () => {
    const slide = makeSlide({
      content_shape: "financial_formula",
      structured_content: {
        parts: [
          { type: "value", value: "$10M", label: "Выручка" },
          { type: "operator", operator: "-" },
          { type: "value", value: "$6M", label: "Расходы" },
          { type: "equals" },
          { type: "value", value: "$4M", label: "Прибыль" },
        ],
      },
    });

    const data = buildFallbackData(slide, "financial-formula");
    const { data: fixedData } = autoFixSlideData(data, "financial-formula");
    const result = validateSlideData(fixedData, "financial-formula");

    expect(result.passed).toBe(true);
    // Check operator parts have symbol
    const operators = fixedData.formulaParts.filter((p: any) => p.type === "operator");
    for (const op of operators) {
      expect(op.symbol).toBeTruthy();
    }
  });

  it("verdict-analysis fallback passes validation after auto-fix", () => {
    const slide = makeSlide({
      content_shape: "analysis_with_verdict",
      structured_content: {
        items: [
          { label: "ROI", value: "340%", severity: "positive" },
          { label: "Срок окупаемости", value: "8 мес", severity: "positive" },
          { label: "Риск", value: "Средний", severity: "neutral" },
        ],
        verdict: "Рекомендуется к внедрению",
        verdict_detail: "Проект показывает высокую рентабельность",
      },
    });

    const data = buildFallbackData(slide, "verdict-analysis");
    const { data: fixedData } = autoFixSlideData(data, "verdict-analysis");
    const result = validateSlideData(fixedData, "verdict-analysis");

    expect(result.passed).toBe(true);
    // Check verdictColor is hex
    if (fixedData.verdictColor) {
      expect(fixedData.verdictColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("checklist fallback passes validation after auto-fix", () => {
    const slide = makeSlide({
      content_shape: "checklist_items",
      structured_content: {
        items: [
          { title: "SSL", description: "HTTPS enabled", done: true },
          { title: "2FA", description: "Required for all", done: true },
          { title: "SOC2", description: "Planned Q3", done: false },
        ],
      },
    });

    const data = buildFallbackData(slide, "checklist");
    const { data: fixedData } = autoFixSlideData(data, "checklist");
    const result = validateSlideData(fixedData, "checklist");

    expect(result.passed).toBe(true);
    // Check status colors are set
    for (const item of fixedData.items) {
      expect(item.statusColor).toBeTruthy();
      expect(item.statusTextColor).toBeTruthy();
    }
  });

  it("swot-analysis fallback passes validation", () => {
    const slide = makeSlide({
      content_shape: "swot_quadrants",
      structured_content: {
        strengths: { title: "Сильные стороны", items: ["Технология", "Команда"] },
        weaknesses: { title: "Слабые стороны", items: ["Бюджет"] },
        opportunities: { title: "Возможности", items: ["Рынок AI"] },
        threats: { title: "Угрозы", items: ["Конкуренция"] },
      },
    });

    const data = buildFallbackData(slide, "swot-analysis");
    const result = validateSlideData(data, "swot-analysis");

    expect(result.passed).toBe(true);
    expect(data.strengths).toBeDefined();
    expect(data.weaknesses).toBeDefined();
    expect(data.opportunities).toBeDefined();
    expect(data.threats).toBeDefined();
  });

  // Test that text-only fallback (no structured_content) still produces valid data
  it("vertical-timeline text-only fallback passes validation", () => {
    const slide = makeSlide({
      text: "2020 — Основание компании. 2021 — Seed-раунд $3M. 2023 — Series A $25M. 2025 — IPO.",
    });

    const data = buildFallbackData(slide, "vertical-timeline");
    const { data: fixedData } = autoFixSlideData(data, "vertical-timeline");
    const result = validateSlideData(fixedData, "vertical-timeline");

    expect(result.passed).toBe(true);
    expect(fixedData.events.length).toBeGreaterThanOrEqual(3);
  });

  it("comparison-table text-only fallback passes validation", () => {
    const slide = makeSlide({
      text: "Вариант A: дорого, медленно, надёжно. Вариант B: дёшево, быстро, рискованно.",
    });

    const data = buildFallbackData(slide, "comparison-table");
    const { data: fixedData } = autoFixSlideData(data, "comparison-table");
    const result = validateSlideData(fixedData, "comparison-table");

    expect(result.passed).toBe(true);
    expect(fixedData.columns.length).toBeGreaterThanOrEqual(2);
    expect(fixedData.features.length).toBeGreaterThanOrEqual(2);
  });

  it("quote-highlight text-only fallback passes validation", () => {
    const slide = makeSlide({
      text: "\"AI — это новое электричество\" — Эндрю Нг",
    });

    const data = buildFallbackData(slide, "quote-highlight");
    const { data: fixedData } = autoFixSlideData(data, "quote-highlight");
    const result = validateSlideData(fixedData, "quote-highlight");

    expect(result.passed).toBe(true);
    expect(fixedData.quote).toBeTruthy();
    expect(fixedData.author).toBeTruthy();
  });
});
