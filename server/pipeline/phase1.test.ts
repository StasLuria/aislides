/**
 * Phase 1 Quick Wins — Comprehensive Tests
 * Covers: 3-tier QA, Few-shot Writer, Content Density, Type Classification,
 * Layout CoT/Affinity, HTML Composer transitions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════
// Step 1.1: 3-Tier QA System
// ═══════════════════════════════════════════════════════
import { getQALevel, getQARetryBudget } from "./qaAgent";

describe("Step 1.1: 3-Tier QA System", () => {
  describe("getQALevel", () => {
    it("returns 'full' for title-slide", () => {
      expect(getQALevel("title-slide")).toBe("full");
    });
    it("returns 'full' for section-header", () => {
      expect(getQALevel("section-header")).toBe("full");
    });
    it("returns 'full' for final-slide", () => {
      expect(getQALevel("final-slide")).toBe("full");
    });
    it("returns 'content' for stats-chart", () => {
      expect(getQALevel("stats-chart")).toBe("content");
    });
    it("returns 'content' for comparison-table", () => {
      expect(getQALevel("comparison-table")).toBe("content");
    });
    it("returns 'content' for icons-numbers", () => {
      expect(getQALevel("icons-numbers")).toBe("content");
    });
    it("returns 'content' for table-slide", () => {
      expect(getQALevel("table-slide")).toBe("content");
    });
    it("returns 'content' for highlight-stats", () => {
      expect(getQALevel("highlight-stats")).toBe("content");
    });
    it("returns 'quick' for text-with-callout", () => {
      expect(getQALevel("text-with-callout")).toBe("quick");
    });
    it("returns 'full' for big-statement", () => {
      expect(getQALevel("big-statement")).toBe("full");
    });
    it("returns 'quick' for card-grid", () => {
      expect(getQALevel("card-grid")).toBe("quick");
    });
    it("returns 'quick' for unknown layouts", () => {
      expect(getQALevel("some-unknown-layout")).toBe("quick");
    });
  });

  describe("getQARetryBudget", () => {
    it("returns 1 for full level", () => {
      expect(getQARetryBudget("full")).toBe(1);
    });
    it("returns 1 for content level", () => {
      expect(getQARetryBudget("content")).toBe(1);
    });
    it("returns 0 for quick level", () => {
      expect(getQARetryBudget("quick")).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════
// Step 1.2: Few-Shot Examples in Writer Prompt
// ═══════════════════════════════════════════════════════
import { writerSystem } from "./prompts";

describe("Step 1.2: Few-Shot Examples in Writer Prompt", () => {
  const prompt = writerSystem("ru", "Test Presentation", "Slide 1, Slide 2", "Executives");

  it("contains few-shot examples section", () => {
    expect(prompt).toContain("few_shot_examples");
  });

  it("contains stat_cards example", () => {
    expect(prompt).toContain("stat_cards");
  });

  it("contains process_steps example", () => {
    expect(prompt).toContain("process_steps");
  });

  it("contains comparison example", () => {
    expect(prompt).toContain("comparison");
  });

  it("contains timeline example", () => {
    expect(prompt).toContain("timeline");
  });

  it("contains bullet_points example", () => {
    expect(prompt).toContain("bullet_points");
  });

  it("includes type hint when provided", () => {
    const promptWithHint = writerSystem("ru", "Test", "Slides", "Audience", "Use data-driven tone");
    expect(promptWithHint).toContain("Use data-driven tone");
  });

  it("does not include type hint section when not provided", () => {
    expect(prompt).not.toContain("PRESENTATION TYPE GUIDANCE");
  });
});

// ═══════════════════════════════════════════════════════
// Step 1.3: Content Density Validator (6×6 Rule)
// ═══════════════════════════════════════════════════════
import {
  enforceContentDensity,
  autoSplitSlide,
  enforceAllSlidesDensity,
  DEFAULT_LIMITS,
} from "./contentDensityValidator";

describe("Step 1.3: Content Density Validator", () => {
  describe("enforceContentDensity", () => {
    it("returns trimmed=false for content within limits", () => {
      const slide = {
        text: "Line 1\nLine 2\nLine 3",
        structured_content: {
          stat_cards: [{ title: "A", value: "1" }, { title: "B", value: "2" }],
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(false);
      expect(result.trimmedFields).toHaveLength(0);
    });

    it("trims stat_cards exceeding limit", () => {
      const slide = {
        structured_content: {
          stat_cards: Array(8).fill({ title: "Metric", value: "100" }),
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(result.trimmedFields).toContain("stat_cards");
      expect(slide.structured_content.stat_cards).toHaveLength(DEFAULT_LIMITS.maxStatCards);
    });

    it("trims process_steps exceeding limit", () => {
      const slide = {
        structured_content: {
          process_steps: Array(10).fill({ title: "Step", description: "Do something" }),
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(result.trimmedFields).toContain("process_steps");
      expect(slide.structured_content.process_steps).toHaveLength(DEFAULT_LIMITS.maxProcessSteps);
    });

    it("trims timeline_events exceeding limit", () => {
      const slide = {
        structured_content: {
          timeline_events: Array(10).fill({ title: "Event", description: "Happened" }),
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(slide.structured_content.timeline_events).toHaveLength(DEFAULT_LIMITS.maxTimelineEvents);
    });

    it("trims table rows and columns", () => {
      const slide = {
        structured_content: {
          table_data: {
            headers: Array(8).fill("Col"),
            rows: Array(10).fill(Array(8).fill("Data")),
          },
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(slide.structured_content.table_data.headers).toHaveLength(DEFAULT_LIMITS.maxTableCols);
      expect(slide.structured_content.table_data.rows).toHaveLength(DEFAULT_LIMITS.maxTableRows);
    });

    it("trims long bullet titles", () => {
      const slide = {
        structured_content: {
          bullet_points: [
            { title: "This is a very long title that exceeds the maximum number of allowed words in a single bullet", description: "Short" },
          ],
        },
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(result.trimmedFields).toContain("bullet_points_title");
    });

    it("handles missing structured_content gracefully", () => {
      const slide = { text: "Simple text" };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(false);
    });

    it("trims text bullets exceeding limit", () => {
      const slide = {
        text: Array(10).fill("• Bullet point").join("\n"),
        structured_content: {},
      };
      const result = enforceContentDensity(slide);
      expect(result.trimmed).toBe(true);
      expect(result.trimmedFields).toContain("text_bullets");
    });

    it("sets splitRequired when text bullets greatly exceed limit", () => {
      const slide = {
        text: Array(12).fill("• Bullet point").join("\n"),
        structured_content: {},
      };
      const result = enforceContentDensity(slide);
      expect(result.splitRequired).toBe(true);
    });
  });

  describe("autoSplitSlide", () => {
    it("returns single slide when bullets <= 6", () => {
      const slide = {
        slide_number: 1,
        title: "Test",
        text: "Line 1\nLine 2\nLine 3",
      };
      const result = autoSplitSlide(slide);
      expect(result).toHaveLength(1);
    });

    it("splits slide when bullets > 6", () => {
      const slide = {
        slide_number: 3,
        title: "Many Points",
        text: Array(10).fill("• Point").join("\n"),
      };
      const result = autoSplitSlide(slide);
      expect(result).toHaveLength(2);
      expect(result[0].title).toContain("(1/2)");
      expect(result[1].title).toContain("(2/2)");
    });

    it("splits bullets roughly evenly", () => {
      const slide = {
        slide_number: 1,
        title: "Test",
        text: Array(8).fill("• Point").join("\n"),
      };
      const result = autoSplitSlide(slide);
      const lines1 = result[0].text.split("\n").filter((l: string) => l.trim());
      const lines2 = result[1].text.split("\n").filter((l: string) => l.trim());
      expect(lines1.length).toBe(4);
      expect(lines2.length).toBe(4);
    });
  });

  describe("enforceAllSlidesDensity", () => {
    it("processes all slides and renumbers after split", () => {
      const slides = [
        { slide_number: 1, title: "Intro", text: "Short", structured_content: {} },
        { slide_number: 2, title: "Many", text: Array(12).fill("• Point").join("\n"), structured_content: {} },
        { slide_number: 3, title: "End", text: "Short", structured_content: {} },
      ];
      const result = enforceAllSlidesDensity(slides);
      // 12 bullets > 6+2=8, so splitRequired=true
      expect(result.totalSplit).toBeGreaterThanOrEqual(1);
      // After split, slides should be renumbered sequentially
      result.content.forEach((s, i) => {
        expect(s.slide_number).toBe(i + 1);
      });
    });

    it("returns 0 trimmed/split for clean content", () => {
      const slides = [
        { slide_number: 1, title: "A", text: "Line 1\nLine 2", structured_content: {} },
        { slide_number: 2, title: "B", text: "Line 1\nLine 2", structured_content: {} },
      ];
      const result = enforceAllSlidesDensity(slides);
      expect(result.totalTrimmed).toBe(0);
      expect(result.totalSplit).toBe(0);
      expect(result.content).toHaveLength(2);
    });
  });
});

// ═══════════════════════════════════════════════════════
// Step 1.4: Presentation Type Classification
// ═══════════════════════════════════════════════════════
import { classifyPresentation, getTypeProfile, getAllTypes } from "./presentationTypeClassifier";

describe("Step 1.4: Presentation Type Classification", () => {
  describe("classifyPresentation", () => {
    it("classifies investor-related prompts as investor_deck", () => {
      const result = classifyPresentation("Pitch deck для инвесторов Series A стартапа");
      expect(result.type).toBe("investor_deck");
    });

    it("classifies product-related prompts as product_pitch", () => {
      const result = classifyPresentation("Запуск нового SaaS продукта для клиентов");
      expect(result.type).toBe("product_pitch");
    });

    it("classifies quarterly review prompts", () => {
      const result = classifyPresentation("Квартальный отчет Q3 результаты KPI");
      expect(result.type).toBe("quarterly_review");
    });

    it("classifies educational prompts", () => {
      const result = classifyPresentation("Обучение: введение в машинное обучение курс");
      expect(result.type).toBe("educational");
    });

    it("classifies strategy prompts as business_strategy", () => {
      const result = classifyPresentation("Стратегия развития бизнеса на рынке");
      expect(result.type).toBe("business_strategy");
    });

    it("defaults to business_strategy for ambiguous prompts", () => {
      const result = classifyPresentation("Презентация о погоде");
      expect(result.type).toBe("business_strategy");
    });

    it("returns outlineHint in profile", () => {
      const result = classifyPresentation("Инвестиционный раунд");
      expect(result.outlineHint).toBeTruthy();
      expect(result.outlineHint.length).toBeGreaterThan(10);
    });

    it("returns writerHint in profile", () => {
      const result = classifyPresentation("Обучение основам Python");
      expect(result.writerHint).toBeTruthy();
      expect(result.writerHint).toContain("educational");
    });

    it("returns layoutHint in profile", () => {
      const result = classifyPresentation("Квартальный обзор за Q2");
      expect(result.layoutHint).toBeTruthy();
    });

    it("returns preferredLayouts", () => {
      const result = classifyPresentation("Pitch deck для инвесторов");
      expect(result.preferredLayouts).toBeInstanceOf(Array);
      expect(result.preferredLayouts.length).toBeGreaterThan(0);
    });
  });

  describe("getTypeProfile", () => {
    it("returns profile for known type", () => {
      const profile = getTypeProfile("educational");
      expect(profile.type).toBe("educational");
      expect(profile.label).toBe("Образовательная");
    });
  });

  describe("getAllTypes", () => {
    it("returns all 5 types", () => {
      const types = getAllTypes();
      expect(types).toHaveLength(5);
      expect(types).toContain("business_strategy");
      expect(types).toContain("product_pitch");
      expect(types).toContain("educational");
      expect(types).toContain("investor_deck");
      expect(types).toContain("quarterly_review");
    });
  });
});

// ═══════════════════════════════════════════════════════
// Step 1.5: Layout Agent CoT + Affinity Rules
// ═══════════════════════════════════════════════════════
import { layoutUser } from "./prompts";
import { LAYOUT_SYSTEM } from "./prompts";

describe("Step 1.5: Layout Agent Improvements", () => {
  it("LAYOUT_SYSTEM contains chain_of_thought instructions", () => {
    expect(LAYOUT_SYSTEM).toContain("chain_of_thought");
    expect(LAYOUT_SYSTEM).toContain("CONTENT TYPE");
    expect(LAYOUT_SYSTEM).toContain("SHAPE HINT");
    expect(LAYOUT_SYSTEM).toContain("VISUAL FIT");
    expect(LAYOUT_SYSTEM).toContain("DIVERSITY");
  });

  it("LAYOUT_SYSTEM contains shape_affinity_rules", () => {
    expect(LAYOUT_SYSTEM).toContain("shape_affinity_rules");
    expect(LAYOUT_SYSTEM).toContain("stat_cards");
    expect(LAYOUT_SYSTEM).toContain("process_steps");
    expect(LAYOUT_SYSTEM).toContain("comparison_two_sides");
    expect(LAYOUT_SYSTEM).toContain("timeline_events");
    expect(LAYOUT_SYSTEM).toContain("chart_with_context");
    expect(LAYOUT_SYSTEM).toContain("bullet_points");
  });

  it("layoutUser includes type hint when provided", () => {
    const user = layoutUser("Slide 1: Title", "Use data visualization layouts");
    expect(user).toContain("layout_type_hint");
    expect(user).toContain("Use data visualization layouts");
  });

  it("layoutUser works without type hint", () => {
    const user = layoutUser("Slide 1: Title");
    expect(user).not.toContain("layout_type_hint");
    expect(user).toContain("Slide 1: Title");
  });
});

// ═══════════════════════════════════════════════════════
// Step 1.6: HTML Composer Transition Phrases
// ═══════════════════════════════════════════════════════
import { htmlComposerUser, htmlComposerSystem, outlineUser } from "./prompts";

describe("Step 1.6: HTML Composer Improvements", () => {
  it("htmlComposerSystem contains transition instruction", () => {
    const system = htmlComposerSystem();
    expect(system).toContain("transition_phrase");
  });

  it("htmlComposerUser includes transition_phrase when provided", () => {
    const user = htmlComposerUser(
      "icons-numbers",
      "template code",
      "Slide Title",
      "Slide text",
      "Speaker notes",
      "Key message",
      "theme css",
      undefined,
      undefined,
      undefined,
      "А теперь перейдём к цифрам",
    );
    expect(user).toContain("transition_phrase");
    expect(user).toContain("А теперь перейдём к цифрам");
  });

  it("htmlComposerUser works without transition_phrase", () => {
    const user = htmlComposerUser(
      "icons-numbers",
      "template code",
      "Slide Title",
      "Slide text",
      "Speaker notes",
      "Key message",
      "theme css",
    );
    expect(user).not.toContain("transition_phrase");
  });

  describe("outlineUser with type hint", () => {
    it("includes type hint when provided", () => {
      const user = outlineUser("Topic", "branding", "Structure: Problem → Solution");
      expect(user).toContain("presentation_type_hint");
      expect(user).toContain("Structure: Problem → Solution");
    });

    it("works without type hint", () => {
      const user = outlineUser("Topic", "branding");
      expect(user).not.toContain("presentation_type_hint");
    });
  });
});
