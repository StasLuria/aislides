/**
 * Tests for Speaker Coach Agent
 * Covers: note application, similarity detection, timing validation,
 * and basic note generation fallback.
 */
import { describe, it, expect } from "vitest";
import {
  applySpeakerNotes,
  calculateNoteSimilarity,
  validateTiming,
  type SpeakerNote,
  type SpeakerCoachResult,
} from "./speakerCoachAgent";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function makeSlide(num: number, title: string, text: string = "", notes: string = ""): SlideContent {
  return {
    slide_number: num,
    title,
    text,
    notes,
    data_points: [],
    key_message: `Key message for ${title}`,
  };
}

function makeNote(num: number, overrides: Partial<SpeakerNote> = {}): SpeakerNote {
  return {
    slide_number: num,
    talking_points: [
      "This is the first talking point expanding on the content",
      "Here's a second point with additional context",
      "And a third point with a real-world example",
    ],
    transition_to_next: "Building on this, let's look at...",
    timing_seconds: 60,
    engagement_cue: "Ask the audience: How many of you have experienced this?",
    delivery_tip: "Maintain eye contact and speak with confidence",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// applySpeakerNotes
// ═══════════════════════════════════════════════════════

describe("applySpeakerNotes", () => {
  it("enriches slide notes with all speaker coach fields", () => {
    const content: SlideContent[] = [makeSlide(1, "Introduction", "Welcome text")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { timing_seconds: 45 })],
      total_estimated_minutes: 1,
      general_advice: "Practice twice before presenting",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).toContain("⏱");
    expect(result[0].notes).toContain("45 сек");
    expect(result[0].notes).toContain("💡");
    expect(result[0].notes).toContain("📝 Ключевые тезисы:");
    expect(result[0].notes).toContain("1.");
    expect(result[0].notes).toContain("2.");
    expect(result[0].notes).toContain("3.");
    expect(result[0].notes).toContain("🎯");
    expect(result[0].notes).toContain("➡️ Переход:");
  });

  it("preserves existing notes and appends coach notes", () => {
    const content: SlideContent[] = [
      makeSlide(1, "Title", "", "[Переход] Building on the introduction"),
    ];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1)],
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).toContain("[Переход] Building on the introduction");
    expect(result[0].notes).toContain("---"); // separator
    expect(result[0].notes).toContain("📝 Ключевые тезисы:");
  });

  it("formats timing correctly for minutes + seconds", () => {
    const content: SlideContent[] = [makeSlide(1, "Data Slide")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { timing_seconds: 90 })],
      total_estimated_minutes: 2,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).toContain("1 мин 30 сек");
  });

  it("formats timing correctly for exact minutes", () => {
    const content: SlideContent[] = [makeSlide(1, "Long Slide")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { timing_seconds: 120 })],
      total_estimated_minutes: 2,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).toContain("2 мин");
    // Should not have extra seconds
    expect(result[0].notes).not.toContain("2 мин 0 сек");
  });

  it("handles slides without matching coach notes", () => {
    const content: SlideContent[] = [
      makeSlide(1, "Title"),
      makeSlide(2, "Content"),
    ];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1)], // Only note for slide 1
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    // Slide 1 should be enriched
    expect(result[0].notes).toContain("📝");
    // Slide 2 should remain unchanged
    expect(result[1].notes).toBe("");
  });

  it("handles empty engagement cue gracefully", () => {
    const content: SlideContent[] = [makeSlide(1, "Title")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { engagement_cue: "" })],
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).not.toContain("🎯");
  });

  it("handles empty transition gracefully", () => {
    const content: SlideContent[] = [makeSlide(1, "Last Slide")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { transition_to_next: "" })],
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result[0].notes).not.toContain("➡️");
  });

  it("processes multiple slides correctly", () => {
    const content: SlideContent[] = [
      makeSlide(1, "Intro"),
      makeSlide(2, "Problem"),
      makeSlide(3, "Solution"),
    ];
    const coachResult: SpeakerCoachResult = {
      notes: [
        makeNote(1, { timing_seconds: 30 }),
        makeNote(2, { timing_seconds: 90 }),
        makeNote(3, { timing_seconds: 60 }),
      ],
      total_estimated_minutes: 3,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    expect(result).toHaveLength(3);
    expect(result[0].notes).toContain("30 сек");
    expect(result[1].notes).toContain("1 мин 30 сек");
    expect(result[2].notes).toContain("1 мин");
  });
});

// ═══════════════════════════════════════════════════════
// calculateNoteSimilarity
// ═══════════════════════════════════════════════════════

describe("calculateNoteSimilarity", () => {
  it("returns 0 for empty inputs", () => {
    expect(calculateNoteSimilarity("", "")).toBe(0);
    expect(calculateNoteSimilarity("some text", "")).toBe(0);
    expect(calculateNoteSimilarity("", "some text")).toBe(0);
  });

  it("returns high similarity for identical text", () => {
    const text = "The market is growing rapidly with significant opportunities ahead";
    const similarity = calculateNoteSimilarity(text, text);
    expect(similarity).toBeGreaterThan(0.8);
  });

  it("returns low similarity for different text", () => {
    const slideText = "Revenue increased by 40% in Q3 2025";
    const noteText = "This dramatic improvement demonstrates our competitive advantage in the enterprise segment";
    const similarity = calculateNoteSimilarity(slideText, noteText);
    expect(similarity).toBeLessThan(0.3);
  });

  it("returns moderate similarity for partially overlapping text", () => {
    const slideText = "AI platform reduces operational costs by 40%";
    const noteText = "Our AI platform has shown remarkable results, reducing costs significantly across all departments";
    const similarity = calculateNoteSimilarity(slideText, noteText);
    expect(similarity).toBeGreaterThan(0.1);
    expect(similarity).toBeLessThan(0.7);
  });

  it("ignores short words (3 chars or less)", () => {
    const slideText = "The AI is a big deal for us";
    const noteText = "The AI is a big deal for us but also";
    // Most words are 3 chars or less, so overlap should be based on "deal" only
    const similarity = calculateNoteSimilarity(slideText, noteText);
    expect(similarity).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════
// validateTiming
// ═══════════════════════════════════════════════════════

describe("validateTiming", () => {
  it("returns no issues for reasonable timing", () => {
    const notes: SpeakerNote[] = [
      makeNote(1, { timing_seconds: 30 }),
      makeNote(2, { timing_seconds: 90 }),
      makeNote(3, { timing_seconds: 60 }),
      makeNote(4, { timing_seconds: 90 }),
      makeNote(5, { timing_seconds: 30 }),
    ];

    const issues = validateTiming(notes);
    expect(issues).toHaveLength(0);
  });

  it("detects too-short timing", () => {
    const notes: SpeakerNote[] = [
      makeNote(1, { timing_seconds: 5 }),
      makeNote(2, { timing_seconds: 60 }),
    ];

    const issues = validateTiming(notes);
    expect(issues.some((i) => i.includes("too short"))).toBe(true);
  });

  it("detects too-long timing", () => {
    const notes: SpeakerNote[] = [
      makeNote(1, { timing_seconds: 60 }),
      makeNote(2, { timing_seconds: 400 }),
    ];

    const issues = validateTiming(notes);
    expect(issues.some((i) => i.includes("too long"))).toBe(true);
  });

  it("detects total time too long for slide count", () => {
    const notes: SpeakerNote[] = [
      makeNote(1, { timing_seconds: 250 }),
      makeNote(2, { timing_seconds: 250 }),
      makeNote(3, { timing_seconds: 250 }),
    ];
    // 750 seconds = 12.5 min for 3 slides → 4.17 min/slide > 3 min limit

    const issues = validateTiming(notes);
    expect(issues.some((i) => i.includes("too long") && i.includes("Total"))).toBe(true);
  });

  it("detects total time too short for slide count", () => {
    const notes: SpeakerNote[] = [
      makeNote(1, { timing_seconds: 10 }),
      makeNote(2, { timing_seconds: 10 }),
      makeNote(3, { timing_seconds: 10 }),
      makeNote(4, { timing_seconds: 10 }),
      makeNote(5, { timing_seconds: 10 }),
    ];
    // 50 seconds = 0.83 min for 5 slides → 0.17 min/slide < 0.3 min limit

    const issues = validateTiming(notes);
    expect(issues.some((i) => i.includes("too short") && i.includes("Total"))).toBe(true);
  });

  it("handles empty notes array", () => {
    const issues = validateTiming([]);
    expect(issues).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("applySpeakerNotes with empty coach result", () => {
    const content: SlideContent[] = [makeSlide(1, "Title")];
    const coachResult: SpeakerCoachResult = {
      notes: [],
      total_estimated_minutes: 0,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe(""); // Unchanged
  });

  it("applySpeakerNotes does not mutate original content", () => {
    const content: SlideContent[] = [makeSlide(1, "Title", "", "Original notes")];
    const originalNotes = content[0].notes;

    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1)],
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    // Result should be different from original
    expect(result[0].notes).not.toBe(originalNotes);
    // Original should be unchanged (applySpeakerNotes creates copies)
    expect(content[0].notes).toBe(originalNotes);
  });

  it("handles note with empty talking points", () => {
    const content: SlideContent[] = [makeSlide(1, "Title")];
    const coachResult: SpeakerCoachResult = {
      notes: [makeNote(1, { talking_points: [] })],
      total_estimated_minutes: 1,
      general_advice: "",
    };

    const result = applySpeakerNotes(content, coachResult);

    // Should still have timing and delivery tip
    expect(result[0].notes).toContain("⏱");
    expect(result[0].notes).toContain("💡");
    // Should not have talking points section
    expect(result[0].notes).not.toContain("📝 Ключевые тезисы:");
  });
});
