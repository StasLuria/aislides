/**
 * PPTX Export Module — Converts slide data to PowerPoint format using pptxgenjs.
 *
 * Supports all 18+ layout types with proper data mapping, markdown stripping,
 * decorative elements, and correct positioning for LAYOUT_WIDE (13.33 x 7.5 inches).
 */
import PptxGenJSDefault from "pptxgenjs";
// Handle both ESM default and CJS module exports at runtime
const PptxGenJSConstructor = (PptxGenJSDefault as any).default || PptxGenJSDefault;

// shapes and charts are instance properties in pptxgenjs, not static
const _refPptx = new PptxGenJSConstructor();
const SHAPES = _refPptx.shapes;
const CHARTS = _refPptx.charts;

// Type aliases from the PptxGenJS namespace
type PptxSlide = PptxGenJSDefault.Slide;
type PptxTextProps = PptxGenJSDefault.TextProps;
type PptxTableRow = PptxGenJSDefault.TableRow;
type PptxChartName = PptxGenJSDefault.CHART_NAME;

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface SlideInput {
  layoutId: string;
  data: Record<string, any>;
}

interface ThemeColors {
  headingColor: string;
  bodyColor: string;
  accentColor: string;
  accentLight: string;
  secondaryAccent: string;
  bgColor: string;
  cardBg: string;
  headingFont: string;
  bodyFont: string;
}

// LAYOUT_WIDE dimensions in inches
const W = 13.33;
const H = 7.5;
const MARGIN = 0.7;
const CONTENT_W = W - 2 * MARGIN;
const FOOTER_Y = H - 0.5;

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

/** Strip markdown bold/italic markers and clean up text */
function stripMd(text: any): string {
  if (text === null || text === undefined) return "";
  if (typeof text !== "string") return String(text);
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")  // ***bold italic***
    .replace(/\*\*(.*?)\*\*/g, "$1")       // **bold**
    .replace(/\*(.*?)\*/g, "$1")           // *italic*
    .replace(/__(.*?)__/g, "$1")           // __underline__
    .replace(/~~(.*?)~~/g, "$1")           // ~~strikethrough~~
    .replace(/`(.*?)`/g, "$1")             // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
    .trim();
}

function parseThemeColors(cssVariables: string): ThemeColors {
  const get = (name: string, fallback: string): string => {
    const match = cssVariables.match(new RegExp(`--${name}:\\s*([^;]+)`));
    return match ? match[1].trim() : fallback;
  };

  const getFont = (name: string, fallback: string): string => {
    const raw = get(name, fallback);
    return raw.replace(/['"]/g, "").trim();
  };

  return {
    headingColor: get("text-heading-color", "#0f172a"),
    bodyColor: get("text-body-color", "#475569"),
    accentColor: get("primary-accent-color", "#2563eb"),
    accentLight: get("primary-accent-light", "#93bbfd"),
    secondaryAccent: get("secondary-accent-color", "#0ea5e9"),
    bgColor: "#ffffff",
    cardBg: get("card-background-color", "#ffffff"),
    headingFont: getFont("heading-font-family", "Inter"),
    bodyFont: getFont("body-font-family", "Source Sans 3"),
  };
}

/** Convert hex color to PPTX-compatible format (strip #) */
function pc(hex: string): string {
  if (!hex) return "475569";
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
    // Try to extract from rgba(r,g,b,a)
    const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const r = parseInt(m[1]).toString(16).padStart(2, "0");
      const g = parseInt(m[2]).toString(16).padStart(2, "0");
      const b = parseInt(m[3]).toString(16).padStart(2, "0");
      return `${r}${g}${b}`.toUpperCase();
    }
    return "475569";
  }
  return hex.replace("#", "").toUpperCase();
}

/** Lighten a hex color by mixing with white */
function lighten(hex: string, amount: number): string {
  const c = pc(hex);
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
}

/** Add an accent bar at the top of a content slide */
function addAccentBar(slide: PptxSlide, theme: ThemeColors) {
  slide.addShape(SHAPES.RECTANGLE, {
    x: 0, y: 0, w: W, h: 0.06,
    fill: { color: pc(theme.accentColor) },
    line: { width: 0 },
  });
}

/** Add slide title with consistent styling */
function addTitle(slide: PptxSlide, title: string, theme: ThemeColors, opts?: { y?: number; fontSize?: number }) {
  const cleanTitle = stripMd(title);
  // Auto-reduce font size for long titles to prevent truncation
  const baseFontSize = opts?.fontSize ?? 24;
  const fontSize = cleanTitle.length > 60 ? baseFontSize - 4 : cleanTitle.length > 40 ? baseFontSize - 2 : baseFontSize;
  slide.addText(cleanTitle, {
    x: MARGIN, y: opts?.y ?? 0.35, w: CONTENT_W, h: 0.8,
    fontSize,
    fontFace: theme.headingFont,
    color: pc(theme.headingColor),
    bold: true,
    valign: "middle",
    shrinkText: true,
  });
}

/** Add slide number footer */
function addFooter(slide: PptxSlide, data: Record<string, any>, totalSlides: number, theme: ThemeColors) {
  const num = data._slideNumber;
  if (!num) return;
  // Thin line above footer
  slide.addShape(SHAPES.RECTANGLE, {
    x: MARGIN, y: FOOTER_Y - 0.05, w: CONTENT_W, h: 0.01,
    fill: { color: lighten(theme.bodyColor, 0.7) },
    line: { width: 0 },
  });
  slide.addText(`${num} / ${totalSlides}`, {
    x: W - 2, y: FOOTER_Y, w: 1.3, h: 0.3,
    fontSize: 9, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "right",
  });
  // Presentation title in footer
  if (data._presentationTitle) {
    slide.addText(stripMd(data._presentationTitle), {
      x: MARGIN, y: FOOTER_Y, w: 6, h: 0.3,
      fontSize: 9, fontFace: theme.bodyFont, color: lighten(theme.bodyColor, 0.3),
    });
  }
}

/** Create bullet items from various data shapes */
function makeBullets(items: any[], theme: ThemeColors, opts?: { fontSize?: number }): PptxTextProps[] {
  if (!items || items.length === 0) return [];
  const fs = opts?.fontSize ?? 13;
  return items.map((b: any) => {
    if (typeof b === "string") {
      return {
        text: stripMd(b),
        options: { bullet: { type: "bullet" as any }, fontSize: fs, fontFace: theme.bodyFont, color: pc(theme.bodyColor), paraSpaceAfter: 6 },
      };
    }
    const title = stripMd(b.title || b.label || b.text || b.name || "");
    const desc = stripMd(b.description || b.details || b.desc || "");
    const combined = desc ? `${title}\n${desc}` : title;
    return {
      text: combined,
      options: { bullet: { type: "bullet" as any }, fontSize: fs, fontFace: theme.bodyFont, color: pc(theme.bodyColor), paraSpaceAfter: 8 },
    };
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE BUILDERS
// ═══════════════════════════════════════════════════════

function addTitleSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pc(theme.accentColor) };

  // Decorative large circle
  slide.addShape(SHAPES.OVAL, {
    x: W - 4, y: -2, w: 6, h: 6,
    fill: { color: "FFFFFF", type: "solid" },
    line: { width: 0 },
  });

  slide.addText(stripMd(data.title || "Презентация"), {
    x: MARGIN + 0.2, y: 1.8, w: 9, h: 2,
    fontSize: 40, fontFace: theme.headingFont, color: "FFFFFF", bold: true, valign: "bottom",
    lineSpacingMultiple: 1.1,
  });

  if (data.description) {
    slide.addText(stripMd(data.description), {
      x: MARGIN + 0.2, y: 4.0, w: 9, h: 1.2,
      fontSize: 16, fontFace: theme.bodyFont, color: "D4D4D8",
      lineSpacingMultiple: 1.3,
    });
  }

  if (data.presentationDate || data.presenterName) {
    const meta = [data.presenterName, data.presentationDate].filter(Boolean).join("  ·  ");
    slide.addText(stripMd(meta), {
      x: MARGIN + 0.2, y: H - 1.2, w: 6, h: 0.4,
      fontSize: 12, fontFace: theme.bodyFont, color: "FFFFFF99",
    });
  }
}

function addSectionHeader(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, _totalSlides?: number) {
  slide.background = { color: pc(theme.accentColor) };

  // Accent line
  slide.addShape(SHAPES.RECTANGLE, {
    x: MARGIN + 0.2, y: 2.2, w: 1.5, h: 0.06,
    fill: { color: "FFFFFF" },
    line: { width: 0 },
  });

  const sectionTitle = stripMd(data.title || "");
  const sectionFontSize = sectionTitle.length > 50 ? 26 : sectionTitle.length > 35 ? 30 : 34;
  slide.addText(sectionTitle, {
    x: MARGIN + 0.2, y: 2.5, w: CONTENT_W - 0.4, h: 1.5,
    fontSize: sectionFontSize, fontFace: theme.headingFont, color: "FFFFFF", bold: true, valign: "top",
    shrinkText: true,
  });

  if (data.subtitle) {
    slide.addText(stripMd(data.subtitle), {
      x: MARGIN + 0.2, y: 4.2, w: 10, h: 1,
      fontSize: 16, fontFace: theme.bodyFont, color: "D4D4D8",
    });
  }
}

function addTextSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const bullets = data.bullets || [];
  if (bullets.length > 0) {
    const items = bullets.map((b: any) => {
      const title = typeof b === "string" ? stripMd(b) : stripMd(b.title || "");
      const desc = typeof b === "string" ? "" : stripMd(b.description || "");
      if (desc) {
        return [
          { text: title, options: { bold: true, fontSize: 14, fontFace: theme.headingFont, color: pc(theme.headingColor), breakType: "none" as any } },
          { text: `\n${desc}`, options: { fontSize: 12, fontFace: theme.bodyFont, color: pc(theme.bodyColor), paraSpaceAfter: 10 } },
        ];
      }
      return [
        { text: title, options: { bullet: { type: "bullet" as any }, fontSize: 13, fontFace: theme.bodyFont, color: pc(theme.bodyColor), paraSpaceAfter: 8 } },
      ];
    });
    // Flatten for addText
    const flatItems = items.map((group: any[]) => ({
      text: group.map((p: any) => p.text).join(""),
      options: { ...group[0].options, paraSpaceAfter: 10 },
    }));
    slide.addText(flatItems, { x: MARGIN, y: 1.3, w: CONTENT_W, h: 5, valign: "top" });
  } else if (data.callout || data.description) {
    slide.addText(stripMd(data.callout || data.description), {
      x: MARGIN, y: 1.3, w: CONTENT_W, h: 5,
      fontSize: 14, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addTwoColumn(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const colW = (CONTENT_W - 0.5) / 2;

  // Left column
  const leftTitle = stripMd(data.leftColumn?.title || "");
  if (leftTitle) {
    slide.addText(leftTitle, {
      x: MARGIN, y: 1.3, w: colW, h: 0.5,
      fontSize: 15, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true,
    });
  }
  const leftBullets = makeBullets(data.leftColumn?.bullets || [], theme, { fontSize: 12 });
  if (leftBullets.length > 0) {
    slide.addText(leftBullets, { x: MARGIN, y: 1.9, w: colW, h: 4.5, valign: "top" });
  }

  // Vertical divider
  slide.addShape(SHAPES.RECTANGLE, {
    x: MARGIN + colW + 0.2, y: 1.3, w: 0.02, h: 4.5,
    fill: { color: lighten(theme.bodyColor, 0.7) },
    line: { width: 0 },
  });

  // Right column
  const rightTitle = stripMd(data.rightColumn?.title || "");
  if (rightTitle) {
    slide.addText(rightTitle, {
      x: MARGIN + colW + 0.5, y: 1.3, w: colW, h: 0.5,
      fontSize: 15, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true,
    });
  }
  const rightBullets = makeBullets(data.rightColumn?.bullets || [], theme, { fontSize: 12 });
  if (rightBullets.length > 0) {
    slide.addText(rightBullets, { x: MARGIN + colW + 0.5, y: 1.9, w: colW, h: 4.5, valign: "top" });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addChartSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  if (data.description) {
    slide.addText(stripMd(data.description), {
      x: MARGIN, y: 1.15, w: CONTENT_W, h: 0.5,
      fontSize: 12, fontFace: theme.bodyFont, color: pc(theme.bodyColor),
    });
  }

  const chartData = data.chartData;
  if (chartData && chartData.labels && chartData.datasets?.length > 0) {
    try {
      const chartType = mapChartType(chartData.type);
      const chartDataForPptx = chartData.datasets.map((ds: any) => ({
        name: ds.label || "Данные",
        labels: chartData.labels,
        values: ds.data.map((v: any) => (typeof v === "number" ? v : parseFloat(v) || 0)),
      }));

      const isPie = chartData.type === "pie" || chartData.type === "donut" || chartData.type === "doughnut";
      slide.addChart(chartType, chartDataForPptx, {
        x: 1,
        y: 1.8,
        w: W - 2,
        h: 4.5,
        showTitle: false,
        showLegend: chartData.datasets.length > 1 || isPie,
        legendPos: "b",
        legendFontSize: 10,
        chartColors: [pc(theme.accentColor), pc(theme.secondaryAccent), "F59E0B", "10B981", "EF4444", "8B5CF6", "EC4899", "14B8A6"],
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        showValue: !isPie,
        dataLabelFontSize: 9,
        dataLabelColor: pc(theme.bodyColor),
        catAxisOrientation: "minMax",
        valAxisOrientation: "minMax",
        barDir: chartData.type === "horizontal-bar" ? "bar" : "col",
      });
    } catch {
      // Fallback: show data as table
      addDataAsTable(slide, chartData, theme);
    }
  } else if (data.stats && Array.isArray(data.stats)) {
    // stats-chart layout may have stats[] instead of chartData
    addStatsGrid(slide, data.stats, theme, 1.8);
  }

  addFooter(slide, data, totalSlides, theme);
}

function mapChartType(type: string): PptxChartName {
  switch (type) {
    case "bar":
      return CHARTS.BAR;
    case "horizontal-bar":
      return CHARTS.BAR;
    case "line":
      return CHARTS.LINE;
    case "pie":
      return CHARTS.PIE;
    case "donut":
    case "doughnut":
      return CHARTS.DOUGHNUT;
    case "radar":
      return CHARTS.RADAR;
    default:
      return CHARTS.BAR;
  }
}

function addDataAsTable(slide: PptxSlide, chartData: any, theme: ThemeColors) {
  if (!chartData?.labels || !chartData?.datasets?.[0]?.data) return;

  const rows: PptxTableRow[] = [
    chartData.labels.map((l: string) => ({
      text: stripMd(l),
      options: { bold: true, fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pc(theme.accentColor) }, align: "center" as any, valign: "middle" as any },
    })),
    ...chartData.datasets.map((ds: any) =>
      ds.data.map((v: any) => ({
        text: String(v),
        options: { fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center" as any, valign: "middle" as any },
      })),
    ),
  ];

  const colW = Math.min(2, (W - 2) / chartData.labels.length);
  slide.addTable(rows, { x: 1, y: 2.0, w: W - 2, colW, border: { pt: 0.5, color: "CCCCCC" }, rowH: 0.4 });
}

function addTableSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const headers = data.headers || [];
  const rows = data.rows || [];
  if (headers.length === 0 && rows.length === 0) {
    addFooter(slide, data, totalSlides, theme);
    return;
  }

  const colCount = headers.length || (rows[0]?.length || 2);
  const tableW = CONTENT_W;
  const colW = tableW / colCount;

  const tableRows: PptxTableRow[] = [];

  if (headers.length > 0) {
    tableRows.push(
      headers.map((h: string) => ({
        text: stripMd(h),
        options: { bold: true, fontSize: 11, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pc(theme.accentColor) }, align: "center" as any, valign: "middle" as any },
      })),
    );
  }

  rows.forEach((row: any[], i: number) => {
    tableRows.push(
      (Array.isArray(row) ? row : Object.values(row)).map((cell: any) => ({
        text: stripMd(String(cell ?? "")),
        options: {
          fontSize: 10,
          fontFace: theme.bodyFont,
          color: pc(theme.bodyColor),
          fill: { color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
          valign: "middle" as any,
          paraSpaceBefore: 2,
          paraSpaceAfter: 2,
        },
      })),
    );
  });

  slide.addTable(tableRows, {
    x: MARGIN, y: 1.3, w: tableW, colW,
    border: { pt: 0.5, color: "E2E8F0" },
    rowH: 0.4,
    autoPage: true,
  });

  addFooter(slide, data, totalSlides, theme);
}

/** Render a grid of stat cards */
function addStatsGrid(slide: PptxSlide, metrics: any[], theme: ThemeColors, startY: number) {
  const count = Math.min(metrics.length, 4);
  if (count === 0) return;
  const cardW = (CONTENT_W - (count - 1) * 0.3) / count;

  metrics.slice(0, 4).forEach((m: any, i: number) => {
    const x = MARGIN + i * (cardW + 0.3);
    // Card background
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x, y: startY, w: cardW, h: 2.2,
      fill: { color: "F8FAFC" },
      rectRadius: 0.1,
      line: { color: "E2E8F0", width: 0.5 },
    });

    // Value
    slide.addText(stripMd(m.value || m.stat || "—"), {
      x, y: startY + 0.3, w: cardW, h: 0.7,
      fontSize: 28, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
    });

    // Label
    slide.addText(stripMd(m.label || m.title || m.name || "").toUpperCase(), {
      x, y: startY + 1.0, w: cardW, h: 0.4,
      fontSize: 10, fontFace: theme.headingFont, color: pc(theme.headingColor), align: "center", bold: true,
    });

    // Description
    const desc = stripMd(m.description || m.details || m.change || "");
    if (desc) {
      slide.addText(desc, {
        x: x + 0.15, y: startY + 1.4, w: cardW - 0.3, h: 0.6,
        fontSize: 9, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center",
        lineSpacingMultiple: 1.2,
      });
    }
  });
}

function addStatsSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const metrics = data.metrics || data.stats || [];
  if (metrics.length > 0) {
    addStatsGrid(slide, metrics, theme, 1.5);
  }

  addFooter(slide, data, totalSlides, theme);
}

function addHighlightStats(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  // Main stat (hero number)
  const mainStat = data.mainStat || {};
  if (mainStat.value) {
    // Background accent area
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x: MARGIN, y: 1.4, w: CONTENT_W, h: 2.2,
      fill: { color: lighten(theme.accentColor, 0.92) },
      rectRadius: 0.15,
      line: { width: 0 },
    });

    slide.addText(stripMd(mainStat.value), {
      x: MARGIN, y: 1.5, w: CONTENT_W, h: 1.0,
      fontSize: 48, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
    });
    slide.addText(stripMd(mainStat.label || ""), {
      x: MARGIN, y: 2.5, w: CONTENT_W, h: 0.5,
      fontSize: 16, fontFace: theme.bodyFont, color: pc(theme.headingColor), align: "center",
    });
    if (mainStat.description) {
      slide.addText(stripMd(mainStat.description), {
        x: MARGIN + 1, y: 3.0, w: CONTENT_W - 2, h: 0.4,
        fontSize: 11, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center",
      });
    }
  }

  // Supporting stats
  const supporting = data.supportingStats || [];
  const count = Math.min(supporting.length, 4);
  if (count > 0) {
    const startY = mainStat.value ? 4.0 : 1.5;
    const cardW = (CONTENT_W - (count - 1) * 0.3) / count;

    supporting.slice(0, 4).forEach((s: any, i: number) => {
      const x = MARGIN + i * (cardW + 0.3);
      // Card
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x, y: startY, w: cardW, h: 2,
        fill: { color: "F8FAFC" },
        rectRadius: 0.1,
        line: { color: "E2E8F0", width: 0.5 },
      });

      slide.addText(stripMd(s.value || "—"), {
        x, y: startY + 0.2, w: cardW, h: 0.7,
        fontSize: 24, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
      });
      slide.addText(stripMd(s.label || ""), {
        x, y: startY + 0.9, w: cardW, h: 0.4,
        fontSize: 11, fontFace: theme.headingFont, color: pc(theme.headingColor), align: "center", bold: true,
      });
      if (s.description || s.trend) {
        slide.addText(stripMd(s.description || s.trend || ""), {
          x: x + 0.1, y: startY + 1.3, w: cardW - 0.2, h: 0.5,
          fontSize: 9, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center",
        });
      }
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addHeroStatSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const mainStat = data.mainStat || {};
  if (mainStat.value) {
    slide.addText(stripMd(mainStat.value), {
      x: 1, y: 1.5, w: W - 2, h: 1.2,
      fontSize: 52, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
    });
    slide.addText(stripMd(mainStat.label || ""), {
      x: 1, y: 2.7, w: W - 2, h: 0.5,
      fontSize: 16, fontFace: theme.bodyFont, color: pc(theme.headingColor), align: "center",
    });
  }

  const supporting = data.supportingStats || [];
  const count = Math.min(supporting.length, 4);
  if (count > 0) {
    const cardW = (W - 2) / count;
    supporting.slice(0, 4).forEach((s: any, i: number) => {
      const x = 1 + i * cardW;
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: x + 0.1, y: 3.6, w: cardW - 0.2, h: 1.5,
        fill: { color: "F8FAFC" },
        rectRadius: 0.08,
        line: { color: "E2E8F0", width: 0.5 },
      });
      slide.addText(stripMd(s.value || "—"), {
        x, y: 3.7, w: cardW, h: 0.6,
        fontSize: 22, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
      });
      slide.addText(stripMd(s.label || ""), {
        x, y: 4.3, w: cardW, h: 0.4,
        fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center",
      });
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addTimelineSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const events = data.events || data.milestones || data.items || [];
  const maxItems = Math.min(events.length, 6);
  const rowH = Math.min(0.8, 4.5 / maxItems);

  events.slice(0, 6).forEach((ev: any, i: number) => {
    const y = 1.5 + i * rowH;

    // Date badge
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x: MARGIN, y, w: 2, h: rowH - 0.1,
      fill: { color: pc(theme.accentColor) },
      rectRadius: 0.08,
      line: { width: 0 },
    });
    slide.addText(stripMd(ev.date || ev.period || ev.year || ""), {
      x: MARGIN, y, w: 2, h: rowH - 0.1,
      fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });

    // Connector line
    slide.addShape(SHAPES.RECTANGLE, {
      x: MARGIN + 2.1, y: y + (rowH - 0.1) / 2 - 0.01, w: 0.3, h: 0.02,
      fill: { color: pc(theme.accentColor) },
      line: { width: 0 },
    });

    // Title
    slide.addText(stripMd(ev.title || ""), {
      x: MARGIN + 2.5, y, w: 4, h: rowH - 0.1,
      fontSize: 12, fontFace: theme.headingFont, color: pc(theme.headingColor), bold: true, valign: "middle",
    });

    // Description
    if (ev.description) {
      slide.addText(stripMd(ev.description), {
        x: MARGIN + 6.8, y, w: 4.5, h: rowH - 0.1,
        fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "middle",
      });
    }
  });

  addFooter(slide, data, totalSlides, theme);
}

function addProcessSteps(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const steps = data.steps || data.items || data.stages || [];
  const maxSteps = Math.min(steps.length, 6);
  const rowH = Math.min(0.85, 4.5 / maxSteps);

  steps.slice(0, 6).forEach((step: any, i: number) => {
    const y = 1.5 + i * rowH;

    // Number circle
    slide.addShape(SHAPES.OVAL, {
      x: MARGIN, y: y + 0.05, w: 0.5, h: 0.5,
      fill: { color: pc(theme.accentColor) },
      line: { width: 0 },
    });
    slide.addText(String(i + 1), {
      x: MARGIN, y: y + 0.05, w: 0.5, h: 0.5,
      fontSize: 14, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });

    // Title
    slide.addText(stripMd(step.title || step.name || ""), {
      x: MARGIN + 0.7, y, w: 4.5, h: rowH - 0.05,
      fontSize: 13, fontFace: theme.headingFont, color: pc(theme.headingColor), bold: true, valign: "middle",
    });

    // Description
    if (step.description) {
      slide.addText(stripMd(step.description), {
        x: MARGIN + 5.5, y, w: 5.5, h: rowH - 0.05,
        fontSize: 11, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "middle",
      });
    }
  });

  addFooter(slide, data, totalSlides, theme);
}

function addComparisonSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const optA = data.optionA || data.left || {};
  const optB = data.optionB || data.right || {};
  const colW = (CONTENT_W - 0.5) / 2;

  // Option A header
  const colorA = pc(optA.color || theme.accentColor);
  slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
    x: MARGIN, y: 1.3, w: colW, h: 0.5,
    fill: { color: colorA },
    rectRadius: 0.08,
    line: { width: 0 },
  });
  slide.addText(stripMd(optA.title || "Вариант A"), {
    x: MARGIN, y: 1.3, w: colW, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
  });

  const pointsA = makeBullets(optA.points || optA.bullets || [], theme, { fontSize: 11 });
  if (pointsA.length > 0) {
    slide.addText(pointsA, { x: MARGIN, y: 1.9, w: colW, h: 4.5, valign: "top" });
  }

  // Option B header
  const colorB = pc(optB.color || theme.secondaryAccent);
  slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
    x: MARGIN + colW + 0.5, y: 1.3, w: colW, h: 0.5,
    fill: { color: colorB },
    rectRadius: 0.08,
    line: { width: 0 },
  });
  slide.addText(stripMd(optB.title || "Вариант B"), {
    x: MARGIN + colW + 0.5, y: 1.3, w: colW, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
  });

  const pointsB = makeBullets(optB.points || optB.bullets || [], theme, { fontSize: 11 });
  if (pointsB.length > 0) {
    slide.addText(pointsB, { x: MARGIN + colW + 0.5, y: 1.9, w: colW, h: 4.5, valign: "top" });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addComparisonTable(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  // Build table from comparison-table data
  // headers can be empty; columns may contain {name, highlight} objects
  let headers = data.headers || [];
  if (headers.length === 0 && data.columns && Array.isArray(data.columns)) {
    headers = data.columns.map((c: any) => (typeof c === "string" ? c : c.name || c.label || c.title || ""));
  }
  const features = data.features || [];
  const featureLabel = data.featureLabel || "\u041C\u0435\u0442\u0440\u0438\u043A\u0430";

  if (features.length > 0 && headers.length > 0) {
    const colCount = headers.length + 1;
    const colW = CONTENT_W / colCount;
    const tableRows: PptxTableRow[] = [];

    // Header row
    tableRows.push([
      { text: stripMd(featureLabel), options: { bold: true, fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pc(theme.accentColor) }, align: "center" as any, valign: "middle" as any } },
      ...headers.map((h: any) => ({
        text: stripMd(typeof h === "string" ? h : h.label || h.title || h.name || ""),
        options: { bold: true, fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pc(theme.accentColor) }, align: "center" as any, valign: "middle" as any },
      })),
    ]);

    // Data rows
    features.forEach((f: any, i: number) => {
      const name = typeof f === "string" ? f : f.name || f.label || f.feature || "";
      const values = f.values || f.data || headers.map((_: any, ci: number) => (data.columns?.[ci]?.values?.[i] || "—"));
      tableRows.push([
        { text: stripMd(name), options: { bold: true, fontSize: 10, fontFace: theme.headingFont, color: pc(theme.headingColor), fill: { color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" }, valign: "middle" as any } },
        ...(Array.isArray(values) ? values : []).map((v: any) => ({
          text: stripMd(String(v ?? "—")),
          options: { fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), fill: { color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" }, align: "center" as any, valign: "middle" as any },
        })),
      ]);
    });

    slide.addTable(tableRows, {
      x: MARGIN, y: 1.3, w: CONTENT_W, colW,
      border: { pt: 0.5, color: "E2E8F0" },
      rowH: 0.4,
    });
  } else if (data.description) {
    slide.addText(stripMd(data.description), {
      x: MARGIN, y: 1.3, w: CONTENT_W, h: 5,
      fontSize: 13, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
    });
  }

  if (data.footnote) {
    slide.addText(stripMd(data.footnote), {
      x: MARGIN, y: FOOTER_Y - 0.5, w: CONTENT_W, h: 0.3,
      fontSize: 9, fontFace: theme.bodyFont, color: lighten(theme.bodyColor, 0.3), italic: true,
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addFinancialFormula(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  // Formula parts
  const parts = data.formulaParts || data.components || [];
  if (parts.length > 0) {
    const partW = Math.min(2.5, (CONTENT_W - (parts.length - 1) * 0.4) / parts.length);
    const startX = MARGIN + (CONTENT_W - parts.length * partW - (parts.length - 1) * 0.4) / 2;

    parts.forEach((p: any, i: number) => {
      const x = startX + i * (partW + 0.4);
      const isOperator = p.type === "operator" || p.operator;

      if (isOperator) {
        slide.addText(stripMd(p.symbol || p.value || p.operator || "="), {
          x, y: 2.0, w: 0.4, h: 1.5,
          fontSize: 28, fontFace: theme.headingFont, color: pc(theme.bodyColor), align: "center", valign: "middle",
        });
      } else {
        // Card for each component
        slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
          x, y: 1.8, w: partW, h: 2.2,
          fill: { color: lighten(theme.accentColor, 0.92) },
          rectRadius: 0.1,
          line: { color: lighten(theme.accentColor, 0.7), width: 0.5 },
        });
        slide.addText(stripMd(p.value || p.amount || "—"), {
          x, y: 1.9, w: partW, h: 0.8,
          fontSize: 24, fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true, align: "center",
        });
        const labelText = stripMd(p.label || p.name || p.title || "");
        const labelFontSize = labelText.length > 15 ? 8 : labelText.length > 10 ? 9 : 11;
        slide.addText(labelText.toUpperCase(), {
          x, y: 2.7, w: partW, h: 0.5,
          fontSize: labelFontSize, fontFace: theme.headingFont, color: pc(theme.headingColor), align: "center", bold: true,
          shrinkText: true,
        });
        if (p.description || p.details) {
          slide.addText(stripMd(p.description || p.details), {
            x: x + 0.1, y: 3.2, w: partW - 0.2, h: 0.6,
            fontSize: 9, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center",
          });
        }
      }
    });
  }

  if (data.footnote) {
    slide.addText(stripMd(data.footnote), {
      x: MARGIN, y: 5.5, w: CONTENT_W, h: 0.3,
      fontSize: 9, fontFace: theme.bodyFont, color: lighten(theme.bodyColor, 0.3), italic: true,
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addVerdictAnalysis(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  // Verdict banner
  const verdictColor = pc(data.verdictColor || theme.accentColor);
  if (data.verdictTitle || data.verdictText) {
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x: MARGIN, y: 1.3, w: CONTENT_W, h: 1.0,
      fill: { color: verdictColor },
      rectRadius: 0.1,
      line: { width: 0 },
    });
    const icon = data.verdictIcon || "";
    slide.addText(`${icon} ${stripMd(data.verdictTitle || data.verdictText || "")}`.trim(), {
      x: MARGIN + 0.3, y: 1.3, w: CONTENT_W - 0.6, h: 0.6,
      fontSize: 18, fontFace: theme.headingFont, color: "FFFFFF", bold: true, valign: "middle",
    });
    if (data.verdictDetails) {
      const detailsText = Array.isArray(data.verdictDetails)
        ? data.verdictDetails.map((d: string) => stripMd(d)).join(" \u2022 ")
        : stripMd(data.verdictDetails);
      slide.addText(detailsText, {
        x: MARGIN + 0.3, y: 1.85, w: CONTENT_W - 0.6, h: 0.4,
        fontSize: 10, fontFace: theme.bodyFont, color: "1E293B", shrinkText: true,
      });
    }
  }

  // Criteria
  const criteria = data.criteria || [];
  if (criteria.length > 0) {
    const startY = (data.verdictTitle || data.verdictText) ? 2.6 : 1.5;
    const maxItems = Math.min(criteria.length, 5);
    const rowH = Math.min(0.7, 3.5 / maxItems);

    criteria.slice(0, 5).forEach((c: any, i: number) => {
      const y = startY + i * rowH;
      const status = (c.value || c.status || c.result || "").toString().toUpperCase();
      const statusColor = status.includes("HIGH") || status.includes("FAIL") || status.includes("BAD") || status.includes("НЕГАТИВ") || status.includes("КРИТИЧ")
        ? "EF4444" : status.includes("MEDIUM") || status.includes("WARN") || status.includes("RISK") || status.includes("СРЕДН")
        ? "F59E0B" : "10B981";

      // Status dot
      slide.addShape(SHAPES.OVAL, {
        x: MARGIN, y: y + 0.15, w: 0.25, h: 0.25,
        fill: { color: statusColor },
        line: { width: 0 },
      });

      slide.addText(stripMd(c.name || c.title || c.label || ""), {
        x: MARGIN + 0.4, y, w: 4, h: rowH,
        fontSize: 12, fontFace: theme.headingFont, color: pc(theme.headingColor), bold: true, valign: "middle",
      });
      // Severity label
      slide.addText(status, {
        x: MARGIN + 4.5, y, w: 1.2, h: rowH,
        fontSize: 10, fontFace: theme.bodyFont, color: statusColor, bold: true, valign: "middle",
      });
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addCardGrid(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  if (data.description) {
    slide.addText(stripMd(data.description), {
      x: MARGIN, y: 1.15, w: CONTENT_W, h: 0.5,
      fontSize: 12, fontFace: theme.bodyFont, color: pc(theme.bodyColor),
    });
  }

  const cards = data.cards || data.items || [];
  const count = Math.min(cards.length, 6);
  if (count === 0) {
    addFooter(slide, data, totalSlides, theme);
    return;
  }

  const cols = count <= 3 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cardW = (CONTENT_W - (cols - 1) * 0.3) / cols;
  const cardH = Math.min(2.2, (5.0 - (data.description ? 0.6 : 0)) / rows - 0.2);
  const startY = data.description ? 1.8 : 1.5;

  cards.slice(0, 6).forEach((card: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + 0.3);
    const y = startY + row * (cardH + 0.2);

    // Card background
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: "F8FAFC" },
      rectRadius: 0.1,
      line: { color: "E2E8F0", width: 0.5 },
    });

    // Icon/emoji — icon can be string emoji or {name, url} object
    const rawIcon = card.icon || card.emoji || "";
    const iconStr = typeof rawIcon === "string" ? rawIcon : (rawIcon.name || "");
    const hasIcon = !!iconStr;
    if (hasIcon) {
      // Try to load SVG icon image, fallback to text
      if (typeof rawIcon === "object" && rawIcon.url) {
        try {
          slide.addImage({ path: rawIcon.url, x: x + 0.2, y: y + 0.15, w: 0.4, h: 0.4 });
        } catch {
          slide.addText(iconStr.substring(0, 2).toUpperCase(), {
            x: x + 0.2, y: y + 0.15, w: 0.5, h: 0.5,
            fontSize: 14, align: "center", fontFace: theme.headingFont, color: pc(theme.accentColor), bold: true,
          });
        }
      } else {
        slide.addText(iconStr, {
          x: x + 0.2, y: y + 0.15, w: 0.5, h: 0.5,
          fontSize: 18, align: "center",
        });
      }
    }

    // Title
    slide.addText(stripMd(card.title || card.name || ""), {
      x: x + 0.2, y: y + (hasIcon ? 0.65 : 0.2), w: cardW - 0.4, h: 0.4,
      fontSize: 12, fontFace: theme.headingFont, color: pc(theme.headingColor), bold: true,
    });

    // Description
    if (card.description || card.details) {
      slide.addText(stripMd(card.description || card.details), {
        x: x + 0.2, y: y + (hasIcon ? 1.05 : 0.6), w: cardW - 0.4, h: cardH - (hasIcon ? 1.25 : 0.8),
        fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
        lineSpacingMultiple: 1.2,
      });
    }
  });

  addFooter(slide, data, totalSlides, theme);
}

function addQuoteSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  slide.background = { color: pc(theme.accentColor) };

  // Large quote mark
  slide.addText("\u201C", {
    x: MARGIN, y: 0.8, w: 1.5, h: 1.5,
    fontSize: 96, fontFace: "Georgia", color: "D4D4D8",
  });

  slide.addText(stripMd(data.quote || data.text || data.title || ""), {
    x: 1.5, y: 2.0, w: W - 3, h: 2.5,
    fontSize: 22, fontFace: theme.headingFont, color: "FFFFFF", italic: true, align: "center", valign: "middle",
    lineSpacingMultiple: 1.4,
  });

  if (data.author || data.source) {
    slide.addText(`— ${stripMd(data.author || data.source || "")}`, {
      x: 1.5, y: 4.8, w: W - 3, h: 0.5,
      fontSize: 14, fontFace: theme.bodyFont, color: "D4D4D8", align: "center",
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addFinalSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pc(theme.accentColor) };

  // Decorative circle
  slide.addShape(SHAPES.OVAL, {
    x: -2, y: H - 4, w: 6, h: 6,
    fill: { color: "FFFFFF", type: "solid" },
    line: { width: 0 },
  });

  slide.addText(stripMd(data.thankYouText || data.title || "Спасибо!"), {
    x: 1, y: 2.0, w: W - 2, h: 1.5,
    fontSize: 40, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
  });

  if (data.subtitle) {
    slide.addText(stripMd(data.subtitle), {
      x: 1, y: 3.8, w: W - 2, h: 1,
      fontSize: 16, fontFace: theme.bodyFont, color: "D4D4D8", align: "center",
    });
  }

  if (data.contactInfo) {
    const contact = typeof data.contactInfo === "string" ? data.contactInfo : (data.contactInfo.email || data.contactInfo.phone || "");
    if (contact) {
      slide.addText(stripMd(contact), {
        x: 1, y: 5.0, w: W - 2, h: 0.5,
        fontSize: 12, fontFace: theme.bodyFont, color: "FFFFFF99", align: "center",
      });
    }
  }
}

function addImageTextSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const imageUrl = data.image?.url || data.backgroundImage?.url;
  const hasImage = !!imageUrl;

  if (hasImage) {
    try {
      slide.addImage({ path: imageUrl, x: MARGIN, y: 1.3, w: 5, h: 3.5, sizing: { type: "contain", w: 5, h: 3.5 } });
    } catch {
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: MARGIN, y: 1.3, w: 5, h: 3.5,
        fill: { color: "F1F5F9" },
        rectRadius: 0.1,
        line: { color: "E2E8F0", width: 0.5 },
      });
      slide.addText("[Изображение]", {
        x: MARGIN, y: 1.3, w: 5, h: 3.5,
        fontSize: 14, fontFace: theme.bodyFont, color: pc(theme.bodyColor), align: "center", valign: "middle",
      });
    }
  }

  const textX = hasImage ? MARGIN + 5.3 : MARGIN;
  const textW = hasImage ? CONTENT_W - 5.3 : CONTENT_W;
  const bullets = makeBullets(data.bullets || [], theme, { fontSize: 12 });
  if (bullets.length > 0) {
    slide.addText(bullets, { x: textX, y: 1.3, w: textW, h: 4.5, valign: "top" });
  } else if (data.description) {
    slide.addText(stripMd(data.description), {
      x: textX, y: 1.3, w: textW, h: 4.5,
      fontSize: 13, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
    });
  }

  addFooter(slide, data, totalSlides, theme);
}

function addSwotAnalysis(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const quadrants = [
    { key: "strengths", label: "Сильные стороны", color: "10B981", altKey: "optionA" },
    { key: "weaknesses", label: "Слабые стороны", color: "EF4444", altKey: "optionB" },
    { key: "opportunities", label: "Возможности", color: "3B82F6", altKey: "" },
    { key: "threats", label: "Угрозы", color: "F59E0B", altKey: "" },
  ];

  const qW = (CONTENT_W - 0.3) / 2;
  const qH = 2.3;

  quadrants.forEach((q, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (qW + 0.3);
    const y = 1.4 + row * (qH + 0.2);

    // Header
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x, y, w: qW, h: 0.4,
      fill: { color: q.color },
      rectRadius: 0.06,
      line: { width: 0 },
    });
    slide.addText(stripMd(data[q.key]?.title || q.label), {
      x, y, w: qW, h: 0.4,
      fontSize: 11, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });

    // Points
    const points = data[q.key]?.points || data[q.key]?.bullets || data[q.altKey]?.points || [];
    const bulletItems = makeBullets(points, theme, { fontSize: 10 });
    if (bulletItems.length > 0) {
      slide.addText(bulletItems, { x: x + 0.1, y: y + 0.45, w: qW - 0.2, h: qH - 0.55, valign: "top" });
    }
  });

  addFooter(slide, data, totalSlides, theme);
}

function addScenarioCards(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  const scenarios = data.scenarios || data.cards || data.items || [];
  const count = Math.min(scenarios.length, 3);
  if (count === 0) {
    addFooter(slide, data, totalSlides, theme);
    return;
  }

  const cardW = (CONTENT_W - (count - 1) * 0.3) / count;
  const colors = [pc(theme.accentColor), pc(theme.secondaryAccent), "F59E0B"];

  scenarios.slice(0, 3).forEach((s: any, i: number) => {
    const x = MARGIN + i * (cardW + 0.3);
    // Card
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x, y: 1.4, w: cardW, h: 4.5,
      fill: { color: "F8FAFC" },
      rectRadius: 0.1,
      line: { color: colors[i] || "E2E8F0", width: 1 },
    });
    // Header bar
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x, y: 1.4, w: cardW, h: 0.5,
      fill: { color: colors[i] || pc(theme.accentColor) },
      rectRadius: 0.1,
      line: { width: 0 },
    });
    slide.addText(stripMd(s.title || s.name || `Сценарий ${i + 1}`), {
      x, y: 1.4, w: cardW, h: 0.5,
      fontSize: 12, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });

    if (s.description) {
      slide.addText(stripMd(s.description), {
        x: x + 0.2, y: 2.0, w: cardW - 0.4, h: 3.5,
        fontSize: 10, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
        lineSpacingMultiple: 1.3,
      });
    }
    const bullets = makeBullets(s.points || s.bullets || [], theme, { fontSize: 10 });
    if (bullets.length > 0) {
      slide.addText(bullets, { x: x + 0.2, y: s.description ? 3.5 : 2.0, w: cardW - 0.4, h: 2.5, valign: "top" });
    }
  });

  addFooter(slide, data, totalSlides, theme);
}

function addGenericSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors, totalSlides: number) {
  addAccentBar(slide, theme);
  addTitle(slide, data.title || "", theme);

  // Try to render any available structured data
  const bullets = data.bullets || data.steps || data.events || data.sections || data.scenarios || data.items || data.cards || data.criteria || [];
  if (bullets.length > 0) {
    const textItems = makeBullets(bullets, theme);
    slide.addText(textItems, { x: MARGIN, y: 1.3, w: CONTENT_W, h: 5, valign: "top" });
  } else if (data.description || data.subtitle || data.callout || data.text) {
    slide.addText(stripMd(data.description || data.subtitle || data.callout || data.text || ""), {
      x: MARGIN, y: 1.3, w: CONTENT_W, h: 5,
      fontSize: 14, fontFace: theme.bodyFont, color: pc(theme.bodyColor), valign: "top",
      lineSpacingMultiple: 1.4,
    });
  }

  // If there are metrics/stats, show them
  const metrics = data.metrics || data.stats || data.supportingStats || [];
  if (metrics.length > 0) {
    addStatsGrid(slide, metrics, theme, bullets.length > 0 ? 4.5 : 1.5);
  }

  addFooter(slide, data, totalSlides, theme);
}

// ═══════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════

export async function generatePptx(
  slides: SlideInput[],
  title: string,
  cssVariables: string,
): Promise<Buffer> {
  const theme = parseThemeColors(cssVariables);

  const pptx = new PptxGenJSConstructor();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches (16:9)
  pptx.title = title || "Презентация";
  pptx.author = "AI Slides";

  const totalSlides = slides.length;

  for (const slideInput of slides) {
    const slide = pptx.addSlide();
    const { layoutId, data } = slideInput;

    // Set default white background for content slides
    if (!["title-slide", "section-header", "final-slide", "quote-slide", "quote-highlight"].includes(layoutId)) {
      slide.background = { color: "FFFFFF" };
    }

    switch (layoutId) {
      case "title-slide":
        addTitleSlide(pptx, slide, data, theme);
        break;
      case "section-header":
        addSectionHeader(pptx, slide, data, theme, totalSlides);
        break;
      case "text-slide":
      case "text-with-callout":
      case "checklist":
      case "big-statement":
      case "agenda-table-of-contents":
        addTextSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "two-column":
        addTwoColumn(pptx, slide, data, theme, totalSlides);
        break;
      case "chart-slide":
      case "stats-chart":
      case "chart-text":
      case "dual-chart":
      case "waterfall-chart":
        addChartSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "table-slide":
        addTableSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "icons-numbers":
        addStatsSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "highlight-stats":
        addHighlightStats(pptx, slide, data, theme, totalSlides);
        break;
      case "hero-stat":
        addHeroStatSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "timeline":
      case "timeline-horizontal":
      case "vertical-timeline":
      case "roadmap":
        addTimelineSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "process-steps":
      case "numbered-steps-v2":
      case "funnel":
      case "pyramid":
        addProcessSteps(pptx, slide, data, theme, totalSlides);
        break;
      case "comparison":
      case "pros-cons":
        addComparisonSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "comparison-table":
        addComparisonTable(pptx, slide, data, theme, totalSlides);
        break;
      case "swot-analysis":
        addSwotAnalysis(pptx, slide, data, theme, totalSlides);
        break;
      case "financial-formula":
        addFinancialFormula(pptx, slide, data, theme, totalSlides);
        break;
      case "verdict-analysis":
      case "risk-matrix":
        addVerdictAnalysis(pptx, slide, data, theme, totalSlides);
        break;
      case "card-grid":
      case "kanban-board":
      case "scenario-cards":
        addCardGrid(pptx, slide, data, theme, totalSlides);
        break;
      case "quote-slide":
      case "quote-highlight":
        addQuoteSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "final-slide":
        addFinalSlide(pptx, slide, data, theme);
        break;
      case "image-text":
      case "image-fullscreen":
        addImageTextSlide(pptx, slide, data, theme, totalSlides);
        break;
      case "team-profiles":
      case "org-chart":
      case "logo-grid":
        addCardGrid(pptx, slide, data, theme, totalSlides);
        break;
      default:
        addGenericSlide(pptx, slide, data, theme, totalSlides);
    }
  }

  // Generate as Buffer
  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
