import { describe, it, expect } from "vitest";
import {
  normalizeNumber,
  extractFacts,
  areFactsContradictory,
  contextOverlap,
  runFactCheck,
  type ExtractedFact,
} from "./factChecker";

// ═══════════════════════════════════════════════════════
// normalizeNumber
// ═══════════════════════════════════════════════════════

describe("normalizeNumber", () => {
  it("should parse simple integers", () => {
    const result = normalizeNumber("42");
    expect(result).toEqual({ value: 42, unit: "" });
  });

  it("should parse percentages", () => {
    const result = normalizeNumber("32%");
    expect(result).toEqual({ value: 32, unit: "%" });
  });

  it("should parse currency with $ prefix", () => {
    const result = normalizeNumber("$1.2B");
    expect(result).toEqual({ value: 1_200_000_000, unit: "$" });
  });

  it("should parse Russian millions (млн)", () => {
    const result = normalizeNumber("850 млн");
    expect(result).toEqual({ value: 850_000_000, unit: "млн" });
  });

  it("should parse Russian billions (млрд)", () => {
    const result = normalizeNumber("1.5 млрд");
    expect(result).toEqual({ value: 1_500_000_000, unit: "млрд" });
  });

  it("should parse thousands (тыс)", () => {
    const result = normalizeNumber("500 тыс");
    expect(result).toEqual({ value: 500_000, unit: "тыс" });
  });

  it("should parse ruble symbol", () => {
    const result = normalizeNumber("₽100");
    expect(result).toEqual({ value: 100, unit: "₽" });
  });

  it("should parse euro symbol", () => {
    const result = normalizeNumber("€500 млн");
    expect(result).toEqual({ value: 500_000_000, unit: "€" });
  });

  it("should handle commas as decimal separators", () => {
    const result = normalizeNumber("1,5 млрд");
    expect(result).toEqual({ value: 1_500_000_000, unit: "млрд" });
  });

  it("should return null for non-numeric strings", () => {
    expect(normalizeNumber("abc")).toBeNull();
  });

  it("should parse M suffix", () => {
    const result = normalizeNumber("850M");
    expect(result).toEqual({ value: 850_000_000, unit: "M" });
  });

  it("should parse K suffix", () => {
    const result = normalizeNumber("50K");
    expect(result).toEqual({ value: 50_000, unit: "K" });
  });
});

// ═══════════════════════════════════════════════════════
// extractFacts
// ═══════════════════════════════════════════════════════

describe("extractFacts", () => {
  it("should extract currency amounts", () => {
    const facts = extractFacts("Оборот компании $1.2B в 2025 году");
    const currencyFacts = facts.filter(f => f.type === "currency");
    expect(currencyFacts.length).toBeGreaterThanOrEqual(1);
    expect(currencyFacts.some(f => f.normalizedValue === 1_200_000_000)).toBe(true);
  });

  it("should extract percentages", () => {
    const facts = extractFacts("Рост составил 32% по сравнению с прошлым годом");
    const pctFacts = facts.filter(f => f.type === "percentage" || f.unit === "%");
    expect(pctFacts.length).toBeGreaterThanOrEqual(1);
    expect(pctFacts.some(f => f.normalizedValue === 32)).toBe(true);
  });

  it("should extract Russian currency amounts", () => {
    const facts = extractFacts("Выручка 850 млн рублей за Q4 2025");
    const found = facts.some(f => f.normalizedValue === 850_000_000);
    expect(found).toBe(true);
  });

  it("should extract dates and quarters", () => {
    const facts = extractFacts("Итоги Q4 2025 и планы на Q1 2026");
    const dateFacts = facts.filter(f => f.type === "date");
    expect(dateFacts.length).toBeGreaterThanOrEqual(2);
  });

  it("should skip year-like numbers", () => {
    const facts = extractFacts("В 2025 году компания выросла");
    // 2025 should be captured as a date, not as a standalone number
    const numFacts = facts.filter(f => f.type === "number" && f.normalizedValue === 2025);
    expect(numFacts.length).toBe(0);
  });

  it("should skip small standalone numbers", () => {
    const facts = extractFacts("У нас 3 офиса и 5 партнёров");
    const numFacts = facts.filter(f => f.type === "number");
    // Numbers < 10 without unit should be skipped
    expect(numFacts.filter(f => (f.normalizedValue || 0) < 10).length).toBe(0);
  });

  it("should extract multiple facts from complex prompt", () => {
    const prompt = "Стратегия выхода на рынок ЮВА для SaaS-компании с оборотом 850 млн руб, NPS 72, рост 32% за Q4 2025";
    const facts = extractFacts(prompt);
    expect(facts.length).toBeGreaterThanOrEqual(3);
  });

  it("should return empty array for text without facts", () => {
    const facts = extractFacts("Общая стратегия развития компании");
    expect(facts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// areFactsContradictory
// ═══════════════════════════════════════════════════════

describe("areFactsContradictory", () => {
  const makeFact = (raw: string, value: number | null, unit: string): ExtractedFact => ({
    raw,
    normalizedValue: value,
    unit,
    type: "number",
    context: raw,
  });

  it("should detect contradictory currency amounts (>3x difference)", () => {
    const prompt = makeFact("850 млн", 850_000_000, "млн");
    const slide = makeFact("$1.2B", 1_200_000_000, "$");
    // Different currency units — should not flag as contradictory
    // because isCurrencyUnit checks both
    expect(areFactsContradictory(prompt, slide)).toBe(false);
  });

  it("should detect contradictory same-unit amounts", () => {
    const prompt = makeFact("850 млн", 850_000_000, "млн");
    const slide = makeFact("3.5 млрд", 3_500_000_000, "млрд");
    // Both are currency-like units, ratio is ~4.1x
    expect(areFactsContradictory(prompt, slide)).toBe(true);
  });

  it("should not flag exact matches", () => {
    const prompt = makeFact("32%", 32, "%");
    const slide = makeFact("32%", 32, "%");
    expect(areFactsContradictory(prompt, slide)).toBe(false);
  });

  it("should flag large percentage differences (>10pp)", () => {
    const prompt = makeFact("32%", 32, "%");
    const slide = makeFact("85%", 85, "%");
    expect(areFactsContradictory(prompt, slide)).toBe(true);
  });

  it("should not flag small percentage differences (<10pp)", () => {
    const prompt = makeFact("32%", 32, "%");
    const slide = makeFact("35%", 35, "%");
    expect(areFactsContradictory(prompt, slide)).toBe(false);
  });

  it("should not flag when values are null", () => {
    const prompt = makeFact("Q4 2025", null, "");
    const slide = makeFact("Q1 2026", null, "");
    expect(areFactsContradictory(prompt, slide)).toBe(false);
  });

  it("should not flag different unit types", () => {
    const prompt = makeFact("32%", 32, "%");
    const slide = makeFact("850 млн", 850_000_000, "млн");
    expect(areFactsContradictory(prompt, slide)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// contextOverlap
// ═══════════════════════════════════════════════════════

describe("contextOverlap", () => {
  it("should return high overlap for similar contexts", () => {
    const overlap = contextOverlap(
      "Выручка компании составила 850 млн рублей",
      "Общая выручка компании достигла 3.5 млрд рублей"
    );
    expect(overlap).toBeGreaterThan(0.2);
  });

  it("should return 0 for completely different contexts", () => {
    const overlap = contextOverlap(
      "Количество сотрудников в офисе",
      "Температура на улице сегодня"
    );
    expect(overlap).toBe(0);
  });

  it("should return 0 for empty contexts", () => {
    expect(contextOverlap("", "some text")).toBe(0);
    expect(contextOverlap("some text", "")).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// runFactCheck (integration)
// ═══════════════════════════════════════════════════════

describe("runFactCheck", () => {
  it("should return no violations when prompt has no facts", () => {
    const result = runFactCheck("Общая стратегия развития", [
      { slideNumber: 1, title: "Стратегия", textContent: "Наша стратегия на 2026 год" },
    ]);
    expect(result.violations.length).toBe(0);
    expect(result.penalty).toBe(0);
  });

  it("should return no violations when slides match prompt facts", () => {
    const result = runFactCheck("Выручка 850 млн рублей, рост 32%", [
      { slideNumber: 1, title: "Финансы", textContent: "Выручка компании 850 млн рублей" },
      { slideNumber: 2, title: "Рост", textContent: "Рост составил 32% за год" },
    ]);
    expect(result.violations.length).toBe(0);
    expect(result.penalty).toBe(0);
  });

  it("should detect violations when slide contradicts prompt", () => {
    const result = runFactCheck("Выручка 850 млн рублей", [
      { slideNumber: 1, title: "Финансы", textContent: "Выручка компании 5 млрд рублей за год" },
    ]);
    // 850M vs 5B is a ~5.9x difference — should be flagged
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.penalty).toBeGreaterThan(0);
  });

  it("should cap penalty at 3", () => {
    const result = runFactCheck("Рост 10%, выручка 100 млн, NPS 72", [
      { slideNumber: 1, title: "S1", textContent: "Рост 85% за квартал" },
      { slideNumber: 2, title: "S2", textContent: "Выручка 5 млрд рублей" },
      { slideNumber: 3, title: "S3", textContent: "NPS составляет 15 баллов" },
    ]);
    expect(result.penalty).toBeLessThanOrEqual(3);
  });

  it("should handle empty slides array", () => {
    const result = runFactCheck("Выручка 850 млн", []);
    expect(result.violations.length).toBe(0);
    expect(result.penalty).toBe(0);
  });

  it("should include prompt facts count in result", () => {
    const result = runFactCheck("Выручка $1.2B, рост 32%, NPS 72", [
      { slideNumber: 1, title: "Test", textContent: "Some content" },
    ]);
    expect(result.promptFacts.length).toBeGreaterThanOrEqual(2);
  });

  it("should generate a summary string", () => {
    const result = runFactCheck("Выручка 850 млн", [
      { slideNumber: 1, title: "Test", textContent: "Выручка 850 млн рублей" },
    ]);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe("string");
  });
});
