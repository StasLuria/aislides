/**
 * Theme Auto-Selector — intelligently picks the best theme preset
 * based on the presentation topic/prompt.
 *
 * Two-level approach:
 * 1. Fast keyword-based matching (no LLM call, ~0ms)
 * 2. LLM-based analysis fallback when keywords are ambiguous
 *
 * The selector returns a theme ID from the 12 available presets.
 */

import { THEME_PRESETS, type ThemePreset } from "./themes";
import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// THEME CLASSIFICATION RULES
// ═══════════════════════════════════════════════════════

interface ThemeRule {
  themeId: string;
  /** Keywords that strongly suggest this theme (case-insensitive) */
  keywords: string[];
  /** Broader category patterns (regex) */
  patterns: RegExp[];
  /** Weight boost — higher = more likely to be selected when multiple match */
  weight: number;
}

const THEME_RULES: ThemeRule[] = [
  {
    themeId: "bspb_corporate",
    keywords: [
      "банк", "бспб", "санкт-петербург", "финанс", "кредит", "вклад",
      "ипотек", "депозит", "расчётн", "расчетн", "банковск",
      "проект", "предпроект", "внедрен", "автоматизац",
    ],
    patterns: [/банк\w*\s+(?:санкт|петербург|бспб)/i, /бспб/i],
    weight: 2.0,
  },
  {
    themeId: "corporate_blue",
    keywords: [
      "бизнес", "компания", "корпоративн", "менеджмент", "управлен",
      "отчёт", "отчет", "квартальн", "годовой", "бюджет", "kpi",
      "business", "corporate", "management", "report", "quarterly", "annual",
      "стратеги", "strategy", "планирован", "planning",
    ],
    patterns: [/(?:годов|квартальн|ежемесячн)\w*\s+(?:отчёт|отчет|план)/i, /(?:бизнес|корпоративн)\w*\s+(?:стратег|план)/i],
    weight: 1.0,
  },
  {
    themeId: "executive_navy_red",
    keywords: [
      "руководств", "директор", "ceo", "cfo", "cto", "совет директор",
      "инвестор", "инвестиц", "акционер", "ipo", "m&a", "слияни",
      "executive", "leadership", "board", "investor", "investment",
      "капитал", "capital", "фонд", "fund", "дивиденд",
      "промышленн", "industry", "производств", "manufacturing",
      "нефт", "газ", "oil", "gas", "энерг", "energy",
      "металлург", "горнодобыв", "mining", "уголь", "coal",
    ],
    patterns: [/(?:совет|заседани)\w*\s+(?:директор|акционер)/i, /(?:инвестиц|капитал)\w*\s+(?:стратег|план|привлечен)/i],
    weight: 1.3,
  },
  {
    themeId: "data_navy_blue",
    keywords: [
      "данные", "аналитик", "статистик", "метрик", "дашборд",
      "data", "analytics", "statistics", "metrics", "dashboard",
      "big data", "machine learning", "нейросет", "модел",
      "исследован", "research", "анализ рынк", "market analysis",
      "benchmark", "бенчмарк", "roi", "конверси", "conversion",
    ],
    patterns: [/(?:анализ|аналитик)\w*\s+(?:данн|рынк|трафик)/i, /(?:data|big\s*data|ml|ai)\s+(?:analytics|analysis|pipeline)/i],
    weight: 1.2,
  },
  {
    themeId: "modern_purple",
    keywords: [
      "стартап", "startup", "продукт", "product", "saas", "платформ",
      "приложен", "app", "мобильн", "mobile", "ux", "ui", "дизайн",
      "design", "бренд", "brand", "маркетинг", "marketing",
      "креатив", "creative", "инноваци", "innovation",
    ],
    patterns: [/(?:запуск|launch)\w*\s+(?:продукт|приложен|платформ)/i, /(?:ux|ui|product)\s+(?:design|strategy)/i],
    weight: 1.0,
  },
  {
    themeId: "cosmic_dark",
    keywords: [
      "технолог", "technology", "ai", "искусственн", "artificial",
      "блокчейн", "blockchain", "crypto", "крипто", "web3",
      "космос", "space", "робот", "robot", "автоматизац", "automation",
      "кибербезопасн", "cybersecurity", "devops", "cloud", "облачн",
      "программирован", "programming", "разработк", "development",
      "нейронн", "neural", "deep learning", "gpt", "llm",
      "квантов", "quantum", "vr", "ar", "метавселен", "metaverse",
    ],
    patterns: [/(?:искусственн|нейронн)\w*\s+(?:интеллект|сет)/i, /(?:ai|ml|deep\s*learning|blockchain)/i],
    weight: 1.1,
  },
  {
    themeId: "forest_green",
    keywords: [
      "экологи", "ecology", "устойчив", "sustainab", "esg",
      "зелён", "зелен", "green", "природ", "nature", "климат", "climate",
      "возобновляем", "renewable", "переработк", "recycl",
      "сельск", "agricultur", "фермер", "farm", "органическ", "organic",
      "здоровь", "health", "медицин", "medic", "фарм", "pharm",
      "биотехнолог", "biotech", "wellness", "велнес",
    ],
    patterns: [/(?:устойчив|зелён|зелен)\w*\s+(?:развит|энерг|технолог)/i, /(?:esg|carbon|co2|углерод)/i],
    weight: 1.0,
  },
  {
    themeId: "sunset_warm",
    keywords: [
      "образован", "education", "обучен", "training", "курс", "course",
      "школ", "school", "университет", "university", "студент", "student",
      "мотивац", "motivation", "вдохновен", "inspiration",
      "команд", "team", "hr", "персонал", "staff", "культур", "culture",
      "лидерств", "leadership", "коучинг", "coaching", "менторств",
      "тренинг", "workshop", "мастер-класс",
    ],
    patterns: [/(?:обучен|тренинг|курс)\w*\s+(?:сотрудник|команд|персонал)/i, /(?:team|hr|people)\s+(?:building|management|development)/i],
    weight: 1.0,
  },
  {
    themeId: "ocean_deep",
    keywords: [
      "логистик", "logistics", "транспорт", "transport", "цепочк", "supply chain",
      "международн", "international", "глобальн", "global", "экспорт", "export",
      "импорт", "import", "торговл", "trade", "таможн", "customs",
      "морск", "maritime", "авиац", "aviation", "флот", "fleet",
    ],
    patterns: [/(?:международн|глобальн)\w*\s+(?:рынок|торговл|экспанси)/i, /(?:supply\s*chain|logistics|shipping)/i],
    weight: 1.0,
  },
  {
    themeId: "rose_gold",
    keywords: [
      "люкс", "luxury", "премиум", "premium", "мода", "fashion",
      "красот", "beauty", "ювелирн", "jewelry", "отель", "hotel",
      "ресторан", "restaurant", "гастроном", "gastronom",
      "свадьб", "wedding", "событи", "event", "праздник",
      "недвижимост", "real estate", "интерьер", "interior",
    ],
    patterns: [/(?:люкс|премиум|luxury)\w*\s+(?:бренд|сегмент|рынок)/i],
    weight: 1.0,
  },
  {
    themeId: "arctic_frost",
    keywords: [
      "минимализм", "minimalism", "чистый", "clean", "скандинавск",
      "nordic", "финтех", "fintech", "банк", "bank", "страхован", "insurance",
      "платёж", "платеж", "payment", "финансов", "financial",
      "бухгалтер", "accounting", "аудит", "audit", "налог", "tax",
      "юридическ", "legal", "право", "law", "комплаенс", "compliance",
    ],
    patterns: [/(?:финансов|банковск)\w*\s+(?:услуг|продукт|сервис)/i, /(?:fintech|neobank|payment)/i],
    weight: 1.0,
  },
  {
    themeId: "midnight_noir",
    keywords: [
      "премьер", "premiere", "презентац", "presentation", "запуск", "launch",
      "конференц", "conference", "саммит", "summit", "форум", "forum",
      "выставк", "exhibition", "демо", "demo", "питч", "pitch",
      "тедх", "tedx", "ted", "keynote", "кейноут",
    ],
    patterns: [/(?:запуск|launch|презентац)\w*\s+(?:продукт|бренд|компани)/i, /(?:pitch\s*deck|keynote|demo\s*day)/i],
    weight: 0.9,
  },
  {
    themeId: "citrus_energy",
    keywords: [
      "спорт", "sport", "фитнес", "fitness", "молодёж", "youth",
      "развлечен", "entertainment", "игр", "game", "геймин", "gaming",
      "социальн", "social", "медиа", "media", "контент", "content",
      "блог", "blog", "влог", "vlog", "smm", "реклам", "advertis",
      "ритейл", "retail", "магазин", "store", "e-commerce", "ecommerce",
    ],
    patterns: [/(?:социальн|digital)\w*\s+(?:медиа|маркетинг|реклам)/i, /(?:e-?commerce|retail|marketplace)/i],
    weight: 0.9,
  },
];

// ═══════════════════════════════════════════════════════
// KEYWORD-BASED FAST MATCHING
// ═══════════════════════════════════════════════════════

interface MatchResult {
  themeId: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * Fast keyword-based theme selection.
 * Scans the prompt for keyword matches and returns scored results.
 */
export function keywordMatch(prompt: string): MatchResult[] {
  const normalizedPrompt = prompt.toLowerCase();
  const results: MatchResult[] = [];

  for (const rule of THEME_RULES) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check keywords
    for (const keyword of rule.keywords) {
      if (normalizedPrompt.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }

    // Check patterns (worth more)
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedPrompt)) {
        score += 2;
        matchedKeywords.push(`pattern:${pattern.source}`);
      }
    }

    // Apply weight
    score *= rule.weight;

    if (score > 0) {
      results.push({ themeId: rule.themeId, score, matchedKeywords });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Determine confidence level from keyword matching results.
 * Returns "high" if the top match is clearly dominant,
 * "medium" if there's a reasonable match, "low" if ambiguous.
 */
export function matchConfidence(results: MatchResult[]): "high" | "medium" | "low" {
  if (results.length === 0) return "low";

  const topScore = results[0].score;

  // High confidence: strong match with clear separation from second place
  if (topScore >= 4 && (results.length === 1 || topScore >= results[1].score * 1.5)) {
    return "high";
  }

  // Medium confidence: decent match
  if (topScore >= 2) {
    return "medium";
  }

  return "low";
}

// ═══════════════════════════════════════════════════════
// LLM-BASED THEME SELECTION
// ═══════════════════════════════════════════════════════

const THEME_SELECTOR_SYSTEM = `You are a presentation design expert. Your task is to select the most appropriate visual theme for a presentation based on its topic.

Available themes:
${THEME_PRESETS.map((t) => `- "${t.id}": ${t.name} — ${t.mood}`).join("\n")}

Rules:
1. Analyze the topic, industry, audience, and tone of the presentation.
2. Select the theme that best matches the content and context.
3. Consider the emotional impact: formal presentations need authoritative themes, creative topics need vibrant ones.
4. When in doubt between similar themes, prefer the one with stronger visual identity for the topic.

Return ONLY a JSON object with: { "theme_id": "...", "reason": "..." }`;

/**
 * LLM-based theme selection for ambiguous cases.
 * Only called when keyword matching has low confidence.
 */
export async function llmSelectTheme(prompt: string): Promise<{ themeId: string; reason: string }> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: THEME_SELECTOR_SYSTEM },
        { role: "user", content: `Select the best theme for this presentation:\n\n"${prompt}"` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "theme_selection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              theme_id: {
                type: "string",
                description: "The ID of the selected theme",
                enum: THEME_PRESETS.map((t) => t.id),
              },
              reason: {
                type: "string",
                description: "Brief explanation of why this theme was selected",
              },
            },
            required: ["theme_id", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      return { themeId: "corporate_blue", reason: "LLM returned empty response" };
    }

    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(content);
    // Validate the theme ID exists
    const validTheme = THEME_PRESETS.find((t) => t.id === parsed.theme_id);
    if (!validTheme) {
      return { themeId: "corporate_blue", reason: "LLM returned invalid theme ID" };
    }

    return { themeId: parsed.theme_id, reason: parsed.reason };
  } catch (error) {
    console.error("[ThemeSelector] LLM selection failed:", error);
    return { themeId: "corporate_blue", reason: "LLM fallback due to error" };
  }
}

// ═══════════════════════════════════════════════════════
// MAIN AUTO-SELECT FUNCTION
// ═══════════════════════════════════════════════════════

export interface ThemeSelectionResult {
  themeId: string;
  method: "keyword" | "llm" | "default";
  confidence: "high" | "medium" | "low";
  reason: string;
}

/**
 * Automatically select the best theme for a presentation.
 *
 * Strategy:
 * 1. Try keyword matching first (instant, no API call)
 * 2. If confidence is high → use keyword result
 * 3. If confidence is medium → use keyword result (good enough)
 * 4. If confidence is low → call LLM for intelligent selection
 *
 * @param prompt - The user's presentation topic/prompt
 * @param useLlmFallback - Whether to use LLM when keywords are ambiguous (default: true)
 */
export async function autoSelectTheme(
  prompt: string,
  useLlmFallback: boolean = true,
): Promise<ThemeSelectionResult> {
  // Step 1: Keyword matching
  const matches = keywordMatch(prompt);
  const confidence = matchConfidence(matches);

  console.log(`[ThemeSelector] Keyword matches: ${JSON.stringify(matches.slice(0, 3).map((m) => ({ id: m.themeId, score: m.score.toFixed(1) })))}`);
  console.log(`[ThemeSelector] Confidence: ${confidence}`);

  // High or medium confidence → use keyword result
  if (confidence === "high" || confidence === "medium") {
    const topMatch = matches[0];
    return {
      themeId: topMatch.themeId,
      method: "keyword",
      confidence,
      reason: `Keyword match (${topMatch.matchedKeywords.slice(0, 3).join(", ")})`,
    };
  }

  // Low confidence → try LLM if enabled
  if (useLlmFallback) {
    console.log("[ThemeSelector] Low confidence, calling LLM...");
    const llmResult = await llmSelectTheme(prompt);
    return {
      themeId: llmResult.themeId,
      method: "llm",
      confidence: "medium", // LLM is reasonably confident
      reason: llmResult.reason,
    };
  }

  // No LLM, no keywords → default to BSPB corporate theme
  return {
    themeId: "bspb_corporate",
    method: "default",
    confidence: "low",
    reason: "No strong keyword matches, using BSPB corporate as default",
  };
}
