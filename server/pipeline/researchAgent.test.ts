import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  identifySlidesForResearch,
  generateResearchQueries,
  formatResearchForWriter,
  runResearchAgent,
  type OutlineForResearch,
  type ResearchContext,
  type SlideResearch,
  type ResearchFact,
} from "./researchAgent";

// ═══════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════

const mockOutline: OutlineForResearch = {
  presentation_title: "AI Market Trends 2025",
  target_audience: "C-level executives",
  narrative_arc: "Problem-Solution",
  slides: [
    {
      slide_number: 1,
      title: "AI Market Trends 2025",
      purpose: "Title slide — introduce the presentation",
      key_points: ["Welcome", "Overview"],
    },
    {
      slide_number: 2,
      title: "Market Overview",
      purpose: "Section header for market analysis",
      key_points: ["Market analysis section"],
    },
    {
      slide_number: 3,
      title: "Global AI Market Size",
      purpose: "Present market size data and growth rates",
      key_points: ["Market size $196B", "Growth rate 37%", "Key segments"],
    },
    {
      slide_number: 4,
      title: "Technology Adoption Trends",
      purpose: "Show AI adoption across industries",
      key_points: ["Enterprise adoption rates", "Industry leaders", "Barriers"],
    },
    {
      slide_number: 5,
      title: "Competitive Landscape",
      purpose: "Compare major AI players and market share",
      key_points: ["Top competitors", "Market share distribution", "Differentiators"],
    },
    {
      slide_number: 6,
      title: "Key Challenges",
      purpose: "Identify main problems and risks in AI adoption",
      key_points: ["Data quality", "Talent shortage", "Regulatory risks"],
    },
    {
      slide_number: 7,
      title: "Strategic Recommendations",
      purpose: "Present solution framework and action plan",
      key_points: ["Investment priorities", "Implementation roadmap", "Success metrics"],
    },
    {
      slide_number: 8,
      title: "Future Outlook",
      purpose: "Show trends and forecasts for next 5 years",
      key_points: ["2025-2030 forecast", "Emerging technologies", "Market predictions"],
    },
    {
      slide_number: 9,
      title: "Thank You",
      purpose: "Final slide — call to action and contact info",
      key_points: ["Contact information", "Next steps"],
    },
  ],
};

const mockResearchContext: ResearchContext = {
  presentation_topic: "AI Market Trends 2025",
  overall_context: "The global AI market reached $196B in 2023 and is projected to grow at 37% CAGR through 2030.",
  slide_research: [
    {
      slide_number: 3,
      slide_title: "Global AI Market Size",
      facts: [
        {
          fact: "The global AI market was valued at $196.6 billion in 2023",
          source_type: "statistic",
          confidence: "high",
          year: "2023",
          source_hint: "Grand View Research",
        },
        {
          fact: "AI market is expected to reach $1.81 trillion by 2030",
          source_type: "trend",
          confidence: "high",
          year: "2024",
          source_hint: "Statista",
        },
        {
          fact: "North America accounts for 36.8% of the global AI market",
          source_type: "statistic",
          confidence: "medium",
          year: "2023",
          source_hint: "IDC",
        },
      ],
      key_statistics: [
        "$196.6B global AI market (2023)",
        "37.3% CAGR 2023-2030",
        "$1.81T projected by 2030",
      ],
      industry_context: "The AI market is experiencing unprecedented growth driven by enterprise adoption of generative AI and large language models.",
      recommended_data_points: [
        { label: "Market Size 2023", value: "196.6", unit: "$ billion" },
        { label: "Projected 2030", value: "1810", unit: "$ billion" },
        { label: "CAGR", value: "37.3", unit: "%" },
      ],
    },
    {
      slide_number: 4,
      slide_title: "Technology Adoption Trends",
      facts: [
        {
          fact: "72% of enterprises have adopted AI in at least one business function",
          source_type: "statistic",
          confidence: "high",
          year: "2024",
          source_hint: "McKinsey Global Survey",
        },
        {
          fact: "Generative AI adoption doubled from 33% to 65% in one year",
          source_type: "trend",
          confidence: "high",
          year: "2024",
          source_hint: "McKinsey",
        },
      ],
      key_statistics: [
        "72% enterprise AI adoption",
        "65% generative AI adoption",
      ],
      industry_context: "Enterprise AI adoption accelerated significantly in 2023-2024.",
      recommended_data_points: [
        { label: "Enterprise Adoption", value: "72", unit: "%" },
        { label: "GenAI Adoption", value: "65", unit: "%" },
      ],
    },
  ],
  total_facts_found: 5,
};

// ═══════════════════════════════════════════════════════
// SLIDE IDENTIFICATION TESTS
// ═══════════════════════════════════════════════════════

describe("identifySlidesForResearch", () => {
  it("should skip title slide (slide 1)", () => {
    const result = identifySlidesForResearch(mockOutline);
    const slideNumbers = result.map((s) => s.slide_number);
    expect(slideNumbers).not.toContain(1);
  });

  it("should skip final slide", () => {
    const result = identifySlidesForResearch(mockOutline);
    const slideNumbers = result.map((s) => s.slide_number);
    expect(slideNumbers).not.toContain(9);
  });

  it("should skip section header slides", () => {
    const result = identifySlidesForResearch(mockOutline);
    const slideNumbers = result.map((s) => s.slide_number);
    expect(slideNumbers).not.toContain(2); // "Section header for market analysis"
  });

  it("should include content slides", () => {
    const result = identifySlidesForResearch(mockOutline);
    const slideNumbers = result.map((s) => s.slide_number);
    expect(slideNumbers).toContain(3); // Market size
    expect(slideNumbers).toContain(4); // Technology adoption
    expect(slideNumbers).toContain(5); // Competitive landscape
    expect(slideNumbers).toContain(6); // Challenges
    expect(slideNumbers).toContain(7); // Recommendations
    expect(slideNumbers).toContain(8); // Future outlook
  });

  it("should return empty array for outline with only structural slides", () => {
    const structuralOnly: OutlineForResearch = {
      presentation_title: "Test",
      target_audience: "Test",
      narrative_arc: "Test",
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title slide", key_points: [] },
        { slide_number: 2, title: "Thanks", purpose: "Final slide — thank you", key_points: [] },
      ],
    };
    const result = identifySlidesForResearch(structuralOnly);
    expect(result).toHaveLength(0);
  });

  it("should handle Russian purpose descriptions", () => {
    const russianOutline: OutlineForResearch = {
      presentation_title: "Тест",
      target_audience: "Менеджеры",
      narrative_arc: "Problem-Solution",
      slides: [
        { slide_number: 1, title: "Заголовок", purpose: "Титульный слайд", key_points: [] },
        { slide_number: 2, title: "Раздел", purpose: "Заголовок секции — разделитель", key_points: [] },
        { slide_number: 3, title: "Контент", purpose: "Основной контент", key_points: ["Факт 1"] },
        { slide_number: 4, title: "Спасибо", purpose: "Заключительный слайд", key_points: [] },
      ],
    };
    const result = identifySlidesForResearch(russianOutline);
    expect(result).toHaveLength(1);
    expect(result[0].slide_number).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════
// RESEARCH QUERY GENERATION TESTS
// ═══════════════════════════════════════════════════════

describe("generateResearchQueries", () => {
  it("should generate queries for each slide", () => {
    const slides = identifySlidesForResearch(mockOutline);
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries.length).toBe(slides.length);
  });

  it("should include slide number and title in each query", () => {
    const slides = identifySlidesForResearch(mockOutline);
    const queries = generateResearchQueries(mockOutline, slides);
    for (const q of queries) {
      expect(q.slide_number).toBeGreaterThan(0);
      expect(q.slide_title).toBeTruthy();
      expect(q.queries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("should detect market-related research focus", () => {
    const slides = [mockOutline.slides[2]]; // "Global AI Market Size"
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("market");
  });

  it("should detect technology-related research focus", () => {
    const slides = [{ slide_number: 4, title: "AI and Machine Learning Applications", purpose: "Show technology adoption across industries", key_points: ["Enterprise adoption rates", "Industry leaders"] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("technology");
  });

  it("should detect competition-related research focus", () => {
    const slides = [{ slide_number: 5, title: "Competitive Landscape", purpose: "Compare major AI competitors", key_points: ["Top competitors", "Differentiators"] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("competitive");
  });

  it("should detect problem/risk-related research focus", () => {
    const slides = [{ slide_number: 6, title: "Key Challenges", purpose: "Identify main problems and risks", key_points: ["Talent shortage", "Regulatory risks"] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("challenge");
  });

  it("should detect strategy/solution-related research focus", () => {
    const slides = [{ slide_number: 7, title: "Strategic Recommendations", purpose: "Present solution framework", key_points: ["Implementation roadmap", "Success metrics"] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("best practices");
  });

  it("should detect trend/future-related research focus", () => {
    const slides = [{ slide_number: 8, title: "Future Outlook", purpose: "Show trends and forecasts", key_points: ["Emerging technologies", "Predictions"] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].research_focus).toContain("forecast");
  });

  it("should add extra market query for market-focused slides", () => {
    const slides = [mockOutline.slides[2]]; // "Global AI Market Size"
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries[0].queries.length).toBeGreaterThanOrEqual(3);
    expect(queries[0].queries.some((q) => q.includes("market size"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// RESEARCH CONTEXT FORMATTING TESTS
// ═══════════════════════════════════════════════════════

describe("formatResearchForWriter", () => {
  it("should return research data for existing slide", () => {
    const result = formatResearchForWriter(3, mockResearchContext);
    expect(result).toContain("<research_data>");
    expect(result).toContain("$196.6 billion");
    expect(result).toContain("Grand View Research");
  });

  it("should include overall context", () => {
    const result = formatResearchForWriter(3, mockResearchContext);
    expect(result).toContain("<industry_context>");
    expect(result).toContain("$196B");
  });

  it("should include key statistics", () => {
    const result = formatResearchForWriter(3, mockResearchContext);
    expect(result).toContain("<key_statistics>");
    expect(result).toContain("37.3% CAGR");
  });

  it("should include recommended data points", () => {
    const result = formatResearchForWriter(3, mockResearchContext);
    expect(result).toContain("<suggested_data_points>");
    expect(result).toContain("Market Size 2023");
  });

  it("should return empty string for slide without research", () => {
    const result = formatResearchForWriter(1, mockResearchContext);
    expect(result).toBe("");
  });

  it("should return empty string for non-existent slide", () => {
    const result = formatResearchForWriter(99, mockResearchContext);
    expect(result).toBe("");
  });

  it("should filter out low-confidence facts", () => {
    const contextWithLowConfidence: ResearchContext = {
      ...mockResearchContext,
      slide_research: [
        {
          slide_number: 10,
          slide_title: "Test",
          facts: [
            { fact: "High confidence fact", source_type: "statistic", confidence: "high", year: "2024", source_hint: "Source" },
            { fact: "Low confidence fact", source_type: "statistic", confidence: "low", year: "2024", source_hint: "Source" },
          ],
          key_statistics: [],
          industry_context: "",
          recommended_data_points: [],
        },
      ],
      total_facts_found: 2,
    };
    const result = formatResearchForWriter(10, contextWithLowConfidence);
    expect(result).toContain("High confidence fact");
    expect(result).not.toContain("Low confidence fact");
  });

  it("should include source hints and years in fact formatting", () => {
    const result = formatResearchForWriter(3, mockResearchContext);
    expect(result).toContain("(Grand View Research, 2023)");
    expect(result).toContain("(Statista, 2024)");
  });

  it("should handle research with empty facts gracefully", () => {
    const emptyResearch: ResearchContext = {
      presentation_topic: "Test",
      overall_context: "Some context",
      slide_research: [
        {
          slide_number: 5,
          slide_title: "Test",
          facts: [],
          key_statistics: [],
          industry_context: "",
          recommended_data_points: [],
        },
      ],
      total_facts_found: 0,
    };
    const result = formatResearchForWriter(5, emptyResearch);
    // Should still include overall context
    expect(result).toContain("<industry_context>");
  });
});

// ═══════════════════════════════════════════════════════
// RESEARCH AGENT INTEGRATION TESTS
// ═══════════════════════════════════════════════════════

describe("runResearchAgent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty context for outline with only structural slides", async () => {
    const structuralOnly: OutlineForResearch = {
      presentation_title: "Test",
      target_audience: "Test",
      narrative_arc: "Test",
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title slide", key_points: [] },
        { slide_number: 2, title: "Thanks", purpose: "Final slide", key_points: [] },
      ],
    };
    
    const result = await runResearchAgent(structuralOnly);
    expect(result.slidesResearched).toBe(0);
    expect(result.totalFacts).toBe(0);
    expect(result.context.slide_research).toHaveLength(0);
  });

  it("should call progress callback during research", async () => {
    const structuralOnly: OutlineForResearch = {
      presentation_title: "Test",
      target_audience: "Test",
      narrative_arc: "Test",
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title slide", key_points: [] },
      ],
    };
    
    const progressMessages: string[] = [];
    await runResearchAgent(structuralOnly, (msg) => progressMessages.push(msg));
    // No progress for empty slides
    expect(progressMessages).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// RESEARCH FACT TYPE TESTS
// ═══════════════════════════════════════════════════════

describe("ResearchFact types", () => {
  it("should support all source types", () => {
    const sourceTypes: ResearchFact["source_type"][] = [
      "statistic", "trend", "case_study", "expert_opinion", "comparison", "definition", "historical",
    ];
    for (const st of sourceTypes) {
      const fact: ResearchFact = {
        fact: `Test ${st}`,
        source_type: st,
        confidence: "high",
        year: "2024",
        source_hint: "Test",
      };
      expect(fact.source_type).toBe(st);
    }
  });

  it("should support all confidence levels", () => {
    const levels: ResearchFact["confidence"][] = ["high", "medium", "low"];
    for (const level of levels) {
      const fact: ResearchFact = {
        fact: `Test ${level}`,
        source_type: "statistic",
        confidence: level,
      };
      expect(fact.confidence).toBe(level);
    }
  });
});

// ═══════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("should handle outline with single content slide", () => {
    const singleSlide: OutlineForResearch = {
      presentation_title: "Quick Update",
      target_audience: "Team",
      narrative_arc: "Data-Driven",
      slides: [
        { slide_number: 1, title: "Title", purpose: "Title slide", key_points: [] },
        { slide_number: 2, title: "Key Metric", purpose: "Show revenue growth data", key_points: ["Revenue up 25%"] },
        { slide_number: 3, title: "Thanks", purpose: "Final slide — спасибо", key_points: [] },
      ],
    };
    const slides = identifySlidesForResearch(singleSlide);
    expect(slides).toHaveLength(1);
    expect(slides[0].slide_number).toBe(2);
  });

  it("should handle slides with empty key_points", () => {
    const slides = [{ slide_number: 5, title: "Empty Slide", purpose: "Show data", key_points: [] }];
    const queries = generateResearchQueries(mockOutline, slides);
    expect(queries).toHaveLength(1);
    expect(queries[0].queries.length).toBeGreaterThanOrEqual(2);
  });

  it("should handle research context with no overall context", () => {
    const noOverall: ResearchContext = {
      ...mockResearchContext,
      overall_context: "",
    };
    const result = formatResearchForWriter(3, noOverall);
    expect(result).toContain("<research_data>");
    expect(result).not.toContain("<industry_context>");
  });

  it("should handle very long key_points gracefully", () => {
    const longPoints = [
      "A".repeat(200),
      "B".repeat(200),
      "C".repeat(200),
    ];
    const slides = [{ slide_number: 5, title: "Long", purpose: "Show data", key_points: longPoints }];
    const queries = generateResearchQueries(mockOutline, slides);
    // Should truncate key points in query
    expect(queries[0].queries[1].length).toBeLessThan(300);
  });
});
