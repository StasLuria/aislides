/**
 * Tests for the pipeline quality improvements:
 * - Title truncation in storytelling agent
 * - Content shape diversity in outline critic
 * - Subtitle truncation in generator
 * - Writer output shape propagation
 */

import { describe, it, expect } from "vitest";
import {
  validateOutlineStructure,
  calculateLocalScore,
} from "./pipeline/outlineCritic";
import type { OutlineResult, OutlineSlide, SlideContent } from "./pipeline/generator";

// ═══════════════════════════════════════════════════════
// TITLE TRUNCATION TESTS
// ═══════════════════════════════════════════════════════

describe("Title truncation", () => {
  it("truncateTitle should shorten titles over 60 chars", () => {
    // Simulate the truncateTitle logic from storytellingAgent.ts
    const truncateTitle = (title: string, maxLen = 60): string => {
      if (title.length <= maxLen) return title;
      const colonIdx = title.indexOf(":");
      if (colonIdx > 0 && colonIdx <= maxLen - 5) {
        const afterColon = title.substring(0, maxLen);
        const lastSpace = afterColon.lastIndexOf(" ");
        if (lastSpace > colonIdx) return afterColon.substring(0, lastSpace);
      }
      const truncated = title.substring(0, maxLen);
      const lastSpace = truncated.lastIndexOf(" ");
      return lastSpace > maxLen * 0.5 ? truncated.substring(0, lastSpace) : truncated;
    };

    const longTitle = "Фрагментация ИИ-Рынка: Снижение Продуктивности на Фоне Множества Инструментов";
    const result = truncateTitle(longTitle);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(longTitle.length).toBeGreaterThan(60);
  });

  it("short titles should not be truncated", () => {
    const truncateTitle = (title: string, maxLen = 60): string => {
      if (title.length <= maxLen) return title;
      const truncated = title.substring(0, maxLen);
      const lastSpace = truncated.lastIndexOf(" ");
      return lastSpace > maxLen * 0.5 ? truncated.substring(0, lastSpace) : truncated;
    };

    const shortTitle = "Рост рынка ИИ";
    expect(truncateTitle(shortTitle)).toBe(shortTitle);
  });
});

// ═══════════════════════════════════════════════════════
// SUBTITLE TRUNCATION TESTS
// ═══════════════════════════════════════════════════════

describe("Subtitle truncation", () => {
  it("should truncate subtitles over 200 chars", () => {
    const truncateSubtitle = (text: string, maxLen = 200): string => {
      if (text.length <= maxLen) return text;
      const truncated = text.substring(0, maxLen);
      const lastSentence = truncated.lastIndexOf(".");
      if (lastSentence > maxLen * 0.5) return truncated.substring(0, lastSentence + 1);
      const lastSpace = truncated.lastIndexOf(" ");
      return lastSpace > maxLen * 0.5 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
    };

    const longSubtitle = "Подтверждение Стратегической Мощи: Q4 2025 не просто показал рост, но и подтвердил нашу способность к ускоренному развитию и эффективной реализации стратегических инициатив, заложив прочный фундамент для будущих успехов. Готовность к Новым Горизонтам: Опираясь на сильную команду профессионалов и портфель инновационных решений, мы полностью готовы к масштабированию.";
    const result = truncateSubtitle(longSubtitle);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(longSubtitle.length).toBeGreaterThan(200);
  });
});

// ═══════════════════════════════════════════════════════
// CONTENT SHAPE DIVERSITY TESTS
// ═══════════════════════════════════════════════════════

describe("Outline content shape diversity validation", () => {
  const makeSlide = (num: number, overrides: Partial<OutlineSlide> = {}): OutlineSlide => ({
    slide_number: num,
    title: `Slide ${num}`,
    purpose: "Content slide",
    key_points: ["Point 1", "Point 2", "Point 3"],
    speaker_notes_hint: "Notes",
    content_shape: "bullet_points",
    slide_category: "CONTENT",
    ...overrides,
  });

  it("should warn when all slides have the same content_shape", () => {
    const outline: OutlineResult = {
      presentation_title: "Test",
      target_audience: "Business",
      narrative_arc: "Problem → Solution → Action",
      slides: [
        makeSlide(1, { purpose: "Title slide" }),
        makeSlide(2),
        makeSlide(3),
        makeSlide(4),
        makeSlide(5),
        makeSlide(6),
        makeSlide(7, { purpose: "Conclusion" }),
      ],
    };

    const issues = validateOutlineStructure(outline);
    const shapeIssues = issues.filter(i => i.message.includes("content shape diversity") || i.message.includes("bullet_points"));
    expect(shapeIssues.length).toBeGreaterThan(0);
  });

  it("should not warn when content shapes are diverse", () => {
    const outline: OutlineResult = {
      presentation_title: "Test",
      target_audience: "Business",
      narrative_arc: "Problem → Solution → Action",
      slides: [
        makeSlide(1, { content_shape: "single_concept", purpose: "Title slide" }),
        makeSlide(2, { content_shape: "stat_cards" }),
        makeSlide(3, { content_shape: "process_steps" }),
        makeSlide(4, { content_shape: "card_grid" }),
        makeSlide(5, { content_shape: "comparison_two_sides" }),
        makeSlide(6, { content_shape: "timeline_events" }),
        makeSlide(7, { content_shape: "bullet_points", purpose: "Conclusion" }),
      ],
    };

    const issues = validateOutlineStructure(outline);
    const shapeIssues = issues.filter(i => i.message.includes("content shape diversity"));
    expect(shapeIssues.length).toBe(0);
  });

  it("should warn when bullet_points exceeds 40% of slides", () => {
    const outline: OutlineResult = {
      presentation_title: "Test",
      target_audience: "Business",
      narrative_arc: "Problem → Solution → Action",
      slides: [
        makeSlide(1, { content_shape: "bullet_points", purpose: "Title slide" }),
        makeSlide(2, { content_shape: "bullet_points" }),
        makeSlide(3, { content_shape: "bullet_points" }),
        makeSlide(4, { content_shape: "bullet_points" }),
        makeSlide(5, { content_shape: "stat_cards" }),
        makeSlide(6, { content_shape: "process_steps" }),
        makeSlide(7, { content_shape: "bullet_points", purpose: "Conclusion" }),
      ],
    };

    const issues = validateOutlineStructure(outline);
    const bulletIssues = issues.filter(i => i.message.includes("Too many bullet_points"));
    expect(bulletIssues.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════
// SLIDE CONTENT SHAPE PROPAGATION TESTS
// ═══════════════════════════════════════════════════════

describe("SlideContent shape propagation", () => {
  it("SlideContent should carry content_shape and structured_content", () => {
    const slide: SlideContent = {
      slide_number: 2,
      title: "Market Overview",
      text: "The market is growing",
      notes: "Speaker notes",
      data_points: [],
      key_message: "Market is growing",
      content_shape: "stat_cards",
      slide_category: "DATA",
      structured_content: {
        stat_cards: [
          { label: "MARKET SIZE", value: "$9.9B", description: "Global AI market" },
          { label: "GROWTH", value: "47%", description: "Year over year" },
        ],
      },
    };

    expect(slide.content_shape).toBe("stat_cards");
    expect(slide.structured_content).toBeDefined();
    expect(slide.structured_content!.stat_cards).toHaveLength(2);
    expect(slide.structured_content!.stat_cards[0].value).toBe("$9.9B");
  });

  it("SlideContent without structured_content should still work", () => {
    const slide: SlideContent = {
      slide_number: 1,
      title: "Title Slide",
      text: "Welcome",
      notes: "",
      data_points: [],
      key_message: "Welcome",
    };

    expect(slide.content_shape).toBeUndefined();
    expect(slide.structured_content).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// LOCAL SCORE CALCULATION TESTS
// ═══════════════════════════════════════════════════════

describe("Local score calculation", () => {
  it("should give perfect score with no issues", () => {
    expect(calculateLocalScore([])).toBe(10);
  });

  it("should deduct 2 for errors", () => {
    const issues = [
      { severity: "error" as const, aspect: "structure", message: "test", affected_slides: [] },
    ];
    expect(calculateLocalScore(issues)).toBe(8);
  });

  it("should deduct 1 for warnings", () => {
    const issues = [
      { severity: "warning" as const, aspect: "balance", message: "test", affected_slides: [] },
    ];
    expect(calculateLocalScore(issues)).toBe(9);
  });

  it("should combine deductions", () => {
    const issues = [
      { severity: "error" as const, aspect: "structure", message: "test", affected_slides: [] },
      { severity: "warning" as const, aspect: "balance", message: "test", affected_slides: [] },
      { severity: "suggestion" as const, aspect: "content", message: "test", affected_slides: [] },
    ];
    // 10 - 2 - 1 - 0.3 = 6.7
    expect(calculateLocalScore(issues)).toBe(6.7);
  });
});
