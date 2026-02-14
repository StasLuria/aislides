/**
 * Round 7 Tests — kanban-board template, LLM content validation, Layout Agent improvements
 */
import { describe, it, expect } from "vitest";
import { validateSlideData, autoFixSlideData, validateCriticalSlideContent, isCriticalLayout } from "./qaAgent";
import { buildFallbackData } from "./generator";
import type { SlideContent } from "./types";

// ═══════════════════════════════════════════════════════
// KANBAN-BOARD VALIDATION
// ═══════════════════════════════════════════════════════

describe("validateSlideData — kanban-board", () => {
  it("passes with valid 3-column board", () => {
    const data = {
      title: "Статус проекта",
      columns: [
        { title: "Бэклог", color: "#f59e0b", cards: [{ title: "Задача 1", priority: "high" }] },
        { title: "В работе", color: "#3b82f6", cards: [{ title: "Задача 2", priority: "medium" }] },
        { title: "Готово", color: "#22c55e", cards: [{ title: "Задача 3", priority: "low" }] },
      ],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.passed).toBe(true);
  });

  it("fails with missing columns", () => {
    const data = { title: "Статус проекта" };
    const result = validateSlideData(data, "kanban-board");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "columns")).toBe(true);
  });

  it("fails with only 1 column", () => {
    const data = {
      title: "Статус",
      columns: [{ title: "Единственная", cards: [] }],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "columns" && i.message.includes("at least 2"))).toBe(true);
  });

  it("warns on more than 5 columns", () => {
    const data = {
      title: "Статус",
      columns: Array.from({ length: 6 }, (_, i) => ({
        title: `Col ${i + 1}`,
        cards: [{ title: `Card ${i}` }],
      })),
    };
    const result = validateSlideData(data, "kanban-board");
    // Should pass (warning, not error) but have a warning
    expect(result.issues.some((i) => i.severity === "warning" && i.message.includes("overflow"))).toBe(true);
  });

  it("warns on more than 4 cards per column", () => {
    const data = {
      title: "Статус",
      columns: [
        {
          title: "Бэклог",
          cards: Array.from({ length: 5 }, (_, i) => ({ title: `Card ${i + 1}` })),
        },
        { title: "Готово", cards: [{ title: "Done" }] },
      ],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.issues.some((i) => i.severity === "warning" && i.message.includes("Max 4"))).toBe(true);
  });

  it("fails on empty column title", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "", cards: [{ title: "Card" }] },
        { title: "Done", cards: [] },
      ],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field.includes("title") && i.severity === "error")).toBe(true);
  });

  it("fails on empty card title", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог", cards: [{ title: "" }] },
        { title: "Done", cards: [] },
      ],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field.includes("cards") && i.message.includes("empty title"))).toBe(true);
  });

  it("warns on non-standard priority", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог", cards: [{ title: "Card", priority: "urgent" }] },
        { title: "Done", cards: [] },
      ],
    };
    const result = validateSlideData(data, "kanban-board");
    expect(result.issues.some((i) => i.severity === "warning" && i.message.includes("priority"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// KANBAN-BOARD AUTO-FIX
// ═══════════════════════════════════════════════════════

describe("autoFixSlideData — kanban-board", () => {
  it("normalizes Russian priority names", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог", cards: [{ title: "Card", priority: "важный" }] },
        { title: "Done", cards: [{ title: "Card2", priority: "низкий" }] },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "kanban-board");
    expect(wasFixed).toBe(true);
    expect(fixed.columns[0].cards[0].priority).toBe("high");
    expect(fixed.columns[1].cards[0].priority).toBe("low");
  });

  it("normalizes urgent/critical to high", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог", cards: [{ title: "Card", priority: "urgent" }, { title: "Card2", priority: "critical" }] },
        { title: "Done", cards: [] },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "kanban-board");
    expect(wasFixed).toBe(true);
    expect(fixed.columns[0].cards[0].priority).toBe("high");
    expect(fixed.columns[0].cards[1].priority).toBe("high");
  });

  it("adds missing tags, assignee, description fields", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог", cards: [{ title: "Card" }] },
        { title: "Done", cards: [] },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "kanban-board");
    expect(wasFixed).toBe(true);
    expect(fixed.columns[0].cards[0].tags).toEqual([]);
    expect(fixed.columns[0].cards[0].assignee).toBe("");
    expect(fixed.columns[0].cards[0].description).toBe("");
  });

  it("adds empty cards array to columns without cards", () => {
    const data = {
      title: "Статус",
      columns: [
        { title: "Бэклог" },
        { title: "Done" },
      ],
    };
    const { data: fixed } = autoFixSlideData(data, "kanban-board");
    expect(fixed.columns[0].cards).toEqual([]);
    expect(fixed.columns[1].cards).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════
// KANBAN-BOARD FALLBACK DATA
// ═══════════════════════════════════════════════════════

describe("buildFallbackData — kanban-board", () => {
  it("generates valid kanban-board from structured_content", () => {
    const slide: SlideContent = {
      slide_number: 5,
      title: "Статус проекта",
      text: "Текущий статус задач",
      notes: "",
      key_message: "",
      content_shape: "card_grid",
      slide_category: "body",
      structured_content: {
        columns: [
          { title: "Бэклог", color: "#f59e0b", cards: [{ title: "Исследование", priority: "high" }] },
          { title: "В работе", color: "#3b82f6", cards: [{ title: "Дизайн", priority: "medium" }] },
          { title: "Готово", color: "#22c55e", cards: [{ title: "Бриф", priority: "low" }] },
        ],
      },
    };
    const data = buildFallbackData(slide, "kanban-board");
    const { data: fixedData } = autoFixSlideData(data, "kanban-board");
    const result = validateSlideData(fixedData, "kanban-board");
    expect(result.passed).toBe(true);
    expect(fixedData.columns.length).toBeGreaterThanOrEqual(2);
  });

  it("generates valid kanban-board from text-only content", () => {
    const slide: SlideContent = {
      slide_number: 5,
      title: "Статус проекта",
      text: "Бэклог: Исследование рынка, Анализ конкурентов. В работе: Дизайн MVP. Готово: Бриф проекта.",
      notes: "",
      key_message: "",
      content_shape: "bullet_points",
      slide_category: "body",
    };
    const data = buildFallbackData(slide, "kanban-board");
    const { data: fixedData } = autoFixSlideData(data, "kanban-board");
    const result = validateSlideData(fixedData, "kanban-board");
    expect(result.passed).toBe(true);
    expect(fixedData.columns.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════
// LLM CONTENT QUALITY VALIDATION
// ═══════════════════════════════════════════════════════

describe("isCriticalLayout", () => {
  it("returns true for title-slide", () => {
    expect(isCriticalLayout("title-slide")).toBe(true);
  });

  it("returns true for final-slide", () => {
    expect(isCriticalLayout("final-slide")).toBe(true);
  });

  it("returns false for text-slide", () => {
    expect(isCriticalLayout("text-slide")).toBe(false);
  });

  it("returns false for card-grid", () => {
    expect(isCriticalLayout("card-grid")).toBe(false);
  });

  it("returns false for kanban-board", () => {
    expect(isCriticalLayout("kanban-board")).toBe(false);
  });
});

describe("validateCriticalSlideContent", () => {
  it("runs quick QA on non-critical layouts", async () => {
    const mockLLM = async () => ({ choices: [{ message: { content: JSON.stringify({ completeness: 8, density: 7, issues: [], suggestions: [] }) } }] });
    const result = await validateCriticalSlideContent(
      { title: "Test" },
      "text-slide",
      "Test prompt",
      mockLLM,
    );
    expect(result.passed).toBe(true);
    // Quick QA averages completeness + density scores
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it("returns passed=true when LLM gives high scores", async () => {
    const mockLLM = async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            relevance: 9,
            clarity: 8,
            professionalism: 9,
            completeness: 8,
            issues: [],
            suggestions: [],
          }),
        },
      }],
    });
    const result = await validateCriticalSlideContent(
      { title: "AI в бизнесе", description: "Стратегия внедрения" },
      "title-slide",
      "Стратегия AI",
      mockLLM,
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(8);
  });

  it("returns passed=false when LLM gives low scores", async () => {
    const mockLLM = async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            relevance: 3,
            clarity: 4,
            professionalism: 5,
            completeness: 3,
            issues: ["Title is generic", "Description is placeholder text"],
            suggestions: ["Make title more specific", "Add concrete details"],
          }),
        },
      }],
    });
    const result = await validateCriticalSlideContent(
      { title: "Презентация", description: "Описание" },
      "title-slide",
      "Стратегия AI для ритейла",
      mockLLM,
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(6);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("handles LLM failure gracefully", async () => {
    const mockLLM = async () => {
      throw new Error("LLM service unavailable");
    };
    const result = await validateCriticalSlideContent(
      { title: "Test" },
      "title-slide",
      "Test",
      mockLLM,
    );
    // Should pass gracefully, not block the pipeline
    expect(result.passed).toBe(true);
    expect(result.score).toBe(7);
    expect(result.suggestions).toContain("LLM review failed, skipped");
  });

  it("handles empty LLM response gracefully", async () => {
    const mockLLM = async () => ({ choices: [{ message: { content: null } }] });
    const result = await validateCriticalSlideContent(
      { title: "Test" },
      "final-slide",
      "Test",
      mockLLM,
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(7);
  });

  it("works for final-slide layout", async () => {
    const mockLLM = async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            relevance: 7,
            clarity: 8,
            professionalism: 7,
            completeness: 6,
            issues: [],
            suggestions: ["Add a stronger call to action"],
          }),
        },
      }],
    });
    const result = await validateCriticalSlideContent(
      { title: "Спасибо!", subtitle: "Вопросы?" },
      "final-slide",
      "Стратегия AI",
      mockLLM,
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(7);
    expect(result.suggestions.length).toBe(1);
  });
});
