/**
 * Fact Checker — extracts key facts from the user prompt and verifies
 * that the generated presentation content does not contradict them.
 *
 * Strategy:
 * 1. Extract numbers, percentages, currencies, dates, and named entities from the prompt
 * 2. Extract the same from all slide content
 * 3. Compare: flag any slide content that contradicts or significantly distorts prompt facts
 * 4. Return a penalty score and list of violations
 *
 * This is a LOCAL (no LLM) module for speed. It uses regex-based extraction.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ExtractedFact {
  raw: string;           // Original text fragment
  normalizedValue: number | null;  // Numeric value if applicable
  unit: string;          // %, $, €, ₽, млн, млрд, etc.
  type: "number" | "percentage" | "currency" | "date" | "named_entity";
  context: string;       // Surrounding text for matching
}

export interface FactViolation {
  slideNumber: number;
  slideTitle: string;
  promptFact: string;     // What the user said
  slideFact: string;      // What the slide says
  severity: "high" | "medium" | "low";
  description: string;
}

export interface FactCheckResult {
  promptFacts: ExtractedFact[];
  violations: FactViolation[];
  penalty: number;        // 0-3 points to subtract from Final Review score
  summary: string;
}

// ═══════════════════════════════════════════════════════
// FACT EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Normalize a numeric string: handle Russian abbreviations (млн, млрд, тыс),
 * English abbreviations (M, B, K), and currency symbols.
 */
export function normalizeNumber(raw: string): { value: number; unit: string } | null {
  let cleaned = raw.trim();

  // Strip trailing currency names first (before collapsing spaces)
  cleaned = cleaned.replace(/\s*(?:рублей|рубля|руб\.?|долларов|доллар|долл\.?|евро)\.?\s*$/i, "");

  cleaned = cleaned.replace(/\s+/g, "").replace(/,/g, ".");

  // Extract currency prefix
  let unit = "";
  const currencyMatch = cleaned.match(/^([$€₽£¥])/);
  if (currencyMatch) {
    unit = currencyMatch[1];
    cleaned = cleaned.substring(1);
  }

  // Extract suffix multiplier and unit
  const suffixPatterns: Array<{ pattern: RegExp; multiplier: number; unit: string }> = [
    { pattern: /млрд\.?$/i, multiplier: 1_000_000_000, unit: "млрд" },
    { pattern: /billion$/i, multiplier: 1_000_000_000, unit: "B" },
    { pattern: /B$/i, multiplier: 1_000_000_000, unit: "B" },
    { pattern: /млн\.?$/i, multiplier: 1_000_000, unit: "млн" },
    { pattern: /million$/i, multiplier: 1_000_000, unit: "M" },
    { pattern: /M$/i, multiplier: 1_000_000, unit: "M" },
    { pattern: /тыс\.?$/i, multiplier: 1_000, unit: "тыс" },
    { pattern: /K$/i, multiplier: 1_000, unit: "K" },
    { pattern: /%$/, multiplier: 1, unit: "%" },
    { pattern: /руб\.?$/i, multiplier: 1, unit: "руб" },
  ];

  let multiplier = 1;
  for (const sp of suffixPatterns) {
    if (sp.pattern.test(cleaned)) {
      cleaned = cleaned.replace(sp.pattern, "");
      multiplier = sp.multiplier;
      if (!unit) unit = sp.unit;
      break;
    }
  }

  const numVal = parseFloat(cleaned);
  if (isNaN(numVal)) return null;

  return { value: numVal * multiplier, unit };
}

/**
 * Extract facts (numbers, percentages, currencies, dates) from text.
 */
export function extractFacts(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  // Pattern 1: Currency amounts — MUST have a currency symbol, multiplier, or currency name
  // e.g., $1.2B, 850 млн руб, €500 млн, ₽1.5 млрд
  const currencyPattern = /[$€₽£¥]\s*\d[\d.,]*\s*(?:млрд|млн|тыс|billion|million|B|M|K)?\s*(?:руб(?:лей)?|долл(?:аров)?|евро)?\.?|\d[\d.,]*\s*(?:млрд|млн|тыс|billion|million|B|M|K)\s*(?:руб(?:лей)?|долл(?:аров)?|евро)?\.?|\d[\d.,]*\s*(?:руб(?:лей)?|долл(?:аров)?|евро)\.?/gi;
  const currencyMatches = Array.from(text.matchAll(currencyPattern));
  for (const match of currencyMatches) {
    const raw = match[0].trim();
    if (raw.length < 2) continue;
    const normalized = normalizeNumber(raw);
    if (normalized && !seen.has(raw)) {
      // Only accept as currency if it has a meaningful unit (not just a bare number)
      if (!normalized.unit && !/[$€₽£¥]/.test(raw)) continue;
      seen.add(raw);
      const start = Math.max(0, match.index! - 30);
      const end = Math.min(text.length, match.index! + raw.length + 30);
      facts.push({
        raw,
        normalizedValue: normalized.value,
        unit: normalized.unit,
        type: normalized.unit === "%" ? "percentage" : "currency",
        context: text.substring(start, end).trim(),
      });
    }
  }

  // Pattern 2: Percentages (e.g., 32%, 15.5%, 120%)
  const pctPattern = /\d[\d.,]*\s*%/g;
  const pctMatches = Array.from(text.matchAll(pctPattern));
  for (const match of pctMatches) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const normalized = normalizeNumber(raw);
    if (normalized) {
      const start = Math.max(0, match.index! - 30);
      const end = Math.min(text.length, match.index! + raw.length + 30);
      facts.push({
        raw,
        normalizedValue: normalized.value,
        unit: "%",
        type: "percentage",
        context: text.substring(start, end).trim(),
      });
    }
  }

  // Pattern 3: Standalone significant numbers (e.g., NPS 72, 850M, 1.5 млрд)
  const numPattern = /\b\d[\d.,]*\s*(?:млрд|млн|тыс|billion|million|B|M|K)?\b/gi;
  const numMatches = Array.from(text.matchAll(numPattern));
  for (const match of numMatches) {
    const raw = match[0].trim();
    if (raw.length < 2 || seen.has(raw)) continue;
    // Skip years and very small numbers
    const normalized = normalizeNumber(raw);
    if (!normalized) continue;
    if (normalized.value >= 1900 && normalized.value <= 2100 && !normalized.unit) continue; // Skip years
    if (normalized.value < 10 && !normalized.unit) continue; // Skip small standalone numbers
    seen.add(raw);
    const start = Math.max(0, match.index! - 30);
    const end = Math.min(text.length, match.index! + raw.length + 30);
    facts.push({
      raw,
      normalizedValue: normalized.value,
      unit: normalized.unit || "",
      type: "number",
      context: text.substring(start, end).trim(),
    });
  }

  // Pattern 4: Dates and quarters (e.g., Q4 2025, Q1 2026, 2025 год)
  const datePattern = /\b(?:Q[1-4]\s*\d{4}|\d{4}\s*(?:год|г\.?))\b/gi;
  const dateMatches = Array.from(text.matchAll(datePattern));
  for (const match of dateMatches) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const start = Math.max(0, match.index! - 30);
    const end = Math.min(text.length, match.index! + raw.length + 30);
    facts.push({
      raw,
      normalizedValue: null,
      unit: "",
      type: "date",
      context: text.substring(start, end).trim(),
    });
  }

  return facts;
}

// ═══════════════════════════════════════════════════════
// FACT COMPARISON
// ═══════════════════════════════════════════════════════

/**
 * Check if two numeric facts are contradictory.
 * Returns true if they seem to refer to the same metric but have significantly different values.
 */
export function areFactsContradictory(
  promptFact: ExtractedFact,
  slideFact: ExtractedFact,
): boolean {
  // Both must have numeric values
  if (promptFact.normalizedValue === null || slideFact.normalizedValue === null) return false;

  // Both facts must have meaningful units to compare
  // Bare numbers (unit="") should not be compared with each other
  if (!promptFact.unit && !slideFact.unit) return false;

  // Same unit type check (rough)
  const sameUnit = promptFact.unit === slideFact.unit ||
    (promptFact.unit === "%" && slideFact.unit === "%") ||
    (isCurrencyUnit(promptFact.unit) && isCurrencyUnit(slideFact.unit));

  if (!sameUnit) return false;

  // Check if values are significantly different
  const pv = promptFact.normalizedValue;
  const sv = slideFact.normalizedValue;

  // If exact match, not contradictory
  if (pv === sv) return false;

  // Check for order-of-magnitude difference (e.g., 850M rubles vs $1.2B)
  const ratio = Math.max(pv, sv) / Math.min(pv, sv);

  // For percentages, even small differences can be meaningful
  if (promptFact.unit === "%") {
    return Math.abs(pv - sv) > 10; // More than 10 percentage points difference
  }

  // For currency/numbers, flag if more than 3x different
  return ratio > 3;
}

function isCurrencyUnit(unit: string): boolean {
  return ["$", "€", "₽", "£", "¥", "руб", "долл", "евро", "млн", "млрд", "тыс", "M", "B", "K"].includes(unit);
}

/**
 * Check context similarity — do the facts refer to the same metric?
 * Uses keyword overlap between contexts.
 */
export function contextOverlap(ctx1: string, ctx2: string): number {
  const words1 = new Set(ctx1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(ctx2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  words1.forEach(w => {
    if (words2.has(w)) overlap++;
  });
  return overlap / Math.min(words1.size, words2.size);
}

// ═══════════════════════════════════════════════════════
// MAIN FACT CHECK
// ═══════════════════════════════════════════════════════

export interface SlideForFactCheck {
  slideNumber: number;
  title: string;
  textContent: string;  // All text from the slide concatenated
}

/**
 * Run fact-checking: compare prompt facts against slide content.
 * Returns violations and a penalty score.
 */
export function runFactCheck(
  userPrompt: string,
  slides: SlideForFactCheck[],
): FactCheckResult {
  const promptFacts = extractFacts(userPrompt);

  if (promptFacts.length === 0) {
    return {
      promptFacts: [],
      violations: [],
      penalty: 0,
      summary: "No specific facts found in user prompt to verify.",
    };
  }

  const violations: FactViolation[] = [];

  for (const slide of slides) {
    const slideFacts = extractFacts(slide.textContent);

    for (const pf of promptFacts) {
      for (const sf of slideFacts) {
        // Check if facts are about the same thing and contradictory
        if (areFactsContradictory(pf, sf)) {
          // Additional check: do the contexts suggest they're about the same metric?
          const overlap = contextOverlap(pf.context, sf.context);

          // Only flag if there's some context similarity (>0.15) or same unit
          if (overlap > 0.15 || (pf.unit === sf.unit && pf.unit !== "")) {
            const ratio = pf.normalizedValue && sf.normalizedValue
              ? Math.max(pf.normalizedValue, sf.normalizedValue) / Math.min(pf.normalizedValue, sf.normalizedValue)
              : 0;

            const severity: "high" | "medium" | "low" =
              ratio > 10 ? "high" :
              ratio > 3 ? "medium" : "low";

            violations.push({
              slideNumber: slide.slideNumber,
              slideTitle: slide.title,
              promptFact: pf.raw,
              slideFact: sf.raw,
              severity,
              description: `Prompt says "${pf.raw}" but slide ${slide.slideNumber} says "${sf.raw}" (${ratio.toFixed(1)}x difference)`,
            });
          }
        }
      }
    }
  }

  // Deduplicate: keep only the highest severity violation per slide
  const deduped = new Map<string, FactViolation>();
  for (const v of violations) {
    const key = `${v.slideNumber}-${v.promptFact}`;
    const existing = deduped.get(key);
    if (!existing || severityRank(v.severity) > severityRank(existing.severity)) {
      deduped.set(key, v);
    }
  }
  const uniqueViolations = Array.from(deduped.values());

  // Calculate penalty
  const highCount = uniqueViolations.filter(v => v.severity === "high").length;
  const mediumCount = uniqueViolations.filter(v => v.severity === "medium").length;
  const penalty = Math.min(3, highCount * 1.5 + mediumCount * 0.5);

  const summary = uniqueViolations.length === 0
    ? `All ${promptFacts.length} prompt facts verified — no contradictions found.`
    : `Found ${uniqueViolations.length} fact violation(s): ${highCount} high, ${mediumCount} medium, ${uniqueViolations.length - highCount - mediumCount} low severity. Score penalty: -${penalty.toFixed(1)}.`;

  return {
    promptFacts,
    violations: uniqueViolations,
    penalty,
    summary,
  };
}

function severityRank(s: "high" | "medium" | "low"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
