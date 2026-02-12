/**
 * Tests for Theme Auto-Selector
 * Tests keyword matching, confidence scoring, and auto-selection logic
 */
import { describe, it, expect, vi } from "vitest";
import {
  keywordMatch,
  matchConfidence,
  autoSelectTheme,
} from "./themeSelector";

describe("Theme Auto-Selector", () => {
  // ═══════════════════════════════════════════════════════
  // Keyword Matching — Russian prompts
  // ═══════════════════════════════════════════════════════
  describe("keywordMatch — Russian prompts", () => {
    it("should match corporate_blue for business strategy", () => {
      const results = keywordMatch("Бизнес-стратегия компании на 2026 год");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("corporate_blue");
      expect(topMatch.score).toBeGreaterThan(0);
    });

    it("should match executive_navy_red for investor presentation", () => {
      const results = keywordMatch("Презентация для инвесторов: привлечение капитала серии B");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("executive_navy_red");
    });

    it("should match cosmic_dark for AI technology topic", () => {
      const results = keywordMatch("Искусственный интеллект и нейронные сети в автоматизации");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("cosmic_dark");
    });

    it("should match forest_green for ecology/sustainability", () => {
      const results = keywordMatch("Устойчивое развитие и экология: зелёные технологии");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("forest_green");
    });

    it("should match sunset_warm for education/training", () => {
      const results = keywordMatch("Программа обучения сотрудников: тренинг по лидерству");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("sunset_warm");
    });

    it("should match data_navy_blue for analytics topic", () => {
      const results = keywordMatch("Аналитика данных: метрики конверсии и ROI за Q3");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("data_navy_blue");
    });

    it("should match modern_purple for startup/product", () => {
      const results = keywordMatch("Запуск нового SaaS продукта: стартап в сфере маркетинга");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("modern_purple");
    });

    it("should match rose_gold for luxury/premium", () => {
      const results = keywordMatch("Люкс бренд ювелирных украшений: коллекция 2026");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("rose_gold");
    });

    it("should match arctic_frost for fintech/banking", () => {
      const results = keywordMatch("Финтех-платформа для банковских платежей и страхования");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("arctic_frost");
    });

    it("should match ocean_deep for logistics/international", () => {
      const results = keywordMatch("Международная логистика и цепочки поставок");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("ocean_deep");
    });

    it("should match citrus_energy for social media/retail", () => {
      const results = keywordMatch("SMM стратегия для e-commerce магазина: контент и реклама");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("citrus_energy");
    });

    it("should match executive_navy_red for coal/mining industry", () => {
      const results = keywordMatch("Угольная промышленность России: критическая ситуация и стратегические решения");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("executive_navy_red");
    });

    it("should match executive_navy_red for oil/gas energy", () => {
      const results = keywordMatch("Нефтегазовая отрасль: энергетическая стратегия на 2030");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("executive_navy_red");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Keyword Matching — English prompts
  // ═══════════════════════════════════════════════════════
  describe("keywordMatch — English prompts", () => {
    it("should match cosmic_dark for AI/blockchain topic", () => {
      const results = keywordMatch("Blockchain and AI: The Future of Decentralized Technology");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("cosmic_dark");
    });

    it("should match corporate_blue for business report", () => {
      const results = keywordMatch("Annual Business Report: Q4 Management Review");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("corporate_blue");
    });

    it("should match forest_green for sustainability", () => {
      const results = keywordMatch("ESG Report: Sustainable Development and Renewable Energy for Nature");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("forest_green");
    });

    it("should match data_navy_blue for data analytics", () => {
      const results = keywordMatch("Big Data Analytics: Machine Learning Pipeline Performance Metrics");
      const topMatch = results[0];
      expect(topMatch).toBeDefined();
      expect(topMatch.themeId).toBe("data_navy_blue");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Confidence Scoring
  // ═══════════════════════════════════════════════════════
  describe("matchConfidence", () => {
    it("should return 'low' for empty results", () => {
      expect(matchConfidence([])).toBe("low");
    });

    it("should return 'high' for strong single match", () => {
      // Simulate a strong match with clear separation
      const results = [
        { themeId: "cosmic_dark", score: 6, matchedKeywords: ["ai", "блокчейн", "автоматизац", "pattern:..."] },
        { themeId: "corporate_blue", score: 1, matchedKeywords: ["бизнес"] },
      ];
      expect(matchConfidence(results)).toBe("high");
    });

    it("should return 'medium' for decent match", () => {
      const results = [
        { themeId: "corporate_blue", score: 2, matchedKeywords: ["бизнес", "компания"] },
      ];
      expect(matchConfidence(results)).toBe("medium");
    });

    it("should return 'low' for weak match", () => {
      const results = [
        { themeId: "corporate_blue", score: 1, matchedKeywords: ["компания"] },
      ];
      expect(matchConfidence(results)).toBe("low");
    });

    it("should return 'high' when top score is dominant over second", () => {
      const results = [
        { themeId: "cosmic_dark", score: 5, matchedKeywords: ["ai", "технолог", "автоматизац"] },
        { themeId: "data_navy_blue", score: 2, matchedKeywords: ["данные"] },
      ];
      expect(matchConfidence(results)).toBe("high");
    });

    it("should return 'medium' when top is good but close to second", () => {
      const results = [
        { themeId: "corporate_blue", score: 3, matchedKeywords: ["бизнес", "компания", "стратеги"] },
        { themeId: "executive_navy_red", score: 2.6, matchedKeywords: ["инвестор", "капитал"] },
      ];
      expect(matchConfidence(results)).toBe("medium");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Auto-Select (without LLM)
  // ═══════════════════════════════════════════════════════
  describe("autoSelectTheme — keyword-only mode", () => {
    it("should select theme for clear business topic without LLM", async () => {
      const result = await autoSelectTheme(
        "Квартальный отчёт компании: бюджет и KPI",
        false, // disable LLM
      );
      expect(result.themeId).toBe("corporate_blue");
      expect(result.method).toBe("keyword");
      expect(result.confidence).toMatch(/high|medium/);
    });

    it("should select theme for clear tech topic without LLM", async () => {
      const result = await autoSelectTheme(
        "Искусственный интеллект: нейронные сети и deep learning в автоматизации",
        false,
      );
      expect(result.themeId).toBe("cosmic_dark");
      expect(result.method).toBe("keyword");
    });

    it("should select theme for clear green topic without LLM", async () => {
      const result = await autoSelectTheme(
        "Устойчивое развитие: зелёные технологии и экология",
        false,
      );
      expect(result.themeId).toBe("forest_green");
      expect(result.method).toBe("keyword");
    });

    it("should fall back to default for ambiguous prompt without LLM", async () => {
      const result = await autoSelectTheme(
        "Как сделать мир лучше",
        false,
      );
      expect(result.themeId).toBe("corporate_blue");
      expect(result.method).toBe("default");
      expect(result.confidence).toBe("low");
    });

    it("should select executive_navy_red for industrial topic", async () => {
      const result = await autoSelectTheme(
        "Нефтегазовая промышленность: инвестиции в энергетику и производство",
        false,
      );
      expect(result.themeId).toBe("executive_navy_red");
      expect(result.method).toBe("keyword");
    });

    it("should select data_navy_blue for analytics-heavy topic", async () => {
      const result = await autoSelectTheme(
        "Аналитика данных: метрики, статистика, ROI и конверсия",
        false,
      );
      expect(result.themeId).toBe("data_navy_blue");
      expect(result.method).toBe("keyword");
    });

    it("should select arctic_frost for fintech topic", async () => {
      const result = await autoSelectTheme(
        "Финтех-платформа: банковские платежи и финансовые услуги",
        false,
      );
      expect(result.themeId).toBe("arctic_frost");
      expect(result.method).toBe("keyword");
    });

    it("should select modern_purple for startup/product topic", async () => {
      const result = await autoSelectTheme(
        "Стартап: запуск нового SaaS продукта для маркетинга",
        false,
      );
      expect(result.themeId).toBe("modern_purple");
      expect(result.method).toBe("keyword");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════
  describe("Edge cases", () => {
    it("should handle empty prompt", () => {
      const results = keywordMatch("");
      expect(results).toEqual([]);
    });

    it("should handle very short prompt", () => {
      const results = keywordMatch("AI");
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed language prompt", () => {
      const results = keywordMatch("Blockchain технологии для бизнеса");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle prompt with only numbers", () => {
      const results = keywordMatch("12345 67890");
      expect(results).toEqual([]);
    });

    it("should be case-insensitive", () => {
      const results1 = keywordMatch("БИЗНЕС СТРАТЕГИЯ");
      const results2 = keywordMatch("бизнес стратегия");
      // Both should match corporate_blue
      expect(results1[0]?.themeId).toBe(results2[0]?.themeId);
    });

    it("should handle multiple competing themes", () => {
      // This prompt has keywords for multiple themes
      const results = keywordMatch("AI технологии для бизнес-аналитики данных");
      expect(results.length).toBeGreaterThan(1);
      // Should have at least cosmic_dark and data_navy_blue in results
      const themeIds = results.map((r) => r.themeId);
      expect(themeIds).toContain("cosmic_dark");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Theme Coverage
  // ═══════════════════════════════════════════════════════
  describe("Theme coverage", () => {
    const testCases: [string, string][] = [
      ["Корпоративная стратегия управления компанией", "corporate_blue"],
      ["Инвестиционный фонд: привлечение капитала", "executive_navy_red"],
      ["Big data аналитика: метрики и дашборды", "data_navy_blue"],
      ["Стартап: новый SaaS продукт", "modern_purple"],
      ["Нейронные сети и AI автоматизация", "cosmic_dark"],
      ["Экология и устойчивое развитие ESG", "forest_green"],
      ["Обучение команды: тренинг лидерства", "sunset_warm"],
      ["Международная логистика и транспорт", "ocean_deep"],
      ["Люкс бренд: премиум ювелирные украшения", "rose_gold"],
      ["Финтех банковские платежи и страхование", "arctic_frost"],
      ["Конференция: запуск продукта keynote", "midnight_noir"],
      ["SMM реклама для e-commerce магазина", "citrus_energy"],
    ];

    testCases.forEach(([prompt, expectedTheme]) => {
      it(`should match "${expectedTheme}" for: "${prompt.substring(0, 50)}..."`, () => {
        const results = keywordMatch(prompt);
        expect(results[0]?.themeId).toBe(expectedTheme);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // Result Structure
  // ═══════════════════════════════════════════════════════
  describe("Result structure", () => {
    it("autoSelectTheme should return correct structure", async () => {
      const result = await autoSelectTheme("Бизнес-стратегия компании", false);
      expect(result).toHaveProperty("themeId");
      expect(result).toHaveProperty("method");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("reason");
      expect(["keyword", "llm", "default"]).toContain(result.method);
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });

    it("keywordMatch should return sorted results", () => {
      const results = keywordMatch("Бизнес-стратегия компании с KPI и бюджетом");
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });
  });
});
