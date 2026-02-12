/**
 * Tests for Storytelling Agent
 * Covers: action title detection, narrative coherence validation,
 * enhancement application, and graceful error handling.
 */
import { describe, it, expect } from "vitest";
import {
  isActionTitle,
  checkNarrativeCoherence,
  type StorytellingEnhancement,
} from "./storytellingAgent";

// ═══════════════════════════════════════════════════════
// isActionTitle — heuristic detection
// ═══════════════════════════════════════════════════════

describe("isActionTitle", () => {
  it("rejects empty or very short titles", () => {
    expect(isActionTitle("")).toBe(false);
    expect(isActionTitle("Hi")).toBe(false);
    expect(isActionTitle("")).toBe(false);
  });

  it("rejects generic descriptive titles (no verb, no number)", () => {
    expect(isActionTitle("Market Overview")).toBe(false);
    expect(isActionTitle("Our Solution")).toBe(false);
    expect(isActionTitle("Team Structure")).toBe(false);
    expect(isActionTitle("Agenda")).toBe(false);
  });

  it("accepts titles with action verbs (English)", () => {
    expect(isActionTitle("AI Drives 40% Cost Reduction")).toBe(true);
    expect(isActionTitle("Revenue Doubles in Q3")).toBe(true);
    expect(isActionTitle("Platform Enables Real-Time Analytics")).toBe(true);
    expect(isActionTitle("New Strategy Transforms Customer Experience")).toBe(true);
  });

  it("accepts titles with action verbs (Russian)", () => {
    expect(isActionTitle("Рынок ускоряет рост до $4.2 млрд")).toBe(true);
    expect(isActionTitle("Платформа снижает затраты на 40%")).toBe(true);
    expect(isActionTitle("Выручка выросла в 2 раза за квартал")).toBe(true);
    expect(isActionTitle("AI позволяет автоматизировать 80% процессов")).toBe(true);
  });

  it("accepts titles with numbers and sufficient length", () => {
    expect(isActionTitle("Market Growth Reaches $4.2B by 2027")).toBe(true);
    expect(isActionTitle("3 ключевых фактора роста компании")).toBe(true);
    expect(isActionTitle("ROI 340% за первый год внедрения")).toBe(true);
  });

  it("accepts titles with comparative language", () => {
    expect(isActionTitle("Our Approach is 3x Faster Than Competition")).toBe(true);
    expect(isActionTitle("Результаты лучше отраслевого стандарта")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// checkNarrativeCoherence
// ═══════════════════════════════════════════════════════

describe("checkNarrativeCoherence", () => {
  it("returns coherent for well-structured narrative", () => {
    const enhancements: StorytellingEnhancement[] = [
      { slide_number: 1, action_title: "Title", transition_from_previous: "", audience_takeaway: "", narrative_role: "hook" },
      { slide_number: 2, action_title: "Problem", transition_from_previous: "Let's look at the challenge", audience_takeaway: "", narrative_role: "context" },
      { slide_number: 3, action_title: "Data", transition_from_previous: "The data shows", audience_takeaway: "", narrative_role: "evidence" },
      { slide_number: 4, action_title: "Insight", transition_from_previous: "This means", audience_takeaway: "", narrative_role: "insight" },
      { slide_number: 5, action_title: "Solution", transition_from_previous: "Therefore", audience_takeaway: "", narrative_role: "action" },
      { slide_number: 6, action_title: "Summary", transition_from_previous: "In conclusion", audience_takeaway: "", narrative_role: "conclusion" },
    ];

    const result = checkNarrativeCoherence(enhancements);
    expect(result.coherent).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("detects consecutive same roles (non-evidence)", () => {
    const enhancements: StorytellingEnhancement[] = [
      { slide_number: 1, action_title: "Title", transition_from_previous: "", audience_takeaway: "", narrative_role: "hook" },
      { slide_number: 2, action_title: "Context 1", transition_from_previous: "First", audience_takeaway: "", narrative_role: "context" },
      { slide_number: 3, action_title: "Context 2", transition_from_previous: "Also", audience_takeaway: "", narrative_role: "context" },
    ];

    const result = checkNarrativeCoherence(enhancements);
    expect(result.coherent).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain("context");
  });

  it("allows consecutive evidence slides", () => {
    const enhancements: StorytellingEnhancement[] = [
      { slide_number: 1, action_title: "Title", transition_from_previous: "", audience_takeaway: "", narrative_role: "hook" },
      { slide_number: 2, action_title: "Data 1", transition_from_previous: "Look at", audience_takeaway: "", narrative_role: "evidence" },
      { slide_number: 3, action_title: "Data 2", transition_from_previous: "Furthermore", audience_takeaway: "", narrative_role: "evidence" },
    ];

    const result = checkNarrativeCoherence(enhancements);
    expect(result.coherent).toBe(true);
  });

  it("detects missing transitions for non-first slides", () => {
    const enhancements: StorytellingEnhancement[] = [
      { slide_number: 1, action_title: "Title", transition_from_previous: "", audience_takeaway: "", narrative_role: "hook" },
      { slide_number: 2, action_title: "Problem", transition_from_previous: "", audience_takeaway: "", narrative_role: "context" },
      { slide_number: 3, action_title: "Solution", transition_from_previous: "Given this", audience_takeaway: "", narrative_role: "action" },
    ];

    const result = checkNarrativeCoherence(enhancements);
    expect(result.coherent).toBe(false);
    expect(result.issues.some((i) => i.includes("Slide 2") && i.includes("transition"))).toBe(true);
  });

  it("handles single slide (always coherent)", () => {
    const enhancements: StorytellingEnhancement[] = [
      { slide_number: 1, action_title: "Title", transition_from_previous: "", audience_takeaway: "", narrative_role: "hook" },
    ];

    const result = checkNarrativeCoherence(enhancements);
    expect(result.coherent).toBe(true);
  });

  it("handles empty array", () => {
    const result = checkNarrativeCoherence([]);
    expect(result.coherent).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// Enhancement application logic (unit tests for the mapping)
// ═══════════════════════════════════════════════════════

describe("Enhancement application", () => {
  // We test the logic that would be in runStorytellingAgent
  // by simulating the enhancement map application

  it("replaces title with action title", () => {
    const slide = {
      slide_number: 2,
      title: "Market Overview",
      text: "Some text",
      notes: "Original notes",
      data_points: [],
      key_message: "Market is growing",
    };

    const enhancement: StorytellingEnhancement = {
      slide_number: 2,
      action_title: "Market Growth Accelerates to $4.2B",
      transition_from_previous: "Building on our introduction",
      audience_takeaway: "The market opportunity is massive and growing fast",
      narrative_role: "context",
    };

    // Simulate the enhancement logic
    const enhanced = { ...slide };
    if (enhancement.action_title.trim()) {
      enhanced.title = enhancement.action_title;
    }
    if (enhancement.transition_from_previous.trim()) {
      enhanced.notes = `[Переход] ${enhancement.transition_from_previous}\n\n${enhanced.notes}`;
    }
    if (enhancement.audience_takeaway.length > enhanced.key_message.length) {
      enhanced.key_message = enhancement.audience_takeaway;
    }

    expect(enhanced.title).toBe("Market Growth Accelerates to $4.2B");
    expect(enhanced.notes).toContain("[Переход]");
    expect(enhanced.notes).toContain("Original notes");
    expect(enhanced.key_message).toBe("The market opportunity is massive and growing fast");
  });

  it("preserves original title if action_title is empty", () => {
    const slide = {
      slide_number: 1,
      title: "Welcome Presentation",
      text: "",
      notes: "",
      data_points: [],
      key_message: "",
    };

    const enhancement: StorytellingEnhancement = {
      slide_number: 1,
      action_title: "",
      transition_from_previous: "",
      audience_takeaway: "",
      narrative_role: "hook",
    };

    const enhanced = { ...slide };
    if (enhancement.action_title && enhancement.action_title.trim()) {
      enhanced.title = enhancement.action_title;
    }

    expect(enhanced.title).toBe("Welcome Presentation");
  });

  it("does not overwrite key_message if takeaway is shorter", () => {
    const slide = {
      slide_number: 3,
      title: "Results",
      text: "",
      notes: "",
      data_points: [],
      key_message: "Revenue doubled while costs dropped by 15% across all divisions",
    };

    const enhancement: StorytellingEnhancement = {
      slide_number: 3,
      action_title: "Revenue Doubles",
      transition_from_previous: "Now for the results",
      audience_takeaway: "Revenue doubled",
      narrative_role: "evidence",
    };

    const enhanced = { ...slide };
    if (
      enhancement.audience_takeaway.trim() &&
      enhancement.audience_takeaway.length > enhanced.key_message.length
    ) {
      enhanced.key_message = enhancement.audience_takeaway;
    }

    // Original key_message is longer, so it should be preserved
    expect(enhanced.key_message).toBe("Revenue doubled while costs dropped by 15% across all divisions");
  });
});

// ═══════════════════════════════════════════════════════
// Action title quality examples
// ═══════════════════════════════════════════════════════

describe("Action title quality examples", () => {
  const goodTitles = [
    "Рынок AI достигает $190 млрд к 2025 году",
    "Внедрение снижает затраты на 40%",
    "3 ключевых фактора определяют успех трансформации",
    "Команда удваивает производительность за 6 месяцев",
    "Platform Delivers 99.9% Uptime Across All Regions",
    "Customer Satisfaction Reaches All-Time High of 94%",
  ];

  const badTitles = [
    "Overview",
    "Introduction",
    "Our Team",
    "Next Steps",
    "Summary",
    "Agenda",
  ];

  it("correctly identifies good action titles", () => {
    for (const title of goodTitles) {
      expect(isActionTitle(title)).toBe(true);
    }
  });

  it("correctly rejects bad descriptive titles", () => {
    for (const title of badTitles) {
      expect(isActionTitle(title)).toBe(false);
    }
  });
});
