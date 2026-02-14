/**
 * Multimodal Final Review Agent — evaluates the complete presentation as a whole.
 *
 * Unlike per-slide QA and Visual Review, this agent looks at the ENTIRE presentation
 * to assess narrative coherence, visual consistency, and overall quality.
 *
 * Strategy:
 * 1. Collect all slide titles, key points, and layouts
 * 2. Ask LLM to evaluate the presentation holistically on 6 criteria
 * 3. Return actionable feedback and an overall quality score
 *
 * This runs AFTER all other agents, just before final assembly.
 */

import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface FinalReviewSlide {
  slideNumber: number;
  layoutId: string;
  title: string;
  keyPoints?: string[];
}

export interface FinalReviewCriterion {
  name: string;
  score: number;      // 1-10
  feedback: string;
}

export interface FinalReviewResult {
  overallScore: number;           // 1-10 average
  criteria: FinalReviewCriterion[];
  strengths: string[];            // Top 3 strengths
  improvements: string[];         // Top 3 areas for improvement
  narrativeCoherence: string;     // Brief assessment of story flow
  layoutDiversity: string;        // Assessment of visual variety
}

// ═══════════════════════════════════════════════════════
// LAYOUT DIVERSITY ANALYSIS (no LLM needed)
// ═══════════════════════════════════════════════════════

/**
 * Analyze layout diversity without LLM — pure logic.
 */
export function analyzeLayoutDiversity(layouts: string[]): {
  uniqueLayouts: number;
  totalSlides: number;
  diversityRatio: number;
  repeatedLayouts: Array<{ layout: string; count: number }>;
  maxConsecutiveRepeat: number;
} {
  const counts = new Map<string, number>();
  for (const l of layouts) {
    counts.set(l, (counts.get(l) || 0) + 1);
  }

  const repeated = Array.from(counts.entries())
    .filter(([, count]) => count > 2)
    .map(([layout, count]) => ({ layout, count }))
    .sort((a, b) => b.count - a.count);

  // Check consecutive repeats
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  for (let i = 1; i < layouts.length; i++) {
    if (layouts[i] === layouts[i - 1]) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  return {
    uniqueLayouts: counts.size,
    totalSlides: layouts.length,
    diversityRatio: layouts.length > 0 ? counts.size / layouts.length : 0,
    repeatedLayouts: repeated,
    maxConsecutiveRepeat: maxConsecutive,
  };
}

// ═══════════════════════════════════════════════════════
// NARRATIVE COHERENCE CHECK (no LLM needed)
// ═══════════════════════════════════════════════════════

/**
 * Check narrative structure without LLM — verify expected patterns.
 */
export function checkNarrativeStructure(slides: FinalReviewSlide[]): {
  hasTitle: boolean;
  hasConclusion: boolean;
  hasSectionHeaders: boolean;
  titleCount: number;
  sectionHeaderCount: number;
  contentSlideCount: number;
  issues: string[];
} {
  const hasTitle = slides.length > 0 && slides[0].layoutId === "title-slide";
  const lastSlide = slides[slides.length - 1];
  const hasConclusion = lastSlide?.layoutId === "final-slide" ||
    lastSlide?.title?.toLowerCase().includes("итог") ||
    lastSlide?.title?.toLowerCase().includes("вывод") ||
    lastSlide?.title?.toLowerCase().includes("conclusion") ||
    lastSlide?.title?.toLowerCase().includes("summary");

  const sectionHeaders = slides.filter((s) => s.layoutId === "section-header");
  const contentSlides = slides.filter(
    (s) => s.layoutId !== "title-slide" && s.layoutId !== "final-slide" && s.layoutId !== "section-header",
  );

  const issues: string[] = [];
  if (!hasTitle) issues.push("Missing title slide at the beginning");
  if (!hasConclusion) issues.push("Missing conclusion/final slide at the end");
  if (slides.length > 8 && sectionHeaders.length === 0) {
    issues.push("Long presentation without section headers — consider adding structure");
  }
  if (contentSlides.length > 15) {
    issues.push("Very long presentation — consider trimming to maintain audience attention");
  }

  return {
    hasTitle,
    hasConclusion,
    hasSectionHeaders: sectionHeaders.length > 0,
    titleCount: slides.filter((s) => s.layoutId === "title-slide").length,
    sectionHeaderCount: sectionHeaders.length,
    contentSlideCount: contentSlides.length,
    issues,
  };
}

// ═══════════════════════════════════════════════════════
// LLM-BASED HOLISTIC REVIEW
// ═══════════════════════════════════════════════════════

const FINAL_REVIEW_SYSTEM = `You are a senior presentation consultant performing a final quality review of a complete presentation.

Evaluate the ENTIRE presentation holistically on these 6 criteria (score 1-10 each):

1. **NARRATIVE_FLOW** — Does the presentation tell a coherent story? Is there a clear beginning, middle, and end? Do slides logically follow each other?
2. **CONTENT_DEPTH** — Is the content substantive? Are there specific facts, numbers, and examples rather than vague statements?
3. **VISUAL_VARIETY** — Is there good diversity in slide layouts? Are there no more than 2 consecutive slides with the same layout?
4. **AUDIENCE_FIT** — Is the content appropriate for the target audience? Is the language and complexity level right?
5. **PERSUASIVENESS** — Does the presentation build a compelling argument? Would the audience be convinced or informed?
6. **COMPLETENESS** — Are all important aspects of the topic covered? Are there obvious gaps?

Be specific and actionable in your feedback. Provide exactly 3 strengths and 3 areas for improvement.`;

/**
 * Run the LLM-based holistic review of the entire presentation.
 */
async function runLLMFinalReview(
  presentationTitle: string,
  slides: FinalReviewSlide[],
  layoutDiversity: ReturnType<typeof analyzeLayoutDiversity>,
  narrativeStructure: ReturnType<typeof checkNarrativeStructure>,
): Promise<FinalReviewResult> {
  const slidesSummary = slides
    .map((s) => {
      const kp = s.keyPoints && s.keyPoints.length > 0
        ? `\n    Key points: ${s.keyPoints.slice(0, 3).join("; ")}`
        : "";
      return `  ${s.slideNumber}. [${s.layoutId}] "${s.title}"${kp}`;
    })
    .join("\n");

  const diversityNote = `Layout diversity: ${layoutDiversity.uniqueLayouts} unique layouts across ${layoutDiversity.totalSlides} slides (ratio: ${layoutDiversity.diversityRatio.toFixed(2)}). Max consecutive repeat: ${layoutDiversity.maxConsecutiveRepeat}.`;
  const structureNote = `Structure: ${narrativeStructure.hasTitle ? "Has" : "Missing"} title slide, ${narrativeStructure.hasSectionHeaders ? `${narrativeStructure.sectionHeaderCount} section headers` : "no section headers"}, ${narrativeStructure.hasConclusion ? "has" : "missing"} conclusion.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: FINAL_REVIEW_SYSTEM },
      {
        role: "user",
        content: `Presentation: "${presentationTitle}"
Total slides: ${slides.length}
${diversityNote}
${structureNote}

SLIDES:
${slidesSummary}

Evaluate this presentation holistically.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "FinalReview",
        strict: true,
        schema: {
          type: "object",
          properties: {
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  score: { type: "integer" },
                  feedback: { type: "string" },
                },
                required: ["name", "score", "feedback"],
                additionalProperties: false,
              },
            },
            strengths: {
              type: "array",
              items: { type: "string" },
            },
            improvements: {
              type: "array",
              items: { type: "string" },
            },
            narrative_coherence: { type: "string" },
            layout_diversity: { type: "string" },
          },
          required: ["criteria", "strengths", "improvements", "narrative_coherence", "layout_diversity"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty final review response");
  }

  const parsed = JSON.parse(raw);
  const criteria = (parsed.criteria || []).map((c: Record<string, unknown>) => ({
    name: String(c.name || ""),
    score: Math.max(1, Math.min(10, Number(c.score) || 5)),
    feedback: String(c.feedback || ""),
  }));

  const overallScore = criteria.length > 0
    ? criteria.reduce((sum: number, c: FinalReviewCriterion) => sum + c.score, 0) / criteria.length
    : 5;

  return {
    overallScore,
    criteria,
    strengths: (parsed.strengths || []).slice(0, 3),
    improvements: (parsed.improvements || []).slice(0, 3),
    narrativeCoherence: parsed.narrative_coherence || "",
    layoutDiversity: parsed.layout_diversity || "",
  };
}

// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

/**
 * Run the Final Review Agent on the complete presentation.
 * Returns quality assessment and actionable feedback.
 */
export async function runFinalReview(
  presentationTitle: string,
  slides: FinalReviewSlide[],
): Promise<FinalReviewResult> {
  if (slides.length === 0) {
    return {
      overallScore: 0,
      criteria: [],
      strengths: [],
      improvements: ["No slides to review"],
      narrativeCoherence: "No content",
      layoutDiversity: "No content",
    };
  }

  // 1. Structural analysis (no LLM)
  const layouts = slides.map((s) => s.layoutId);
  const layoutDiversity = analyzeLayoutDiversity(layouts);
  const narrativeStructure = checkNarrativeStructure(slides);

  // 2. LLM holistic review
  try {
    const review = await runLLMFinalReview(presentationTitle, slides, layoutDiversity, narrativeStructure);

    // Log results
    console.log(`[FinalReview] Overall: ${review.overallScore.toFixed(1)}/10`);
    for (const c of review.criteria) {
      console.log(`[FinalReview]   ${c.name}: ${c.score}/10 — ${c.feedback.substring(0, 80)}`);
    }

    return review;
  } catch (error) {
    console.error(`[FinalReview] LLM review failed: ${(error as Error).message}`);

    // Fallback: structural-only review
    const structuralScore = (
      (layoutDiversity.diversityRatio > 0.4 ? 7 : 4) +
      (narrativeStructure.hasTitle ? 8 : 3) +
      (narrativeStructure.hasConclusion ? 8 : 4) +
      (narrativeStructure.issues.length === 0 ? 8 : 5)
    ) / 4;

    return {
      overallScore: structuralScore,
      criteria: [
        { name: "STRUCTURE", score: narrativeStructure.issues.length === 0 ? 8 : 5, feedback: narrativeStructure.issues.join("; ") || "Good structure" },
        { name: "DIVERSITY", score: layoutDiversity.diversityRatio > 0.4 ? 7 : 4, feedback: `${layoutDiversity.uniqueLayouts} unique layouts` },
      ],
      strengths: ["Presentation was generated successfully"],
      improvements: narrativeStructure.issues.slice(0, 3),
      narrativeCoherence: narrativeStructure.hasTitle && narrativeStructure.hasConclusion ? "Basic structure present" : "Missing key structural elements",
      layoutDiversity: `${layoutDiversity.uniqueLayouts} unique layouts, diversity ratio ${layoutDiversity.diversityRatio.toFixed(2)}`,
    };
  }
}
