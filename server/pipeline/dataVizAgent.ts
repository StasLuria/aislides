/**
 * Data Visualization Agent — Smart, LLM-driven chart decisions.
 * 
 * Instead of hardcoded skip-lists and forced limits, this agent:
 * 1. Locally extracts numeric data from all slides (data_points + text patterns)
 * 2. Sends a holistic summary to LLM: "Here are all slides with data. Which ones
 *    truly benefit from a chart? What chart type fits each one?"
 * 3. LLM returns contextual decisions based on content semantics
 * 4. SVG charts are generated only for LLM-approved slides
 * 
 * Pipeline position: After Layout decisions, before HTML Composer.
 */

import { invokeLLM } from "../_core/llm";
import {
  renderChart,
  type ChartConfig,
  type ChartDataPoint,
  type ChartType,
} from "./svgChartEngine";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface DataVizDecision {
  slideNumber: number;
  chartType: ChartType;
  data: ChartDataPoint[];
  title?: string;
  unit?: string;
  centerLabel?: string;
  centerValue?: string;
  confidence: "high" | "medium" | "low";
  source: "data_points" | "text_extraction" | "llm_extraction";
}

export interface DataVizResult {
  decisions: DataVizDecision[];
  svgCharts: Map<number, string>;  // slideNumber → SVG string
  totalChartsGenerated: number;
}

// ═══════════════════════════════════════════════════════
// DATA DETECTION — Local analysis (no LLM)
// ═══════════════════════════════════════════════════════

/**
 * Extract numeric data from slide's data_points field.
 */
export function extractFromDataPoints(slide: SlideContent): ChartDataPoint[] | null {
  if (!slide.data_points || slide.data_points.length < 2) return null;

  const points: ChartDataPoint[] = [];
  for (const dp of slide.data_points) {
    const numValue = parseNumericValue(dp.value);
    if (numValue !== null) {
      points.push({ label: dp.label, value: numValue });
    }
  }

  return points.length >= 2 ? points : null;
}

/**
 * Extract numeric data from slide text using pattern matching.
 * Looks for patterns like "Revenue: $4.2B", "Growth: 15%", "Users: 2.5M"
 */
export function extractFromText(text: string): ChartDataPoint[] | null {
  const patterns = [
    // "Label: 123" or "Label — 123" or "Label - 123"
    /^[•\-\*]?\s*([^:—\-\d][^:—\-]{2,30})\s*[:—\-]\s*([\d,.]+\s*(?:%|млн|млрд|тыс|M|B|K|billion|million|thousand)?)/gm,
    // "123% something" at start of line
    /^[•\-\*]?\s*([\d,.]+\s*(?:%|млн|млрд|тыс|M|B|K))\s+(.{3,30})/gm,
  ];

  const points: ChartDataPoint[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      let label: string;
      let valueStr: string;

      // Determine which group is the label vs value
      if (/^\d/.test(match[1])) {
        valueStr = match[1];
        label = match[2].trim();
      } else {
        label = match[1].trim();
        valueStr = match[2].trim();
      }

      const numValue = parseNumericValue(valueStr);
      if (numValue !== null && !seen.has(label)) {
        seen.add(label);
        points.push({ label, value: numValue });
      }
    }
  }

  return points.length >= 2 ? points : null;
}

/**
 * Parse a string value into a number, handling units and formatting.
 */
export function parseNumericValue(str: string): number | null {
  if (!str) return null;
  
  const cleaned = str.replace(/\s/g, "").replace(/,/g, ".");

  // Handle multiplier suffixes
  const multipliers: Record<string, number> = {
    "k": 1_000, "K": 1_000, "тыс": 1_000,
    "m": 1_000_000, "M": 1_000_000, "млн": 1_000_000, "million": 1_000_000,
    "b": 1_000_000_000, "B": 1_000_000_000, "млрд": 1_000_000_000, "billion": 1_000_000_000,
  };

  for (const [suffix, mult] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      const numPart = cleaned.slice(0, -suffix.length).replace(/[^0-9.\-]/g, "");
      const num = parseFloat(numPart);
      return isNaN(num) ? null : num * mult;
    }
  }

  // Handle percentage
  if (cleaned.endsWith("%")) {
    const num = parseFloat(cleaned.slice(0, -1).replace(/[^0-9.\-]/g, ""));
    return isNaN(num) ? null : num;
  }

  // Plain number
  const num = parseFloat(cleaned.replace(/[^0-9.\-]/g, ""));
  return isNaN(num) ? null : num;
}

/**
 * Detect the unit from data_points or text.
 */
export function detectUnit(slide: SlideContent): string | undefined {
  // Check data_points units
  if (slide.data_points && slide.data_points.length > 0) {
    const units = slide.data_points.map(dp => dp.unit).filter(Boolean);
    if (units.length > 0) return units[0];
  }

  // Check text for common unit patterns
  const text = slide.text + " " + (slide.key_message || "");
  if (text.match(/%|процент|percent/i)) return "%";
  if (text.match(/\$|доллар|dollar|USD/i)) return "$";
  if (text.match(/₽|руб|rub|RUB/i)) return "₽";
  if (text.match(/€|евро|euro|EUR/i)) return "€";

  return undefined;
}

// ═══════════════════════════════════════════════════════
// LOCAL SLIDE ANALYSIS (pre-LLM)
// ═══════════════════════════════════════════════════════

/** Layouts where charts are structurally impossible */
const STRUCTURAL_SKIP = new Set([
  "title-slide", "final-slide", "section-header", "quote-slide",
  "image-fullscreen", "agenda-table-of-contents",
]);

/** Layouts that already have built-in chart areas */
const CHART_LAYOUTS = new Set([
  "chart-slide", "waterfall-chart", "stats-chart", "chart-text", "dual-chart",
]);

interface SlideDataCandidate {
  slideNumber: number;
  title: string;
  layout: string;
  data: ChartDataPoint[];
  unit?: string;
  source: "data_points" | "text_extraction";
  hasChartLayout: boolean;
  textSummary: string; // Brief content for LLM context
}

/**
 * Analyze a single slide for chartable data (local, no LLM).
 * Returns a candidate if data is found, null otherwise.
 * No layout filtering except structural impossibilities.
 */
export function analyzeSlideForChart(
  slide: SlideContent,
  layoutName: string,
): DataVizDecision | null {
  // Only skip layouts where charts are structurally impossible
  if (STRUCTURAL_SKIP.has(layoutName)) return null;

  // Try extracting data from data_points first (highest confidence)
  const dpData = extractFromDataPoints(slide);
  if (dpData && dpData.length >= 2) {
    return {
      slideNumber: slide.slide_number,
      chartType: "bar", // placeholder — LLM will decide the real type
      data: dpData,
      title: slide.title,
      unit: detectUnit(slide),
      confidence: "high",
      source: "data_points",
    };
  }

  // Try extracting from text (medium confidence)
  const textData = extractFromText(slide.text);
  if (textData && textData.length >= 2) {
    return {
      slideNumber: slide.slide_number,
      chartType: "bar", // placeholder
      data: textData,
      title: slide.title,
      unit: detectUnit(slide),
      confidence: "medium",
      source: "text_extraction",
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// LLM-BASED HOLISTIC CHART DECISIONS
// ═══════════════════════════════════════════════════════

interface LLMChartDecision {
  slide_number: number;
  needs_chart: boolean;
  chart_type: ChartType;
  reasoning: string;
  short_labels: Array<{ original: string; short: string }>;
}

interface LLMChartPlan {
  decisions: LLMChartDecision[];
}

/**
 * Ask LLM to review ALL candidate slides holistically and decide:
 * - Which slides truly benefit from a chart (not just "have numbers")
 * - What chart type best fits each slide's data and message
 * - Short labels for chart axes (to prevent truncation)
 */
async function getSmartChartPlan(
  candidates: SlideDataCandidate[],
  totalSlides: number,
): Promise<LLMChartPlan> {
  const slideSummaries = candidates.map(c => {
    const dataStr = c.data.map(d => `${d.label}: ${d.value}`).join(", ");
    return `Slide ${c.slideNumber} (layout: ${c.layout}): "${c.title}"
  Data: [${dataStr}] ${c.unit ? `(unit: ${c.unit})` : ""}
  Content: ${c.textSummary}
  Has chart area in layout: ${c.hasChartLayout}`;
  }).join("\n\n");

  const system = `You are a presentation data visualization expert. You review slide content and decide which slides genuinely benefit from a chart visualization.

WHEN TO ADD A CHART:
- A chart should ADD VALUE — make data easier to understand than text alone
- Do NOT add charts just because numbers exist. "Revenue grew 15%" is fine as text.
- DO add charts when comparing 3+ items, showing distributions, or illustrating trends
- Slides with chart-specific layouts (stats-chart, chart-text, chart-slide) should almost always get charts
- Consider the WHOLE presentation: avoid chart overload. For 8-12 slides, 2-4 charts is ideal.

CHART TYPE SELECTION — CRITICAL RULES:
You MUST select chart type based on what the DATA represents, NOT default to bar charts.

1. "pie" — Use when data shows SHARES/PROPORTIONS of a whole (market share, budget allocation, demographic breakdown). Values should roughly sum to 100% or represent parts of a total.
   Example: "Solar 35%, Wind 28%, Hydro 22%, Other 15%" → pie

2. "donut" — Same as pie but when there is a KEY TOTAL to highlight in the center.
   Example: "Total investment $50B: US $20B, EU $15B, China $10B, Other $5B" → donut with center "$50B"

3. "line" — Use for TIME SERIES, TRENDS, GROWTH over periods, year-over-year data, projections.
   Example: "2020: $2B, 2021: $3B, 2022: $4.5B, 2023: $6B" → line
   Example: "Temperature +0.5°C, +0.8°C, +1.1°C, +1.5°C by decade" → line

4. "bar" — Use ONLY for comparing DISCRETE CATEGORIES of the same metric (not time-based).
   Example: "Agriculture loss $50B, Infrastructure $30B, Health $20B" → bar

5. "horizontal-bar" — Use for RANKINGS, lists sorted by value, or when labels are long.
   Example: "Country A: 85 points, Country B: 72, Country C: 65, Country D: 58" → horizontal-bar

DIVERSITY REQUIREMENT:
- Review ALL your decisions together before finalizing
- If you selected "bar" for more than 2 slides, RE-EVALUATE: can any of them be pie, donut, line, or horizontal-bar?
- Ask yourself: "Is this truly a category comparison, or is it shares/trends/rankings?"
- It is WRONG to use bar chart for percentage distributions that sum to ~100%
- It is WRONG to use bar chart for time-series data

LABELS:
- Provide SHORT LABELS (max 12 chars) for each data point to prevent axis truncation
- Abbreviate intelligently: "Возобновляемая энергетика" → "ВИЭ", "Инфраструктура" → "Инфрастр."

Return JSON with your decisions.`;

  const user = `Presentation has ${totalSlides} slides total. Here are ${candidates.length} slides with numeric data:

${slideSummaries}

For each slide, decide:
1. Does it genuinely need a chart? (not just "has numbers")
2. What chart type BEST fits the data semantics? (NOT default to bar — think about what the data represents)
3. Provide short axis labels (max 12 chars)

IMPORTANT: Before returning, review your chart_type choices. If most are "bar", reconsider — real data usually has a mix of comparisons, distributions, and trends.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chart_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    slide_number: { type: "integer" },
                    needs_chart: { type: "boolean" },
                    chart_type: {
                      type: "string",
                      enum: ["bar", "horizontal-bar", "line", "pie", "donut"],
                    },
                    reasoning: { type: "string" },
                    short_labels: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          original: { type: "string" },
                          short: { type: "string" },
                        },
                        required: ["original", "short"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["slide_number", "needs_chart", "chart_type", "reasoning", "short_labels"],
                  additionalProperties: false,
                },
              },
            },
            required: ["decisions"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      return { decisions: [] };
    }

    return JSON.parse(rawContent) as LLMChartPlan;
  } catch (err) {
    console.error("[DataViz] LLM chart plan failed:", err);
    return { decisions: [] };
  }
}

/**
 * Use LLM to extract chartable data from slide content when local extraction fails.
 * Only called for slides that have chart-specific layouts but no locally extracted data.
 */
export async function extractChartDataWithLLM(slide: SlideContent): Promise<DataVizDecision | null> {
  const system = `You are a data extraction specialist. Analyze the slide content and extract numeric data that can be visualized as a chart.

Rules:
- Only extract if there are at least 2 clear numeric data points
- Choose the best chart type: "bar", "horizontal-bar", "line", "pie", "donut"
- Use "pie" or "donut" for percentage/share data that sums to ~100%
- Use "line" for time series or trend data
- Use "bar" for comparisons of 2-6 items
- Use "horizontal-bar" for rankings or comparisons of 4+ items
- If the data represents parts of a whole, use "donut" with center_label and center_value
- Return has_chartable_data: false if no clear numeric data exists
- Keep labels SHORT (max 12 characters) — abbreviate if needed`;

  const user = `Slide ${slide.slide_number}: "${slide.title}"

Content:
${slide.text}

Key message: ${slide.key_message || "N/A"}

Data points provided:
${slide.data_points.map(dp => `- ${dp.label}: ${dp.value} ${dp.unit}`).join("\n") || "None"}

Extract chartable data as JSON.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chart_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              has_chartable_data: { type: "boolean" },
              chart_type: { type: "string", enum: ["bar", "horizontal-bar", "line", "pie", "donut"] },
              data_points: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["label", "value"],
                  additionalProperties: false,
                },
              },
              unit: { type: "string" },
              center_label: { type: "string" },
              center_value: { type: "string" },
            },
            required: ["has_chartable_data", "chart_type", "data_points", "unit", "center_label", "center_value"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") return null;

    const result = JSON.parse(rawContent);

    if (!result.has_chartable_data || !result.data_points || result.data_points.length < 2) {
      return null;
    }

    return {
      slideNumber: slide.slide_number,
      chartType: result.chart_type,
      data: result.data_points.map((dp: { label: string; value: number }) => ({ label: dp.label, value: dp.value })),
      title: slide.title,
      unit: result.unit || undefined,
      centerLabel: result.center_label || undefined,
      centerValue: result.center_value || undefined,
      confidence: "medium",
      source: "llm_extraction",
    };
  } catch (err) {
    console.error(`[DataViz] LLM extraction failed for slide ${slide.slide_number}:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the Data Visualization Agent on all slides.
 * 
 * Uses a two-phase approach:
 * Phase 1: Local data extraction from all slides
 * Phase 2: LLM holistic review — decides which slides truly need charts and what type
 * Phase 3: LLM extraction for chart-layout slides without local data
 * Phase 4: SVG chart generation
 */
export async function runDataVizAgent(
  content: SlideContent[],
  layoutMap: Map<number, string>,
  _maxCharts: number = 10, // kept for API compat, but LLM decides the actual count
  onProgress?: (message: string) => void,
): Promise<DataVizResult> {
  const decisions: DataVizDecision[] = [];
  const svgCharts = new Map<number, string>();

  onProgress?.("Анализ данных в слайдах...");

  // ── Phase 1: Local data extraction ──
  const candidates: SlideDataCandidate[] = [];

  for (const slide of content) {
    const layout = layoutMap.get(slide.slide_number) || "text-slide";
    
    // Skip only structurally impossible layouts
    if (STRUCTURAL_SKIP.has(layout)) continue;

    const dpData = extractFromDataPoints(slide);
    const textData = !dpData ? extractFromText(slide.text) : null;
    const data = dpData || textData;

    if (data && data.length >= 2) {
      // Build a brief text summary for LLM context
      const textSummary = (slide.text || "").slice(0, 200);
      
      candidates.push({
        slideNumber: slide.slide_number,
        title: slide.title,
        layout,
        data,
        unit: detectUnit(slide),
        source: dpData ? "data_points" : "text_extraction",
        hasChartLayout: CHART_LAYOUTS.has(layout),
        textSummary,
      });
    }
  }

  // ── Phase 2: LLM holistic review ──
  if (candidates.length > 0) {
    onProgress?.(`Анализ ${candidates.length} слайдов с данными...`);
    
    const plan = await getSmartChartPlan(candidates, content.length);

    for (const llmDecision of plan.decisions) {
      if (!llmDecision.needs_chart) continue;

      const candidate = candidates.find(c => c.slideNumber === llmDecision.slide_number);
      if (!candidate) continue;

      // Apply short labels from LLM
      let chartData = candidate.data;
      if (llmDecision.short_labels && llmDecision.short_labels.length > 0) {
        const labelMap = new Map(llmDecision.short_labels.map(sl => [sl.original, sl.short]));
        chartData = chartData.map(dp => ({
          label: labelMap.get(dp.label) || dp.label,
          value: dp.value,
        }));
      }

      decisions.push({
        slideNumber: candidate.slideNumber,
        chartType: llmDecision.chart_type,
        data: chartData,
        title: candidate.title,
        unit: candidate.unit,
        confidence: candidate.source === "data_points" ? "high" : "medium",
        source: candidate.source,
      });
    }
  }

  // ── Phase 3: LLM extraction for chart-layout slides without data ──
  const chartLayoutSlides = content.filter(s => {
    const layout = layoutMap.get(s.slide_number) || "text-slide";
    return CHART_LAYOUTS.has(layout) && !decisions.some(d => d.slideNumber === s.slide_number);
  });

  if (chartLayoutSlides.length > 0) {
    onProgress?.(`Извлечение данных для ${chartLayoutSlides.length} графиков...`);
    
    const llmResults = await Promise.all(
      chartLayoutSlides.map(slide => extractChartDataWithLLM(slide).catch(() => null))
    );

    for (const result of llmResults) {
      if (result) decisions.push(result);
    }
  }

  // ── Phase 4: Generate SVG charts ──
  if (decisions.length > 0) {
    onProgress?.(`Генерация ${decisions.length} SVG-графиков...`);
  }

  for (const decision of decisions) {
    try {
      const chartConfig: ChartConfig = {
        type: decision.chartType,
        data: decision.data,
        title: decision.title,
        unit: decision.unit,
        showGrid: true,
        showValues: true,
        showLegend: decision.chartType === "pie" || decision.chartType === "donut",
        centerLabel: decision.centerLabel,
        centerValue: decision.centerValue,
        width: decision.chartType === "pie" || decision.chartType === "donut" ? 500 : 600,
        height: 340,
      };

      const result = renderChart(chartConfig);
      svgCharts.set(decision.slideNumber, result.svg);
    } catch (err) {
      console.error(`[DataViz] Chart generation failed for slide ${decision.slideNumber}:`, err);
    }
  }

  onProgress?.(`Готово: ${svgCharts.size} графиков`);

  return {
    decisions,
    svgCharts,
    totalChartsGenerated: svgCharts.size,
  };
}

// ═══════════════════════════════════════════════════════
// CHART INJECTION INTO SLIDE DATA
// ═══════════════════════════════════════════════════════

/**
 * Inject SVG chart into slide data for template rendering.
 * Updates the data object with chartSvg field.
 */
export function injectChartIntoSlideData(
  data: Record<string, any>,
  svgChart: string,
  layoutName: string,
): Record<string, any> {
  if (layoutName === "dual-chart") {
    // For dual-chart, inject the same chart into both panels
    data.leftChartSvg = svgChart;
    data.rightChartSvg = svgChart;
    data.hasChart = true;
  } else {
    data.chartSvg = svgChart;
    data.hasChart = true;
  }

  // For chart-slide layout, replace the canvas-based chart with SVG
  if (layoutName === "chart-slide") {
    data.usesSvgChart = true;
  }

  return data;
}
