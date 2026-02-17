/**
 * SVG Chart Engine — generates pure SVG charts for presentation slides.
 * 
 * Features:
 * - Pure SVG output (no JavaScript required, works in PDF export)
 * - Theme-aware colors via CSS variables
 * - 6 chart types: vertical bar, horizontal bar, line, pie, donut, radar
 * - Responsive viewBox with proper scaling
 * - Animated on load (CSS animations)
 * - Grid lines and axis labels
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type ChartType = "bar" | "horizontal-bar" | "line" | "pie" | "donut" | "radar";

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

function truncateLabel(label: string, maxLen: number = 18): string {
  if (label.length <= maxLen) return label;
  // For single words (no spaces), show the full word to avoid cutting Russian words mid-word
  if (!label.includes(" ") && !label.includes("-")) return label;
  return label.substring(0, maxLen - 1) + "…";
}

/**
 * Wrap a long label into multiple lines for SVG <text> elements.
 * Returns an array of lines that fit within maxCharsPerLine.
 */
function wrapLabel(label: string, maxCharsPerLine: number = 14, maxLines: number = 2): string[] {
  if (label.length <= maxCharsPerLine) return [label];
  
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  
  if (currentLine) {
    if (lines.length >= maxLines) {
      // Append remaining text to last line, truncate if multi-word
      const combined = lines[lines.length - 1] + " " + currentLine;
      lines[lines.length - 1] = truncateLabel(combined, maxCharsPerLine);
    } else {
      // Single words that exceed the limit are kept intact (don't truncate Russian words)
      lines.push(truncateLabel(currentLine, maxCharsPerLine));
    }
  }
  
  return lines.length > 0 ? lines : [truncateLabel(label, maxCharsPerLine)];
}

/**
 * Render a multi-line SVG <text> element using <tspan> elements.
 */
function renderMultiLineLabel(x: number, y: number, label: string, opts: {
  maxCharsPerLine?: number;
  maxLines?: number;
  fontSize?: number;
  fill?: string;
  textAnchor?: string;
  rotate?: number;
} = {}): string {
  const {
    maxCharsPerLine = 14,
    maxLines = 2,
    fontSize: baseFontSize = 10,
    fill = "#6b7280",
    textAnchor = "middle",
    rotate,
  } = opts;
  
  const lines = wrapLabel(label, maxCharsPerLine, maxLines);
  
  // Reduce font size for long single-word labels that couldn't be wrapped
  const maxLineLen = Math.max(...lines.map(l => l.length));
  let fontSize = baseFontSize;
  if (maxLineLen > maxCharsPerLine + 4) {
    // Scale down proportionally for very long labels
    fontSize = Math.max(7, Math.round(baseFontSize * maxCharsPerLine / maxLineLen));
  }
  const lineHeight = fontSize + 3;
  
  if (lines.length === 1) {
    const transform = rotate ? ` transform="rotate(${rotate}, ${x}, ${y})"` : "";
    return `<text x="${x}" y="${y}" text-anchor="${textAnchor}" fill="${fill}" font-size="${fontSize}" font-family="Inter, sans-serif"${transform}>${escapeXml(lines[0])}</text>`;
  }
  
  const transform = rotate ? ` transform="rotate(${rotate}, ${x}, ${y})"` : "";
  const tspans = lines.map((line, i) => 
    `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
  ).join("");
  
  return `<text text-anchor="${textAnchor}" fill="${fill}" font-size="${fontSize}" font-family="Inter, sans-serif"${transform}>${tspans}</text>`;
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
  if (!unit) return formatted;
  // Prefix units (currency symbols) go before the number
  if (unit === "$" || unit === "€" || unit === "₽" || unit === "£" || unit === "¥") {
    return `${unit}${formatted}`;
  }
  // Suffix units: add space for word-like units, no space for symbols like %
  if (unit === "%" || unit.length === 1) {
    return `${formatted}${unit}`;
  }
  return `${formatted} ${unit}`;
}

// ═══════════════════════════════════════════════════════
// VERTICAL BAR CHART
// ═══════════════════════════════════════════════════════

export function renderBarChart(config: ChartConfig): string {
  const { data, width = 600, height = 360, showGrid = true, showValues = true, unit } = config;
  if (data.length === 0) return renderEmptyChart(width, height, "No data");

  // Adaptive bottom margin: increase for long labels
  const maxLabelLen = Math.max(...data.map(d => d.label.length));
  const needsExtraSpace = maxLabelLen > 12;
  const margin = { top: 30, right: 20, bottom: needsExtraSpace ? 70 : 50, left: 60 };
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

  // Pre-calculate bar positions for overlap detection
  const barPositions = data.map((d, i) => {
    const barH = (d.value / maxVal) * chartH;
    const x = margin.left + barGap + i * (barWidth + barGap);
    const y = margin.top + chartH - barH;
    return { x, y, barH, labelX: x + barWidth / 2 };
  });

  // Detect value label overlaps: if bars are close in height and position,
  // alternate label placement (above vs inside bar)
  const valueLabelYPositions = barPositions.map((pos, i) => {
    let labelY = pos.y - 6; // default: above bar
    if (showValues && i > 0) {
      const prevY = barPositions[i - 1].y - 6;
      const prevX = barPositions[i - 1].labelX;
      // If labels would be within 14px vertically and bars are adjacent
      if (Math.abs(labelY - prevY) < 14 && Math.abs(pos.labelX - prevX) < barWidth + barGap + 10) {
        // Place inside bar if bar is tall enough (>30px)
        if (pos.barH > 30) {
          labelY = pos.y + 16;
        } else {
          // Offset upward to avoid overlap
          labelY = Math.min(labelY, prevY - 14);
        }
      }
    }
    return labelY;
  });

  // Reduce font size for x-axis labels when there are many bars
  const xLabelFontSize = data.length > 8 ? 8 : data.length > 6 ? 9 : 10;
  const xLabelMaxChars = data.length > 8 ? 10 : needsExtraSpace ? 14 : 18;

  // Bars
  const bars = data.map((d, i) => {
    const { x, y, barH, labelX } = barPositions[i];
    const color = d.color || getColor(i);

    let valueLabel = "";
    if (showValues) {
      const labelY = valueLabelYPositions[i];
      const isInside = labelY > y; // label is inside the bar
      const fill = isInside ? "#ffffff" : "#6b7280";
      valueLabel = `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="${fill}" font-size="11" font-weight="600" font-family="Inter, sans-serif">${formatValue(d.value, unit)}</text>`;
    }

    return `<g>
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.9">
        <animate attributeName="height" from="0" to="${barH}" dur="0.6s" fill="freeze" />
        <animate attributeName="y" from="${margin.top + chartH}" to="${y}" dur="0.6s" fill="freeze" />
      </rect>
      ${valueLabel}
      ${renderMultiLineLabel(labelX, height - margin.bottom + 16, d.label, {
        maxCharsPerLine: xLabelMaxChars,
        maxLines: needsExtraSpace ? 2 : 1,
        fontSize: xLabelFontSize,
        textAnchor: "middle",
      })}
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

  // Adaptive left margin for long labels
  const maxLabelLen = Math.max(...data.map(d => d.label.length));
  const leftMargin = maxLabelLen > 16 ? 160 : maxLabelLen > 10 ? 130 : 120;
  const margin = { top: 20, right: 60, bottom: 20, left: leftMargin };
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
      <text x="${margin.left - 8}" y="${y + barHeight / 2 + 4}" text-anchor="end" fill="#6b7280" font-size="11" font-family="Inter, sans-serif">${escapeXml(truncateLabel(d.label, 22))}</text>
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

  // Adaptive bottom margin for long labels
  const maxLabelLen = Math.max(...data.map(d => d.label.length));
  const needsExtraSpace = maxLabelLen > 12;
  const margin = { top: 30, right: 30, bottom: needsExtraSpace ? 70 : 50, left: 60 };
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

  // Pre-calculate value label positions with overlap avoidance
  const valueLabelPositions = points.map((p, i) => {
    let labelY = p.y - 12; // default: above point
    let labelX = p.x;
    if (showValues && i > 0) {
      const prevLabelY = points[i - 1].y - 12;
      const prevLabelX = points[i - 1].x;
      // Check if labels would overlap (within 12px vertically and 40px horizontally)
      if (Math.abs(labelY - prevLabelY) < 12 && Math.abs(labelX - prevLabelX) < 50) {
        // Alternate: place below the point instead
        labelY = p.y + 18;
      }
    }
    // Ensure label doesn't go above the chart area
    if (labelY < margin.top - 5) labelY = p.y + 18;
    return { x: labelX, y: labelY };
  });

  // Reduce font size for x-axis labels when there are many points
  const xLabelFontSize = data.length > 8 ? 8 : data.length > 6 ? 9 : 10;
  const xLabelMaxChars = data.length > 8 ? 10 : needsExtraSpace ? 14 : 18;

  const pointElements = points.map((p, i) => {
    let valueLabel = "";
    if (showValues) {
      const lp = valueLabelPositions[i];
      valueLabel = `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" fill="#6b7280" font-size="10" font-weight="600" font-family="Inter, sans-serif">${formatValue(p.d.value, unit)}</text>`;
    }
    return `<g>
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${lineColor}" stroke-width="2.5" />
      ${valueLabel}
      ${renderMultiLineLabel(p.x, height - margin.bottom + 16, p.d.label, {
        maxCharsPerLine: xLabelMaxChars,
        maxLines: needsExtraSpace ? 2 : 1,
        fontSize: xLabelFontSize,
        textAnchor: "middle",
      })}
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

  // Legend — adaptive sizing for many items
  let legend = "";
  if (showLegend) {
    const legendX = width * 0.72;
    const maxLegendWidth = width - legendX - 10;
    const maxChars = Math.max(12, Math.floor(maxLegendWidth / 6));
    // Reduce item height when there are many items to prevent overflow
    const legendItemHeight = data.length > 8 ? 18 : data.length > 6 ? 22 : 28;
    const legendFontSize = data.length > 8 ? 8 : data.length > 6 ? 9 : 10;
    // Limit displayed items to prevent overflow, show "+ N more" if needed
    const maxLegendItems = Math.min(data.length, Math.floor((height - 40) / legendItemHeight));
    const legendStartY = Math.max(10, cy - (maxLegendItems * legendItemHeight) / 2);
    const displayData = data.slice(0, maxLegendItems);
    legend = displayData.map((d, i) => {
      const y = legendStartY + i * legendItemHeight;
      const color = d.color || getColor(i, true);
      const pct = ((Math.abs(d.value) / total) * 100).toFixed(0);
      const suffix = ` (${pct}%)`;
      const availChars = Math.max(8, maxChars - suffix.length);
      const displayLabel = truncateLabel(d.label, availChars);
      return `<g>
        <rect x="${legendX}" y="${y}" width="10" height="10" rx="2" fill="${color}" />
        <text x="${legendX + 16}" y="${y + 9}" fill="#6b7280" font-size="${legendFontSize}" font-family="Inter, sans-serif">${escapeXml(displayLabel)}${suffix}</text>
      </g>`;
    }).join("\n    ");
    if (data.length > maxLegendItems) {
      const moreY = legendStartY + maxLegendItems * legendItemHeight;
      legend += `\n    <text x="${legendX}" y="${moreY + 9}" fill="#9ca3af" font-size="${legendFontSize}" font-family="Inter, sans-serif">+ ${data.length - maxLegendItems} more</text>`;
    }
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

  // Legend — adaptive sizing for many items
  let legend = "";
  if (showLegend) {
    const legendX = width * 0.72;
    const maxLegendWidth = width - legendX - 10;
    const maxChars = Math.max(12, Math.floor(maxLegendWidth / 6));
    const legendItemHeight = data.length > 8 ? 18 : data.length > 6 ? 22 : 28;
    const legendFontSize = data.length > 8 ? 8 : data.length > 6 ? 9 : 10;
    const maxLegendItems = Math.min(data.length, Math.floor((height - 40) / legendItemHeight));
    const legendStartY = Math.max(10, cy - (maxLegendItems * legendItemHeight) / 2);
    const displayData = data.slice(0, maxLegendItems);
    legend = displayData.map((d, i) => {
      const y = legendStartY + i * legendItemHeight;
      const color = d.color || getColor(i, true);
      const pct = ((Math.abs(d.value) / total) * 100).toFixed(0);
      const suffix = ` (${pct}%)`;
      const availChars = Math.max(8, maxChars - suffix.length);
      const displayLabel = truncateLabel(d.label, availChars);
      return `<g>
        <rect x="${legendX}" y="${y}" width="10" height="10" rx="2" fill="${color}" />
        <text x="${legendX + 16}" y="${y + 9}" fill="#6b7280" font-size="${legendFontSize}" font-family="Inter, sans-serif">${escapeXml(displayLabel)}${suffix}</text>
      </g>`;
    }).join("\n    ");
    if (data.length > maxLegendItems) {
      const moreY = legendStartY + maxLegendItems * legendItemHeight;
      legend += `\n    <text x="${legendX}" y="${moreY + 9}" fill="#9ca3af" font-size="${legendFontSize}" font-family="Inter, sans-serif">+ ${data.length - maxLegendItems} more</text>`;
    }
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
// RADAR CHART
// ═══════════════════════════════════════════════════════

export function renderRadarChart(config: ChartConfig): string {
  const { data, width = 500, height = 400, showValues = true, showLegend = false, unit } = config;
  if (data.length < 3) return renderEmptyChart(width, height, "Radar chart needs 3+ data points");

  const cx = showLegend ? width * 0.38 : width / 2;
  const cy = height / 2;
  const radius = Math.min(cx - 40, cy - 40);
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start from top

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);

  // Helper: get point on the radar at given angle and distance
  function radarPoint(index: number, value: number): { x: number; y: number } {
    const angle = startAngle + index * angleStep;
    const r = (value / maxVal) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  // Grid rings (5 levels)
  const gridRings: string[] = [];
  for (let level = 1; level <= 5; level++) {
    const r = (radius * level) / 5;
    const points = Array.from({ length: n }, (_, i) => {
      const angle = startAngle + i * angleStep;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
    gridRings.push(
      `<polygon points="${points}" fill="none" stroke="#e5e7eb" stroke-width="${level === 5 ? 1.5 : 0.8}" stroke-dasharray="${level === 5 ? 'none' : '3,3'}" />`
    );
  }

  // Axis lines from center to each vertex
  const axisLines = Array.from({ length: n }, (_, i) => {
    const angle = startAngle + i * angleStep;
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#d1d5db" stroke-width="1" />`;
  });

  // Axis labels (category names)
  const axisLabels = data.map((d, i) => {
    const angle = startAngle + i * angleStep;
    const labelR = radius + 18;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    
    // Determine text-anchor based on position
    let textAnchor = "middle";
    if (Math.cos(angle) > 0.3) textAnchor = "start";
    else if (Math.cos(angle) < -0.3) textAnchor = "end";
    
    // Adjust vertical position for top/bottom labels
    let dy = 4;
    if (Math.sin(angle) < -0.5) dy = 0;
    else if (Math.sin(angle) > 0.5) dy = 10;

    const label = truncateLabel(d.label, 20);
    return `<text x="${lx}" y="${ly}" dy="${dy}" text-anchor="${textAnchor}" fill="#6b7280" font-size="10" font-family="Inter, sans-serif">${escapeXml(label)}</text>`;
  });

  // Data polygon
  const dataPoints = data.map((d, i) => radarPoint(i, d.value));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(" ");
  const color = getColor(0, true);

  // Value labels on data points
  const valueLabels = showValues ? data.map((d, i) => {
    const p = radarPoint(i, d.value);
    const angle = startAngle + i * angleStep;
    // Offset the value label slightly outward from the data point
    const offsetR = 14;
    const vx = p.x + offsetR * Math.cos(angle);
    const vy = p.y + offsetR * Math.sin(angle);
    return `<text x="${vx}" y="${vy}" text-anchor="middle" dominant-baseline="middle" fill="#374151" font-size="9" font-weight="600" font-family="Inter, sans-serif">${formatValue(d.value, unit)}</text>`;
  }) : [];

  // Scale labels on the first axis (top)
  const scaleLabels: string[] = [];
  for (let level = 1; level <= 5; level++) {
    const val = (maxVal * level) / 5;
    const r = (radius * level) / 5;
    scaleLabels.push(
      `<text x="${cx + 4}" y="${cy - r - 2}" fill="#9ca3af" font-size="8" font-family="Inter, sans-serif">${formatValue(val, unit)}</text>`
    );
  }

  // Legend (optional)
  let legend = "";
  if (showLegend) {
    const legendX = width * 0.78;
    const legendStartY = cy - (data.length * 22) / 2;
    legend = data.map((d, i) => {
      const y = legendStartY + i * 22;
      const displayLabel = truncateLabel(d.label, 16);
      return `<g>
        <circle cx="${legendX + 5}" cy="${y + 5}" r="4" fill="${getColor(i, true)}" />
        <text x="${legendX + 14}" y="${y + 9}" fill="#6b7280" font-size="9" font-family="Inter, sans-serif">${escapeXml(displayLabel)}: ${formatValue(d.value, unit)}</text>
      </g>`;
    }).join("\n    ");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0.08" />
    </linearGradient>
  </defs>
  <!-- Grid -->
  ${gridRings.join("\n  ")}
  <!-- Axes -->
  ${axisLines.join("\n  ")}
  <!-- Scale labels -->
  ${scaleLabels.join("\n  ")}
  <!-- Data polygon -->
  <polygon points="${polygonPoints}" fill="url(#radarFill)" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" />
  <!-- Data points -->
  ${dataPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${color}" stroke-width="2.5" />`).join("\n  ")}
  <!-- Value labels -->
  ${valueLabels.join("\n  ")}
  <!-- Axis labels -->
  ${axisLabels.join("\n  ")}
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
  // Validate data — filter out NaN/undefined values and ensure we have usable data
  const cleanedData = config.data
    .filter(d => d && typeof d.value === 'number' && !isNaN(d.value) && d.label)
    .map(d => ({ ...d, label: String(d.label), value: Number(d.value) }));
  
  if (cleanedData.length === 0) {
    return {
      svg: renderEmptyChart(config.width || 600, config.height || 360, "Нет данных для графика"),
      chartType: config.type,
      dataPointCount: 0,
    };
  }
  
  // Use cleaned data
  const cleanConfig = { ...config, data: cleanedData };
  let svg: string;

  switch (cleanConfig.type) {
    case "bar":
      svg = renderBarChart(cleanConfig);
      break;
    case "horizontal-bar":
      svg = renderHorizontalBarChart(cleanConfig);
      break;
    case "line":
      svg = renderLineChart(cleanConfig);
      break;
    case "pie":
      svg = renderPieChart(cleanConfig);
      break;
    case "donut":
      svg = renderDonutChart(cleanConfig);
      break;
    case "radar":
      svg = renderRadarChart(cleanConfig);
      break;
    default:
      svg = renderBarChart(cleanConfig);
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

  // Multi-criteria comparison / radar-suitable data
  if (contextLower.match(/критери|criteria|параметр|parameter|показател|indicator|оценк|rating|сильные сторон|strengths|компетенц|competenc|профиль|profile|индекс|index/)) {
    if (count >= 4 && count <= 10) return "radar";
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
