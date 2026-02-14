/**
 * Presentation Type Classifier
 * Classifies user prompt into one of 5 presentation types.
 * Returns type-specific hints for Outline, Writer, and Layout agents.
 */

export type PresentationType =
  | "business_strategy"
  | "product_pitch"
  | "educational"
  | "investor_deck"
  | "quarterly_review";

export interface TypeProfile {
  type: PresentationType;
  label: string;
  preferredArcs: string[];
  preferredLayouts: string[];
  tone: string;
  contentRules: string;
  outlineHint: string;
  writerHint: string;
  layoutHint: string;
}

const TYPE_PROFILES: Record<PresentationType, TypeProfile> = {
  business_strategy: {
    type: "business_strategy",
    label: "Бизнес-стратегия",
    preferredArcs: ["problem_solution", "situation_complication_resolution"],
    preferredLayouts: ["stats-chart", "comparison-table", "icons-numbers", "highlight-stats", "numbered-steps-v2"],
    tone: "Authoritative, data-driven, forward-looking. Use metrics and strategic frameworks.",
    contentRules: "Include market data, competitive analysis, KPIs. Every claim backed by numbers.",
    outlineHint: "Structure: Current State → Challenge → Strategy → Implementation → Expected Results. Use data-heavy slides for market analysis.",
    writerHint: "Tone: authoritative, strategic. Use specific metrics, market data, competitive benchmarks. Avoid vague claims.",
    layoutHint: "Prefer data visualization layouts (stats-chart, comparison-table, highlight-stats) for analytical slides. Use icons-numbers for KPIs.",
  },
  product_pitch: {
    type: "product_pitch",
    label: "Продуктовый питч",
    preferredArcs: ["problem_solution", "hero_journey"],
    preferredLayouts: ["big-statement", "icons-numbers", "comparison-table", "hero-stat", "card-grid"],
    tone: "Energetic, benefit-focused, customer-centric. Lead with pain points, show transformation.",
    contentRules: "Focus on customer pain → solution → benefits → proof points. Include testimonials or case studies.",
    outlineHint: "Structure: Pain Point → Solution Demo → Key Benefits → Social Proof → CTA. Make the problem visceral, solution clear.",
    writerHint: "Tone: energetic, benefit-focused. Lead with customer pain points. Use before/after comparisons. Include proof points.",
    layoutHint: "Use big-statement for key messages, comparison for before/after, hero-stat for impressive metrics, card-grid for features.",
  },
  educational: {
    type: "educational",
    label: "Образовательная",
    preferredArcs: ["chronological", "modular"],
    preferredLayouts: ["text-with-callout", "numbered-steps-v2", "vertical-timeline", "card-grid", "icons-numbers"],
    tone: "Clear, structured, progressive. Build knowledge step by step. Use examples and analogies.",
    contentRules: "Break complex topics into digestible parts. Use examples, definitions, diagrams. Progressive complexity.",
    outlineHint: "Structure: Introduction → Core Concepts (3-5) → Examples → Practice/Application → Summary. Each concept builds on previous.",
    writerHint: "Tone: clear, educational. Explain concepts progressively. Use analogies and real-world examples. Define key terms.",
    layoutHint: "Use numbered-steps for processes, text-with-callout for definitions, card-grid for concept overview, timeline for history.",
  },
  investor_deck: {
    type: "investor_deck",
    label: "Инвестиционный питч",
    preferredArcs: ["problem_solution", "situation_complication_resolution"],
    preferredLayouts: ["hero-stat", "stats-chart", "highlight-stats", "comparison-table", "financial-formula"],
    tone: "Confident, metrics-heavy, opportunity-focused. Show traction, market size, unit economics.",
    contentRules: "Must include: market size (TAM/SAM/SOM), traction metrics, unit economics, team, ask. Every slide needs numbers.",
    outlineHint: "Structure: Problem → Market Size → Solution → Traction → Business Model → Team → Ask. Heavy on metrics and financial data.",
    writerHint: "Tone: confident, data-heavy. Include TAM/SAM/SOM, MRR/ARR, unit economics, growth rates. Investors want numbers, not stories.",
    layoutHint: "Use hero-stat for key metrics, stats-chart for growth, financial-formula for unit economics, highlight-stats for traction.",
  },
  quarterly_review: {
    type: "quarterly_review",
    label: "Квартальный обзор",
    preferredArcs: ["chronological", "situation_complication_resolution"],
    preferredLayouts: ["stats-chart", "highlight-stats", "comparison-table", "table-slide", "icons-numbers"],
    tone: "Factual, balanced, action-oriented. Show results vs targets, explain variances, set next steps.",
    contentRules: "Compare actual vs plan. Show trends over time. Highlight wins and areas for improvement. End with action items.",
    outlineHint: "Structure: Executive Summary → Key Metrics vs Targets → Wins → Challenges → Action Plan → Next Quarter Goals.",
    writerHint: "Tone: factual, balanced. Compare actual vs plan with specific numbers. Explain variances. Be honest about misses.",
    layoutHint: "Use stats-chart for trends, comparison-table for actual vs plan, highlight-stats for key results, table-slide for detailed data.",
  },
};

/** Keyword patterns for each type */
const TYPE_KEYWORDS: Record<PresentationType, RegExp[]> = {
  investor_deck: [
    /инвест/i, /pitch\s*deck/i, /раунд/i, /series\s*[a-d]/i,
    /venture/i, /фандрайзинг/i, /fundrais/i, /tam\b/i, /sam\b/i,
    /unit\s*econom/i, /юнит.?эконом/i, /mrr|arr/i, /pre.?seed|seed/i,
    /стартап/i, /startup/i, /инвестор/i, /investor/i,
  ],
  product_pitch: [
    /продукт/i, /product/i, /запуск/i, /launch/i, /фич/i, /feature/i,
    /демо/i, /demo/i, /saas/i, /платформ/i, /platform/i,
    /решени[ея]/i, /solution/i, /клиент/i, /customer/i,
    /пользовател/i, /user/i, /ценност/i, /value\s*prop/i,
  ],
  quarterly_review: [
    /квартал/i, /quarter/i, /q[1-4]\b/i, /отчёт/i, /отчет/i, /report/i,
    /результат/i, /result/i, /kpi/i, /план.?факт/i, /actual\s*vs/i,
    /итог/i, /summary/i, /обзор\s*(за|период)/i, /review/i,
    /полугод/i, /годов/i, /annual/i,
  ],
  educational: [
    /обучен/i, /educat/i, /курс/i, /course/i, /урок/i, /lesson/i,
    /лекци/i, /lecture/i, /тренинг/i, /training/i, /workshop/i,
    /введение\s*в/i, /intro(duction)?\s*(to|в)/i, /основ[ыа]/i,
    /tutorial/i, /гайд/i, /guide/i, /как\s+работает/i, /how\s+.*works/i,
  ],
  business_strategy: [
    /стратеги/i, /strategy/i, /развити/i, /growth/i, /план/i, /plan/i,
    /трансформац/i, /transform/i, /оптимизац/i, /optimiz/i,
    /конкурент/i, /competi/i, /рынок|рыноч/i, /market/i,
    /бизнес/i, /business/i, /масштаб/i, /scal/i,
  ],
};

/**
 * Classify a presentation prompt into one of 5 types using keyword matching.
 * Returns the type profile with hints for all agents.
 */
export function classifyPresentation(prompt: string): TypeProfile {
  const scores: Record<PresentationType, number> = {
    investor_deck: 0,
    product_pitch: 0,
    quarterly_review: 0,
    educational: 0,
    business_strategy: 0,
  };

  for (const [type, patterns] of Object.entries(TYPE_KEYWORDS) as [PresentationType, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        scores[type]++;
      }
    }
  }

  // Find highest scoring type
  let bestType: PresentationType = "business_strategy"; // default
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores) as [PresentationType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return TYPE_PROFILES[bestType];
}

/**
 * Get the type profile for a known type.
 */
export function getTypeProfile(type: PresentationType): TypeProfile {
  return TYPE_PROFILES[type];
}

/**
 * Get all available presentation types.
 */
export function getAllTypes(): PresentationType[] {
  return Object.keys(TYPE_PROFILES) as PresentationType[];
}
