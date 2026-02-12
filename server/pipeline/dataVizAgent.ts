/**
 * Data Visualization Agent — analyzes slide content to detect data-rich slides
 * and generates SVG charts to replace or enhance chart-slide layouts.
 * 
 * Pipeline position: After Layout decisions, before HTML Composer.
 * The agent:
 * 1. Scans all slides for numeric data (data_points, text patterns)
 * 2. Determines which slides would benefit from charts
 * 3. Selects optimal chart type based on data shape and context
 * 4. Generates SVG charts via the SVG Chart Engine
 * 5. Injects chart SVG into slide data for template rendering
 */

import { invokeLLM } from "../_core/llm";
import {
  renderChart,
  recommendChartType,
  type ChartConfig,
  type ChartDataPoint,
  type ChartType,
  type ChartResult,
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
// CHART TYPE SELECTION
// ═══════════════════════════════════════════════════════

/** Layouts that should NOT get auto-charts */
const SKIP_CHART_LAYOUTS = new Set([
  "title-slide", "final-slide", "section-header", "quote-slide",
  "image-text", "image-fullscreen", "agenda-table-of-contents",
  "checklist", "pros-cons",
]);

/** Layouts that already have chart support */
const CHART_LAYOUTS = new Set(["chart-slide", "waterfall-chart"]);

/**
 * Determine if a slide should get a chart and what type.
 */
export function analyzeSlideForChart(
  slide: SlideContent,
  layoutName: string,
): DataVizDecision | null {
  // Skip layouts that don't benefit from charts
  if (SKIP_CHART_LAYOUTS.has(layoutName)) return null;

  // Try extracting data from data_points first (highest confidence)
  const dpData = extractFromDataPoints(slide);
  if (dpData && dpData.length >= 2) {
    const chartType = recommendChartType(dpData, slide.title + " " + slide.key_message);
    const unit = detectUnit(slide);
    
    return {
      slideNumber: slide.slide_number,
      chartType,
      data: dpData,
      title: slide.title,
      unit,
      confidence: "high",
      source: "data_points",
    };
  }

  // Try extracting from text (medium confidence)
  const textData = extractFromText(slide.text);
  if (textData && textData.length >= 2) {
    const chartType = recommendChartType(textData, slide.title + " " + slide.key_message);
    const unit = detectUnit(slide);

    return {
      slideNumber: slide.slide_number,
      chartType,
      data: textData,
      title: slide.title,
      unit,
      confidence: "medium",
      source: "text_extraction",
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// LLM-BASED DATA EXTRACTION (for slides with implicit data)
// ═══════════════════════════════════════════════════════

interface LLMChartExtraction {
  has_chartable_data: boolean;
  chart_type: ChartType;
  data_points: Array<{ label: string; value: number }>;
  unit?: string;
  center_label?: string;
  center_value?: string;
}

/**
 * Use LLM to extract chartable data from slide content when local extraction fails.
 * Only called for slides that have chart-slide or waterfall-chart layouts.
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
- Return has_chartable_data: false if no clear numeric data exists`;

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
    if (!rawContent || typeof rawContent !== 'string') return null;

    const result: LLMChartExtraction = JSON.parse(rawContent);
    
    if (!result.has_chartable_data || result.data_points.length < 2) return null;

    return {
      slideNumber: slide.slide_number,
      chartType: result.chart_type,
      data: result.data_points.map(dp => ({ label: dp.label, value: dp.value })),
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
 * @param content - All slide content from the Writer
 * @param layoutMap - Layout decisions for each slide
 * @param maxCharts - Maximum number of charts to generate (default 6)
 * @param onProgress - Optional progress callback
 * @returns DataVizResult with SVG charts mapped to slide numbers
 */
export async function runDataVizAgent(
  content: SlideContent[],
  layoutMap: Map<number, string>,
  maxCharts: number = 6,
  onProgress?: (message: string) => void,
): Promise<DataVizResult> {
  const decisions: DataVizDecision[] = [];
  const svgCharts = new Map<number, string>();

  onProgress?.("Анализ данных в слайдах...");

  // Phase 1: Local analysis — scan all slides for chartable data
  for (const slide of content) {
    const layout = layoutMap.get(slide.slide_number) || "text-slide";
    const decision = analyzeSlideForChart(slide, layout);
    if (decision) {
      decisions.push(decision);
    }
  }

  // Phase 2: LLM extraction for chart-slide layouts that didn't get local data
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

  // Phase 3: Sort by confidence and limit
  decisions.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  const selectedDecisions = decisions.slice(0, maxCharts);

  // Phase 4: Generate SVG charts
  if (selectedDecisions.length > 0) {
    onProgress?.(`Генерация ${selectedDecisions.length} SVG-графиков...`);
  }

  for (const decision of selectedDecisions) {
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
    decisions: selectedDecisions,
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
  data.chartSvg = svgChart;
  data.hasChart = true;

  // For chart-slide layout, replace the canvas-based chart with SVG
  if (layoutName === "chart-slide") {
    data.usesSvgChart = true;
  }

  return data;
}
