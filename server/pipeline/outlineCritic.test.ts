/**
 * Tests for Outline Critic Agent
 * Covers: local structure validation, score calculation, and edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  validateOutlineStructure,
  calculateLocalScore,
  type CritiqueIssue,
} from "./outlineCritic";
import type { OutlineResult } from "./generator";

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function makeOutline(overrides: Partial<OutlineResult> = {}): OutlineResult {
  return {
    presentation_title: "AI Strategy for Enterprise Growth",
    target_audience: "C-level executives and technology leaders",
    narrative_arc: "Problem-Solution: Current challenges → AI opportunity → Implementation roadmap",
    slides: [
      { slide_number: 1, title: "AI Strategy for Enterprise Growth", purpose: "Title slide — opening", key_points: ["Company name", "Date", "Presenter"], speaker_notes_hint: "Welcome" },
      { slide_number: 2, title: "The Challenge", purpose: "Context — problem framing", key_points: ["Market disruption", "Legacy systems", "Competitive pressure"], speaker_notes_hint: "Set the stage" },
      { slide_number: 3, title: "Market Opportunity", purpose: "Section header — transition to opportunity", key_points: ["$190B market", "40% CAGR"], speaker_notes_hint: "Transition" },
      { slide_number: 4, title: "Our AI Platform", purpose: "Core — solution overview", key_points: ["Architecture", "Key features", "Integration", "Security"], speaker_notes_hint: "Present solution" },
      { slide_number: 5, title: "Implementation Roadmap", purpose: "Core — timeline", key_points: ["Phase 1: Pilot", "Phase 2: Scale", "Phase 3: Optimize"], speaker_notes_hint: "Show timeline" },
      { slide_number: 6, title: "Expected Results", purpose: "Evidence — ROI data", key_points: ["Cost reduction 40%", "Revenue growth 25%", "Efficiency 3x"], speaker_notes_hint: "Data" },
      { slide_number: 7, title: "Case Studies", purpose: "Evidence — social proof", key_points: ["Client A results", "Client B results", "Industry benchmarks"], speaker_notes_hint: "Proof" },
      { slide_number: 8, title: "Next Steps", purpose: "Conclusion — call to action", key_points: ["Schedule pilot", "Assign team", "Set KPIs"], speaker_notes_hint: "CTA" },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// validateOutlineStructure
// ═══════════════════════════════════════════════════════

describe("validateOutlineStructure", () => {
  it("returns no errors for a well-structured outline", () => {
    const outline = makeOutline();
    const issues = validateOutlineStructure(outline);
    // Should have at most suggestions, no errors
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("detects too few slides", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Content", purpose: "Content", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 3, title: "End", purpose: "Conclusion", key_points: ["a", "b"], speaker_notes_hint: "" },
      ],
    });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("Too few slides"))).toBe(true);
  });

  it("warns about too many slides", () => {
    const slides = Array.from({ length: 22 }, (_, i) => ({
      slide_number: i + 1,
      title: `Slide ${i + 1}`,
      purpose: i === 0 ? "Title" : i === 21 ? "Conclusion" : "Content",
      key_points: ["Point A", "Point B", "Point C"],
      speaker_notes_hint: "",
    }));
    const outline = makeOutline({ slides });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("Too many slides"))).toBe(true);
  });

  it("detects duplicate slide titles", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Introduction", purpose: "Title", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Market Analysis", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 3, title: "Market Analysis", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 4, title: "Results", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 5, title: "Conclusion", purpose: "Conclusion", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
      ],
    });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "error" && i.aspect === "mece" && i.message.includes("Duplicate"))).toBe(true);
  });

  it("warns about slides with too few key points", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title", key_points: ["a"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Content", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 3, title: "Sparse", purpose: "Content", key_points: ["only one"], speaker_notes_hint: "" },
        { slide_number: 4, title: "More", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 5, title: "End", purpose: "Conclusion", key_points: ["a", "b"], speaker_notes_hint: "" },
      ],
    });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "warning" && i.aspect === "content" && i.message.includes("key point"))).toBe(true);
  });

  it("detects numbering gaps", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Content", purpose: "Content", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 4, title: "Skipped", purpose: "Content", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 5, title: "More", purpose: "Content", key_points: ["a", "b"], speaker_notes_hint: "" },
        { slide_number: 6, title: "End", purpose: "Conclusion", key_points: ["a", "b"], speaker_notes_hint: "" },
      ],
    });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("numbering gap"))).toBe(true);
  });

  it("warns about missing last slide as conclusion", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title slide", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Content A", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 3, title: "Content B", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 4, title: "Content C", purpose: "Content", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
        { slide_number: 5, title: "Random Topic", purpose: "Just another slide", key_points: ["a", "b", "c"], speaker_notes_hint: "" },
      ],
    });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("conclusion"))).toBe(true);
  });

  it("suggests section headers for long presentations", () => {
    const slides = Array.from({ length: 10 }, (_, i) => ({
      slide_number: i + 1,
      title: `Slide ${i + 1}`,
      purpose: i === 0 ? "Title" : i === 9 ? "Conclusion" : "Content detail",
      key_points: ["a", "b", "c"],
      speaker_notes_hint: "",
    }));
    const outline = makeOutline({ slides });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "suggestion" && i.message.includes("section"))).toBe(true);
  });

  it("warns about missing narrative arc", () => {
    const outline = makeOutline({ narrative_arc: "" });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "warning" && i.aspect === "narrative")).toBe(true);
  });

  it("warns about missing target audience", () => {
    const outline = makeOutline({ target_audience: "" });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "warning" && i.aspect === "content" && i.message.includes("audience"))).toBe(true);
  });

  it("handles empty slides array", () => {
    const outline = makeOutline({ slides: [] });
    const issues = validateOutlineStructure(outline);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("Too few"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// calculateLocalScore
// ═══════════════════════════════════════════════════════

describe("calculateLocalScore", () => {
  it("returns 10 for no issues", () => {
    expect(calculateLocalScore([])).toBe(10);
  });

  it("deducts 2 per error", () => {
    const issues: CritiqueIssue[] = [
      { severity: "error", aspect: "structure", message: "test", affected_slides: [] },
    ];
    expect(calculateLocalScore(issues)).toBe(8);
  });

  it("deducts 1 per warning", () => {
    const issues: CritiqueIssue[] = [
      { severity: "warning", aspect: "content", message: "test", affected_slides: [] },
      { severity: "warning", aspect: "balance", message: "test", affected_slides: [] },
    ];
    expect(calculateLocalScore(issues)).toBe(8);
  });

  it("deducts 0.3 per suggestion", () => {
    const issues: CritiqueIssue[] = [
      { severity: "suggestion", aspect: "balance", message: "test", affected_slides: [] },
    ];
    expect(calculateLocalScore(issues)).toBe(9.7);
  });

  it("never goes below 1", () => {
    const issues: CritiqueIssue[] = Array.from({ length: 10 }, () => ({
      severity: "error" as const,
      aspect: "structure",
      message: "test",
      affected_slides: [],
    }));
    expect(calculateLocalScore(issues)).toBe(1);
  });

  it("handles mixed severity correctly", () => {
    const issues: CritiqueIssue[] = [
      { severity: "error", aspect: "structure", message: "test", affected_slides: [] },
      { severity: "warning", aspect: "content", message: "test", affected_slides: [] },
      { severity: "suggestion", aspect: "balance", message: "test", affected_slides: [] },
    ];
    // 10 - 2 - 1 - 0.3 = 6.7
    expect(calculateLocalScore(issues)).toBe(6.7);
  });
});

// ═══════════════════════════════════════════════════════
// Integration: well-formed outline should pass
// ═══════════════════════════════════════════════════════

describe("Well-formed outline validation", () => {
  it("a good 8-slide outline with sections passes with high score", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "AI Strategy", purpose: "Title slide", key_points: ["Company", "Date", "Speaker"], speaker_notes_hint: "" },
        { slide_number: 2, title: "The Challenge", purpose: "Context", key_points: ["Market disruption", "Legacy costs", "Competition"], speaker_notes_hint: "" },
        { slide_number: 3, title: "Section: Opportunity", purpose: "Section divider", key_points: ["Transition to opportunity"], speaker_notes_hint: "" },
        { slide_number: 4, title: "Market Size", purpose: "Evidence", key_points: ["$190B TAM", "40% CAGR", "Key segments"], speaker_notes_hint: "" },
        { slide_number: 5, title: "Our Solution", purpose: "Core", key_points: ["Platform", "Features", "Integration", "Security"], speaker_notes_hint: "" },
        { slide_number: 6, title: "Section: Results", purpose: "Section divider", key_points: ["Transition to results"], speaker_notes_hint: "" },
        { slide_number: 7, title: "ROI Analysis", purpose: "Evidence", key_points: ["Cost savings", "Revenue growth", "Efficiency"], speaker_notes_hint: "" },
        { slide_number: 8, title: "Next Steps", purpose: "Conclusion and call to action", key_points: ["Pilot plan", "Team", "Timeline"], speaker_notes_hint: "" },
      ],
    });

    const issues = validateOutlineStructure(outline);
    const score = calculateLocalScore(issues);
    expect(score).toBeGreaterThanOrEqual(8);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("a minimal 5-slide outline passes without errors", () => {
    const outline = makeOutline({
      slides: [
        { slide_number: 1, title: "Welcome", purpose: "Title slide", key_points: ["Topic", "Speaker"], speaker_notes_hint: "" },
        { slide_number: 2, title: "Problem", purpose: "Context", key_points: ["Issue A", "Issue B", "Issue C"], speaker_notes_hint: "" },
        { slide_number: 3, title: "Solution", purpose: "Core", key_points: ["Approach", "Benefits", "Timeline"], speaker_notes_hint: "" },
        { slide_number: 4, title: "Evidence", purpose: "Data", key_points: ["Metric 1", "Metric 2", "Metric 3"], speaker_notes_hint: "" },
        { slide_number: 5, title: "Summary", purpose: "Conclusion", key_points: ["Key takeaway", "Next steps"], speaker_notes_hint: "" },
      ],
    });

    const issues = validateOutlineStructure(outline);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
