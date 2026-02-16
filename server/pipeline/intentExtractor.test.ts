/**
 * Tests for the intentExtractor module.
 * Tests both the regex fallback extraction and the LLM-based extraction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LLM for controlled testing
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          topic: "Стратегия компании на 2026 год",
          slideCount: 5,
          enableImages: true,
          userWillAddImages: false,
          styleHints: ["корпоративный", "минималистичный"],
          audience: "руководство",
          purpose: "стратегическое планирование",
          topicIsClear: true,
          confidence: 0.95,
          structureHints: [],
          language: "ru",
          customInstructions: [],
        }),
      },
    }],
  })),
}));

const { extractUserRequirements, formatRequirementsSummary, buildPipelineContext } = await import("./intentExtractor");

describe("intentExtractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractUserRequirements (LLM-based)", () => {
    it("should extract requirements from a complex user message", async () => {
      const result = await extractUserRequirements("Стратегия компании на 2026 год, 5 слайдов, для руководства");
      
      expect(result).toBeDefined();
      expect(result.topic).toBeTruthy();
      expect(result.slideCount).toBe(5);
      expect(result.topicIsClear).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return a valid UserRequirements object", async () => {
      const result = await extractUserRequirements("Презентация про AI");
      
      // Check all required fields exist
      expect(result).toHaveProperty("topic");
      expect(result).toHaveProperty("slideCount");
      expect(result).toHaveProperty("enableImages");
      expect(result).toHaveProperty("userWillAddImages");
      expect(result).toHaveProperty("styleHints");
      expect(result).toHaveProperty("audience");
      expect(result).toHaveProperty("purpose");
      expect(result).toHaveProperty("topicIsClear");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("structureHints");
      expect(result).toHaveProperty("language");
      expect(result).toHaveProperty("customInstructions");
    });
  });

  describe("formatRequirementsSummary", () => {
    it("should format slide count", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: 5,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toContain("5");
      expect(summary).toContain("слайдов");
    });

    it("should format disabled images", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: false,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toContain("Без AI-картинок");
    });

    it("should format user will add images", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: false,
        userWillAddImages: true,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toContain("добавите изображения сами");
    });

    it("should format audience", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: "инвесторы",
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toContain("инвесторы");
    });

    it("should format style hints", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: ["минималистичный", "строгий"],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toContain("минималистичный");
      expect(summary).toContain("строгий");
    });

    it("should format English language", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: "en",
        customInstructions: [],
      });
      expect(summary).toContain("английском");
    });

    it("should return empty string when no requirements specified", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(summary).toBe("");
    });

    it("should format multiple requirements together", () => {
      const summary = formatRequirementsSummary({
        topic: "Test",
        slideCount: 10,
        enableImages: true,
        userWillAddImages: false,
        styleHints: ["корпоративный"],
        audience: "руководство",
        purpose: "отчёт",
        topicIsClear: true,
        confidence: 0.9,
        structureHints: ["начать с проблемы"],
        language: null,
        customInstructions: ["добавить графики"],
      });
      expect(summary).toContain("10");
      expect(summary).toContain("иллюстрациями");
      expect(summary).toContain("корпоративный");
      expect(summary).toContain("руководство");
      expect(summary).toContain("отчёт");
      expect(summary).toContain("графики");
    });
  });

  describe("buildPipelineContext", () => {
    it("should build context with audience", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: "студенты",
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(ctx).toContain("Целевая аудитория: студенты");
    });

    it("should build context with purpose", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: "продажа продукта",
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(ctx).toContain("Цель презентации: продажа продукта");
    });

    it("should build context with style hints", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: ["яркий", "креативный"],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(ctx).toContain("Стиль: яркий, креативный");
    });

    it("should build context with custom instructions", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: ["использовать реальные данные", "добавить сравнение с конкурентами"],
      });
      expect(ctx).toContain("использовать реальные данные");
      expect(ctx).toContain("сравнение с конкурентами");
    });

    it("should return empty string when no context needed", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: [],
        audience: null,
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(ctx).toBe("");
    });

    it("should include ТРЕБОВАНИЯ ПОЛЬЗОВАТЕЛЯ header when context exists", () => {
      const ctx = buildPipelineContext({
        topic: "Test",
        slideCount: null,
        enableImages: null,
        userWillAddImages: false,
        styleHints: ["строгий"],
        audience: "инвесторы",
        purpose: null,
        topicIsClear: true,
        confidence: 0.9,
        structureHints: [],
        language: null,
        customInstructions: [],
      });
      expect(ctx).toContain("ТРЕБОВАНИЯ ПОЛЬЗОВАТЕЛЯ");
    });
  });
});
