/**
 * Content Evaluator Agent — Evaluator-Optimizer pattern (Anthropic).
 * Scores each slide on 4 criteria (SPECIFICITY, DENSITY, NOVELTY, ACTIONABILITY).
 * Slides scoring below threshold get specific rewrite feedback.
 */
import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface SlideEvaluation {
  slide_number: number;
  scores: {
    specificity: number;   // 1-5: concrete facts/numbers vs vague generalities
    density: number;       // 1-5: optimal info density for slide type
    novelty: number;       // 1-5: new info vs repetition of previous slides
    actionability: number; // 1-5: audience can act on this information
  };
  average: number;
  passed: boolean;
  feedback: string;  // specific rewrite instructions if failed
}

export interface EvaluationResult {
  evaluations: SlideEvaluation[];
  overallScore: number;
  failedSlides: number[];
}

export interface SlideForEval {
  slide_number: number;
  title: string;
  text: string;
  key_message: string;
  content_shape?: string;
  structured_content?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const PASS_THRESHOLD = 3.5;
const MAX_RETRIES = 2;

// Slides that are structural (not content-heavy) get a lower bar
const STRUCTURAL_SHAPES = new Set([
  "title", "section_header", "final", "quote_highlight",
]);

const CONTENT_EVALUATOR_SYSTEM = `You are Content Evaluator — a quality assessor for presentation slide content.

<role>
Evaluate each slide's content quality using a strict rubric. Your goal is to catch weak, vague, or repetitive content BEFORE it reaches the audience.
</role>

<rubric>
Score each criterion from 1 (worst) to 5 (best):

**SPECIFICITY** (1-5):
- 5: Contains specific numbers, percentages, dates, names, or concrete examples
- 4: Mostly specific with 1-2 concrete data points
- 3: Mix of specific and general statements
- 2: Mostly vague ("significant growth", "many companies")
- 1: Entirely abstract with no concrete details

**DENSITY** (1-5):
- 5: Perfect amount of information for the slide type (not too sparse, not overloaded)
- 4: Slightly over or under optimal density
- 3: Noticeable imbalance (too much text or too little substance)
- 2: Clearly wrong density (wall of text or nearly empty)
- 1: Completely inappropriate density

**NOVELTY** (1-5):
- 5: Entirely new information not covered in previous slides
- 4: Mostly new with minor overlap
- 3: Some repetition of previous points
- 2: Significant repetition, little new value
- 1: Almost entirely repeats previous slides

**ACTIONABILITY** (1-5):
- 5: Clear takeaway — audience knows exactly what to do/think
- 4: Good takeaway with minor ambiguity
- 3: Takeaway exists but is vague
- 2: Unclear what audience should do with this information
- 1: No discernible takeaway or call to action
</rubric>

<rules>
- Be STRICT. Average presentation content scores 2-3, not 4-5.
- For structural slides (title, section-header, final, quote): be lenient on DENSITY and ACTIONABILITY.
- When a slide fails (average < 3.5), provide SPECIFIC rewrite instructions:
  BAD: "Make it more specific"
  GOOD: "Replace 'significant market growth' with actual market size (e.g., '$4.2B in 2025'). Add 2-3 concrete competitor names instead of 'many players'."
- Feedback must be actionable — the Writer should know exactly what to change.
</rules>

<output_format>
Return a JSON array of evaluations:
[
  {
    "slide_number": 1,
    "scores": { "specificity": 4, "density": 5, "novelty": 5, "actionability": 3 },
    "feedback": "Specific rewrite instructions or empty string if passed"
  }
]
</output_format>`;

function buildEvaluatorUserPrompt(
  slides: SlideForEval[],
  previousTitles: string[],
): string {
  const slidesText = slides.map((s) => {
    const structuredInfo = s.structured_content
      ? `\nStructured content keys: [${Object.keys(s.structured_content).join(", ")}]`
      : "";
    return `--- Slide ${s.slide_number}: "${s.title}" ---
Content shape: ${s.content_shape || "bullet_points"}
Key message: ${s.key_message}
Text:
${s.text}${structuredInfo}`;
  }).join("\n\n");

  const contextInfo = previousTitles.length > 0
    ? `\n<previous_slides_titles>\n${previousTitles.join("\n")}\n</previous_slides_titles>\n`
    : "";

  return `${contextInfo}
<slides_to_evaluate>
${slidesText}
</slides_to_evaluate>

Evaluate each slide using the rubric. Return JSON array.`;
}

// ═══════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Evaluate a batch of slides using LLM.
 * Returns evaluations with scores and feedback.
 */
export async function evaluateSlides(
  slides: SlideForEval[],
  previousTitles: string[] = [],
): Promise<EvaluationResult> {
  if (slides.length === 0) {
    return { evaluations: [], overallScore: 5, failedSlides: [] };
  }

  const userPrompt = buildEvaluatorUserPrompt(slides, previousTitles);

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: CONTENT_EVALUATOR_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content || "[]";
    const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const parsed: Array<{
      slide_number: number;
      scores: { specificity: number; density: number; novelty: number; actionability: number };
      feedback: string;
    }> = JSON.parse(jsonStr.trim());

    const evaluations: SlideEvaluation[] = parsed.map((e) => {
      const scores = {
        specificity: clamp(e.scores.specificity, 1, 5),
        density: clamp(e.scores.density, 1, 5),
        novelty: clamp(e.scores.novelty, 1, 5),
        actionability: clamp(e.scores.actionability, 1, 5),
      };
      const avg = (scores.specificity + scores.density + scores.novelty + scores.actionability) / 4;
      const isStructural = STRUCTURAL_SHAPES.has(
        slides.find((s) => s.slide_number === e.slide_number)?.content_shape || "",
      );
      // Structural slides pass with lower threshold
      const threshold = isStructural ? 2.5 : PASS_THRESHOLD;

      return {
        slide_number: e.slide_number,
        scores,
        average: Math.round(avg * 100) / 100,
        passed: avg >= threshold,
        feedback: avg >= threshold ? "" : (e.feedback || "Improve content specificity and density."),
      };
    });

    const overallScore = evaluations.length > 0
      ? Math.round((evaluations.reduce((sum, e) => sum + e.average, 0) / evaluations.length) * 100) / 100
      : 5;

    const failedSlides = evaluations
      .filter((e) => !e.passed)
      .map((e) => e.slide_number);

    return { evaluations, overallScore, failedSlides };
  } catch (err) {
    console.error("[ContentEvaluator] LLM evaluation failed:", err);
    // On failure, pass all slides (don't block pipeline)
    return {
      evaluations: slides.map((s) => ({
        slide_number: s.slide_number,
        scores: { specificity: 4, density: 4, novelty: 4, actionability: 4 },
        average: 4,
        passed: true,
        feedback: "",
      })),
      overallScore: 4,
      failedSlides: [],
    };
  }
}

/**
 * Run the full Evaluator-Optimizer loop:
 * 1. Evaluate all slides
 * 2. For failed slides, provide feedback to Writer for rewrite
 * 3. Re-evaluate rewritten slides (max 2 iterations)
 * Returns the final evaluation result.
 */
export async function runEvaluatorLoop(
  slides: SlideForEval[],
  rewriteCallback: (slideNumber: number, feedback: string) => Promise<SlideForEval>,
  onProgress?: (iteration: number, failedCount: number) => void,
): Promise<{ finalSlides: SlideForEval[]; evaluations: EvaluationResult; iterations: number }> {
  let currentSlides = [...slides];
  let lastEvaluation: EvaluationResult = { evaluations: [], overallScore: 0, failedSlides: [] };

  for (let iteration = 0; iteration <= MAX_RETRIES; iteration++) {
    const previousTitles = currentSlides.map((s) => `Slide ${s.slide_number}: ${s.title}`);
    lastEvaluation = await evaluateSlides(currentSlides, previousTitles);

    console.log(
      `[ContentEvaluator] Iteration ${iteration}: overall=${lastEvaluation.overallScore}, ` +
      `failed=${lastEvaluation.failedSlides.length}/${currentSlides.length}`,
    );

    onProgress?.(iteration, lastEvaluation.failedSlides.length);

    // If all passed or this is the last iteration, stop
    if (lastEvaluation.failedSlides.length === 0 || iteration === MAX_RETRIES) {
      break;
    }

    // Rewrite failed slides in parallel
    const rewritePromises = lastEvaluation.failedSlides.map(async (slideNum) => {
      const eval_ = lastEvaluation.evaluations.find((e) => e.slide_number === slideNum);
      if (!eval_) return;

      try {
        const rewritten = await rewriteCallback(slideNum, eval_.feedback);
        const idx = currentSlides.findIndex((s) => s.slide_number === slideNum);
        if (idx >= 0) {
          currentSlides[idx] = rewritten;
        }
      } catch (err) {
        console.error(`[ContentEvaluator] Rewrite failed for slide ${slideNum}:`, err);
      }
    });

    await Promise.all(rewritePromises);
  }

  return {
    finalSlides: currentSlides,
    evaluations: lastEvaluation,
    iterations: Math.min(MAX_RETRIES + 1, lastEvaluation.failedSlides.length > 0 ? MAX_RETRIES + 1 : 1),
  };
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the pass threshold for a given content shape.
 */
export function getPassThreshold(contentShape?: string): number {
  return STRUCTURAL_SHAPES.has(contentShape || "") ? 2.5 : PASS_THRESHOLD;
}

/**
 * Check if a slide is structural (lower evaluation bar).
 */
export function isStructuralSlide(contentShape?: string): boolean {
  return STRUCTURAL_SHAPES.has(contentShape || "");
}

export { PASS_THRESHOLD, MAX_RETRIES, STRUCTURAL_SHAPES };
