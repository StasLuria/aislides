import { describe, it, expect } from "vitest";
import {
  analyzeSlideContent,
  analyzeAllSlides,
  buildEnrichedSlidesSummary,
  applyContentAwareOverrides,
  type ContentAnalysis,
} from "./contentAnalyzer";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function makeSlide(overrides: Partial<SlideContent> & { slide_number: number }): SlideContent {
  return {
    title: "Test Slide",
    text: "Some content here",
    notes: "",
    data_points: [],
    key_message: "",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// CONTENT TYPE DETECTION
// ═══════════════════════════════════════════════════════

describe("analyzeSlideContent", () => {
  describe("fixed layouts", () => {
    it("should detect slide 1 as title", () => {
      const result = analyzeSlideContent(makeSlide({ slide_number: 1, title: "My Presentation" }));
      expect(result.contentType).toBe("title");
      expect(result.confidence).toBe(1.0);
      expect(result.recommendedLayouts).toEqual(["title-slide"]);
    });
  });

  describe("specialized keyword detection", () => {
    it("should detect SWOT analysis", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 3,
        title: "SWOT-анализ компании",
        text: "Сильные и слабые стороны, возможности и угрозы",
      }));
      expect(result.contentType).toBe("swot");
      expect(result.recommendedLayouts[0]).toBe("swot-analysis");
    });

    it("should detect funnel content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 4,
        title: "Воронка продаж",
        text: "Конверсия на каждом этапе: awareness → consideration → decision",
      }));
      expect(result.contentType).toBe("funnel");
      expect(result.recommendedLayouts[0]).toBe("funnel");
    });

    it("should detect matrix content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 5,
        title: "Матрица приоритизации",
        text: "Распределение задач по усилиям и эффекту в 2x2 квадрантах",
      }));
      expect(result.contentType).toBe("matrix");
      expect(result.recommendedLayouts[0]).toBe("matrix-2x2");
    });

    it("should detect risk content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 6,
        title: "Оценка рисков проекта",
        text: "Вероятность и воздействие каждого риска, план митигации",
      }));
      expect(result.contentType).toBe("risk");
      expect(result.recommendedLayouts[0]).toBe("risk-matrix");
    });

    it("should detect scenario content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 7,
        title: "Сценарии развития",
        text: "Оптимистичный, базовый и пессимистичный прогноз на 2026 год",
      }));
      expect(result.contentType).toBe("scenario");
      expect(result.recommendedLayouts[0]).toBe("scenario-cards");
    });

    it("should detect checklist content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 8,
        title: "Чеклист готовности",
        text: "Требования к запуску: инфраструктура, команда, бюджет, план действий",
      }));
      expect(result.contentType).toBe("checklist");
      expect(result.recommendedLayouts[0]).toBe("checklist");
    });

    it("should detect hierarchy/pyramid content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 9,
        title: "Иерархия потребностей",
        text: "Пирамида приоритетов: базовые → продвинутые → стратегические",
      }));
      expect(result.contentType).toBe("hierarchy");
      expect(result.recommendedLayouts[0]).toBe("pyramid");
    });

    it("should detect agenda content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 2,
        title: "Повестка дня",
        text: "Обзор тем: стратегия, финансы, команда, план",
      }));
      expect(result.contentType).toBe("agenda");
      expect(result.recommendedLayouts[0]).toBe("agenda-table-of-contents");
    });
  });

  describe("quote detection", () => {
    it("should detect quoted text with guillemets", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 5,
        title: "Мнение эксперта",
        text: "«Искусственный интеллект изменит мир» — Илон Маск",
      }));
      expect(result.contentType).toBe("quote");
      expect(result.recommendedLayouts[0]).toBe("quote-slide");
    });

    it("should detect quoted text with English quotes", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 5,
        title: "Expert Opinion",
        text: '"AI will transform every industry" — Satya Nadella, Microsoft CEO',
      }));
      expect(result.contentType).toBe("quote");
    });
  });

  describe("data-heavy detection", () => {
    it("should detect data-heavy slide with many data points", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 4,
        title: "Финансовые показатели",
        text: "Выручка выросла на 34%, EBITDA составила 12 млрд ₽, чистая прибыль 8.5 млрд ₽",
        data_points: [
          { label: "Выручка", value: "34", unit: "%" },
          { label: "EBITDA", value: "12", unit: "млрд ₽" },
          { label: "Прибыль", value: "8.5", unit: "млрд ₽" },
        ],
      }));
      expect(result.contentType).toBe("metrics");
      expect(result.recommendedLayouts).toContain("icons-numbers");
    });

    it("should detect single dominant metric", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 4,
        title: "Ключевой результат",
        text: "Рост выручки на 47% за Q3 2025",
        data_points: [{ label: "Рост", value: "47", unit: "%" }],
        key_message: "Рекордный рост на 47%",
      }));
      expect(result.contentType).toBe("single_metric");
      expect(result.recommendedLayouts[0]).toBe("hero-stat");
    });

    it("should detect data-heavy with high numeric density", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 4,
        title: "Рыночные показатели",
        text: "Рынок вырос на 25%, объём составил $201 billion, прогноз 35% роста к 2030, инвестиции $45 billion, 108 ГВт мощности, 3.5 млн рабочих мест",
        data_points: [
          { label: "Рост", value: "25", unit: "%" },
          { label: "Объём", value: "201", unit: "billion $" },
          { label: "Прогноз", value: "35", unit: "%" },
          { label: "Инвестиции", value: "45", unit: "billion $" },
          { label: "Мощность", value: "108", unit: "ГВт" },
          { label: "Рабочие места", value: "3.5", unit: "млн" },
        ],
      }));
      expect(["data_heavy", "metrics"]).toContain(result.contentType);
      const hasChartLayout = result.recommendedLayouts.some(l =>
        ["stats-chart", "chart-text", "chart-slide", "dual-chart", "icons-numbers", "highlight-stats"].includes(l)
      );
      expect(hasChartLayout).toBe(true);
    });
  });

  describe("process detection", () => {
    it("should detect process/methodology content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 6,
        title: "Методология внедрения",
        text: "Пошаговый процесс: 1. Анализ 2. Проектирование 3. Разработка 4. Тестирование 5. Запуск",
      }));
      expect(result.contentType).toBe("process");
      expect(result.recommendedLayouts).toContain("numbered-steps-v2");
    });

    it("should detect workflow content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 6,
        title: "Как работает система",
        text: "Алгоритм обработки данных проходит через 5 этапов",
      }));
      expect(result.contentType).toBe("process");
    });
  });

  describe("comparison detection", () => {
    it("should detect comparison content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 7,
        title: "Сравнение подходов",
        text: "Традиционный vs AI-подход: преимущества и недостатки каждого",
      }));
      expect(result.contentType).toBe("comparison");
      expect(result.recommendedLayouts).toContain("comparison");
    });

    it("should detect pros/cons content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 7,
        title: "Плюсы и минусы облачных решений",
        text: "За и против миграции в облако",
      }));
      expect(result.contentType).toBe("comparison");
      expect(result.recommendedLayouts).toContain("pros-cons");
    });
  });

  describe("timeline detection", () => {
    it("should detect timeline content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 8,
        title: "Дорожная карта на 2026",
        text: "Q1: Запуск MVP, Q2: Масштабирование, Q3: Международная экспансия, Q4: IPO",
      }));
      expect(result.contentType).toBe("timeline");
      expect(result.recommendedLayouts).toContain("timeline-horizontal");
    });

    it("should detect roadmap content", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 8,
        title: "Стратегический план развития",
        text: "Этапы развития: 2025 — фундамент, 2026 — рост, 2027 — лидерство",
      }));
      expect(result.contentType).toBe("timeline");
    });
  });

  describe("metrics keyword detection", () => {
    it("should detect metrics slide with keywords and numbers", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 5,
        title: "Ключевые KPI",
        text: "Показатели эффективности: NPS 72, CAC $45, LTV $890, Retention 85%",
      }));
      expect(result.contentType).toBe("metrics");
    });
  });

  describe("narrative fallback", () => {
    it("should default to narrative for general text", () => {
      const result = analyzeSlideContent(makeSlide({
        slide_number: 5,
        title: "Обзор рынка",
        text: "Рынок электромобилей продолжает расти. Основные игроки включают Tesla, BYD, и Volkswagen. Конкуренция усиливается в сегменте бюджетных моделей.",
      }));
      expect(result.contentType).toBe("narrative");
      expect(result.recommendedLayouts).toContain("text-with-callout");
    });
  });
});

// ═══════════════════════════════════════════════════════
// ENRICHED SUMMARY
// ═══════════════════════════════════════════════════════

describe("buildEnrichedSlidesSummary", () => {
  it("should include content type tags in summary", () => {
    const slides = [
      makeSlide({ slide_number: 1, title: "Title" }),
      makeSlide({
        slide_number: 2,
        title: "SWOT-анализ",
        text: "Сильные и слабые стороны",
        key_message: "SWOT analysis",
      }),
    ];
    const analyses = analyzeAllSlides(slides);
    const summary = buildEnrichedSlidesSummary(slides, analyses);

    expect(summary).toContain("[CONTENT TYPE: TITLE]");
    expect(summary).toContain("[CONTENT TYPE: SWOT]");
    expect(summary).toContain("[RECOMMENDED:");
  });

  it("should include data point count", () => {
    const slides = [
      makeSlide({
        slide_number: 2,
        title: "Финансы",
        text: "Рост на 34%, прибыль 12 млрд ₽",
        data_points: [
          { label: "Рост", value: "34", unit: "%" },
          { label: "Прибыль", value: "12", unit: "млрд ₽" },
          { label: "Выручка", value: "50", unit: "млрд ₽" },
        ],
      }),
    ];
    const analyses = analyzeAllSlides(slides);
    const summary = buildEnrichedSlidesSummary(slides, analyses);

    expect(summary).toContain("[HAS 3 DATA POINTS]");
  });

  it("should include bullet count for text-heavy slides", () => {
    const slides = [
      makeSlide({
        slide_number: 2,
        title: "Обзор",
        text: "**Пункт 1**: Описание\n**Пункт 2**: Описание\n**Пункт 3**: Описание\n**Пункт 4**: Описание\n**Пункт 5**: Описание",
      }),
    ];
    const analyses = analyzeAllSlides(slides);
    const summary = buildEnrichedSlidesSummary(slides, analyses);

    expect(summary).toContain("BULLETS]");
  });
});

// ═══════════════════════════════════════════════════════
// CONTENT-AWARE OVERRIDES
// ═══════════════════════════════════════════════════════

describe("applyContentAwareOverrides", () => {
  it("should override text-slide for data-heavy content", () => {
    const layoutMap = new Map<number, string>([
      [1, "title-slide"],
      [2, "text-slide"],  // Wrong! Should be chart-capable
      [3, "final-slide"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 2,
        contentType: "data_heavy",
        confidence: 0.8,
        recommendedLayouts: ["stats-chart", "chart-text", "chart-slide"],
        signals: ["data_points=5"],
        dataPointCount: 5,
        numericDensity: 0.2,
        bulletCount: 3,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    expect(layoutMap.get(2)).toBe("stats-chart");
  });

  it("should override chart-slide for process content", () => {
    const layoutMap = new Map<number, string>([
      [1, "title-slide"],
      [2, "chart-slide"],  // Wrong! Process content doesn't need chart
      [3, "final-slide"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 2,
        contentType: "process",
        confidence: 0.75,
        recommendedLayouts: ["numbered-steps-v2", "process-steps", "timeline-horizontal"],
        signals: ["process_keywords"],
        dataPointCount: 0,
        numericDensity: 0.02,
        bulletCount: 5,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    expect(layoutMap.get(2)).toBe("numbered-steps-v2");
  });

  it("should NOT override exempt layouts (title-slide, final-slide)", () => {
    const layoutMap = new Map<number, string>([
      [1, "title-slide"],
      [10, "final-slide"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 1,
        contentType: "data_heavy",
        confidence: 0.9,
        recommendedLayouts: ["stats-chart"],
        signals: ["data_points=5"],
        dataPointCount: 5,
        numericDensity: 0.3,
        bulletCount: 0,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    expect(layoutMap.get(1)).toBe("title-slide");
  });

  it("should NOT override when confidence is low", () => {
    const layoutMap = new Map<number, string>([
      [2, "text-slide"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 2,
        contentType: "narrative",
        confidence: 0.5,
        recommendedLayouts: ["text-with-callout"],
        signals: ["default_narrative"],
        dataPointCount: 0,
        numericDensity: 0.01,
        bulletCount: 3,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    // text-slide is valid for narrative, and confidence is low, so no override
    expect(layoutMap.get(2)).toBe("text-slide");
  });

  it("should override text-slide for comparison content", () => {
    const layoutMap = new Map<number, string>([
      [3, "text-slide"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 3,
        contentType: "comparison",
        confidence: 0.75,
        recommendedLayouts: ["comparison", "pros-cons", "two-column"],
        signals: ["comparison_keywords"],
        dataPointCount: 0,
        numericDensity: 0.02,
        bulletCount: 6,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    expect(layoutMap.get(3)).toBe("comparison");
  });

  it("should override timeline for metrics content", () => {
    const layoutMap = new Map<number, string>([
      [4, "timeline"],
    ]);
    const analyses: ContentAnalysis[] = [
      {
        slideNumber: 4,
        contentType: "metrics",
        confidence: 0.85,
        recommendedLayouts: ["icons-numbers", "highlight-stats", "stats-chart"],
        signals: ["metrics_cluster"],
        dataPointCount: 4,
        numericDensity: 0.15,
        bulletCount: 4,
        hasQuote: false,
      },
    ];

    applyContentAwareOverrides(layoutMap, analyses);
    expect(layoutMap.get(4)).toBe("icons-numbers");
  });
});

// ═══════════════════════════════════════════════════════
// ANALYZE ALL SLIDES
// ═══════════════════════════════════════════════════════

describe("analyzeAllSlides", () => {
  it("should analyze a full presentation with diverse content", () => {
    const slides: SlideContent[] = [
      makeSlide({ slide_number: 1, title: "Цифровая трансформация" }),
      makeSlide({ slide_number: 2, title: "Повестка", text: "Содержание презентации" }),
      makeSlide({
        slide_number: 3,
        title: "Ключевые метрики",
        text: "NPS 72, CAC $45, LTV $890, Retention 85%",
        data_points: [
          { label: "NPS", value: "72", unit: "" },
          { label: "CAC", value: "45", unit: "$" },
          { label: "LTV", value: "890", unit: "$" },
        ],
      }),
      makeSlide({
        slide_number: 4,
        title: "Этапы внедрения",
        text: "Пошаговый процесс: анализ → проектирование → разработка → тестирование",
      }),
      makeSlide({
        slide_number: 5,
        title: "Сравнение подходов",
        text: "Традиционный vs AI-подход: преимущества и недостатки",
      }),
      makeSlide({
        slide_number: 6,
        title: "Дорожная карта 2026",
        text: "Q1: MVP, Q2: Масштабирование, Q3: Экспансия, Q4: IPO",
      }),
    ];

    const analyses = analyzeAllSlides(slides);
    expect(analyses).toHaveLength(6);
    expect(analyses[0].contentType).toBe("title");
    expect(analyses[1].contentType).toBe("agenda");
    expect(analyses[2].contentType).toBe("metrics");
    expect(analyses[3].contentType).toBe("process");
    expect(analyses[4].contentType).toBe("comparison");
    expect(analyses[5].contentType).toBe("timeline");
  });

  it("should handle empty presentation", () => {
    const analyses = analyzeAllSlides([]);
    expect(analyses).toHaveLength(0);
  });
});
