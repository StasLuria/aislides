import { describe, it, expect } from "vitest";
import { renderSlide, listLayouts, getLayoutTemplate } from "./templateEngine";
import { estimateContentHeight } from "./autoDensity";
import { getThemePreset } from "./themes";

describe("Manus-Style Layout Templates — Sprint 4", () => {
  // ═══════════════════════════════════════════════════════
  // Registration & Availability
  // ═══════════════════════════════════════════════════════
  describe("Layout Registration", () => {
    const newLayouts = [
      "stats-chart",
      "chart-text",
      "hero-stat",
      "scenario-cards",
      "numbered-steps-v2",
      "timeline-horizontal",
      "text-with-callout",
    ];

    it("should have all 7 new layouts registered", () => {
      const allLayouts = listLayouts();
      for (const layout of newLayouts) {
        expect(allLayouts).toContain(layout);
      }
    });

    it("should have at least 31 total layouts (24 original + 7 new)", () => {
      const allLayouts = listLayouts();
      expect(allLayouts.length).toBeGreaterThanOrEqual(31);
    });

    it("should have non-empty templates for all new layouts", () => {
      for (const layout of newLayouts) {
        const template = getLayoutTemplate(layout);
        expect(template.length).toBeGreaterThan(100);
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // stats-chart
  // ═══════════════════════════════════════════════════════
  describe("stats-chart", () => {
    it("should render stats cards with values and labels", () => {
      const html = renderSlide("stats-chart", {
        title: "Финансовые показатели",
        stats: [
          { value: "₽2.4 млрд", label: "Выручка", description: "За 2025 год", change: "+15%", changeDirection: "up" },
          { value: "₽380 млн", label: "EBITDA", description: "Маржа 16%", change: "+8%", changeDirection: "up" },
          { value: "1,240", label: "Сотрудники", description: "Штат компании" },
          { value: "12", label: "Регионы", description: "Присутствие" },
        ],
        chartSvg: "<svg><rect width='100' height='50'/></svg>",
        source: "Данные за 2025 год",
      });
      expect(html).toContain("Финансовые показатели");
      expect(html).toContain("₽2.4 млрд");
      expect(html).toContain("Выручка");
      expect(html).toContain("+15%");
      expect(html).toContain("₽380 млн");
      expect(html).toContain("<svg>");
      expect(html).toContain("Данные за 2025 год");
    });

    it("should render change direction badges with correct colors", () => {
      const html = renderSlide("stats-chart", {
        title: "Metrics",
        stats: [
          { value: "85%", label: "Growth", change: "+12%", changeDirection: "up" },
          { value: "3%", label: "Churn", change: "-2%", changeDirection: "down" },
        ],
      });
      expect(html).toContain("#16a34a"); // green for up
      expect(html).toContain("#dc2626"); // red for down
    });

    it("should render without chart (placeholder)", () => {
      const html = renderSlide("stats-chart", {
        title: "Overview",
        stats: [{ value: "100", label: "Total" }],
        chartPlaceholder: "Chart loading...",
      });
      expect(html).toContain("Chart loading...");
    });
  });

  // ═══════════════════════════════════════════════════════
  // chart-text
  // ═══════════════════════════════════════════════════════
  describe("chart-text", () => {
    it("should render chart + text analysis", () => {
      const html = renderSlide("chart-text", {
        title: "Анализ рынка",
        description: "Рынок демонстрирует устойчивый рост",
        bullets: [
          { title: "Рост 15%", description: "Среднегодовой темп роста за последние 5 лет" },
          { title: "Лидеры рынка", description: "Топ-3 компании контролируют 60% рынка" },
          { title: "Тренды", description: "Цифровизация и автоматизация" },
        ],
        chartSvg: "<svg><circle r='50'/></svg>",
        source: "McKinsey Report 2025",
      });
      expect(html).toContain("Анализ рынка");
      expect(html).toContain("Рост 15%");
      expect(html).toContain("<svg>");
      expect(html).toContain("McKinsey Report 2025");
    });

    it("should render without description", () => {
      const html = renderSlide("chart-text", {
        title: "Data Analysis",
        bullets: [
          { title: "Point 1", description: "Detail 1" },
        ],
      });
      expect(html).toContain("Data Analysis");
      expect(html).toContain("Point 1");
    });
  });

  // ═══════════════════════════════════════════════════════
  // hero-stat
  // ═══════════════════════════════════════════════════════
  describe("hero-stat", () => {
    it("should render giant stat on accent panel + supporting stats", () => {
      const html = renderSlide("hero-stat", {
        title: "Ключевой результат",
        mainStat: {
          value: "47%",
          label: "Рост выручки",
          description: "Год к году",
        },
        supportingStats: [
          { value: "₽2.4 млрд", label: "Общая выручка", description: "За 2025 год" },
          { value: "1,240", label: "Новых клиентов", description: "За Q4" },
          { value: "99.9%", label: "Аптайм", description: "SLA выполнен" },
        ],
        callout: "Рост обусловлен запуском нового продукта в Q3 2025",
      });
      expect(html).toContain("47%");
      expect(html).toContain("Рост выручки");
      expect(html).toContain("Год к году");
      expect(html).toContain("₽2.4 млрд");
      expect(html).toContain("1,240");
      expect(html).toContain("99.9%");
      expect(html).toContain("Рост обусловлен запуском");
    });

    it("should render without callout", () => {
      const html = renderSlide("hero-stat", {
        title: "Revenue",
        mainStat: { value: "$10M", label: "ARR" },
        supportingStats: [{ value: "200", label: "Customers" }],
      });
      expect(html).toContain("$10M");
      expect(html).toContain("ARR");
      expect(html).not.toContain("callout");
    });

    it("should have accent gradient background on left panel", () => {
      const html = renderSlide("hero-stat", {
        title: "Test",
        mainStat: { value: "1", label: "L" },
        supportingStats: [],
      });
      expect(html).toContain("slide-bg-accent-gradient");
    });
  });

  // ═══════════════════════════════════════════════════════
  // scenario-cards
  // ═══════════════════════════════════════════════════════
  describe("scenario-cards", () => {
    it("should render 3 scenario cards with colors", () => {
      const html = renderSlide("scenario-cards", {
        title: "Сценарный анализ",
        description: "Три сценария развития",
        scenarios: [
          {
            label: "Оптимистичный",
            title: "Быстрый рост",
            value: "+25%",
            points: ["Рост рынка", "Новые клиенты", "Экспансия"],
            color: "#16a34a",
            probability: "30%",
          },
          {
            label: "Базовый",
            title: "Стабильный рост",
            value: "+10%",
            points: ["Удержание доли", "Оптимизация"],
            color: "#2563eb",
            probability: "50%",
          },
          {
            label: "Пессимистичный",
            title: "Стагнация",
            value: "-5%",
            points: ["Потеря клиентов", "Сокращение"],
            color: "#dc2626",
            probability: "20%",
          },
        ],
      });
      expect(html).toContain("Сценарный анализ");
      expect(html).toContain("Оптимистичный");
      expect(html).toContain("Быстрый рост");
      expect(html).toContain("+25%");
      expect(html).toContain("Рост рынка");
      expect(html).toContain("30%");
      expect(html).toContain("#16a34a");
      expect(html).toContain("#2563eb");
      expect(html).toContain("#dc2626");
    });

    it("should render without probability and value", () => {
      const html = renderSlide("scenario-cards", {
        title: "Options",
        scenarios: [
          { label: "A", title: "Option A", points: ["Point 1"], color: "#3b82f6" },
          { label: "B", title: "Option B", points: ["Point 2"], color: "#ef4444" },
        ],
      });
      expect(html).toContain("Option A");
      expect(html).toContain("Option B");
    });
  });

  // ═══════════════════════════════════════════════════════
  // numbered-steps-v2
  // ═══════════════════════════════════════════════════════
  describe("numbered-steps-v2", () => {
    it("should render vertical steps with circles and results", () => {
      const html = renderSlide("numbered-steps-v2", {
        title: "Методология внедрения",
        steps: [
          { number: 1, title: "Аудит", description: "Анализ текущих процессов", result: "2 недели" },
          { number: 2, title: "Проектирование", description: "Разработка архитектуры решения", result: "4 недели" },
          { number: 3, title: "Внедрение", description: "Поэтапная интеграция", result: "8 недель" },
          { number: 4, title: "Тестирование", description: "QA и приёмочные тесты" },
          { number: 5, title: "Запуск", description: "Переход в продакшн", result: "Go Live" },
        ],
      });
      expect(html).toContain("Методология внедрения");
      expect(html).toContain("Аудит");
      expect(html).toContain("2 недели");
      expect(html).toContain("Проектирование");
      expect(html).toContain("4 недели");
      expect(html).toContain("Go Live");
    });

    it("should have first step with filled circle", () => {
      const html = renderSlide("numbered-steps-v2", {
        title: "Steps",
        steps: [
          { number: 1, title: "First" },
          { number: 2, title: "Second" },
          { number: 3, title: "Third" },
        ],
      });
      // First step should have primary accent color background
      expect(html).toContain("var(--primary-accent-color");
    });

    it("should render connector lines between steps", () => {
      const html = renderSlide("numbered-steps-v2", {
        title: "Process",
        steps: [
          { number: 1, title: "A" },
          { number: 2, title: "B" },
        ],
      });
      // Connector line between steps
      expect(html).toContain("width: 1px");
    });
  });

  // ═══════════════════════════════════════════════════════
  // timeline-horizontal
  // ═══════════════════════════════════════════════════════
  describe("timeline-horizontal", () => {
    it("should render horizontal timeline with events", () => {
      const html = renderSlide("timeline-horizontal", {
        title: "История компании",
        description: "Ключевые вехи развития",
        events: [
          { date: "2020", title: "Основание", description: "Запуск стартапа" },
          { date: "2021", title: "Seed раунд", description: "$2M инвестиций", highlight: true },
          { date: "2022", title: "Series A", description: "$15M инвестиций" },
          { date: "2023", title: "Масштабирование", description: "1000+ клиентов" },
          { date: "2024", title: "IPO", description: "Выход на биржу", highlight: true },
        ],
      });
      expect(html).toContain("История компании");
      expect(html).toContain("2020");
      expect(html).toContain("Основание");
      expect(html).toContain("Seed раунд");
      expect(html).toContain("IPO");
    });

    it("should have a horizontal line connecting events", () => {
      const html = renderSlide("timeline-horizontal", {
        title: "Timeline",
        events: [
          { date: "Q1", title: "Start" },
          { date: "Q2", title: "Mid" },
          { date: "Q3", title: "End" },
        ],
      });
      // Should have the horizontal line gradient
      expect(html).toContain("linear-gradient(90deg");
    });

    it("should highlight specific events", () => {
      const html = renderSlide("timeline-horizontal", {
        title: "Events",
        events: [
          { date: "Jan", title: "Normal" },
          { date: "Jun", title: "Key Event", highlight: true },
        ],
      });
      // Highlighted events should have filled dot
      expect(html).toContain("var(--primary-accent-color");
    });
  });

  // ═══════════════════════════════════════════════════════
  // text-with-callout
  // ═══════════════════════════════════════════════════════
  describe("text-with-callout", () => {
    it("should render bullets + callout bar", () => {
      const html = renderSlide("text-with-callout", {
        title: "Ключевые выводы",
        bullets: [
          { title: "Рост рынка", description: "Рынок вырос на 15% за последний год" },
          { title: "Конкуренция", description: "Усиление конкуренции в сегменте" },
          { title: "Технологии", description: "AI-решения становятся стандартом" },
          { title: "Регулирование", description: "Новые требования к данным" },
        ],
        callout: "Вывод: компании, инвестирующие в AI, показывают рост на 40% быстрее конкурентов",
        source: "Исследование BCG, 2025",
      });
      expect(html).toContain("Ключевые выводы");
      expect(html).toContain("Рост рынка");
      expect(html).toContain("Конкуренция");
      expect(html).toContain("инвестирующие в AI");
      expect(html).toContain("Исследование BCG, 2025");
    });

    it("should render without callout and source", () => {
      const html = renderSlide("text-with-callout", {
        title: "Points",
        bullets: [
          { title: "A", description: "Detail A" },
          { title: "B", description: "Detail B" },
          { title: "C", description: "Detail C" },
        ],
      });
      expect(html).toContain("Points");
      expect(html).toContain("Detail A");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Footer integration with new layouts
  // ═══════════════════════════════════════════════════════
  describe("Footer integration", () => {
    it("should add footer to all new layouts", () => {
      const newLayouts = [
        "stats-chart",
        "chart-text",
        "hero-stat",
        "scenario-cards",
        "numbered-steps-v2",
        "timeline-horizontal",
        "text-with-callout",
      ];

      for (const layout of newLayouts) {
        const html = renderSlide(layout, {
          title: "Test",
          _slideNumber: 5,
          _totalSlides: 15,
          _presentationTitle: "Test Deck",
          stats: [{ value: "1", label: "L" }],
          bullets: [{ title: "B", description: "D" }, { title: "B2", description: "D2" }, { title: "B3", description: "D3" }],
          mainStat: { value: "1", label: "L" },
          supportingStats: [],
          scenarios: [{ label: "A", title: "T", points: ["P"], color: "#333" }],
          steps: [{ number: 1, title: "S", description: "D" }, { number: 2, title: "S2", description: "D2" }, { number: 3, title: "S3", description: "D3" }],
          events: [{ date: "Q1", title: "E" }, { date: "Q2", title: "E2" }, { date: "Q3", title: "E3" }],
        });
        expect(html).toContain("slide-footer");
        expect(html).toContain("5 / 15");
        expect(html).toContain("Test Deck");
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // Auto-density integration
  // ═══════════════════════════════════════════════════════
  describe("Auto-density integration", () => {
    it("should estimate height for stats-chart", () => {
      const height = estimateContentHeight("stats-chart", {
        title: "Metrics",
        stats: [
          { value: "1", label: "A" },
          { value: "2", label: "B" },
          { value: "3", label: "C" },
        ],
      }, "normal");
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThan(1000);
    });

    it("should estimate height for hero-stat", () => {
      const height = estimateContentHeight("hero-stat", {
        title: "Key Metric",
        mainStat: { value: "47%", label: "Growth" },
        supportingStats: [
          { value: "1", label: "A" },
          { value: "2", label: "B" },
        ],
      }, "normal");
      expect(height).toBeGreaterThan(0);
    });

    it("should estimate height for scenario-cards", () => {
      const height = estimateContentHeight("scenario-cards", {
        title: "Scenarios",
        scenarios: [
          { points: ["a", "b", "c"], color: "#333" },
          { points: ["d", "e"], color: "#666" },
        ],
      }, "normal");
      expect(height).toBeGreaterThan(0);
    });

    it("should estimate height for numbered-steps-v2", () => {
      const height = estimateContentHeight("numbered-steps-v2", {
        title: "Steps",
        steps: [
          { title: "Step 1", description: "Description 1" },
          { title: "Step 2", description: "Description 2" },
          { title: "Step 3", description: "Description 3" },
        ],
      }, "normal");
      expect(height).toBeGreaterThan(0);
    });

    it("should estimate height for text-with-callout", () => {
      const height = estimateContentHeight("text-with-callout", {
        title: "Points",
        bullets: [
          { title: "A", description: "Detail A" },
          { title: "B", description: "Detail B" },
        ],
        callout: "Key takeaway",
        source: "Source",
      }, "normal");
      expect(height).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // New Themes
  // ═══════════════════════════════════════════════════════
  describe("New Themes", () => {
    it("should have executive_navy_red theme", () => {
      const theme = getThemePreset("executive_navy_red");
      expect(theme).toBeDefined();
      expect(theme!.name).toContain("Navy");
    });

    it("should have data_navy_blue theme", () => {
      const theme = getThemePreset("data_navy_blue");
      expect(theme).toBeDefined();
      expect(theme!.name).toContain("Navy");
    });

    it("executive_navy_red theme should have correct primary colors", () => {
      const theme = getThemePreset("executive_navy_red");
      expect(theme!.cssVariables).toContain("--primary-accent-color");
    });

    it("data_navy_blue theme should have correct primary colors", () => {
      const theme = getThemePreset("data_navy_blue");
      expect(theme!.cssVariables).toContain("--primary-accent-color");
    });
  });
});
