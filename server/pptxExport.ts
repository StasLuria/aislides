/**
 * PPTX Export Module — Converts slide data to PowerPoint format using pptxgenjs.
 *
 * Converts the internal slide data (title, bullets, charts, images, tables, etc.)
 * into a .pptx file. Each layout type maps to a specific PPTX slide composition.
 */
import PptxGenJSDefault from "pptxgenjs";
// Handle both ESM default and CJS module exports at runtime
const PptxGenJSConstructor = (PptxGenJSDefault as any).default || PptxGenJSDefault;

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

// ═══════════════════════════════════════════════════════
// CSS VARIABLE PARSER
// ═══════════════════════════════════════════════════════

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

// Convert hex color to PPTX-compatible format (strip #)
function pptxColor(hex: string): string {
  // Handle rgba/rgb — extract hex or return fallback
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
    return "475569";
  }
  return hex.replace("#", "").toUpperCase();
}

// ═══════════════════════════════════════════════════════
// SLIDE BUILDERS
// ═══════════════════════════════════════════════════════

function addTitleSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pptxColor(theme.accentColor) };

  slide.addText(data.title || "Презентация", {
    x: 0.8,
    y: 1.5,
    w: 8.4,
    h: 1.5,
    fontSize: 36,
    fontFace: theme.headingFont,
    color: "FFFFFF",
    bold: true,
    align: "left",
    valign: "bottom",
  });

  if (data.description) {
    slide.addText(data.description, {
      x: 0.8,
      y: 3.2,
      w: 8.4,
      h: 1,
      fontSize: 16,
      fontFace: theme.bodyFont,
      color: "FFFFFF",
      align: "left",
      valign: "top",
    });
  }

  if (data.presentationDate) {
    slide.addText(data.presentationDate, {
      x: 0.8,
      y: 4.5,
      w: 4,
      h: 0.4,
      fontSize: 12,
      fontFace: theme.bodyFont,
      color: "FFFFFF99",
    });
  }
}

function addSectionHeader(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pptxColor(theme.accentColor) };

  slide.addText(data.title || "", {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.2,
    fontSize: 32,
    fontFace: theme.headingFont,
    color: "FFFFFF",
    bold: true,
    align: "left",
    valign: "middle",
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8,
      y: 3.2,
      w: 8.4,
      h: 0.8,
      fontSize: 16,
      fontFace: theme.bodyFont,
      color: "FFFFFF",
      align: "left",
    });
  }
}

function addTextSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  // Title
  slide.addText(data.title || "", {
    x: 0.6,
    y: 0.4,
    w: 8.8,
    h: 0.7,
    fontSize: 22,
    fontFace: theme.headingFont,
    color: pptxColor(theme.headingColor),
    bold: true,
  });

  // Bullets
  const bullets = (data.bullets || []).map((b: any) => {
    const title = typeof b === "string" ? b : b.title || "";
    const desc = typeof b === "string" ? "" : b.description || "";
    const parts: PptxTextProps[] = [
      { text: title, options: { bold: true, fontSize: 14, fontFace: theme.headingFont, color: pptxColor(theme.headingColor) } },
    ];
    if (desc) {
      parts.push({ text: `\n${desc}`, options: { fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor) } });
    }
    return parts;
  });

  if (bullets.length > 0) {
    slide.addText(
      bullets.map((b: PptxTextProps[]) => ({
        text: b.map((p: PptxTextProps) => (p as any).text).join(""),
        options: { bullet: { type: "bullet" as any }, fontSize: 13, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 8 },
      })),
      { x: 0.6, y: 1.3, w: 8.8, h: 3.8, valign: "top" },
    );
  }
}

function addTwoColumn(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // Left column
  const leftTitle = data.leftColumn?.title || "";
  const leftBullets = (data.leftColumn?.bullets || []).map((b: string) => ({
    text: b,
    options: { bullet: { type: "bullet" as any }, fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 6 },
  }));

  slide.addText(leftTitle, {
    x: 0.6, y: 1.3, w: 4.2, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: pptxColor(theme.accentColor), bold: true,
  });
  if (leftBullets.length > 0) {
    slide.addText(leftBullets, { x: 0.6, y: 1.9, w: 4.2, h: 3.2, valign: "top" });
  }

  // Right column
  const rightTitle = data.rightColumn?.title || "";
  const rightBullets = (data.rightColumn?.bullets || []).map((b: string) => ({
    text: b,
    options: { bullet: { type: "bullet" as any }, fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 6 },
  }));

  slide.addText(rightTitle, {
    x: 5.2, y: 1.3, w: 4.2, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: pptxColor(theme.accentColor), bold: true,
  });
  if (rightBullets.length > 0) {
    slide.addText(rightBullets, { x: 5.2, y: 1.9, w: 4.2, h: 3.2, valign: "top" });
  }
}

function addChartSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  if (data.description) {
    slide.addText(data.description, {
      x: 0.6, y: 1.1, w: 8.8, h: 0.5,
      fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor),
    });
  }

  // Chart
  const chartData = data.chartData;
  if (chartData && chartData.labels && chartData.datasets?.length > 0) {
    try {
      const chartType = mapChartType(chartData.type);
      const chartDataForPptx = chartData.datasets.map((ds: any) => ({
        name: ds.label || "Данные",
        labels: chartData.labels,
        values: ds.data.map((v: any) => (typeof v === "number" ? v : parseFloat(v) || 0)),
      }));

      slide.addChart(chartType, chartDataForPptx, {
        x: 0.8,
        y: 1.7,
        w: 8.4,
        h: 3.5,
        showTitle: false,
        showLegend: chartData.datasets.length > 1,
        legendPos: "b",
        chartColors: [pptxColor(theme.accentColor), pptxColor(theme.secondaryAccent), "F59E0B", "10B981", "EF4444", "8B5CF6"],
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
      });
    } catch {
      // Fallback: show data as table
      addDataAsTable(slide, chartData, theme);
    }
  }
}

function mapChartType(type: string): PptxChartName {
  switch (type) {
    case "bar":
    case "horizontal-bar":
      return PptxGenJSConstructor.charts.BAR;
    case "line":
      return PptxGenJSConstructor.charts.LINE;
    case "pie":
      return PptxGenJSConstructor.charts.PIE;
    case "donut":
    case "doughnut":
      return PptxGenJSConstructor.charts.DOUGHNUT;
    case "radar":
      return PptxGenJSConstructor.charts.RADAR;
    default:
      return PptxGenJSConstructor.charts.BAR;
  }
}

function addDataAsTable(slide: PptxSlide, chartData: any, theme: ThemeColors) {
  if (!chartData?.labels || !chartData?.datasets?.[0]?.data) return;

  const rows: PptxTableRow[] = [
    chartData.labels.map((l: string) => ({
      text: l,
      options: { bold: true, fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pptxColor(theme.accentColor) } },
    })),
    ...chartData.datasets.map((ds: any) =>
      ds.data.map((v: any) => ({
        text: String(v),
        options: { fontSize: 10, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor) },
      })),
    ),
  ];

  slide.addTable(rows, { x: 0.8, y: 2.0, w: 8.4, colW: 8.4 / chartData.labels.length, border: { pt: 0.5, color: "CCCCCC" } });
}

function addTableSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  const headers = data.headers || [];
  const rows = data.rows || [];
  if (headers.length === 0 && rows.length === 0) return;

  const colCount = headers.length || (rows[0]?.length || 2);
  const colW = 8.4 / colCount;

  const tableRows: PptxTableRow[] = [];

  // Header row
  if (headers.length > 0) {
    tableRows.push(
      headers.map((h: string) => ({
        text: h,
        options: { bold: true, fontSize: 11, fontFace: theme.headingFont, color: "FFFFFF", fill: { color: pptxColor(theme.accentColor) }, align: "center" as any, valign: "middle" as any },
      })),
    );
  }

  // Data rows
  rows.forEach((row: string[], i: number) => {
    tableRows.push(
      row.map((cell: string) => ({
        text: cell,
        options: {
          fontSize: 10,
          fontFace: theme.bodyFont,
          color: pptxColor(theme.bodyColor),
          fill: { color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
          valign: "middle" as any,
        },
      })),
    );
  });

  slide.addTable(tableRows, {
    x: 0.6,
    y: 1.3,
    w: 8.8,
    colW: Array(colCount).fill(colW),
    border: { pt: 0.5, color: "E2E8F0" },
    rowH: 0.4,
  });
}

function addStatsSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // Metrics / stats
  const metrics = data.metrics || data.stats || [];
  const count = Math.min(metrics.length, 4);
  if (count === 0) return;

  const cardW = 8.4 / count;
  metrics.slice(0, 4).forEach((m: any, i: number) => {
    const x = 0.6 + i * cardW + 0.1;
    const w = cardW - 0.2;

    // Value
    slide.addText(m.value || "—", {
      x, y: 1.5, w, h: 0.8,
      fontSize: 28, fontFace: theme.headingFont, color: pptxColor(theme.accentColor), bold: true, align: "center",
    });

    // Label
    slide.addText(m.label || "", {
      x, y: 2.3, w, h: 0.5,
      fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.headingColor), align: "center", bold: true,
    });

    // Description
    if (m.description) {
      slide.addText(m.description, {
        x, y: 2.8, w, h: 0.5,
        fontSize: 10, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), align: "center",
      });
    }
  });
}

function addTimelineSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  const events = data.events || [];
  events.slice(0, 6).forEach((ev: any, i: number) => {
    const y = 1.4 + i * 0.65;

    // Date/step badge
    slide.addText(ev.date || `Этап ${i + 1}`, {
      x: 0.6, y, w: 1.5, h: 0.5,
      fontSize: 10, fontFace: theme.headingFont, color: "FFFFFF", bold: true,
      fill: { color: pptxColor(theme.accentColor) },
      align: "center", valign: "middle",
      shape: PptxGenJSConstructor.shapes.ROUNDED_RECTANGLE,
      rectRadius: 0.1,
    });

    // Title + description
    slide.addText(ev.title || "", {
      x: 2.3, y, w: 3.5, h: 0.5,
      fontSize: 12, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true, valign: "middle",
    });

    if (ev.description) {
      slide.addText(ev.description, {
        x: 6, y, w: 3.6, h: 0.5,
        fontSize: 10, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), valign: "middle",
      });
    }
  });
}

function addProcessSteps(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  const steps = data.steps || [];
  const count = Math.min(steps.length, 5);
  if (count === 0) return;

  steps.slice(0, 5).forEach((step: any, i: number) => {
    const y = 1.4 + i * 0.7;

    // Step number circle
    slide.addText(String(step.number || i + 1), {
      x: 0.6, y, w: 0.5, h: 0.5,
      fontSize: 14, fontFace: theme.headingFont, color: "FFFFFF", bold: true,
      fill: { color: pptxColor(theme.accentColor) },
      align: "center", valign: "middle",
      shape: PptxGenJSConstructor.shapes.OVAL,
    });

    slide.addText(step.title || "", {
      x: 1.3, y, w: 4, h: 0.5,
      fontSize: 13, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true, valign: "middle",
    });

    if (step.description) {
      slide.addText(step.description, {
        x: 5.5, y, w: 4, h: 0.5,
        fontSize: 11, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), valign: "middle",
      });
    }
  });
}

function addComparisonSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // Option A
  const optA = data.optionA || {};
  slide.addText(optA.title || "Вариант A", {
    x: 0.6, y: 1.3, w: 4.2, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: pptxColor(optA.color || "#22c55e"), bold: true,
  });

  const pointsA = (optA.points || []).map((p: string) => ({
    text: p,
    options: { bullet: { type: "bullet" as any }, fontSize: 11, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 4 },
  }));
  if (pointsA.length > 0) {
    slide.addText(pointsA, { x: 0.6, y: 1.9, w: 4.2, h: 3.2, valign: "top" });
  }

  // Option B
  const optB = data.optionB || {};
  slide.addText(optB.title || "Вариант B", {
    x: 5.2, y: 1.3, w: 4.2, h: 0.5,
    fontSize: 14, fontFace: theme.headingFont, color: pptxColor(optB.color || "#ef4444"), bold: true,
  });

  const pointsB = (optB.points || []).map((p: string) => ({
    text: p,
    options: { bullet: { type: "bullet" as any }, fontSize: 11, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 4 },
  }));
  if (pointsB.length > 0) {
    slide.addText(pointsB, { x: 5.2, y: 1.9, w: 4.2, h: 3.2, valign: "top" });
  }
}

function addQuoteSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pptxColor(theme.accentColor) };

  // Quote mark
  slide.addText("\u201C", {
    x: 0.8, y: 0.8, w: 1, h: 1,
    fontSize: 72, fontFace: theme.headingFont, color: "FFFFFF44",
  });

  slide.addText(data.quote || data.title || "", {
    x: 1.2, y: 1.8, w: 7.6, h: 2,
    fontSize: 20, fontFace: theme.headingFont, color: "FFFFFF", italic: true, align: "center", valign: "middle",
  });

  if (data.author) {
    slide.addText(`— ${data.author}`, {
      x: 1.2, y: 3.8, w: 7.6, h: 0.5,
      fontSize: 14, fontFace: theme.bodyFont, color: "FFFFFF", align: "center",
    });
  }
}

function addFinalSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.background = { color: pptxColor(theme.accentColor) };

  slide.addText(data.thankYouText || data.title || "Спасибо!", {
    x: 0.8, y: 1.5, w: 8.4, h: 1.5,
    fontSize: 36, fontFace: theme.headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle",
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 3.2, w: 8.4, h: 1,
      fontSize: 16, fontFace: theme.bodyFont, color: "FFFFFF", align: "center",
    });
  }
}

function addImageTextSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // If there's an image URL, try to add it
  const imageUrl = data.image?.url || data.backgroundImage?.url;
  if (imageUrl) {
    try {
      slide.addImage({ path: imageUrl, x: 0.6, y: 1.3, w: 4, h: 3, sizing: { type: "contain", w: 4, h: 3 } });
    } catch {
      // Image loading may fail — add placeholder text
      slide.addText("[Изображение]", {
        x: 0.6, y: 1.3, w: 4, h: 3,
        fontSize: 14, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), align: "center", valign: "middle",
        fill: { color: "F1F5F9" },
      });
    }
  }

  // Bullets on the right
  const bullets = (data.bullets || []).map((b: any) => {
    const text = typeof b === "string" ? b : b.title || "";
    return {
      text,
      options: { bullet: { type: "bullet" as any }, fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 6 },
    };
  });

  const textX = imageUrl ? 5 : 0.6;
  const textW = imageUrl ? 4.6 : 8.8;
  if (bullets.length > 0) {
    slide.addText(bullets, { x: textX, y: 1.3, w: textW, h: 3.5, valign: "top" });
  }
}

function addHeroStatSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // Main stat
  const mainStat = data.mainStat || {};
  slide.addText(mainStat.value || "—", {
    x: 1, y: 1.5, w: 8, h: 1.2,
    fontSize: 48, fontFace: theme.headingFont, color: pptxColor(theme.accentColor), bold: true, align: "center",
  });
  slide.addText(mainStat.label || "", {
    x: 1, y: 2.7, w: 8, h: 0.5,
    fontSize: 16, fontFace: theme.bodyFont, color: pptxColor(theme.headingColor), align: "center",
  });

  // Supporting stats
  const supporting = data.supportingStats || [];
  const count = Math.min(supporting.length, 3);
  if (count > 0) {
    const cardW = 8 / count;
    supporting.slice(0, 3).forEach((s: any, i: number) => {
      const x = 1 + i * cardW;
      slide.addText(s.value || "—", {
        x, y: 3.5, w: cardW, h: 0.6,
        fontSize: 20, fontFace: theme.headingFont, color: pptxColor(theme.accentColor), bold: true, align: "center",
      });
      slide.addText(s.label || "", {
        x, y: 4.1, w: cardW, h: 0.4,
        fontSize: 10, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), align: "center",
      });
    });
  }
}

function addGenericSlide(pptx: any, slide: PptxSlide, data: Record<string, any>, theme: ThemeColors) {
  // Fallback for any layout not explicitly handled
  slide.addText(data.title || "", {
    x: 0.6, y: 0.4, w: 8.8, h: 0.7,
    fontSize: 22, fontFace: theme.headingFont, color: pptxColor(theme.headingColor), bold: true,
  });

  // Try to render bullets if available
  const bullets = data.bullets || data.steps || data.events || data.sections || data.scenarios || [];
  if (bullets.length > 0) {
    const textItems = bullets.map((b: any) => {
      const text = typeof b === "string" ? b : b.title || b.label || b.text || JSON.stringify(b);
      return {
        text,
        options: { bullet: { type: "bullet" as any }, fontSize: 12, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), paraSpaceAfter: 6 },
      };
    });
    slide.addText(textItems, { x: 0.6, y: 1.3, w: 8.8, h: 3.8, valign: "top" });
  } else if (data.description || data.subtitle || data.callout) {
    slide.addText(data.description || data.subtitle || data.callout || "", {
      x: 0.6, y: 1.3, w: 8.8, h: 3.8,
      fontSize: 14, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), valign: "top",
    });
  }
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

  for (const slideInput of slides) {
    const slide = pptx.addSlide();
    const { layoutId, data } = slideInput;

    // Add slide number footer (except title and final slides)
    if (layoutId !== "title-slide" && layoutId !== "final-slide") {
      const slideNum = data._slideNumber || "";
      const totalSlides = data._totalSlides || slides.length;
      if (slideNum) {
        slide.addText(`${slideNum} / ${totalSlides}`, {
          x: 8.5, y: 4.9, w: 1.2, h: 0.3,
          fontSize: 8, fontFace: theme.bodyFont, color: pptxColor(theme.bodyColor), align: "right",
        });
      }
    }

    switch (layoutId) {
      case "title-slide":
        addTitleSlide(pptx, slide, data, theme);
        break;
      case "section-header":
        addSectionHeader(pptx, slide, data, theme);
        break;
      case "text-slide":
      case "text-with-callout":
      case "checklist":
        addTextSlide(pptx, slide, data, theme);
        break;
      case "two-column":
        addTwoColumn(pptx, slide, data, theme);
        break;
      case "chart-slide":
      case "stats-chart":
      case "chart-text":
      case "dual-chart":
        addChartSlide(pptx, slide, data, theme);
        break;
      case "table-slide":
        addTableSlide(pptx, slide, data, theme);
        break;
      case "icons-numbers":
      case "highlight-stats":
        addStatsSlide(pptx, slide, data, theme);
        break;
      case "timeline":
      case "timeline-horizontal":
      case "roadmap":
        addTimelineSlide(pptx, slide, data, theme);
        break;
      case "process-steps":
      case "numbered-steps-v2":
      case "funnel":
      case "pyramid":
        addProcessSteps(pptx, slide, data, theme);
        break;
      case "comparison":
      case "pros-cons":
      case "swot-analysis":
        addComparisonSlide(pptx, slide, data, theme);
        break;
      case "quote-slide":
        addQuoteSlide(pptx, slide, data, theme);
        break;
      case "final-slide":
        addFinalSlide(pptx, slide, data, theme);
        break;
      case "image-text":
      case "image-fullscreen":
        addImageTextSlide(pptx, slide, data, theme);
        break;
      case "hero-stat":
        addHeroStatSlide(pptx, slide, data, theme);
        break;
      default:
        addGenericSlide(pptx, slide, data, theme);
    }
  }

  // Generate as Buffer
  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
