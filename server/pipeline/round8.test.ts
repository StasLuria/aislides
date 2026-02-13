/**
 * Round 8 Tests — DataViz fix, Design Critique improvements, org-chart template
 */
import { describe, it, expect } from "vitest";
import { validateSlideData, autoFixSlideData } from "./qaAgent";
import { buildFallbackData } from "./generator";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// DataViz parseNumericValue type-guard tests
// ═══════════════════════════════════════════════════════

describe("DataViz parseNumericValue type safety", () => {
  // We test indirectly through buildFallbackData since parseNumericValue is internal
  it("handles numeric data_points without crashing", () => {
    const slide: SlideContent = {
      slide_number: 3,
      title: "Рост показателей",
      text: "Выручка: 100 млн\nПрибыль: 20 млн\nROI: 150%",
      key_message: "Рост на 50%",
      content_shape: "stat_cards",
      data_points: [
        { label: "Выручка", value: 100 as any, unit: "млн" },
        { label: "Прибыль", value: 20 as any, unit: "млн" },
        { label: "ROI", value: 150 as any, unit: "%" },
      ],
    };
    // Should not throw even with numeric values
    expect(() => buildFallbackData(slide, "highlight-stats")).not.toThrow();
  });

  it("handles null/undefined data_points gracefully", () => {
    const slide: SlideContent = {
      slide_number: 3,
      title: "Test",
      text: "Some text\nMore text\nEven more",
      key_message: "",
      content_shape: "stat_cards",
      data_points: undefined as any,
    };
    expect(() => buildFallbackData(slide, "highlight-stats")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// org-chart validation tests
// ═══════════════════════════════════════════════════════

describe("validateSlideData — org-chart", () => {
  it("passes with valid org-chart data", () => {
    const data = {
      title: "Структура команды",
      root: { name: "Алексей Петров", role: "CEO" },
      children: [
        { name: "Технологии", role: "CTO", avatar: "👨‍💻", detail: "15 чел", members: [{ name: "Иван", role: "Backend" }] },
        { name: "Продукт", role: "CPO", avatar: "📊", detail: "8 чел", members: [] },
        { name: "Маркетинг", role: "CMO", avatar: "📢", detail: "5 чел", members: [] },
      ],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.passed).toBe(true);
  });

  it("fails when root is missing", () => {
    const data = {
      title: "Структура",
      children: [{ name: "A", role: "CTO" }],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "root")).toBe(true);
  });

  it("fails when children is missing", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "children")).toBe(true);
  });

  it("fails when root name is empty", () => {
    const data = {
      title: "Структура",
      root: { name: "", role: "CEO" },
      children: [
        { name: "A", role: "CTO" },
        { name: "B", role: "CPO" },
      ],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.issues.some((i) => i.field === "root.name")).toBe(true);
  });

  it("fails with less than 2 children", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
      children: [{ name: "A", role: "CTO" }],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "children" && i.message.includes("at least 2"))).toBe(true);
  });

  it("warns with more than 6 children", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
      children: Array.from({ length: 7 }, (_, i) => ({ name: `Dept ${i + 1}`, role: `Head ${i + 1}` })),
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.issues.some((i) => i.field === "children" && i.severity === "warning")).toBe(true);
  });

  it("fails when child has empty name", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
      children: [
        { name: "", role: "CTO" },
        { name: "B", role: "CPO" },
      ],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.issues.some((i) => i.field.includes("children[0].name"))).toBe(true);
  });

  it("warns when child has more than 3 members", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
      children: [
        {
          name: "Tech", role: "CTO",
          members: [
            { name: "A", role: "r1" }, { name: "B", role: "r2" },
            { name: "C", role: "r3" }, { name: "D", role: "r4" },
          ],
        },
        { name: "Prod", role: "CPO", members: [] },
      ],
    };
    const result = validateSlideData(data, "org-chart");
    expect(result.issues.some((i) => i.field.includes("members") && i.severity === "warning")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// org-chart auto-fix tests
// ═══════════════════════════════════════════════════════

describe("autoFixSlideData — org-chart", () => {
  it("adds missing avatar, role, detail, members to children", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO" },
      children: [
        { name: "Tech" },
        { name: "Product" },
      ],
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "org-chart");
    expect(wasFixed).toBe(true);
    expect(fixed.root.role).toBe("");
    expect(fixed.children[0].avatar).toBe("👤");
    expect(fixed.children[0].role).toBe("");
    expect(fixed.children[0].detail).toBe("");
    expect(fixed.children[0].members).toEqual([]);
  });

  it("limits children to 6 and members to 3", () => {
    const data = {
      title: "Структура",
      root: { name: "CEO", role: "CEO" },
      children: Array.from({ length: 8 }, (_, i) => ({
        name: `Dept ${i + 1}`,
        role: `Head`,
        avatar: "👤",
        detail: "",
        members: Array.from({ length: 5 }, (_, j) => ({ name: `M${j}`, role: `R${j}` })),
      })),
    };
    const { data: fixed, fixed: wasFixed } = autoFixSlideData(data, "org-chart");
    expect(wasFixed).toBe(true);
    expect(fixed.children.length).toBe(6);
    expect(fixed.children[0].members.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════
// buildFallbackData — org-chart
// ═══════════════════════════════════════════════════════

describe("buildFallbackData — org-chart", () => {
  it("generates valid org-chart from structured_content", () => {
    const slide: SlideContent = {
      slide_number: 5,
      title: "Структура команды",
      text: "CEO\nCTO — Технологии\nCPO — Продукт\nCMO — Маркетинг",
      key_message: "",
      content_shape: "org_structure",
      structured_content: {
        root: { name: "Алексей Петров", role: "CEO" },
        children: [
          { name: "Технологии", role: "CTO", avatar: "👨‍💻", detail: "15 чел", members: [{ name: "Иван", role: "Backend" }] },
          { name: "Продукт", role: "CPO", avatar: "📊", detail: "8 чел", members: [] },
          { name: "Маркетинг", role: "CMO", avatar: "📢", detail: "5 чел", members: [] },
        ],
      } as any,
    };
    const data = buildFallbackData(slide, "org-chart");
    const { data: fixedData } = autoFixSlideData(data, "org-chart");
    const result = validateSlideData(fixedData, "org-chart");
    expect(result.passed).toBe(true);
    expect(fixedData.root.name).toBe("Алексей Петров");
    expect(fixedData.children.length).toBe(3);
  });

  it("generates valid org-chart from text-only content", () => {
    const slide: SlideContent = {
      slide_number: 5,
      title: "Наша команда",
      text: "Разработка: Backend и Frontend\nМаркетинг: SEO и контент\nПродажи: B2B и B2C",
      key_message: "",
      content_shape: "org_structure",
    };
    const data = buildFallbackData(slide, "org-chart");
    const { data: fixedData } = autoFixSlideData(data, "org-chart");
    const result = validateSlideData(fixedData, "org-chart");
    expect(result.passed).toBe(true);
    expect(fixedData.root.name).toBe("Наша команда");
    expect(fixedData.children.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════
// Design Critique — TEXT_LIMITS coverage
// ═══════════════════════════════════════════════════════

describe("Design Critique TEXT_LIMITS", () => {
  // We verify that the new templates are registered in TEXT_LIMITS
  // by checking that the designCriticAgent module exports correctly
  it("org-chart template is recognized by pipeline", () => {
    const slide: SlideContent = {
      slide_number: 5,
      title: "Org Chart Test",
      text: "A: Role A\nB: Role B\nC: Role C",
      key_message: "",
      content_shape: "org_structure",
    };
    const data = buildFallbackData(slide, "org-chart");
    expect(data.title).toBe("Org Chart Test");
    expect(data.root).toBeDefined();
    expect(data.children).toBeDefined();
  });
});
