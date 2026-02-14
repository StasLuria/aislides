/**
 * Layout Voting — Step 3.1
 *
 * Instead of a single layout choice, the Layout Agent returns top-3 candidates
 * with confidence scores. A scoring function applies diversity penalties to
 * avoid repetitive layouts and selects the best option.
 *
 * Zero extra LLM calls — we just change the output schema.
 */

export interface LayoutCandidate {
  layout_name: string;
  confidence: number; // 0-1
  rationale: string;
}

export interface LayoutVote {
  slide_number: number;
  candidates: LayoutCandidate[];
  rationale: string;
}

export interface LayoutVotingResult {
  slide_number: number;
  layout_name: string;
  rationale: string;
  confidence: number;
  was_reranked: boolean;
}

// Diversity penalty: how much to subtract from confidence for each prior usage
const REPEAT_PENALTY = 0.15;
// Adjacent penalty: extra penalty if the same layout was used on the previous slide
const ADJACENT_PENALTY = 0.25;
// Minimum confidence threshold — if top candidate is above this, skip reranking
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

// Mandatory layouts that cannot be overridden
const MANDATORY_LAYOUTS: Record<string, string> = {
  "kanban_board": "kanban-board",
  "org_structure": "org-chart",
  "swot_quadrants": "swot-analysis",
};

/**
 * Apply diversity-aware scoring to select the best layout from top-3 candidates.
 *
 * @param votes - Array of layout votes from the LLM (one per slide)
 * @param contentShapes - Map of slide_number → content_shape for mandatory overrides
 * @returns Final layout decisions with diversity applied
 */
export function applyLayoutVoting(
  votes: LayoutVote[],
  contentShapes?: Map<number, string>,
): LayoutVotingResult[] {
  const usageCounts = new Map<string, number>();
  const results: LayoutVotingResult[] = [];
  let previousLayout = "";

  for (const vote of votes) {
    const slideShape = contentShapes?.get(vote.slide_number);

    // Check mandatory layouts first
    if (slideShape && MANDATORY_LAYOUTS[slideShape]) {
      const mandatoryLayout = MANDATORY_LAYOUTS[slideShape];
      results.push({
        slide_number: vote.slide_number,
        layout_name: mandatoryLayout,
        rationale: `Mandatory layout for ${slideShape}`,
        confidence: 1.0,
        was_reranked: false,
      });
      usageCounts.set(mandatoryLayout, (usageCounts.get(mandatoryLayout) || 0) + 1);
      previousLayout = mandatoryLayout;
      continue;
    }

    // If no candidates (shouldn't happen), use first candidate or fallback
    if (!vote.candidates || vote.candidates.length === 0) {
      results.push({
        slide_number: vote.slide_number,
        layout_name: "text-slide",
        rationale: "No candidates provided, fallback to text-slide",
        confidence: 0.5,
        was_reranked: false,
      });
      usageCounts.set("text-slide", (usageCounts.get("text-slide") || 0) + 1);
      previousLayout = "text-slide";
      continue;
    }

    const topCandidate = vote.candidates[0];

    // High confidence + not repeated too much → use directly
    if (
      topCandidate.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
      (usageCounts.get(topCandidate.layout_name) || 0) < 2 &&
      topCandidate.layout_name !== previousLayout
    ) {
      results.push({
        slide_number: vote.slide_number,
        layout_name: topCandidate.layout_name,
        rationale: topCandidate.rationale,
        confidence: topCandidate.confidence,
        was_reranked: false,
      });
      usageCounts.set(topCandidate.layout_name, (usageCounts.get(topCandidate.layout_name) || 0) + 1);
      previousLayout = topCandidate.layout_name;
      continue;
    }

    // Apply diversity scoring to all candidates
    const scored = vote.candidates.map((c) => {
      let score = c.confidence;
      const usage = usageCounts.get(c.layout_name) || 0;

      // Repeat penalty
      score -= usage * REPEAT_PENALTY;

      // Adjacent penalty
      if (c.layout_name === previousLayout) {
        score -= ADJACENT_PENALTY;
      }

      // Bonus for unused layouts (encourage diversity)
      if (usage === 0) {
        score += 0.05;
      }

      return { ...c, adjustedScore: Math.max(0, score) };
    });

    // Sort by adjusted score
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

    const winner = scored[0];
    const wasReranked = winner.layout_name !== topCandidate.layout_name;

    results.push({
      slide_number: vote.slide_number,
      layout_name: winner.layout_name,
      rationale: wasReranked
        ? `Reranked: ${winner.rationale} (diversity penalty applied to ${topCandidate.layout_name})`
        : winner.rationale,
      confidence: winner.adjustedScore,
      was_reranked: wasReranked,
    });

    usageCounts.set(winner.layout_name, (usageCounts.get(winner.layout_name) || 0) + 1);
    previousLayout = winner.layout_name;
  }

  return results;
}

/**
 * Convert old-style single-choice LayoutDecision[] to LayoutVote[] format.
 * Used as a fallback if the LLM doesn't return top-3 candidates.
 */
export function convertLegacyDecisions(
  decisions: Array<{ slide_number: number; layout_name: string; rationale: string }>,
): LayoutVote[] {
  return decisions.map((d) => ({
    slide_number: d.slide_number,
    candidates: [
      {
        layout_name: d.layout_name,
        confidence: 0.8,
        rationale: d.rationale,
      },
    ],
    rationale: d.rationale,
  }));
}
