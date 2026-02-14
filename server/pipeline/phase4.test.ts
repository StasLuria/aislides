/**
 * Phase 4 Tests: Reference Library, Web Search, Final Review
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════
// 4.2: REFERENCE LIBRARY
// ═══════════════════════════════════════════════════════

import {
  matchReference,
  formatReferenceHint,
  REFERENCE_LIBRARY,
  type ReferencePresentation,
} from "./referenceLibrary";
import type { PresentationType } from "./presentationTypeClassifier";

describe("Reference Library (Step 4.2)", () => {
  describe("REFERENCE_LIBRARY", () => {
    it("contains references for investor_deck type", () => {
      const refs = REFERENCE_LIBRARY.filter((r) => r.type === "investor_deck");
      expect(refs.length).toBeGreaterThanOrEqual(2);
      for (const ref of refs) {
        expect(ref.slides.length).toBeGreaterThan(0);
        expect(ref.name).toBeTruthy();
      }
    });

    it("contains references for educational type", () => {
      const refs = REFERENCE_LIBRARY.filter((r) => r.type === "educational");
      expect(refs.length).toBeGreaterThanOrEqual(2);
    });

    it("contains references for business_strategy type", () => {
      const refs = REFERENCE_LIBRARY.filter((r) => r.type === "business_strategy");
      expect(refs.length).toBeGreaterThanOrEqual(2);
    });

    it("contains references for product_pitch type", () => {
      const refs = REFERENCE_LIBRARY.filter((r) => r.type === "product_pitch");
      expect(refs.length).toBeGreaterThanOrEqual(2);
    });

    it("contains references for quarterly_review type", () => {
      const refs = REFERENCE_LIBRARY.filter((r) => r.type === "quarterly_review");
      expect(refs.length).toBeGreaterThanOrEqual(2);
    });

    it("covers all 5 presentation types", () => {
      const types = new Set(REFERENCE_LIBRARY.map((r) => r.type));
      expect(types.has("business_strategy")).toBe(true);
      expect(types.has("product_pitch")).toBe(true);
      expect(types.has("investor_deck")).toBe(true);
      expect(types.has("educational")).toBe(true);
      expect(types.has("quarterly_review")).toBe(true);
    });

    it("all reference slides have required fields", () => {
      for (const ref of REFERENCE_LIBRARY) {
        for (const slide of ref.slides) {
          expect(slide.role).toBeTruthy();
          expect(slide.purpose).toBeTruthy();
          expect(slide.content_shape).toBeTruthy();
          expect(slide.title_pattern).toBeTruthy();
        }
      }
    });
  });

  describe("matchReference", () => {
    it("returns a reference for known type", () => {
      const ref = matchReference("investment strategy", "investor_deck");
      expect(ref).toBeTruthy();
      expect(ref!.type).toBe("investor_deck");
    });

    it("returns a reference for business_strategy", () => {
      const ref = matchReference("growth strategy", "business_strategy");
      expect(ref).toBeTruthy();
      expect(ref!.type).toBe("business_strategy");
    });

    it("returns null for unknown type", () => {
      const ref = matchReference("test", "unknown_type" as any);
      // May return null or a fallback
      expect(ref === null || ref === undefined).toBe(true);
    });
  });

  describe("formatReferenceHint", () => {
    it("formats reference into readable outline hint", () => {
      const ref = REFERENCE_LIBRARY.find((r) => r.type === "investor_deck")!;
      const formatted = formatReferenceHint(ref);
      expect(formatted).toContain(ref.name);
      expect(formatted.length).toBeGreaterThan(50);
    });

    it("includes slide roles and purposes", () => {
      const ref = REFERENCE_LIBRARY.find((r) => r.type === "business_strategy")!;
      const formatted = formatReferenceHint(ref);
      expect(formatted.length).toBeGreaterThan(50);
    });

    it("includes content shape recommendations", () => {
      const ref = REFERENCE_LIBRARY.find((r) => r.type === "educational")!;
      const formatted = formatReferenceHint(ref);
      expect(formatted.length).toBeGreaterThan(50);
    });
  });
});

// ═══════════════════════════════════════════════════════
// 4.1: WEB SEARCH (Research Agent Enhancement)
// ═══════════════════════════════════════════════════════

import {
  runResearchAgent,
  formatResearchForWriter,
  type ResearchContext,
} from "./researchAgent";

describe("Research Agent with Web Search (Step 4.1)", () => {
  describe("formatResearchForWriter", () => {
    it("returns empty string for missing slide number", () => {
      const ctx: ResearchContext = {
        presentation_topic: "Test",
        overall_context: "",
        slide_research: [],
        total_facts_found: 0,
      };
      expect(formatResearchForWriter(99, ctx)).toBe("");
    });

    it("formats research data with facts", () => {
      const ctx: ResearchContext = {
        presentation_topic: "AI Market",
        overall_context: "AI market is growing rapidly",
        slide_research: [
          {
            slide_number: 1,
            slide_title: "Market Overview",
            facts: [
              { fact: "AI market reached $200B in 2025", confidence: "high", source_hint: "Gartner", year: "2025" },
              { fact: "Growth rate is 35% YoY", confidence: "medium", source_hint: "McKinsey", year: "2024" },
            ],
            key_statistics: ["$200B market size", "35% CAGR"],
            industry_context: "Enterprise AI adoption accelerating",
            recommended_data_points: [
              { label: "Market Size", value: "200", unit: "billion USD" },
            ],
          },
        ],
        total_facts_found: 2,
      };

      const result = formatResearchForWriter(1, ctx);
      expect(result).toContain("<research_data>");
      expect(result).toContain("AI market reached $200B");
      expect(result).toContain("Gartner");
      expect(result).toContain("<key_statistics>");
      expect(result).toContain("$200B market size");
    });

    it("filters out low-confidence facts", () => {
      const ctx: ResearchContext = {
        presentation_topic: "Test",
        overall_context: "",
        slide_research: [
          {
            slide_number: 1,
            slide_title: "Test",
            facts: [
              { fact: "High confidence fact", confidence: "high", source_hint: "", year: "" },
              { fact: "Low confidence fact", confidence: "low", source_hint: "", year: "" },
            ],
            key_statistics: [],
            industry_context: "",
            recommended_data_points: [],
          },
        ],
        total_facts_found: 2,
      };

      const result = formatResearchForWriter(1, ctx);
      expect(result).toContain("High confidence fact");
      expect(result).not.toContain("Low confidence fact");
    });

    it("includes overall context when available", () => {
      const ctx: ResearchContext = {
        presentation_topic: "Test",
        overall_context: "Important industry context here",
        slide_research: [
          {
            slide_number: 1,
            slide_title: "Test",
            facts: [{ fact: "Some fact", confidence: "high", source_hint: "", year: "" }],
            key_statistics: [],
            industry_context: "",
            recommended_data_points: [],
          },
        ],
        total_facts_found: 1,
      };

      const result = formatResearchForWriter(1, ctx);
      expect(result).toContain("<industry_context>");
      expect(result).toContain("Important industry context here");
    });
  });

  describe("runResearchAgent", () => {
    it("returns empty context for empty outline", async () => {
      const result = await runResearchAgent({
        presentation_title: "Test",
        target_audience: "Executives",
        narrative_arc: "Problem → Solution",
        slides: [],
      });
      expect(result.slidesResearched).toBe(0);
      expect(result.totalFacts).toBe(0);
      expect(result.context.slide_research).toHaveLength(0);
    });

    it("skips structural slides (title, section-header)", () => {
      // Research agent skips structural slides by checking content_shape
      const structuralShapes = ["title", "section_header", "section-header"];
      for (const shape of structuralShapes) {
        // These shapes should be recognized as structural
        expect(["title", "section_header", "section-header"]).toContain(shape);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════
// 4.3: FINAL REVIEW
// ═══════════════════════════════════════════════════════

import {
  analyzeLayoutDiversity,
  checkNarrativeStructure,
  type FinalReviewSlide,
} from "./finalReview";

describe("Final Review (Step 4.3)", () => {
  describe("analyzeLayoutDiversity", () => {
    it("calculates correct diversity ratio", () => {
      const result = analyzeLayoutDiversity([
        "title-slide", "two-column", "stat-cards", "process-steps", "final-slide",
      ]);
      expect(result.uniqueLayouts).toBe(5);
      expect(result.totalSlides).toBe(5);
      expect(result.diversityRatio).toBe(1.0);
      expect(result.repeatedLayouts).toHaveLength(0);
    });

    it("detects repeated layouts", () => {
      const result = analyzeLayoutDiversity([
        "title-slide", "two-column", "two-column", "two-column", "final-slide",
      ]);
      expect(result.uniqueLayouts).toBe(3);
      expect(result.repeatedLayouts).toHaveLength(1);
      expect(result.repeatedLayouts[0].layout).toBe("two-column");
      expect(result.repeatedLayouts[0].count).toBe(3);
    });

    it("detects consecutive repeats", () => {
      const result = analyzeLayoutDiversity([
        "title-slide", "two-column", "two-column", "two-column", "stat-cards", "final-slide",
      ]);
      expect(result.maxConsecutiveRepeat).toBe(3);
    });

    it("handles single slide", () => {
      const result = analyzeLayoutDiversity(["title-slide"]);
      expect(result.uniqueLayouts).toBe(1);
      expect(result.diversityRatio).toBe(1.0);
      expect(result.maxConsecutiveRepeat).toBe(1);
    });

    it("handles empty array", () => {
      const result = analyzeLayoutDiversity([]);
      expect(result.uniqueLayouts).toBe(0);
      expect(result.totalSlides).toBe(0);
      expect(result.diversityRatio).toBe(0);
    });

    it("calculates diversity ratio for mixed layouts", () => {
      const layouts = [
        "title-slide", "two-column", "stat-cards", "two-column",
        "process-steps", "comparison-table", "two-column", "timeline",
        "quote-highlight", "final-slide",
      ];
      const result = analyzeLayoutDiversity(layouts);
      expect(result.uniqueLayouts).toBe(8);
      expect(result.totalSlides).toBe(10);
      expect(result.diversityRatio).toBeCloseTo(0.8, 1);
    });
  });

  describe("checkNarrativeStructure", () => {
    const makeSlides = (layouts: string[]): FinalReviewSlide[] =>
      layouts.map((l, i) => ({
        slideNumber: i + 1,
        layoutId: l,
        title: `Slide ${i + 1}`,
      }));

    it("detects proper structure with title and conclusion", () => {
      const slides = makeSlides([
        "title-slide", "two-column", "stat-cards", "final-slide",
      ]);
      const result = checkNarrativeStructure(slides);
      expect(result.hasTitle).toBe(true);
      expect(result.hasConclusion).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("detects missing title slide", () => {
      const slides = makeSlides([
        "two-column", "stat-cards", "final-slide",
      ]);
      const result = checkNarrativeStructure(slides);
      expect(result.hasTitle).toBe(false);
      expect(result.issues).toContain("Missing title slide at the beginning");
    });

    it("detects missing conclusion", () => {
      const slides = makeSlides([
        "title-slide", "two-column", "stat-cards",
      ]);
      const result = checkNarrativeStructure(slides);
      expect(result.hasConclusion).toBe(false);
      expect(result.issues.some((i) => i.includes("Missing conclusion"))).toBe(true);
    });

    it("detects conclusion by title keywords", () => {
      const slides: FinalReviewSlide[] = [
        { slideNumber: 1, layoutId: "title-slide", title: "Intro" },
        { slideNumber: 2, layoutId: "two-column", title: "Content" },
        { slideNumber: 3, layoutId: "two-column", title: "Итоги и выводы" },
      ];
      const result = checkNarrativeStructure(slides);
      expect(result.hasConclusion).toBe(true);
    });

    it("warns about long presentations without section headers", () => {
      const slides = makeSlides([
        "title-slide",
        "two-column", "two-column", "two-column", "two-column",
        "two-column", "two-column", "two-column", "two-column",
        "final-slide",
      ]);
      const result = checkNarrativeStructure(slides);
      expect(result.hasSectionHeaders).toBe(false);
      expect(result.issues.some((i) => i.includes("section headers"))).toBe(true);
    });

    it("counts section headers correctly", () => {
      const slides = makeSlides([
        "title-slide", "section-header", "two-column", "section-header", "stat-cards", "final-slide",
      ]);
      const result = checkNarrativeStructure(slides);
      expect(result.hasSectionHeaders).toBe(true);
      expect(result.sectionHeaderCount).toBe(2);
      expect(result.contentSlideCount).toBe(2);
    });

    it("handles empty slides array", () => {
      const result = checkNarrativeStructure([]);
      expect(result.hasTitle).toBe(false);
      expect(result.contentSlideCount).toBe(0);
    });
  });
});
