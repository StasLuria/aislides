/**
 * Tests for Round 6:
 * - New template buildFallbackData (vertical-timeline, comparison-table, quote-highlight)
 * - QA validation for new layouts
 * - Auto-fix logic for new layouts
 * - Checklist and SWOT validation
 */
import { describe, it, expect } from "vitest";
import { validateSlideData, autoFixSlideData } from "./qaAgent";

// ═══════════════════════════════════════════════════════
// VALIDATION TESTS — New Templates
// ═══════════════════════════════════════════════════════

describe("validateSlideData — vertical-timeline", () => {
  it("passes with valid events", () => {
    const data = {
      title: "История компании",
      events: [
        { date: "2020", title: "Основание", description: "Запуск" },
        { date: "2021", title: "Seed", description: "$3M" },
        { date: "2023", title: "Series A", description: "$25M" },
      ],
    };
    const result = validateSlideData(data, "vertical-timeline");
    expect(result.passed).toBe(true);
  });

  it("fails with fewer than 3 events", () => {
    const data = {
      title: "Timeline",
      events: [
        { date: "2020", title: "Start", description: "Begin" },
        { date: "2021", title: "Growth", description: "Grow" },
      ],
    };
    const result = validateSlideData(data, "vertical-timeline");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "events")).toBe(true);
  });

  it("fails when events is missing", () => {
    const data = { title: "Timeline" };
    const result = validateSlideData(data, "vertical-timeline");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "events")).toBe(true);
  });

  it("reports error for string icon in event", () => {
    const data = {
      title: "Timeline",
      events: [
        { date: "2020", title: "A", description: "a", icon: "rocket" },
        { date: "2021", title: "B", description: "b" },
        { date: "2022", title: "C", description: "c" },
      ],
    };
    const result = validateSlideData(data, "vertical-timeline");
    expect(result.issues.some((i) => i.field === "events[0].icon")).toBe(true);
  });
});

describe("validateSlideData — comparison-table", () => {
  it("passes with valid columns and features", () => {
    const data = {
      title: "Сравнение",
      columns: [{ name: "A" }, { name: "B" }],
      features: [
        { name: "Цена", values: ["$100", "$200"] },
        { name: "Скорость", values: ["Быстро", "Медленно"] },
      ],
    };
    const result = validateSlideData(data, "comparison-table");
    expect(result.passed).toBe(true);
  });

  it("fails when values length doesn't match columns", () => {
    const data = {
      title: "Сравнение",
      columns: [{ name: "A" }, { name: "B" }, { name: "C" }],
      features: [
        { name: "Цена", values: ["$100", "$200"] }, // 2 values, 3 columns
      ],
    };
    const result = validateSlideData(data, "comparison-table");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field.includes("values"))).toBe(true);
  });

  it("fails with fewer than 2 features", () => {
    const data = {
      title: "Сравнение",
      columns: [{ name: "A" }, { name: "B" }],
      features: [{ name: "Цена", values: ["$100", "$200"] }],
    };
    const result = validateSlideData(data, "comparison-table");
    expect(result.passed).toBe(false);
  });
});

describe("validateSlideData — quote-highlight", () => {
  it("passes with valid quote and author", () => {
    const data = {
      title: "Цитата",
      quote: "AI — это новое электричество",
      author: "Эндрю Нг",
    };
    const result = validateSlideData(data, "quote-highlight");
    expect(result.passed).toBe(true);
  });

  it("fails when author is missing", () => {
    const data = {
      title: "Цитата",
      quote: "AI — это новое электричество",
    };
    const result = validateSlideData(data, "quote-highlight");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "author")).toBe(true);
  });

  it("warns for very long quotes", () => {
    const data = {
      title: "Цитата",
      quote: "A".repeat(501),
      author: "Author",
    };
    const result = validateSlideData(data, "quote-highlight");
    // Should pass (warning only) but have a warning
    expect(result.issues.some((i) => i.field === "quote" && i.severity === "warning")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// VALIDATION TESTS — Previously Missing Layouts
// ═══════════════════════════════════════════════════════

describe("validateSlideData — card-grid", () => {
  it("passes with 3+ cards", () => {
    const data = {
      title: "Features",
      cards: [
        { title: "A", description: "a", icon: { name: "shield", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/shield.svg" } },
        { title: "B", description: "b", icon: { name: "zap", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/zap.svg" } },
        { title: "C", description: "c", icon: { name: "globe", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg" } },
      ],
    };
    const result = validateSlideData(data, "card-grid");
    expect(result.passed).toBe(true);
  });

  it("reports error for string icon in card", () => {
    const data = {
      title: "Features",
      cards: [
        { title: "A", description: "a", icon: "shield" },
        { title: "B", description: "b", icon: { name: "zap", url: "..." } },
        { title: "C", description: "c" },
      ],
    };
    const result = validateSlideData(data, "card-grid");
    expect(result.issues.some((i) => i.field === "cards[0].icon")).toBe(true);
  });
});

describe("validateSlideData — verdict-analysis", () => {
  it("fails when verdictColor is not hex", () => {
    const data = {
      title: "Вердикт",
      criteria: [{ label: "A", value: "OK" }],
      verdictTitle: "Рекомендация",
      verdictText: "Одобрено",
      verdictColor: "green",
    };
    const result = validateSlideData(data, "verdict-analysis");
    expect(result.issues.some((i) => i.field === "verdictColor")).toBe(true);
  });
});

describe("validateSlideData — financial-formula", () => {
  it("fails when operator part missing symbol", () => {
    const data = {
      title: "Формула",
      formulaParts: [
        { type: "value", value: "$100", label: "Revenue" },
        { type: "operator" }, // missing symbol
        { type: "value", value: "$50", label: "Costs" },
      ],
    };
    const result = validateSlideData(data, "financial-formula");
    expect(result.issues.some((i) => i.field.includes("symbol"))).toBe(true);
  });
});

describe("validateSlideData — swot-analysis", () => {
  it("fails when any quadrant is missing", () => {
    const data = {
      title: "SWOT",
      strengths: { title: "S", items: ["a"] },
      weaknesses: { title: "W", items: ["b"] },
      // missing opportunities and threats
    };
    const result = validateSlideData(data, "swot-analysis");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "opportunities")).toBe(true);
  });
});

describe("validateSlideData — checklist", () => {
  it("passes with valid items", () => {
    const data = {
      title: "Checklist",
      items: [
        { title: "Task 1", done: true },
        { title: "Task 2", done: false },
      ],
    };
    const result = validateSlideData(data, "checklist");
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// AUTO-FIX TESTS
// ═══════════════════════════════════════════════════════

describe("autoFixSlideData — card-grid icon fix", () => {
  it("converts string icons to objects", () => {
    const data = {
      title: "Features",
      cards: [
        { title: "A", description: "a", icon: "shield" },
        { title: "B", description: "b" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "card-grid");
    expect(wasFixed).toBe(true);
    expect(fixed.cards[0].icon).toEqual({
      name: "shield",
      url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/shield.svg",
    });
    expect(fixed.cards[1].icon).toBeDefined();
    expect(fixed.cards[1].icon.name).toBeTruthy();
    expect(fixed.cards[1].icon.url).toContain("lucide-static");
  });
});

describe("autoFixSlideData — verdict-analysis color fix", () => {
  it("converts color name to hex", () => {
    const data = {
      title: "Verdict",
      verdictColor: "green",
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "verdict-analysis");
    expect(wasFixed).toBe(true);
    expect(fixed.verdictColor).toBe("#16a34a");
  });

  it("converts severity level to hex", () => {
    const data = {
      title: "Verdict",
      verdictColor: "MEDIUM",
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "verdict-analysis");
    expect(wasFixed).toBe(true);
    expect(fixed.verdictColor).toBe("#f59e0b");
  });
});

describe("autoFixSlideData — financial-formula operator fix", () => {
  it("adds symbol from value when missing", () => {
    const data = {
      title: "Formula",
      formulaParts: [
        { type: "value", value: "$100", label: "Revenue" },
        { type: "operator", value: "-" },
        { type: "value", value: "$50", label: "Costs" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "financial-formula");
    expect(wasFixed).toBe(true);
    expect(fixed.formulaParts[1].symbol).toBe("-");
  });
});

describe("autoFixSlideData — vertical-timeline icon fix", () => {
  it("converts string icons to objects in events", () => {
    const data = {
      title: "Timeline",
      events: [
        { date: "2020", title: "Start", description: "Begin", icon: "rocket" },
        { date: "2021", title: "Growth", description: "Grow" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "vertical-timeline");
    expect(wasFixed).toBe(true);
    expect(fixed.events[0].icon).toEqual({
      name: "rocket",
      url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/rocket.svg",
    });
  });
});

describe("autoFixSlideData — comparison-table feature_label fix", () => {
  it("renames feature_label to featureLabel", () => {
    const data = {
      title: "Compare",
      feature_label: "Параметр",
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "comparison-table");
    expect(wasFixed).toBe(true);
    expect(fixed.featureLabel).toBe("Параметр");
    expect(fixed.feature_label).toBeUndefined();
  });
});

describe("autoFixSlideData — checklist status colors", () => {
  it("adds status colors based on done flag", () => {
    const data = {
      title: "Checklist",
      items: [
        { title: "Task 1", done: true },
        { title: "Task 2", done: false },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "checklist");
    expect(wasFixed).toBe(true);
    expect(fixed.items[0].status).toBe("Готово");
    expect(fixed.items[0].statusColor).toBe("#dcfce7");
    expect(fixed.items[0].statusTextColor).toBe("#166534");
    expect(fixed.items[1].status).toBe("В процессе");
    expect(fixed.items[1].statusColor).toBe("#fef9c3");
    expect(fixed.items[1].statusTextColor).toBe("#854d0e");
  });
});
