/**
 * Outline Critic Agent — validates and improves the outline before content generation.
 *
 * Responsibilities:
 * 1. Check Pyramid Principle compliance (top-down: conclusion → supporting arguments)
 * 2. Verify MECE structure (Mutually Exclusive, Collectively Exhaustive)
 * 3. Ensure slide type balance and variety
 * 4. Validate narrative arc completeness
 * 5. Suggest improvements and optionally rewrite the outline
 *
 * Runs AFTER Outline Agent, BEFORE Writer.
 * Input: OutlineResult from Outline Agent
 * Output: Validated OutlineResult (potentially improved)
 */

import { invokeLLM } from "../_core/llm";
import type { OutlineResult, OutlineSlide } from "./generator";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface CritiqueIssue {
  /** severity: "error" (must fix) | "warning" (should fix) | "suggestion" (nice to have) */
  severity: "error" | "warning" | "suggestion";
  /** Which aspect: structure, mece, balance, narrative, content */
  aspect: string;
  /** Human-readable description of the issue */
  message: string;
  /** Which slide(s) are affected (empty for global issues) */
  affected_slides: number[];
}

export interface CritiqueResult {
  /** Overall score 1-10 */
  score: number;
  /** Whether the outline passes minimum quality bar (score >= 7) */
  passed: boolean;
  /** List of issues found */
  issues: CritiqueIssue[];
  /** Improved outline (only if score < 7) */
  improved_outline?: OutlineResult;
}

// ═══════════════════════════════════════════════════════
// LOCAL VALIDATION (no LLM needed)
// ═══════════════════════════════════════════════════════

/**
 * Validate structural rules that can be checked without LLM.
 * Returns issues found.
 */
export function validateOutlineStructure(outline: OutlineResult): CritiqueIssue[] {
  const issues: CritiqueIssue[] = [];
  const slides = outline.slides;

  // 1. Must have at least 5 slides
  if (slides.length < 5) {
    issues.push({
      severity: "error",
      aspect: "structure",
      message: `Too few slides (${slides.length}). Minimum is 5 for a meaningful presentation.`,
      affected_slides: [],
    });
  }

  // 2. Must not exceed 20 slides
  if (slides.length > 20) {
    issues.push({
      severity: "warning",
      aspect: "structure",
      message: `Too many slides (${slides.length}). Consider condensing to 12-15 for better audience attention.`,
      affected_slides: [],
    });
  }

  // 3. First slide should be a title/intro slide
  if (slides.length > 0) {
    const firstTitle = slides[0].title.toLowerCase();
    const isTitle = firstTitle.includes("title") ||
      firstTitle.includes("заголов") ||
      firstTitle.includes("введен") ||
      firstTitle.includes("приветств") ||
      slides[0].purpose.toLowerCase().includes("title") ||
      slides[0].purpose.toLowerCase().includes("opening") ||
      slides[0].purpose.toLowerCase().includes("титульн") ||
      slides[0].slide_number === 1;
    // We don't flag this as error since slide_number=1 is always title
  }

  // 4. Last slide should be a conclusion/final slide
  if (slides.length > 0) {
    const lastSlide = slides[slides.length - 1];
    const lastPurpose = lastSlide.purpose.toLowerCase();
    const lastTitle = lastSlide.title.toLowerCase();
    const isFinal = lastPurpose.includes("final") ||
      lastPurpose.includes("conclusion") ||
      lastPurpose.includes("closing") ||
      lastPurpose.includes("заключ") ||
      lastPurpose.includes("итог") ||
      lastPurpose.includes("завершен") ||
      lastTitle.includes("итог") ||
      lastTitle.includes("заключ") ||
      lastTitle.includes("спасибо") ||
      lastTitle.includes("thank") ||
      lastTitle.includes("summary") ||
      lastTitle.includes("call to action");

    if (!isFinal) {
      issues.push({
        severity: "warning",
        aspect: "structure",
        message: "Last slide should be a conclusion or call-to-action slide.",
        affected_slides: [lastSlide.slide_number],
      });
    }
  }

  // 5. Check for duplicate or very similar titles
  const titleSet = new Set<string>();
  for (const slide of slides) {
    const normalized = slide.title.toLowerCase().trim();
    if (titleSet.has(normalized)) {
      issues.push({
        severity: "error",
        aspect: "mece",
        message: `Duplicate slide title: "${slide.title}"`,
        affected_slides: [slide.slide_number],
      });
    }
    titleSet.add(normalized);
  }

  // 6. Check that each slide has enough key points (at least 2)
  for (const slide of slides) {
    if (slide.key_points.length < 2) {
      issues.push({
        severity: "warning",
        aspect: "content",
        message: `Slide ${slide.slide_number} "${slide.title}" has only ${slide.key_points.length} key point(s). Should have at least 3.`,
        affected_slides: [slide.slide_number],
      });
    }
  }

  // 7. Check slide numbering is sequential
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].slide_number !== i + 1) {
      issues.push({
        severity: "error",
        aspect: "structure",
        message: `Slide numbering gap: expected ${i + 1}, got ${slides[i].slide_number}`,
        affected_slides: [slides[i].slide_number],
      });
    }
  }

  // 8. Check for section headers (should have 2-3 for presentations with 8+ slides)
  if (slides.length >= 8) {
    const sectionHeaders = slides.filter((s) => {
      const purpose = s.purpose.toLowerCase();
      return purpose.includes("section") ||
        purpose.includes("divider") ||
        purpose.includes("transition") ||
        purpose.includes("раздел") ||
        purpose.includes("секци");
    });

    if (sectionHeaders.length === 0) {
      issues.push({
        severity: "suggestion",
        aspect: "balance",
        message: "No section headers found. Consider adding 2-3 section dividers to organize the presentation into clear parts.",
        affected_slides: [],
      });
    }
  }

  // 9. Check narrative_arc is specified
  if (!outline.narrative_arc || outline.narrative_arc.trim().length < 5) {
    issues.push({
      severity: "warning",
      aspect: "narrative",
      message: "Narrative arc is missing or too vague. Should describe the story structure.",
      affected_slides: [],
    });
  }

  // 10. Check target_audience is specified
  if (!outline.target_audience || outline.target_audience.trim().length < 3) {
    issues.push({
      severity: "warning",
      aspect: "content",
      message: "Target audience is not specified. This affects content tone and depth.",
      affected_slides: [],
    });
  }

  return issues;
}

/**
 * Calculate a quality score based on local validation issues.
 */
export function calculateLocalScore(issues: CritiqueIssue[]): number {
  let score = 10;

  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        score -= 2;
        break;
      case "warning":
        score -= 1;
        break;
      case "suggestion":
        score -= 0.3;
        break;
    }
  }

  return Math.max(1, Math.round(score * 10) / 10);
}

// ═══════════════════════════════════════════════════════
// LLM-BASED CRITIQUE
// ═══════════════════════════════════════════════════════

const OUTLINE_CRITIC_SYSTEM = `You are Outline Critic Agent — a senior presentation consultant who reviews outlines before content creation begins.

<role>
You evaluate presentation outlines against professional standards: Pyramid Principle, MECE structure, narrative arc, and audience engagement. You identify weaknesses and provide an improved outline when quality is insufficient.
</role>

<evaluation_criteria>
1. PYRAMID PRINCIPLE (score 1-10):
   - Does the presentation lead with the conclusion/key message?
   - Are supporting arguments organized hierarchically?
   - Can each slide's purpose be traced back to the main thesis?

2. MECE STRUCTURE (score 1-10):
   - Are slide topics Mutually Exclusive (no overlap/redundancy)?
   - Are they Collectively Exhaustive (no major gaps)?
   - Does the outline cover all necessary aspects of the topic?

3. NARRATIVE ARC (score 1-10):
   - Is there a clear beginning, middle, and end?
   - Does tension/interest build and then resolve?
   - Are transitions between sections logical?

4. SLIDE BALANCE (score 1-10):
   - Is there variety in slide types (data, narrative, visual)?
   - Are section headers used to organize major parts?
   - Is the slide count appropriate for the topic complexity?

5. AUDIENCE ENGAGEMENT (score 1-10):
   - Are titles specific and engaging (not generic)?
   - Are key points concrete (with data, examples, frameworks)?
   - Is there a clear call to action?
</evaluation_criteria>

<rules>
- Be constructive but honest — identify real issues, not nitpicks
- If overall score >= 7: outline is good enough, just list suggestions
- If overall score < 7: provide an improved_outline with fixes applied
- The improved outline must keep the same language as the original
- Focus on the 2-3 most impactful improvements, not a complete rewrite
- Preserve the original presentation_title and target_audience unless they are clearly wrong
</rules>

<output_format>
Return JSON with:
- score: overall quality score (1-10, average of 5 criteria)
- passed: boolean (true if score >= 7)
- issues: array of {severity, aspect, message, affected_slides}
- improved_outline: (only if passed=false) full OutlineResult with fixes applied
</output_format>`;

function buildCriticUserPrompt(outline: OutlineResult, localIssues: CritiqueIssue[]): string {
  const slideSummaries = outline.slides
    .map(
      (s) =>
        `Slide ${s.slide_number}: "${s.title}"
  Purpose: ${s.purpose}
  Key points: ${s.key_points.join("; ")}`,
    )
    .join("\n\n");

  const localIssuesStr = localIssues.length > 0
    ? `\n<local_validation_issues>\n${localIssues.map((i) => `[${i.severity}] ${i.aspect}: ${i.message}`).join("\n")}\n</local_validation_issues>`
    : "";

  return `<outline>
Title: ${outline.presentation_title}
Target audience: ${outline.target_audience}
Narrative arc: ${outline.narrative_arc}
Total slides: ${outline.slides.length}

${slideSummaries}
</outline>${localIssuesStr}

Evaluate this outline against all 5 criteria. If quality is insufficient (score < 7), provide an improved outline.`;
}

// ═══════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the Outline Critic to validate and potentially improve the outline.
 *
 * Flow:
 * 1. Local validation (structural checks, no LLM)
 * 2. LLM critique (Pyramid, MECE, narrative, balance, engagement)
 * 3. If score < 7 and LLM provides improved outline → use it
 * 4. If score >= 7 → return original outline
 *
 * @param outline - OutlineResult from Outline Agent
 * @returns CritiqueResult with validated/improved outline
 */
export async function runOutlineCritic(
  outline: OutlineResult,
): Promise<{ outline: OutlineResult; critique: CritiqueResult }> {
  // Step 1: Local validation
  const localIssues = validateOutlineStructure(outline);
  const localScore = calculateLocalScore(localIssues);

  // Step 2: LLM critique
  const userPrompt = buildCriticUserPrompt(outline, localIssues);

  const slideSchema = {
    type: "object" as const,
    properties: {
      slide_number: { type: "integer" as const },
      title: { type: "string" as const },
      purpose: { type: "string" as const },
      key_points: { type: "array" as const, items: { type: "string" as const } },
      speaker_notes_hint: { type: "string" as const },
    },
    required: ["slide_number", "title", "purpose", "key_points", "speaker_notes_hint"] as const,
    additionalProperties: false as const,
  };

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: OUTLINE_CRITIC_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "OutlineCritiqueOutput",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "number", description: "Overall quality score 1-10" },
              passed: { type: "boolean", description: "Whether outline passes quality bar" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string", description: "error, warning, or suggestion" },
                    aspect: { type: "string", description: "structure, mece, balance, narrative, or content" },
                    message: { type: "string", description: "Description of the issue" },
                    affected_slides: { type: "array", items: { type: "integer" } },
                  },
                  required: ["severity", "aspect", "message", "affected_slides"],
                  additionalProperties: false,
                },
              },
              has_improved_outline: { type: "boolean", description: "Whether an improved outline is provided" },
              improved_presentation_title: { type: "string", description: "Improved title (empty if no improvement)" },
              improved_target_audience: { type: "string", description: "Improved audience (empty if no improvement)" },
              improved_narrative_arc: { type: "string", description: "Improved arc (empty if no improvement)" },
              improved_slides: {
                type: "array",
                description: "Improved slides (empty array if no improvement needed)",
                items: slideSchema,
              },
            },
            required: [
              "score", "passed", "issues",
              "has_improved_outline",
              "improved_presentation_title",
              "improved_target_audience",
              "improved_narrative_arc",
              "improved_slides",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) {
      console.warn("[OutlineCritic] Empty LLM response, using local validation only");
      return {
        outline,
        critique: {
          score: localScore,
          passed: localScore >= 7,
          issues: localIssues,
        },
      };
    }

    const textContent = typeof raw === "string" ? raw : JSON.stringify(raw);
    const llmResult = JSON.parse(textContent);

    // Merge local and LLM issues
    const allIssues: CritiqueIssue[] = [
      ...localIssues,
      ...llmResult.issues.map((i: any) => ({
        severity: i.severity as "error" | "warning" | "suggestion",
        aspect: i.aspect,
        message: i.message,
        affected_slides: i.affected_slides || [],
      })),
    ];

    // Use the lower of local and LLM scores
    const finalScore = Math.min(localScore, llmResult.score);
    const passed = finalScore >= 7;

    const critique: CritiqueResult = {
      score: finalScore,
      passed,
      issues: allIssues,
    };

    // If LLM provided improved outline and score is low, use it
    if (
      !passed &&
      llmResult.has_improved_outline &&
      llmResult.improved_slides &&
      llmResult.improved_slides.length >= 5
    ) {
      const improvedOutline: OutlineResult = {
        presentation_title: llmResult.improved_presentation_title || outline.presentation_title,
        target_audience: llmResult.improved_target_audience || outline.target_audience,
        narrative_arc: llmResult.improved_narrative_arc || outline.narrative_arc,
        slides: llmResult.improved_slides,
      };

      critique.improved_outline = improvedOutline;

      console.log(
        `[OutlineCritic] Score ${finalScore}/10 — using improved outline (${improvedOutline.slides.length} slides)`,
      );

      return { outline: improvedOutline, critique };
    }

    console.log(
      `[OutlineCritic] Score ${finalScore}/10 — ${passed ? "passed" : "issues found but no improved outline"}`,
    );

    return { outline, critique };
  } catch (err) {
    console.error("[OutlineCritic] LLM critique failed, using local validation only:", err);
    return {
      outline,
      critique: {
        score: localScore,
        passed: localScore >= 7,
        issues: localIssues,
      },
    };
  }
}
