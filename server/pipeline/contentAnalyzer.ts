/**
 * Content Analyzer — deterministic content-type detection and layout recommendation.
 *
 * Analyzes SlideContent (title, text, data_points, key_message) to determine
 * the content type and recommend the best layout. This runs BEFORE the Layout Agent
 * to provide hints, and AFTER to validate/override poor choices.
 */

import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// CONTENT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════

export type ContentType =
  | "data_heavy"       // Lots of numbers, percentages, metrics
  | "process"          // Sequential steps, methodology, workflow
  | "comparison"       // Two sides, pros/cons, before/after
  | "timeline"         // Chronological events, roadmap, milestones
  | "quote"            // Contains a direct quote from a person
  | "metrics"          // 3-5 key statistics/KPIs
  | "single_metric"    // One dominant number with context
  | "swot"             // SWOT analysis
  | "funnel"           // Sales/conversion funnel
  | "hierarchy"        // Pyramid, levels, layers
  | "matrix"           // 2x2 grid, prioritization
  | "checklist"        // Action items, requirements
  | "risk"             // Risk assessment, impact/probability
  | "scenario"         // Scenarios, forecasting
  | "narrative"        // General text/explanation
  | "section_intro"    // Section introduction
  | "title"            // Title slide
  | "closing"          // Final/closing slide
  | "agenda";          // Table of contents, agenda

export interface ContentAnalysis {
  slideNumber: number;
  contentType: ContentType;
  confidence: number; // 0-1, how confident we are in the classification
  recommendedLayouts: string[]; // ordered by preference
  signals: string[]; // what triggered this classification
  dataPointCount: number;
  numericDensity: number; // ratio of numeric tokens to total tokens
  bulletCount: number;
  hasQuote: boolean;
}

// ═══════════════════════════════════════════════════════
// KEYWORD PATTERNS (bilingual: Russian + English)
// ═══════════════════════════════════════════════════════

const PROCESS_KEYWORDS = /(этап|шаг|процесс|методолог|алгоритм|последовательн|пошагов|workflow|step|stage|process|methodology|pipeline|порядок|инструкц|как работает|how it works|внедрен|реализац|implement)/i;

const COMPARISON_KEYWORDS = /(сравнен|против|vs\.?|versus|преимущества и недостатки|плюсы и минусы|pros.*cons|до и после|before.*after|отличи|различи|альтернатив|выбор между|compare|comparison|за и против)/i;

const TIMELINE_KEYWORDS = /(хронолог|timeline|roadmap|дорожная карта|этапы развит|история|evolution|milestones|вехи|квартал|Q[1-4]|2024|2025|2026|2027|2028|2029|2030|план на|стратегический план|фаза|phase)/i;

const QUOTE_PATTERNS = /["«»""''].*["«»""'']|—\s*[A-ZА-ЯЁ][a-zа-яё]+\s+[A-ZА-ЯЁ]/;

const SWOT_KEYWORDS = /(swot|сильные.*слабые|strengths.*weaknesses|opportunities.*threats|возможности.*угрозы)/i;

const FUNNEL_KEYWORDS = /(воронк|funnel|конверси|conversion|этап продаж|sales stage|sales funnel|awareness.*consideration|consideration.*decision)/i;

const HIERARCHY_KEYWORDS = /(иерарх|пирамид|pyramid|уровн|level|layer|слой|приоритет|priority|фреймворк|модель маслоу|maslow)/i;

const MATRIX_KEYWORDS = /(матриц|matrix|2x2|квадрант|quadrant|приоритизац|effort.*impact|impact.*effort|усилия.*эффект)/i;

const CHECKLIST_KEYWORDS = /(чеклист|checklist|требован|requirement|готовность|readiness|action item|задач|task list|план действий|to.?do)/i;

const RISK_KEYWORDS = /(риск|risk|угроз|threat|митигац|mitigat|вероятность|probability|воздействи|оценка рисков|risk assessment)/i;

const SCENARIO_KEYWORDS = /(сценарий|scenario|оптимистич|пессимистич|базовый сценарий|base case|best case|worst case|optimistic|pessimistic)/i;

const AGENDA_KEYWORDS = /(повестка|agenda|содержание|table of contents|план презентации|обзор тем)/i;

const METRICS_KEYWORDS = /(KPI|метрик|показател|индикатор|ключевые цифры|key figures|итоги)/i;

// ═══════════════════════════════════════════════════════
// CONTENT TYPE TO LAYOUT MAPPING
// ═══════════════════════════════════════════════════════

const CONTENT_TYPE_LAYOUTS: Record<ContentType, string[]> = {
  data_heavy: ["stats-chart", "chart-text", "chart-slide", "dual-chart"],
  process: ["numbered-steps-v2", "process-steps", "timeline-horizontal"],
  comparison: ["comparison", "pros-cons", "two-column"],
  timeline: ["timeline-horizontal", "timeline", "roadmap"],
  quote: ["quote-slide"],
  metrics: ["icons-numbers", "highlight-stats", "stats-chart"],
  single_metric: ["hero-stat", "highlight-stats"],
  swot: ["swot-analysis"],
  funnel: ["funnel"],
  hierarchy: ["pyramid"],
  matrix: ["matrix-2x2"],
  checklist: ["checklist"],
  risk: ["risk-matrix"],
  scenario: ["scenario-cards"],
  narrative: ["text-with-callout", "text-slide", "two-column"],
  section_intro: ["section-header"],
  title: ["title-slide"],
  closing: ["final-slide"],
  agenda: ["agenda-table-of-contents"],
};

// ═══════════════════════════════════════════════════════
// ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Count numeric tokens in text (numbers, percentages, currency amounts).
 */
function countNumericTokens(text: string): number {
  const numericPattern = /\d+[.,]?\d*\s*(%|млн|млрд|тыс|₽|\$|€|£|ГВт|МВт|кВт|billion|million|thousand|GW|MW|kW|x|×)|\$\d+[.,]?\d*/gi;
  const matches = text.match(numericPattern);
  return matches ? matches.length : 0;
}

/**
 * Count bullet points in text.
 */
function countBullets(text: string): number {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const bulletLines = lines.filter(l => /^[\s]*[-•*▸▹►]|\*\*[^*]+\*\*:/.test(l.trim()));
  return Math.max(bulletLines.length, lines.length);
}

/**
 * Check if text contains a quote.
 */
function hasQuote(text: string): boolean {
  return QUOTE_PATTERNS.test(text);
}

/**
 * Analyze a single slide's content and determine its type.
 */
export function analyzeSlideContent(slide: SlideContent): ContentAnalysis {
  const fullText = `${slide.title} ${slide.text} ${slide.key_message}`;
  const dataPointCount = slide.data_points.length;
  const numericTokens = countNumericTokens(fullText);
  const totalTokens = fullText.split(/\s+/).length;
  const numericDensity = totalTokens > 0 ? numericTokens / totalTokens : 0;
  const bulletCount = countBullets(slide.text);
  const slideHasQuote = hasQuote(fullText);
  const signals: string[] = [];

  // ── Fixed layouts for first/last slides ──
  if (slide.slide_number === 1) {
    return {
      slideNumber: slide.slide_number,
      contentType: "title",
      confidence: 1.0,
      recommendedLayouts: ["title-slide"],
      signals: ["slide_number=1"],
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Keyword-based detection (high confidence) ──
  // Order matters: more specific patterns first, generic patterns last
  // Scenario before timeline (both can match year patterns)
  // Risk before process (both can match "impact" patterns)
  const keywordChecks: Array<{ pattern: RegExp; type: ContentType; signal: string }> = [
    { pattern: SWOT_KEYWORDS, type: "swot", signal: "swot_keywords" },
    { pattern: FUNNEL_KEYWORDS, type: "funnel", signal: "funnel_keywords" },
    { pattern: MATRIX_KEYWORDS, type: "matrix", signal: "matrix_keywords" },
    { pattern: SCENARIO_KEYWORDS, type: "scenario", signal: "scenario_keywords" },
    { pattern: RISK_KEYWORDS, type: "risk", signal: "risk_keywords" },
    { pattern: CHECKLIST_KEYWORDS, type: "checklist", signal: "checklist_keywords" },
    { pattern: HIERARCHY_KEYWORDS, type: "hierarchy", signal: "hierarchy_keywords" },
    { pattern: AGENDA_KEYWORDS, type: "agenda", signal: "agenda_keywords" },
  ];

  for (const check of keywordChecks) {
    if (check.pattern.test(fullText)) {
      signals.push(check.signal);
      return {
        slideNumber: slide.slide_number,
        contentType: check.type,
        confidence: 0.85,
        recommendedLayouts: CONTENT_TYPE_LAYOUTS[check.type],
        signals,
        dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
      };
    }
  }

  // ── Quote detection ──
  if (slideHasQuote) {
    signals.push("has_quote");
    return {
      slideNumber: slide.slide_number,
      contentType: "quote",
      confidence: 0.8,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.quote,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Data-heavy detection ──
  if (dataPointCount >= 3 || numericDensity >= 0.15) {
    signals.push(`data_points=${dataPointCount}`, `numeric_density=${numericDensity.toFixed(2)}`);

    // Single dominant metric vs multiple metrics
    if (dataPointCount === 1 && dataPointCount < 3) {
      signals.push("single_dominant_metric");
      return {
        slideNumber: slide.slide_number,
        contentType: "single_metric",
        confidence: 0.8,
        recommendedLayouts: CONTENT_TYPE_LAYOUTS.single_metric,
        signals,
        dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
      };
    }

    if (dataPointCount >= 3 && dataPointCount <= 8) {
      signals.push("metrics_cluster");
      return {
        slideNumber: slide.slide_number,
        contentType: "metrics",
        confidence: 0.85,
        recommendedLayouts: CONTENT_TYPE_LAYOUTS.metrics,
        signals,
        dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
      };
    }

    // Check if metrics keywords present even without data_points
    if (METRICS_KEYWORDS.test(fullText) && numericTokens >= 2) {
      signals.push("metrics_keywords_in_data_heavy");
      return {
        slideNumber: slide.slide_number,
        contentType: "metrics",
        confidence: 0.75,
        recommendedLayouts: CONTENT_TYPE_LAYOUTS.metrics,
        signals,
        dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
      };
    }

    // General data-heavy
    return {
      slideNumber: slide.slide_number,
      contentType: "data_heavy",
      confidence: 0.8,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.data_heavy,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Timeline detection (before process, since "этапы развития" matches both) ──
  if (TIMELINE_KEYWORDS.test(fullText)) {
    signals.push("timeline_keywords");
    return {
      slideNumber: slide.slide_number,
      contentType: "timeline",
      confidence: 0.75,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.timeline,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Process/methodology detection ──
  if (PROCESS_KEYWORDS.test(fullText)) {
    signals.push("process_keywords");
    return {
      slideNumber: slide.slide_number,
      contentType: "process",
      confidence: 0.75,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.process,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Comparison detection ──
  if (COMPARISON_KEYWORDS.test(fullText)) {
    signals.push("comparison_keywords");
    return {
      slideNumber: slide.slide_number,
      contentType: "comparison",
      confidence: 0.75,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.comparison,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Metrics detection (keyword-based, lower confidence than data-point-based) ──
  if (METRICS_KEYWORDS.test(fullText) && numericTokens >= 2) {
    signals.push("metrics_keywords", `numeric_tokens=${numericTokens}`);
    return {
      slideNumber: slide.slide_number,
      contentType: "metrics",
      confidence: 0.65,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.metrics,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Section intro detection ──
  // Only match if the title explicitly starts with section-like words AND text is very short (< 50 chars)
  // This prevents false positives on slides with short but meaningful content
  const isSectionTitle = /^(раздел|секция|часть|section|part)\s/i.test(slide.title);
  const isVeryShortText = slide.text.trim().length < 50 && bulletCount <= 1 && dataPointCount === 0;
  if (isSectionTitle || (isVeryShortText && numericTokens === 0)) {
    signals.push("short_text_section_intro");
    return {
      slideNumber: slide.slide_number,
      contentType: "section_intro",
      confidence: 0.6,
      recommendedLayouts: CONTENT_TYPE_LAYOUTS.section_intro,
      signals,
      dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
    };
  }

  // ── Default: narrative/explanation ──
  signals.push("default_narrative");
  return {
    slideNumber: slide.slide_number,
    contentType: "narrative",
    confidence: 0.5,
    recommendedLayouts: CONTENT_TYPE_LAYOUTS.narrative,
    signals,
    dataPointCount, numericDensity, bulletCount, hasQuote: slideHasQuote,
  };
}

/**
 * Analyze all slides and return content analyses.
 */
export function analyzeAllSlides(slides: SlideContent[]): ContentAnalysis[] {
  return slides.map(analyzeSlideContent);
}

/**
 * Build an enriched slides summary for the Layout Agent LLM prompt.
 * Includes content type hints, data signals, and recommended layouts.
 */
export function buildEnrichedSlidesSummary(slides: SlideContent[], analyses: ContentAnalysis[]): string {
  const analysisMap = new Map(analyses.map(a => [a.slideNumber, a]));

  return slides.map(s => {
    const analysis = analysisMap.get(s.slide_number);
    const dataTag = s.data_points.length > 0
      ? ` [HAS ${s.data_points.length} DATA POINTS]`
      : "";
    const numericTag = analysis && analysis.numericDensity >= 0.1
      ? ` [NUMERIC DENSITY: ${(analysis.numericDensity * 100).toFixed(0)}%]`
      : "";
    const contentTypeTag = analysis
      ? ` [CONTENT TYPE: ${analysis.contentType.toUpperCase()}]`
      : "";
    const recommendedTag = analysis && analysis.confidence >= 0.7
      ? ` [RECOMMENDED: ${analysis.recommendedLayouts.slice(0, 3).join(" | ")}]`
      : "";
    const bulletTag = analysis && analysis.bulletCount >= 4
      ? ` [${analysis.bulletCount} BULLETS]`
      : "";

    return `Slide ${s.slide_number}: "${s.title}" — ${s.key_message || s.text.substring(0, 120)}${dataTag}${numericTag}${bulletTag}${contentTypeTag}${recommendedTag}`;
  }).join("\n");
}

/**
 * Post-LLM content-aware layout override.
 * If the LLM chose a layout that contradicts the content analysis,
 * override it with a better match. Only overrides with high confidence.
 */
export function applyContentAwareOverrides(
  layoutMap: Map<number, string>,
  analyses: ContentAnalysis[],
): Map<number, string> {
  const EXEMPT_LAYOUTS = new Set(["title-slide", "final-slide"]);

  // Layouts that are "wrong" for specific content types
  const CONTENT_LAYOUT_CONFLICTS: Record<string, Set<string>> = {
    data_heavy: new Set(["text-slide", "text-with-callout", "two-column", "process-steps", "numbered-steps-v2"]),
    process: new Set(["chart-slide", "stats-chart", "chart-text", "dual-chart", "icons-numbers", "highlight-stats", "hero-stat"]),
    comparison: new Set(["text-slide", "chart-slide", "stats-chart", "process-steps", "numbered-steps-v2", "timeline", "timeline-horizontal"]),
    timeline: new Set(["chart-slide", "stats-chart", "icons-numbers", "two-column", "comparison", "pros-cons"]),
    swot: new Set(["text-slide", "chart-slide", "process-steps", "timeline"]),
    funnel: new Set(["text-slide", "chart-slide", "timeline", "comparison"]),
    hierarchy: new Set(["text-slide", "chart-slide", "timeline", "comparison"]),
    matrix: new Set(["text-slide", "chart-slide", "timeline", "process-steps"]),
    checklist: new Set(["chart-slide", "timeline", "comparison", "stats-chart"]),
    risk: new Set(["text-slide", "chart-slide", "process-steps", "timeline"]),
    scenario: new Set(["text-slide", "chart-slide", "timeline", "process-steps"]),
    metrics: new Set(["text-slide", "text-with-callout", "process-steps", "timeline", "comparison"]),
    single_metric: new Set(["text-slide", "text-with-callout", "process-steps", "timeline", "comparison", "two-column"]),
  };

  for (const analysis of analyses) {
    const currentLayout = layoutMap.get(analysis.slideNumber);
    if (!currentLayout || EXEMPT_LAYOUTS.has(currentLayout)) continue;

    // Only override if confidence is high enough
    if (analysis.confidence < 0.7) continue;

    const conflicts = CONTENT_LAYOUT_CONFLICTS[analysis.contentType];
    if (!conflicts || !conflicts.has(currentLayout)) continue;

    // The current layout conflicts with the content type — find a better one
    const usedLayouts = new Set(layoutMap.values());
    const recommended = analysis.recommendedLayouts.find(l => {
      // Prefer layouts that aren't already overused
      let count = 0;
      for (const [, v] of Array.from(layoutMap.entries())) {
        if (v === l) count++;
      }
      return count < 2;
    });

    if (recommended) {
      console.log(
        `[ContentAnalyzer] Override: slide ${analysis.slideNumber} "${currentLayout}" → "${recommended}" ` +
        `(content_type=${analysis.contentType}, confidence=${analysis.confidence.toFixed(2)}, signals=[${analysis.signals.join(", ")}])`
      );
      layoutMap.set(analysis.slideNumber, recommended);
    }
  }

  return layoutMap;
}
