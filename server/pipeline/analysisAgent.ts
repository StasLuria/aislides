/**
 * Analysis Agent — transforms raw research facts into ranked insights and narrative structure.
 *
 * Architecture:
 * 1. Receives raw research_context from the Research Agent
 * 2. Groups facts into thematic clusters
 * 3. Ranks insights by audience impact, uniqueness, and evidence strength
 * 4. Identifies anchor insights (the strongest facts to build the presentation around)
 * 5. Proposes a narrative arc based on the data
 * 6. Identifies gaps in the research
 *
 * This agent bridges the gap between raw data collection and strategic planning.
 * Without it, the planner and outline agents would work with unfiltered data.
 */

import { invokeLLM } from "../_core/llm";
import type { ResearchContext } from "./researchAgent";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ThemeCluster {
  cluster_name: string;
  facts: string[];
  strength: number; // 1-10
  narrative_role: string; // How this cluster can be used in the presentation
}

export interface AnchorInsight {
  insight: string;
  supporting_facts: string[];
  impact_score: number; // 1-10
  recommended_placement: string; // Where in the presentation this works best
}

export interface AnalysisResult {
  theme_clusters: ThemeCluster[];
  anchor_insights: AnchorInsight[];
  narrative_arc: string;
  gaps: string[];
  total_clusters: number;
  total_anchors: number;
}

// ═══════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════

const ANALYSIS_SYSTEM_PROMPT = `You are Analysis Agent — an expert at transforming raw research data into strategic presentation insights.

<role>
Your job is to analyze research findings and produce a structured analysis that will guide the creation of a compelling, data-driven presentation. You bridge the gap between raw facts and strategic storytelling.
</role>

<tasks>
1. GROUPING — Organize facts into 3-7 thematic clusters. Each cluster should represent a coherent theme or argument that could become a section of the presentation.

2. RANKING — Rate each cluster's strength (1-10) based on:
   - Audience impact: Will this surprise, inform, or persuade?
   - Evidence quality: Are there specific numbers and credible sources?
   - Actionability: Can the audience do something with this information?

3. ANCHOR INSIGHTS — Identify 3-5 of the strongest individual insights that the presentation should be built around. These are the "wow moments" — facts so compelling they deserve their own slide or prominent placement. Rate each by impact_score (1-10).

4. NARRATIVE ARC — Based on the data, propose a narrative arc. How should the story flow? What's the logical progression from opening to conclusion? Consider:
   - Problem → Evidence → Solution → Impact
   - Context → Trend → Implication → Action
   - Current state → Gap → Opportunity → Path forward

5. GAPS — Identify what's missing. What questions remain unanswered? What data would strengthen the presentation if available?
</tasks>

<rules>
- Base ALL analysis on the provided research data — do not invent new facts.
- Anchor insights must reference specific facts from the research.
- Clusters should be MECE (Mutually Exclusive, Collectively Exhaustive) where possible.
- The narrative arc should feel natural, not forced — let the data tell the story.
- Be honest about gaps — it's better to acknowledge missing data than to pretend it exists.
- Consider the target audience when ranking impact — what matters to THEM?
- Strength ratings should be discriminating: not everything is a 9 or 10.
- recommended_placement values: "opening" (hook/context), "build-up" (developing argument), "climax" (strongest point), "resolution" (conclusion/call-to-action)
</rules>

<output_format>
Return a JSON object with theme_clusters, anchor_insights, narrative_arc, and gaps.
</output_format>`;

function buildAnalysisUserPrompt(
  userPrompt: string,
  researchContext: ResearchContext,
  language: string,
): string {
  // Format research data for analysis
  const researchSummary = formatResearchForAnalysis(researchContext);

  return `<presentation_request>
Topic: ${userPrompt}
Language: ${language}
</presentation_request>

<research_data>
Overall context: ${researchContext.overall_context}

Total facts found: ${researchContext.total_facts_found}

${researchSummary}
</research_data>

Analyze these research findings and produce:
1. Thematic clusters (3-7 groups of related facts)
2. Anchor insights (3-5 strongest facts to build the presentation around)
3. A recommended narrative arc
4. Identified gaps in the research

Remember: the presentation language is ${language}. Formulate cluster names, insights, and narrative arc in ${language}.`;
}

/**
 * Format research context into a readable string for the analysis agent.
 */
function formatResearchForAnalysis(researchContext: ResearchContext): string {
  if (!researchContext.slide_research || researchContext.slide_research.length === 0) {
    return "No detailed research data available.";
  }

  const parts: string[] = [];

  for (const sr of researchContext.slide_research) {
    const factsText = sr.facts
      .map((f) => {
        const source = f.source_hint ? ` (${f.source_hint}, ${f.year})` : f.year ? ` (${f.year})` : "";
        return `  - [${f.confidence}] ${f.fact}${source} [type: ${f.source_type}]`;
      })
      .join("\n");

    const statsText = sr.key_statistics.length > 0
      ? `  Key stats: ${sr.key_statistics.join("; ")}`
      : "";

    const dataPointsText = sr.recommended_data_points.length > 0
      ? `  Data points: ${sr.recommended_data_points.map((dp) => `${dp.label}: ${dp.value} ${dp.unit}`).join("; ")}`
      : "";

    parts.push(
      `Topic area: "${sr.slide_title}"\n  Context: ${sr.industry_context}\n${factsText}${statsText ? "\n" + statsText : ""}${dataPointsText ? "\n" + dataPointsText : ""}`,
    );
  }

  return parts.join("\n\n");
}

// ═══════════════════════════════════════════════════════
// FORMATTING FOR DOWNSTREAM AGENTS
// ═══════════════════════════════════════════════════════

/**
 * Format analysis result as a context string for downstream agents (planner, outline, critic, writer).
 */
export function formatAnalysisForDownstream(analysis: AnalysisResult): string {
  const clustersText = analysis.theme_clusters
    .sort((a, b) => b.strength - a.strength)
    .map(
      (c) =>
        `[Strength ${c.strength}/10] ${c.cluster_name}\n  Role: ${c.narrative_role}\n  Facts: ${c.facts.join("; ")}`,
    )
    .join("\n\n");

  const anchorsText = analysis.anchor_insights
    .sort((a, b) => b.impact_score - a.impact_score)
    .map(
      (a) =>
        `[Impact ${a.impact_score}/10] ${a.insight}\n  Placement: ${a.recommended_placement}\n  Evidence: ${a.supporting_facts.join("; ")}`,
    )
    .join("\n\n");

  const gapsText = analysis.gaps.length > 0
    ? `\nIdentified gaps:\n${analysis.gaps.map((g) => `  - ${g}`).join("\n")}`
    : "";

  return `<analysis_context>
<theme_clusters>
${clustersText}
</theme_clusters>

<anchor_insights>
${anchorsText}
</anchor_insights>

<narrative_arc>
${analysis.narrative_arc}
</narrative_arc>
${gapsText}
</analysis_context>`;
}

/**
 * Format a compact version of analysis for the writer (per-slide context).
 */
export function formatAnalysisForWriter(analysis: AnalysisResult): string {
  const topAnchors = analysis.anchor_insights
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 5)
    .map((a) => `- [Impact ${a.impact_score}] ${a.insight}`)
    .join("\n");

  return `<analysis_highlights>
Key insights to weave into content:
${topAnchors}

Narrative arc: ${analysis.narrative_arc}
</analysis_highlights>`;
}

// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

export interface AnalysisAgentResult {
  analysis: AnalysisResult;
  clusterCount: number;
  anchorCount: number;
}

/**
 * Run the Analysis Agent on research results to produce ranked insights.
 *
 * @param userPrompt - The original user prompt (presentation topic)
 * @param researchContext - The research context from the Research Agent
 * @param language - The presentation language
 * @param onProgress - Optional progress callback
 * @returns AnalysisResult with clusters, anchors, narrative arc, and gaps
 */
export async function runAnalysisAgent(
  userPrompt: string,
  researchContext: ResearchContext,
  language: string,
  onProgress?: (message: string) => void,
): Promise<AnalysisAgentResult> {
  onProgress?.("Анализ результатов исследования...");

  // Handle edge case: no research data
  if (
    !researchContext.slide_research ||
    researchContext.slide_research.length === 0 ||
    researchContext.total_facts_found === 0
  ) {
    console.log("[Analysis] No research data to analyze, returning empty analysis");
    return {
      analysis: {
        theme_clusters: [],
        anchor_insights: [],
        narrative_arc: "General overview based on the topic",
        gaps: ["No research data was available for analysis"],
        total_clusters: 0,
        total_anchors: 0,
      },
      clusterCount: 0,
      anchorCount: 0,
    };
  }

  const userPromptText = buildAnalysisUserPrompt(userPrompt, researchContext, language);

  onProgress?.("Группировка и ранжирование инсайтов...");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userPromptText },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "AnalysisResult",
        strict: true,
        schema: {
          type: "object",
          properties: {
            theme_clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cluster_name: { type: "string", description: "Name of the thematic cluster" },
                  facts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key facts belonging to this cluster",
                  },
                  strength: {
                    type: "integer",
                    description: "Cluster strength rating 1-10",
                  },
                  narrative_role: {
                    type: "string",
                    description: "How this cluster can be used in the presentation narrative",
                  },
                },
                required: ["cluster_name", "facts", "strength", "narrative_role"],
                additionalProperties: false,
              },
            },
            anchor_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insight: { type: "string", description: "The key insight formulation" },
                  supporting_facts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Facts that support this insight",
                  },
                  impact_score: {
                    type: "integer",
                    description: "Impact score 1-10",
                  },
                  recommended_placement: {
                    type: "string",
                    description: "Where in the presentation: opening, build-up, climax, or resolution",
                  },
                },
                required: ["insight", "supporting_facts", "impact_score", "recommended_placement"],
                additionalProperties: false,
              },
            },
            narrative_arc: {
              type: "string",
              description: "Recommended narrative arc for the presentation",
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              description: "Identified gaps in the research",
            },
          },
          required: ["theme_clusters", "anchor_insights", "narrative_arc", "gaps"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty analysis response from LLM");
  }

  const parsed = JSON.parse(content) as Omit<AnalysisResult, "total_clusters" | "total_anchors">;

  const analysis: AnalysisResult = {
    ...parsed,
    total_clusters: parsed.theme_clusters.length,
    total_anchors: parsed.anchor_insights.length,
  };

  onProgress?.(
    `Анализ завершён: ${analysis.total_clusters} кластеров, ${analysis.total_anchors} якорных инсайтов`,
  );

  return {
    analysis,
    clusterCount: analysis.total_clusters,
    anchorCount: analysis.total_anchors,
  };
}
