/**
 * Research Agent — enriches presentation content with facts, statistics, and data.
 * 
 * Architecture:
 * 1. Analyzes the outline to identify topics needing research
 * 2. Generates targeted research queries per slide
 * 3. Uses LLM to produce factual research briefs with specific data points
 * 4. Creates a ResearchContext that is injected into Writer prompts
 * 
 * The agent uses LLM's training data as the knowledge base, producing
 * structured research briefs with facts, statistics, trends, and examples.
 * The architecture is designed to be easily extended with web search APIs
 * when they become available.
 */

import { invokeLLM } from "../_core/llm";
import { callDataApi } from "../_core/dataApi";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ResearchQuery {
  slide_number: number;
  slide_title: string;
  queries: string[];
  research_focus: string;
}

export interface ResearchFact {
  fact: string;
  source_type: "statistic" | "trend" | "case_study" | "expert_opinion" | "comparison" | "definition" | "historical";
  confidence: "high" | "medium" | "low";
  year?: string;
  source_hint?: string;
}

export interface SlideResearch {
  slide_number: number;
  slide_title: string;
  facts: ResearchFact[];
  key_statistics: string[];
  industry_context: string;
  recommended_data_points: Array<{ label: string; value: string; unit: string }>;
}

export interface ResearchContext {
  presentation_topic: string;
  overall_context: string;
  slide_research: SlideResearch[];
  total_facts_found: number;
}

export interface OutlineForResearch {
  presentation_title: string;
  target_audience: string;
  narrative_arc: string;
  slides: Array<{
    slide_number: number;
    title: string;
    purpose: string;
    key_points: string[];
  }>;
}

// ═══════════════════════════════════════════════════════
// RESEARCH QUERY GENERATOR
// ═══════════════════════════════════════════════════════

/**
 * Determine which slides need research (skip title, section headers, final slides).
 */
export function identifySlidesForResearch(outline: OutlineForResearch): OutlineForResearch["slides"] {
  return outline.slides.filter((slide) => {
    const titleLower = slide.title.toLowerCase();
    const purposeLower = slide.purpose.toLowerCase();
    
    // Skip purely structural slides
    const isTitle = slide.slide_number === 1 || 
      purposeLower.includes("title slide") || 
      purposeLower.includes("титульный");
    const isFinal = purposeLower.includes("final") || 
      purposeLower.includes("заключ") || 
      purposeLower.includes("call to action") ||
      purposeLower.includes("призыв") ||
      purposeLower.includes("thank") ||
      purposeLower.includes("спасибо") ||
      purposeLower.includes("контакт");
    const isSectionHeader = purposeLower.includes("section header") || 
      purposeLower.includes("разделител") ||
      purposeLower.includes("заголовок секции");
    
    return !isTitle && !isFinal && !isSectionHeader;
  });
}

/**
 * Generate research queries for each slide based on its content.
 */
export function generateResearchQueries(
  outline: OutlineForResearch,
  slidesToResearch: OutlineForResearch["slides"]
): ResearchQuery[] {
  return slidesToResearch.map((slide) => {
    const keyPointsText = slide.key_points.join("; ");
    
    // Determine research focus based on slide purpose and key points
    let researchFocus = "general facts and statistics";
    
    const combined = `${slide.title} ${slide.purpose} ${keyPointsText}`.toLowerCase();
    
    // Order matters: more specific patterns first, generic ones (like 'ai') last
    if (combined.match(/конкурен|competit|сравнен|comparison|альтернатив/)) {
      researchFocus = "competitive landscape, market share, differentiators";
    } else if (combined.match(/проблем|problem|challeng|вызов|риск|risk|угроз/)) {
      researchFocus = "industry challenges, risk statistics, failure rates";
    } else if (combined.match(/рынок|market|revenue|доход|оборот|выручка|рост|growth/)) {
      researchFocus = "market data, revenue figures, growth rates, market size";
    } else if (combined.match(/решени|solution|стратег|strategy|план|plan|подход/)) {
      researchFocus = "best practices, implementation frameworks, success metrics";
    } else if (combined.match(/тренд|trend|будущ|future|прогноз|forecast|перспектив/)) {
      researchFocus = "industry forecasts, emerging trends, expert predictions";
    } else if (combined.match(/результат|result|roi|эффект|impact|outcome|метрик/)) {
      researchFocus = "ROI data, performance metrics, impact studies, benchmarks";
    } else if (combined.match(/технолог|technology|ai|ml|искусственн|machine learning|automation/)) {
      researchFocus = "technology trends, adoption rates, benchmarks, case studies";
    } else if (combined.match(/команд|team|культур|culture|процесс|process|организац/)) {
      researchFocus = "organizational studies, team performance data, process benchmarks";
    }
    
    // Generate 2-3 targeted queries
    const queries: string[] = [
      `${slide.title} statistics data ${new Date().getFullYear()}`,
      `${keyPointsText.substring(0, 100)} research facts`,
    ];
    
    if (researchFocus.includes("market")) {
      queries.push(`${outline.presentation_title} market size forecast`);
    } else if (researchFocus.includes("technology")) {
      queries.push(`${slide.title} adoption rate enterprise`);
    }
    
    return {
      slide_number: slide.slide_number,
      slide_title: slide.title,
      queries,
      research_focus: researchFocus,
    };
  });
}

// ═══════════════════════════════════════════════════════
// WEB SEARCH (via Data API)
// ═══════════════════════════════════════════════════════

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Attempt web search via Data API (Google/search).
 * Returns null if search is unavailable.
 */
async function webSearch(query: string): Promise<WebSearchResult[] | null> {
  try {
    const result = await callDataApi("Google/search", {
      query: { q: query, num: 5, hl: "ru" },
    });
    if (!result || typeof result !== "object") return null;
    const data = result as Record<string, unknown>;
    const items = (data.organic_results || data.items || data.results || []) as Array<Record<string, string>>;
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.slice(0, 5).map((item) => ({
      title: item.title || "",
      snippet: item.snippet || item.description || "",
      url: item.link || item.url || "",
    }));
  } catch (error) {
    console.log(`[Research] Web search unavailable: ${(error as Error).message}`);
    return null;
  }
}

/** Test if web search is available */
async function isWebSearchAvailable(): Promise<boolean> {
  try {
    const result = await webSearch("test");
    return result !== null && result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Gather web search context for a batch of research queries.
 * Returns a map of slide_number -> search results text.
 */
async function gatherWebSearchContext(
  queries: ResearchQuery[],
): Promise<Map<number, string>> {
  const contextMap = new Map<number, string>();
  
  // Search in parallel (max 3 concurrent)
  const CONCURRENCY = 3;
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (q) => {
        const searchQuery = q.queries[0]; // Use the primary query
        const sr = await webSearch(searchQuery);
        return { slideNumber: q.slide_number, searchResults: sr };
      }),
    );
    for (const { slideNumber, searchResults: sr } of batchResults) {
      if (sr && sr.length > 0) {
        const text = sr
          .map((r: WebSearchResult, idx: number) => `[${idx + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`)
          .join("\n\n");
        contextMap.set(slideNumber, text);
      }
    }
  }
  
  return contextMap;
}

// ═══════════════════════════════════════════════════════
// LLM-BASED RESEARCH
// ═══════════════════════════════════════════════════════

const RESEARCH_SYSTEM_PROMPT = `You are Research Agent — an expert fact-finder and data analyst for business presentations.

<role>
Your job is to provide SPECIFIC, FACTUAL, and QUANTIFIED information to enrich presentation slides.
You act as a research analyst who provides the kind of data that makes presentations credible and compelling.
</role>

<rules>
- Every fact MUST include a specific number, percentage, date, or measurable metric.
- Prefer recent data (2023-2025) when possible.
- Include source hints (e.g., "according to McKinsey", "Gartner reports", "IDC data").
- Provide a mix of: statistics, trends, case studies, and expert opinions.
- For each slide, provide 3-5 highly relevant facts.
- Mark confidence level: "high" for well-known facts, "medium" for reasonable estimates, "low" for extrapolations.
- Include recommended data_points that can be used for charts/visualizations.
- Be SPECIFIC: "The global AI market reached $196B in 2023" NOT "The AI market is growing".
- If you're not confident about exact numbers, provide reasonable ranges with "medium" confidence.
- NEVER fabricate specific company revenue or stock prices — use industry-level data instead.
</rules>

<output_format>
Return a JSON with research results for each slide.
</output_format>`;

function buildResearchUserPrompt(
  presentationTitle: string,
  targetAudience: string,
  queries: ResearchQuery[],
  webSearchContext?: Map<number, string>,
): string {
  const slidesInfo = queries.map((q) => {
    let slideBlock = `Slide ${q.slide_number}: "${q.slide_title}"\n  Research focus: ${q.research_focus}\n  Queries: ${q.queries.join("; ")}`;
    const webCtx = webSearchContext?.get(q.slide_number);
    if (webCtx) {
      slideBlock += `\n\n  WEB SEARCH RESULTS:\n${webCtx}`;
    }
    return slideBlock;
  }).join("\n\n");

  return `<presentation>
Title: ${presentationTitle}
Target audience: ${targetAudience}
</presentation>

<research_requests>
${slidesInfo}
</research_requests>

For each slide, provide:
1. 3-5 specific facts with numbers/percentages
2. Key statistics that can be used in data visualizations
3. Brief industry context (1-2 sentences)
4. 2-3 recommended data points for charts (label, value, unit)

Focus on REAL, VERIFIABLE data. Mark confidence levels honestly.
${webSearchContext && webSearchContext.size > 0 ? "\nWEB SEARCH RESULTS are provided for some slides. Use them to find SPECIFIC facts with source URLs. Cite the source URL in source_hint." : ""}`;
}

/**
 * Run LLM-based research for a batch of slides.
 */
async function runResearchBatch(
  presentationTitle: string,
  targetAudience: string,
  queries: ResearchQuery[],
  webSearchContext?: Map<number, string>,
): Promise<SlideResearch[]> {
  const userPrompt = buildResearchUserPrompt(presentationTitle, targetAudience, queries, webSearchContext);
  
  const response = await invokeLLM({
    messages: [
      { role: "system", content: RESEARCH_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ResearchResults",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_number: { type: "integer" },
                  slide_title: { type: "string" },
                  facts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fact: { type: "string", description: "Specific factual statement with numbers" },
                        source_type: { 
                          type: "string", 
                          enum: ["statistic", "trend", "case_study", "expert_opinion", "comparison", "definition", "historical"]
                        },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                        year: { type: "string", description: "Year of the data" },
                        source_hint: { type: "string", description: "Source attribution hint" },
                      },
                      required: ["fact", "source_type", "confidence", "year", "source_hint"],
                      additionalProperties: false,
                    },
                  },
                  key_statistics: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key statistics formatted for slide display",
                  },
                  industry_context: { type: "string", description: "Brief industry context" },
                  recommended_data_points: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        value: { type: "string" },
                        unit: { type: "string" },
                      },
                      required: ["label", "value", "unit"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["slide_number", "slide_title", "facts", "key_statistics", "industry_context", "recommended_data_points"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty research response from LLM");
  }

  const parsed = JSON.parse(content) as { slides: SlideResearch[] };
  return parsed.slides;
}

/**
 * Generate overall context summary for the presentation topic.
 */
async function generateOverallContext(
  presentationTitle: string,
  targetAudience: string,
  narrativeArc: string
): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a research analyst. Provide a concise 3-4 sentence overview of the current state of the topic for a presentation. Include the most important recent trends, market data, and key facts. Be specific with numbers and dates.`,
      },
      {
        role: "user",
        content: `Topic: "${presentationTitle}"\nAudience: ${targetAudience}\nNarrative approach: ${narrativeArc}\n\nProvide a brief research overview with key facts and current data.`,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

// ═══════════════════════════════════════════════════════
// RESEARCH CONTEXT FORMATTER
// ═══════════════════════════════════════════════════════

/**
 * Format research results into a context string for the Writer agent.
 */
export function formatResearchForWriter(
  slideNumber: number,
  researchContext: ResearchContext
): string {
  const slideResearch = researchContext.slide_research.find(
    (sr) => sr.slide_number === slideNumber
  );

  if (!slideResearch) return "";

  const parts: string[] = [];

  // Overall context
  if (researchContext.overall_context) {
    parts.push(`<industry_context>\n${researchContext.overall_context}\n</industry_context>`);
  }

  // Slide-specific facts
  if (slideResearch.facts.length > 0) {
    const factsText = slideResearch.facts
      .filter((f) => f.confidence !== "low")
      .map((f) => {
        const source = f.source_hint ? ` (${f.source_hint}, ${f.year})` : f.year ? ` (${f.year})` : "";
        return `• ${f.fact}${source}`;
      })
      .join("\n");
    parts.push(`<research_facts>\n${factsText}\n</research_facts>`);
  }

  // Key statistics
  if (slideResearch.key_statistics.length > 0) {
    parts.push(`<key_statistics>\n${slideResearch.key_statistics.join("\n")}\n</key_statistics>`);
  }

  // Recommended data points
  if (slideResearch.recommended_data_points.length > 0) {
    const dpText = slideResearch.recommended_data_points
      .map((dp) => `• ${dp.label}: ${dp.value} ${dp.unit}`)
      .join("\n");
    parts.push(`<suggested_data_points>\n${dpText}\n</suggested_data_points>`);
  }

  if (parts.length === 0) return "";

  return `\n<research_data>\nUse these verified facts and statistics to enrich your content. Integrate them naturally into bullet points and data_points.\n${parts.join("\n")}\n</research_data>`;
}

// ═══════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

export interface ResearchAgentResult {
  context: ResearchContext;
  slidesResearched: number;
  totalFacts: number;
}

/**
 * Run the Research Agent on the outline to produce enriched context.
 * 
 * @param outline - The presentation outline
 * @param onProgress - Optional progress callback
 * @returns ResearchContext with facts and data for each slide
 */
export async function runResearchAgent(
  outline: OutlineForResearch,
  onProgress?: (message: string) => void,
): Promise<ResearchAgentResult> {
  // 1. Identify slides that need research
  const slidesToResearch = identifySlidesForResearch(outline);
  
  if (slidesToResearch.length === 0) {
    return {
      context: {
        presentation_topic: outline.presentation_title,
        overall_context: "",
        slide_research: [],
        total_facts_found: 0,
      },
      slidesResearched: 0,
      totalFacts: 0,
    };
  }

  onProgress?.(`Исследование ${slidesToResearch.length} слайдов...`);

  // 2. Generate research queries
  const queries = generateResearchQueries(outline, slidesToResearch);

  // 2.5. Attempt web search for additional context
  let webSearchContext: Map<number, string> | undefined;
  let searchAvailable = false;
  try {
    searchAvailable = await isWebSearchAvailable();
    if (searchAvailable) {
      onProgress?.("Поиск фактов в интернете...");
      webSearchContext = await gatherWebSearchContext(queries);
      console.log(`[Research] Web search: found results for ${webSearchContext.size}/${queries.length} slides`);
    } else {
      console.log("[Research] Web search unavailable, using LLM knowledge only");
    }
  } catch (err) {
    console.log(`[Research] Web search failed: ${(err as Error).message}`);
  }

  // 3. Run research in batches (max 5 slides per batch to keep LLM context manageable)
  const batchSize = 5;
  const allResearch: SlideResearch[] = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    onProgress?.(`Исследование слайдов ${i + 1}-${Math.min(i + batchSize, queries.length)}...`);
    
    try {
      const batchResults = await runResearchBatch(
        outline.presentation_title,
        outline.target_audience,
        batch,
        webSearchContext,
      );
      allResearch.push(...batchResults);
    } catch (err) {
      console.error(`[Research] Batch ${i / batchSize + 1} failed:`, err);
      // Create empty research for failed slides
      for (const q of batch) {
        allResearch.push({
          slide_number: q.slide_number,
          slide_title: q.slide_title,
          facts: [],
          key_statistics: [],
          industry_context: "",
          recommended_data_points: [],
        });
      }
    }
  }

  // 4. Generate overall context
  onProgress?.("Формирование общего контекста...");
  let overallContext = "";
  try {
    overallContext = await generateOverallContext(
      outline.presentation_title,
      outline.target_audience,
      outline.narrative_arc
    );
  } catch (err) {
    console.error("[Research] Overall context generation failed:", err);
  }

  // 5. Assemble research context
  const totalFacts = allResearch.reduce((sum, sr) => sum + sr.facts.length, 0);

  const context: ResearchContext = {
    presentation_topic: outline.presentation_title,
    overall_context: overallContext,
    slide_research: allResearch,
    total_facts_found: totalFacts,
  };

  return {
    context,
    slidesResearched: slidesToResearch.length,
    totalFacts,
  };
}
