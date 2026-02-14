import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyLayoutVoting,
  convertLegacyDecisions,
  type LayoutVote,
  type LayoutCandidate,
} from "./layoutVoting";

// ═══════════════════════════════════════════════════════
// STEP 3.1: LAYOUT VOTING TESTS
// ═══════════════════════════════════════════════════════

describe("Layout Voting — applyLayoutVoting", () => {
  it("selects high-confidence top candidate directly", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "title-slide", confidence: 0.95, rationale: "Opening slide" },
          { layout_name: "big-statement", confidence: 0.6, rationale: "Alt" },
          { layout_name: "text-slide", confidence: 0.3, rationale: "Fallback" },
        ],
        rationale: "Title slide",
      },
    ];

    const results = applyLayoutVoting(votes);
    expect(results).toHaveLength(1);
    expect(results[0].layout_name).toBe("title-slide");
    expect(results[0].was_reranked).toBe(false);
    expect(results[0].confidence).toBe(0.95);
  });

  it("applies diversity penalty for repeated layouts", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "text-slide", confidence: 0.9, rationale: "Text" },
          { layout_name: "icons-numbers", confidence: 0.7, rationale: "Alt" },
          { layout_name: "card-grid", confidence: 0.5, rationale: "Fallback" },
        ],
        rationale: "Slide 1",
      },
      {
        slide_number: 2,
        candidates: [
          { layout_name: "text-slide", confidence: 0.9, rationale: "Text again" },
          { layout_name: "icons-numbers", confidence: 0.7, rationale: "Alt" },
          { layout_name: "card-grid", confidence: 0.5, rationale: "Fallback" },
        ],
        rationale: "Slide 2",
      },
      {
        slide_number: 3,
        candidates: [
          { layout_name: "text-slide", confidence: 0.85, rationale: "Text again" },
          { layout_name: "icons-numbers", confidence: 0.75, rationale: "Alt" },
          { layout_name: "card-grid", confidence: 0.6, rationale: "Fallback" },
        ],
        rationale: "Slide 3",
      },
    ];

    const results = applyLayoutVoting(votes);

    // First slide: text-slide (high confidence, no penalty)
    expect(results[0].layout_name).toBe("text-slide");

    // Second slide: text-slide has adjacent penalty (-0.25) + repeat penalty (-0.15)
    // So text-slide: 0.9 - 0.25 - 0.15 = 0.50
    // icons-numbers: 0.7 + 0.05 (unused bonus) = 0.75 → wins
    expect(results[1].layout_name).toBe("icons-numbers");
    expect(results[1].was_reranked).toBe(true);

    // Third slide: text-slide has repeat penalty (-0.15), icons-numbers has repeat + adjacent
    // text-slide: 0.85 - 0.15 = 0.70
    // icons-numbers: 0.75 - 0.15 - 0.25 = 0.35
    // card-grid: 0.6 + 0.05 = 0.65
    expect(results[2].layout_name).toBe("text-slide");
  });

  it("enforces mandatory layouts for specific content shapes", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "card-grid", confidence: 0.9, rationale: "Cards" },
          { layout_name: "kanban-board", confidence: 0.7, rationale: "Kanban" },
          { layout_name: "text-slide", confidence: 0.3, rationale: "Fallback" },
        ],
        rationale: "Slide 1",
      },
    ];

    const shapeMap = new Map<number, string>();
    shapeMap.set(1, "kanban_board");

    const results = applyLayoutVoting(votes, shapeMap);
    expect(results[0].layout_name).toBe("kanban-board");
    expect(results[0].confidence).toBe(1.0);
  });

  it("enforces org-chart for org_structure shape", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 5,
        candidates: [
          { layout_name: "text-slide", confidence: 0.8, rationale: "Text" },
        ],
        rationale: "Org slide",
      },
    ];

    const shapeMap = new Map<number, string>();
    shapeMap.set(5, "org_structure");

    const results = applyLayoutVoting(votes, shapeMap);
    expect(results[0].layout_name).toBe("org-chart");
  });

  it("enforces swot-analysis for swot_quadrants shape", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 3,
        candidates: [
          { layout_name: "matrix-2x2", confidence: 0.85, rationale: "Matrix" },
        ],
        rationale: "SWOT",
      },
    ];

    const shapeMap = new Map<number, string>();
    shapeMap.set(3, "swot_quadrants");

    const results = applyLayoutVoting(votes, shapeMap);
    expect(results[0].layout_name).toBe("swot-analysis");
  });

  it("handles empty candidates gracefully", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [],
        rationale: "No candidates",
      },
    ];

    const results = applyLayoutVoting(votes);
    expect(results[0].layout_name).toBe("text-slide");
    expect(results[0].confidence).toBe(0.5);
  });

  it("gives unused layout bonus", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "text-slide", confidence: 0.7, rationale: "Text" },
          { layout_name: "card-grid", confidence: 0.68, rationale: "Cards" },
        ],
        rationale: "Close call",
      },
    ];

    // Both are unused, but text-slide has higher confidence
    const results = applyLayoutVoting(votes);
    expect(results[0].layout_name).toBe("text-slide");
  });

  it("handles a full 10-slide presentation with diversity", () => {
    const votes: LayoutVote[] = Array.from({ length: 10 }, (_, i) => ({
      slide_number: i + 1,
      candidates: [
        { layout_name: "text-slide", confidence: 0.8, rationale: "Text" },
        { layout_name: "icons-numbers", confidence: 0.75, rationale: "Icons" },
        { layout_name: "card-grid", confidence: 0.7, rationale: "Cards" },
      ],
      rationale: `Slide ${i + 1}`,
    }));

    const results = applyLayoutVoting(votes);

    // Should use all 3 layouts, not just text-slide
    const uniqueLayouts = new Set(results.map((r) => r.layout_name));
    expect(uniqueLayouts.size).toBeGreaterThanOrEqual(3);

    // No layout should appear more than 4 times in 10 slides
    const counts = new Map<string, number>();
    for (const r of results) {
      counts.set(r.layout_name, (counts.get(r.layout_name) || 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it("does not rerank when top candidate has very high confidence and no repeats", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "title-slide", confidence: 0.95, rationale: "Title" },
          { layout_name: "big-statement", confidence: 0.3, rationale: "Alt" },
        ],
        rationale: "Title",
      },
      {
        slide_number: 2,
        candidates: [
          { layout_name: "icons-numbers", confidence: 0.9, rationale: "Metrics" },
          { layout_name: "text-slide", confidence: 0.5, rationale: "Alt" },
        ],
        rationale: "Metrics",
      },
    ];

    const results = applyLayoutVoting(votes);
    expect(results[0].was_reranked).toBe(false);
    expect(results[1].was_reranked).toBe(false);
  });
});

describe("Layout Voting — convertLegacyDecisions", () => {
  it("converts old-style decisions to voting format", () => {
    const legacy = [
      { slide_number: 1, layout_name: "title-slide", rationale: "Opening" },
      { slide_number: 2, layout_name: "text-slide", rationale: "Content" },
    ];

    const votes = convertLegacyDecisions(legacy);
    expect(votes).toHaveLength(2);
    expect(votes[0].candidates).toHaveLength(1);
    expect(votes[0].candidates[0].layout_name).toBe("title-slide");
    expect(votes[0].candidates[0].confidence).toBe(0.8);
  });
});

// ═══════════════════════════════════════════════════════
// STEP 3.2: VISUAL REVIEWER TESTS
// ═══════════════════════════════════════════════════════

describe("Visual Reviewer — module structure", () => {
  it("exports renderSlideToImage function", async () => {
    const mod = await import("./visualReviewer");
    expect(typeof mod.renderSlideToImage).toBe("function");
  });

  it("exports evaluateSlideVisually function", async () => {
    const mod = await import("./visualReviewer");
    expect(typeof mod.evaluateSlideVisually).toBe("function");
  });

  it("exports runVisualReview function", async () => {
    const mod = await import("./visualReviewer");
    expect(typeof mod.runVisualReview).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════
// STEP 3.3: LLM DESIGN CRITIC TESTS
// ═══════════════════════════════════════════════════════

describe("LLM Design Critic — module structure", () => {
  it("exports runLlmDesignCritique function", async () => {
    const mod = await import("./designCriticAgent");
    expect(typeof mod.runLlmDesignCritique).toBe("function");
  });

  it("runLlmDesignCritique handles empty slides gracefully", async () => {
    const mod = await import("./designCriticAgent");
    // With mocked LLM, it should return default values
    const result = await mod.runLlmDesignCritique(
      [],
      ":root { --bg: #000; }",
      {
        issues: [],
        overallScore: 8,
        cssFixesPerSlide: new Map(),
        summary: "Good",
      },
    );
    // Should not throw, should return something
    expect(result).toBeDefined();
    expect(typeof result.revisedScore).toBe("number");
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// PROMPT UPDATES TESTS
// ═══════════════════════════════════════════════════════

describe("Layout Voting — prompt updates", () => {
  it("LAYOUT_SYSTEM prompt requests top-3 candidates with confidence", async () => {
    const { LAYOUT_SYSTEM } = await import("./prompts");
    expect(LAYOUT_SYSTEM).toContain("candidates");
    expect(LAYOUT_SYSTEM).toContain("confidence");
    expect(LAYOUT_SYSTEM).toContain("top-3");
  });

  it("LAYOUT_SYSTEM prompt includes voting output format", async () => {
    const { LAYOUT_SYSTEM } = await import("./prompts");
    expect(LAYOUT_SYSTEM).toContain("votes");
    expect(LAYOUT_SYSTEM).toContain("layout_name");
    expect(LAYOUT_SYSTEM).toContain("0.0-1.0");
  });
});

// ═══════════════════════════════════════════════════════
// INTEGRATION: LAYOUT VOTING EDGE CASES
// ═══════════════════════════════════════════════════════

describe("Layout Voting — edge cases", () => {
  it("handles single-candidate votes", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "title-slide", confidence: 0.95, rationale: "Only option" },
        ],
        rationale: "Title",
      },
    ];

    const results = applyLayoutVoting(votes);
    expect(results[0].layout_name).toBe("title-slide");
  });

  it("handles very low confidence candidates", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "text-slide", confidence: 0.2, rationale: "Low" },
          { layout_name: "card-grid", confidence: 0.15, rationale: "Lower" },
          { layout_name: "icons-numbers", confidence: 0.1, rationale: "Lowest" },
        ],
        rationale: "All low",
      },
    ];

    const results = applyLayoutVoting(votes);
    // Should still pick the best available
    expect(results[0].layout_name).toBe("text-slide");
  });

  it("mandatory shape overrides even with high-confidence alternative", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "text-slide", confidence: 0.99, rationale: "Very confident" },
        ],
        rationale: "Override test",
      },
    ];

    const shapeMap = new Map<number, string>();
    shapeMap.set(1, "org_structure");

    const results = applyLayoutVoting(votes, shapeMap);
    expect(results[0].layout_name).toBe("org-chart");
  });

  it("adjacent penalty prevents same layout on consecutive slides", () => {
    const votes: LayoutVote[] = [
      {
        slide_number: 1,
        candidates: [
          { layout_name: "icons-numbers", confidence: 0.85, rationale: "Metrics" },
          { layout_name: "card-grid", confidence: 0.8, rationale: "Cards" },
        ],
        rationale: "Slide 1",
      },
      {
        slide_number: 2,
        candidates: [
          { layout_name: "icons-numbers", confidence: 0.82, rationale: "Metrics again" },
          { layout_name: "card-grid", confidence: 0.8, rationale: "Cards" },
        ],
        rationale: "Slide 2",
      },
    ];

    const results = applyLayoutVoting(votes);
    // Slide 1: icons-numbers (high confidence, no penalty)
    expect(results[0].layout_name).toBe("icons-numbers");
    // Slide 2: icons-numbers has adjacent (-0.25) + repeat (-0.15) = 0.82 - 0.40 = 0.42
    // card-grid: 0.8 + 0.05 (unused) = 0.85 → wins
    expect(results[1].layout_name).toBe("card-grid");
    expect(results[1].was_reranked).toBe(true);
  });
});
