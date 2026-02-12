/**
 * SVG Chart Engine — generates pure SVG charts for presentation slides.
 * 
 * Features:
 * - Pure SVG output (no JavaScript required, works in PDF export)
 * - Theme-aware colors via CSS variables
 * - 5 chart types: vertical bar, horizontal bar, line, pie, donut
 * - Responsive viewBox with proper scaling
 * - Animated on load (CSS animations)
 * - Grid lines and axis labels
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type ChartType = "bar" | "horizontal-bar" | "line" | "pie" | "donut";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  centerLabel?: string;  // For donut chart center text
  centerValue?: string;  // For donut chart center value
  unit?: string;         // Unit suffix for values (%, $, etc.)
}

export interface ChartResult {
  svg: string;
  chartType: ChartType;
  dataPointCount: number;
}

// ═══════════════════════════════════════════════════════
// COLOR PALETTE (theme-aware)
// ═══════════════════════════════════════════════════════

const CHART_COLORS = [
  "var(--primary-accent-color, #6366f1)",
  "var(--secondary-accent-color, #3b82f6)",
  "#10b981",  // emerald
  "#f59e0b",  // amber
  "#ef4444",  // red
  "#8b5cf6",  // violet
  "#ec4899",  // pink
  "#14b8a6",  // teal
  "#f97316",  // orange
  "#06b6d4",  // cyan
];

// Fallback solid colors for SVG (CSS vars may not work in all SVG contexts)
const CHART_COLORS_SOLID = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

function getColor(index: number, useSolid = false): string {
  const palette = useSolid ? CHART_COLORS_SOLID : CHART_COLORS;
  return palette[index % palette.length];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateLabel(label: string, maxLen: number = 12): string {
  if (label.length <= maxLen) return label;
  return label.substring(0, maxLen - 1) + "…";
}

function formatValue(value: number, unit?: string): string {
  let formatted: string;
  if (Math.abs(value) >= 1_000_000) {
    formatted = (value / 1_000_000).toFixed(1) + "M";
  } else if (Math.abs(value) >= 1_000) {
    formatted = (value / 1_000).toFixed(1) + "K";
  } else if (Number.isInteger(value)) {
    formatted = value.toString();
  } else {
    formatted = value.toFixed(1);
  }
  return unit ? `${formatted}${unit}` : formatted;
}

// ═══════════════════════════════════════════════════════
// VERTICAL BAR CHART
// ═══════════════════════════════════════════════════════

export function renderBarChart(config: ChartConfig): string {
  const { data, width = 600, height = 360, showGrid = true, showValues = true, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  const margin = { top: 30, right: 20, bottom: 50, left: 60 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(60, (chartW / data.length) * 0.6);
  const barGap = (chartW - barWidth * data.length) / (data.length + 1);

  // Grid lines (5 lines)
  const gridLines: string[] = [];
  if (showGrid) {
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + chartH - (chartH * i) / 4;
      const val = (maxVal * i) / 4;
      gridLines.push(
        `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4" />`,
        `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="11" font-family="Inter, sans-serif">${formatValue(val, unit)}</text>`
      );
    }
  }

  // Bars
  const bars = data.map((d, i) => {
    const barH = (d.value / maxVal) * chartH;
    const x = margin.left + barGap + i * (barWidth + barGap);
    const y = margin.top + chartH - barH;
    const color = d.color || getColor(i);
    const labelX = x + barWidth / 2;

    let valueLabel = "";
    if (showValues) {
      valueLabel = `<text x="${labelX}" y="${y - 6}" text-anchor="middle" fill="#6b7280" font-size="11" font-weight="600" font-family="Inter, sans-serif">${formatValue(d.value, unit)}</text>`;
    }

    return `<g>
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.9">
        <animate attributeName="height" from="0" to="${barH}" dur="0.6s" fill="freeze" />
        <animate attributeName="y" from="${margin.top + chartH}" to="${y}" dur="0.6s" fill="freeze" />
      </rect>
      ${valueLabel}
      <text x="${labelX}" y="${height - margin.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="10" font-family="Inter, sans-serif">${escapeXml(truncateLabel(d.label))}</text>
    </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <!-- Grid -->
  ${gridLines.join("\n  ")}
  <!-- Axis -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartH}" stroke="#d1d5db" stroke-width="1.5" />
  <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${width - margin.right}" y2="${margin.top + chartH}" stroke="#d1d5db" stroke-width="1.5" />
  <!-- Bars -->
  ${bars.join("\n  ")}
</svg>`;
}

// ═══════════════════════════════════════════════════════
// HORIZONTAL BAR CHART
// ═══════════════════════════════════════════════════════

export function renderHorizontalBarChart(config: ChartConfig): string {
  const { data, width = 600, height = 360, showValues = true, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  const margin = { top: 20, right: 60, bottom: 20, left: 120 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barHeight = Math.min(40, (chartH / data.length) * 0.65);
  const barGap = (chartH - barHeight * data.length) / (data.length + 1);

  const bars = data.map((d, i) => {
    const barW = (d.value / maxVal) * chartW;
    const y = margin.top + barGap + i * (barHeight + barGap);
    const color = d.color || getColor(i);

    let valueLabel = "";
    if (showValues) {
      valueLabel = `<text x="${margin.left + barW + 8}" y="${y + barHeight / 2 + 4}" text-anchor="start" fill="#6b7280" font-size="12" font-weight="600" font-family="Inter, sans-serif">${formatValue(d.value, unit)}</text>`;
    }

    return `<g>
      <text x="${margin.left - 8}" y="${y + barHeight / 2 + 4}" text-anchor="end" fill="#6b7280" font-size="11" font-family="Inter, sans-serif">${escapeXml(truncateLabel(d.label, 16))}</text>
      <rect x="${margin.left}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${color}" opacity="0.9">
        <animate attributeName="width" from="0" to="${barW}" dur="0.6s" fill="freeze" />
      </rect>
      ${valueLabel}
    </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <!-- Axis -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#d1d5db" stroke-width="1.5" />
  <!-- Bars -->
  ${bars.join("\n  ")}
</svg>`;
}

// ═══════════════════════════════════════════════════════
// LINE CHART
// ═══════════════════════════════════════════════════════

export function renderLineChart(config: ChartConfig): string {
  const { data, width = 600, height = 360, showGrid = true, showValues = true, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  // Grid lines
  const gridLines: string[] = [];
  if (showGrid) {
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + chartH - (chartH * i) / 4;
      const val = minVal + (range * i) / 4;
      gridLines.push(
        `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4" />`,
        `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="11" font-family="Inter, sans-serif">${formatValue(val, unit)}</text>`
      );
    }
  }

  // Points and path
  const points = data.map((d, i) => {
    const x = margin.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = margin.top + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  
  // Area fill (gradient)
  const areaD = `${pathD} L ${points[points.length - 1].x} ${margin.top + chartH} L ${points[0].x} ${margin.top + chartH} Z`;

  const lineColor = getColor(0, true);

  const pointElements = points.map((p, i) => {
    let valueLabel = "";
    if (showValues) {
      valueLabel = `<text x="${p.x}" y="${p.y - 12}" text-anchor="middle" fill="#6b7280" font-size="10" font-weight="600" font-family="Inter, sans-serif">${formatValue(p.d.value, unit)}</text>`;
    }
    return `<g>
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${lineColor}" stroke-width="2.5" />
      ${valueLabel}
      <text x="${p.x}" y="${height - margin.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="10" font-family="Inter, sans-serif">${escapeXml(truncateLabel(p.d.label))}</text>
    </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.2" />
      <stop offset="100%" stop-color="${lineColor}" stop-opacity="0.02" />
    </linearGradient>
  </defs>
  <!-- Grid -->
  ${gridLines.join("\n  ")}
  <!-- Axis -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartH}" stroke="#d1d5db" stroke-width="1.5" />
  <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${width - margin.right}" y2="${margin.top + chartH}" stroke="#d1d5db" stroke-width="1.5" />
  <!-- Area -->
  <path d="${areaD}" fill="url(#areaGrad)" />
  <!-- Line -->
  <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  <!-- Points -->
  ${pointElements.join("\n  ")}
</svg>`;
}

// ═══════════════════════════════════════════════════════
// PIE CHART
// ═══════════════════════════════════════════════════════

export function renderPieChart(config: ChartConfig): string {
  const { data, width = 400, height = 360, showLegend = true, showValues = true, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
  if (total === 0) return renderEmptyChart(width, height, "No data");

  const cx = showLegend ? width * 0.35 : width / 2;
  const cy = height / 2;
  const radius = Math.min(cx - 20, cy - 30);

  let currentAngle = -Math.PI / 2; // Start from top

  const slices = data.map((d, i) => {
    const sliceAngle = (Math.abs(d.value) / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const color = d.color || getColor(i, true);

    // Label position (midpoint of arc)
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = radius * 0.65;
    const labelX = cx + labelR * Math.cos(midAngle);
    const labelY = cy + labelR * Math.sin(midAngle);
    const pct = ((Math.abs(d.value) / total) * 100).toFixed(0);

    let label = "";
    if (showValues && sliceAngle > 0.3) { // Only show label if slice is big enough
      label = `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12" font-weight="700" font-family="Inter, sans-serif">${pct}%</text>`;
    }

    const pathD = data.length === 1
      ? `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius - 0.001} ${cy}`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return `<g>
      <path d="${pathD}" fill="${color}" stroke="white" stroke-width="2" />
      ${label}
    </g>`;
  });

  // Legend
  let legend = "";
  if (showLegend) {
    const legendX = width * 0.72;
    const legendStartY = Math.max(30, cy - (data.length * 24) / 2);
    legend = data.map((d, i) => {
      const y = legendStartY + i * 24;
      const color = d.color || getColor(i, true);
      const pct = ((Math.abs(d.value) / total) * 100).toFixed(0);
      return `<g>
        <rect x="${legendX}" y="${y}" width="12" height="12" rx="3" fill="${color}" />
        <text x="${legendX + 18}" y="${y + 10}" fill="#6b7280" font-size="11" font-family="Inter, sans-serif">${escapeXml(truncateLabel(d.label, 14))} (${pct}%)</text>
      </g>`;
    }).join("\n    ");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <!-- Slices -->
  ${slices.join("\n  ")}
  <!-- Legend -->
  ${legend}
</svg>`;
}

// ═══════════════════════════════════════════════════════
// DONUT CHART
// ═══════════════════════════════════════════════════════

export function renderDonutChart(config: ChartConfig): string {
  const { data, width = 400, height = 360, showLegend = true, centerLabel, centerValue, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
  if (total === 0) return renderEmptyChart(width, height, "No data");

  const cx = showLegend ? width * 0.35 : width / 2;
  const cy = height / 2;
  const outerR = Math.min(cx - 20, cy - 30);
  const innerR = outerR * 0.6;

  let currentAngle = -Math.PI / 2;

  const arcs = data.map((d, i) => {
    const sliceAngle = (Math.abs(d.value) / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const outerX1 = cx + outerR * Math.cos(startAngle);
    const outerY1 = cy + outerR * Math.sin(startAngle);
    const outerX2 = cx + outerR * Math.cos(endAngle);
    const outerY2 = cy + outerR * Math.sin(endAngle);
    const innerX1 = cx + innerR * Math.cos(endAngle);
    const innerY1 = cy + innerR * Math.sin(endAngle);
    const innerX2 = cx + innerR * Math.cos(startAngle);
    const innerY2 = cy + innerR * Math.sin(startAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const color = d.color || getColor(i, true);

    const pathD = data.length === 1
      ? `M ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx + outerR - 0.001} ${cy} M ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR - 0.001} ${cy} Z`
      : `M ${outerX1} ${outerY1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerX2} ${outerY2} L ${innerX1} ${innerY1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX2} ${innerY2} Z`;

    return `<path d="${pathD}" fill="${color}" stroke="white" stroke-width="2" />`;
  });

  // Center text
  let centerText = "";
  if (centerValue || centerLabel) {
    centerText = `<g>
      ${centerValue ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" fill="#1f2937" font-size="28" font-weight="700" font-family="Inter, sans-serif">${escapeXml(centerValue)}</text>` : ""}
      ${centerLabel ? `<text x="${cx}" y="${cy + 18}" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-size="11" font-family="Inter, sans-serif">${escapeXml(centerLabel)}</text>` : ""}
    </g>`;
  }

  // Legend
  let legend = "";
  if (showLegend) {
    const legendX = width * 0.72;
    const legendStartY = Math.max(30, cy - (data.length * 24) / 2);
    legend = data.map((d, i) => {
      const y = legendStartY + i * 24;
      const color = d.color || getColor(i, true);
      const pct = ((Math.abs(d.value) / total) * 100).toFixed(0);
      return `<g>
        <rect x="${legendX}" y="${y}" width="12" height="12" rx="3" fill="${color}" />
        <text x="${legendX + 18}" y="${y + 10}" fill="#6b7280" font-size="11" font-family="Inter, sans-serif">${escapeXml(truncateLabel(d.label, 14))} (${pct}%)</text>
      </g>`;
    }).join("\n    ");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <!-- Arcs -->
  ${arcs.join("\n  ")}
  <!-- Center -->
  ${centerText}
  <!-- Legend -->
  ${legend}
</svg>`;
}

// ═══════════════════════════════════════════════════════
// EMPTY CHART PLACEHOLDER
// ═══════════════════════════════════════════════════════

function renderEmptyChart(width: number, height: number, message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="6,4" />
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-size="14" font-family="Inter, sans-serif">${escapeXml(message)}</text>
</svg>`;
}

// ═══════════════════════════════════════════════════════
// UNIFIED RENDER FUNCTION
// ═══════════════════════════════════════════════════════

export function renderChart(config: ChartConfig): ChartResult {
  let svg: string;

  switch (config.type) {
    case "bar":
      svg = renderBarChart(config);
      break;
    case "horizontal-bar":
      svg = renderHorizontalBarChart(config);
      break;
    case "line":
      svg = renderLineChart(config);
      break;
    case "pie":
      svg = renderPieChart(config);
      break;
    case "donut":
      svg = renderDonutChart(config);
      break;
    default:
      svg = renderBarChart(config);
  }

  return {
    svg,
    chartType: config.type,
    dataPointCount: config.data.length,
  };
}

// ═══════════════════════════════════════════════════════
// CHART TYPE RECOMMENDATION
// ═══════════════════════════════════════════════════════

/**
 * Recommend the best chart type based on data characteristics.
 */
export function recommendChartType(data: ChartDataPoint[], context?: string): ChartType {
  const count = data.length;
  const hasNegatives = data.some(d => d.value < 0);
  const allPositive = data.every(d => d.value >= 0);
  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  const isPercentage = total > 90 && total < 110 && allPositive;
  const contextLower = (context || "").toLowerCase();

  // Percentage/share data → pie or donut
  if (isPercentage || contextLower.match(/доля|share|распределен|distribution|состав|composition/)) {
    return count <= 5 ? "pie" : "donut";
  }

  // Time series / trend data → line
  if (contextLower.match(/тренд|trend|динамик|dynamic|рост|growth|год|year|месяц|month|квартал|quarter|время|time/)) {
    return "line";
  }

  // Comparison / ranking → horizontal bar
  if (contextLower.match(/сравнен|compar|рейтинг|ranking|топ|top|лучш|best|рынок|market share/)) {
    return count > 4 ? "horizontal-bar" : "bar";
  }

  // Default logic based on data shape
  if (count <= 6) return "bar";
  if (count <= 10) return "horizontal-bar";
  return "bar";
}
