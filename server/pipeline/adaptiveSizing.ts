/**
 * Adaptive Font Sizing — dynamically adjusts font sizes, gaps, and padding
 * based on content density per slide.
 *
 * Problem: Fixed font sizes mean slides with 2 bullets look empty,
 * while slides with 6 bullets overflow.
 *
 * Solution: Analyze content count, compute a density level (sparse/normal/dense),
 * and generate a <style> block with CSS overrides that is injected into each slide.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type DensityLevel = "sparse" | "normal" | "dense";

export interface ContentAnalysis {
  layoutName: string;
  itemCount: number;
  avgTextLength: number;
  density: DensityLevel;
}

export interface AdaptiveStyles {
  /** CSS string to inject as a <style> block wrapping the slide */
  cssOverrides: string;
  /** Whether any overrides were needed */
  hasOverrides: boolean;
}

// ═══════════════════════════════════════════════════════
// CONTENT ANALYSIS
// ═══════════════════════════════════════════════════════

/**
 * Analyze the content density of a slide's data for a given layout.
 */
export function analyzeContentDensity(
  data: Record<string, any>,
  layoutName: string,
): ContentAnalysis {
  let itemCount = 0;
  let totalTextLength = 0;

  switch (layoutName) {
    case "text-slide":
    case "image-text": {
      const bullets = data.bullets || [];
      itemCount = bullets.length;
      totalTextLength = bullets.reduce((sum: number, b: any) => {
        const title = typeof b === "string" ? b : b?.title || "";
        const desc = typeof b === "object" ? b?.description || "" : "";
        return sum + title.length + desc.length;
      }, 0);
      break;
    }

    case "two-column": {
      const leftBullets = data.leftColumn?.bullets || [];
      const rightBullets = data.rightColumn?.bullets || [];
      itemCount = leftBullets.length + rightBullets.length;
      totalTextLength = [...leftBullets, ...rightBullets].reduce(
        (sum: number, b: any) => sum + (typeof b === "string" ? b.length : 0),
        0,
      );
      break;
    }

    case "icons-numbers": {
      const metrics = data.metrics || [];
      itemCount = metrics.length;
      totalTextLength = metrics.reduce(
        (sum: number, m: any) => sum + (m.label?.length || 0) + (m.description?.length || 0),
        0,
      );
      break;
    }

    case "process-steps": {
      const steps = data.steps || [];
      itemCount = steps.length;
      totalTextLength = steps.reduce(
        (sum: number, s: any) => sum + (s.title?.length || 0) + (s.description?.length || 0),
        0,
      );
      break;
    }

    case "timeline": {
      const events = data.events || [];
      itemCount = events.length;
      totalTextLength = events.reduce(
        (sum: number, e: any) => sum + (e.title?.length || 0) + (e.description?.length || 0),
        0,
      );
      break;
    }

    case "comparison": {
      const pointsA = data.optionA?.points || [];
      const pointsB = data.optionB?.points || [];
      itemCount = pointsA.length + pointsB.length;
      totalTextLength = [...pointsA, ...pointsB].reduce(
        (sum: number, p: any) => sum + (typeof p === "string" ? p.length : 0),
        0,
      );
      break;
    }

    case "agenda-table-of-contents": {
      const sections = data.sections || [];
      itemCount = sections.length;
      totalTextLength = sections.reduce(
        (sum: number, s: any) => sum + (s.title?.length || 0) + (s.description?.length || 0),
        0,
      );
      break;
    }

    case "table-slide": {
      const rows = data.rows || [];
      itemCount = rows.length;
      totalTextLength = rows.reduce(
        (sum: number, row: any[]) =>
          sum + (Array.isArray(row) ? row.reduce((s: number, cell: any) => s + String(cell).length, 0) : 0),
        0,
      );
      break;
    }

    default:
      // For layouts like title-slide, section-header, final-slide, quote-slide
      // no adaptive sizing needed
      return { layoutName, itemCount: 0, avgTextLength: 0, density: "normal" };
  }

  const avgTextLength = itemCount > 0 ? totalTextLength / itemCount : 0;
  const density = classifyDensity(layoutName, itemCount, avgTextLength);

  return { layoutName, itemCount, avgTextLength, density };
}

// ═══════════════════════════════════════════════════════
// DENSITY CLASSIFICATION
// ═══════════════════════════════════════════════════════

function classifyDensity(
  layoutName: string,
  itemCount: number,
  avgTextLength: number,
): DensityLevel {
  // Layout-specific thresholds
  switch (layoutName) {
    case "text-slide":
    case "image-text":
      if (itemCount <= 2) return "sparse";
      if (itemCount >= 5 && avgTextLength > 60) return "dense";
      if (itemCount >= 6) return "dense";
      return "normal";

    case "two-column":
      // itemCount is total across both columns
      if (itemCount <= 3) return "sparse";
      if (itemCount >= 8) return "dense";
      return "normal";

    case "icons-numbers":
      if (itemCount <= 2) return "sparse";
      if (itemCount >= 5) return "dense";
      return "normal";

    case "process-steps":
      if (itemCount <= 2) return "sparse";
      if (itemCount >= 6) return "dense";
      return "normal";

    case "timeline":
      if (itemCount <= 2) return "sparse";
      if (itemCount >= 6) return "dense";
      return "normal";

    case "comparison":
      if (itemCount <= 4) return "sparse";
      if (itemCount >= 10) return "dense";
      return "normal";

    case "agenda-table-of-contents":
      if (itemCount <= 3) return "sparse";
      if (itemCount >= 7) return "dense";
      return "normal";

    case "table-slide":
      if (itemCount <= 2) return "sparse";
      if (itemCount >= 7) return "dense";
      return "normal";

    default:
      return "normal";
  }
}

// ═══════════════════════════════════════════════════════
// STYLE GENERATION
// ═══════════════════════════════════════════════════════

/**
 * Generate adaptive CSS overrides based on content density.
 * Returns a CSS string that wraps the slide content.
 */
export function generateAdaptiveStyles(
  analysis: ContentAnalysis,
): AdaptiveStyles {
  if (analysis.density === "normal") {
    return { cssOverrides: "", hasOverrides: false };
  }

  const { layoutName, density } = analysis;
  let css = "";

  if (density === "sparse") {
    css = generateSparseStyles(layoutName);
  } else if (density === "dense") {
    css = generateDenseStyles(layoutName);
  }

  return {
    cssOverrides: css,
    hasOverrides: css.length > 0,
  };
}

function generateSparseStyles(layoutName: string): string {
  // For sparse content: increase font sizes, increase gaps, add more padding
  switch (layoutName) {
    case "text-slide":
      return `
        .slide .bullet-row > div:last-child > div:first-child { font-size: 20px !important; }
        .slide .bullet-row > div:last-child > div:last-child { font-size: 17px !important; line-height: 1.6 !important; }
        .slide .bullet-row { gap: 16px !important; }
      `;

    case "image-text":
      return `
        .slide .bullet-row > div:last-child > div:first-child { font-size: 19px !important; }
        .slide .bullet-row > div:last-child > div:last-child { font-size: 16px !important; }
      `;

    case "two-column":
      return `
        .slide .card span { font-size: 18px !important; }
        .slide .card h2 { font-size: 24px !important; }
      `;

    case "icons-numbers":
      return `
        .slide [style*="font-size: 42px"] { font-size: 52px !important; }
        .slide [style*="font-size: 13px"][style*="text-transform"] { font-size: 15px !important; }
        .slide [style*="font-size: 14px"][style*="max-width"] { font-size: 16px !important; }
      `;

    case "process-steps":
      return `
        .slide [style*="font-size: 18px"][style*="font-weight: 600"] { font-size: 22px !important; }
        .slide [style*="font-size: 13px"][style*="line-height: 1.5"] { font-size: 15px !important; }
        .slide [style*="width: 56px"] { width: 64px !important; height: 64px !important; }
        .slide [style*="width: 56px"] span { font-size: 28px !important; }
      `;

    case "timeline":
      return `
        .slide [style*="font-size: 18px"][style*="font-weight: 600"] { font-size: 22px !important; }
        .slide [style*="font-size: 14px"][style*="margin-top: 4px"] { font-size: 16px !important; }
      `;

    case "comparison":
      return `
        .slide .card span { font-size: 18px !important; }
        .slide .card h2 { font-size: 24px !important; }
      `;

    case "agenda-table-of-contents":
      return `
        .slide [style*="font-size: 17px"][style*="font-weight: 600"] { font-size: 20px !important; }
        .slide [style*="font-size: 14px"][style*="margin-top: 4px"] { font-size: 16px !important; }
        .slide [style*="padding: 14px 16px"] { padding: 18px 20px !important; }
      `;

    default:
      return "";
  }
}

function generateDenseStyles(layoutName: string): string {
  // For dense content: decrease font sizes, decrease gaps, tighter padding
  switch (layoutName) {
    case "text-slide":
      return `
        .slide .bullet-row > div:last-child > div:first-child { font-size: 15px !important; }
        .slide .bullet-row > div:last-child > div:last-child { font-size: 13px !important; line-height: 1.45 !important; }
        .slide .bullet-row { margin-bottom: 0 !important; }
      `;

    case "image-text":
      return `
        .slide .bullet-row > div:last-child > div:first-child { font-size: 14px !important; }
        .slide .bullet-row > div:last-child > div:last-child { font-size: 12px !important; }
      `;

    case "two-column":
      return `
        .slide .card span { font-size: 14px !important; }
        .slide .card h2 { font-size: 19px !important; }
      `;

    case "icons-numbers":
      return `
        .slide [style*="font-size: 42px"] { font-size: 32px !important; }
        .slide [style*="font-size: 13px"][style*="text-transform"] { font-size: 11px !important; }
        .slide [style*="font-size: 14px"][style*="max-width"] { font-size: 12px !important; }
        .slide [style*="padding: 28px 16px"] { padding: 18px 12px !important; }
      `;

    case "process-steps":
      return `
        .slide [style*="font-size: 18px"][style*="font-weight: 600"] { font-size: 15px !important; }
        .slide [style*="font-size: 13px"][style*="line-height: 1.5"] { font-size: 11px !important; }
        .slide [style*="width: 56px"] { width: 44px !important; height: 44px !important; }
        .slide [style*="width: 56px"] span { font-size: 20px !important; }
      `;

    case "timeline":
      return `
        .slide [style*="font-size: 18px"][style*="font-weight: 600"] { font-size: 15px !important; }
        .slide [style*="font-size: 14px"][style*="margin-top: 4px"] { font-size: 12px !important; }
      `;

    case "comparison":
      return `
        .slide .card span { font-size: 14px !important; }
        .slide .card h2 { font-size: 19px !important; }
      `;

    case "agenda-table-of-contents":
      return `
        .slide [style*="font-size: 17px"][style*="font-weight: 600"] { font-size: 15px !important; }
        .slide [style*="font-size: 14px"][style*="margin-top: 4px"] { font-size: 12px !important; }
        .slide [style*="padding: 14px 16px"] { padding: 10px 14px !important; }
      `;

    case "table-slide":
      return `
        .slide th, .slide td { font-size: 13px !important; padding: 8px 12px !important; }
      `;

    default:
      return "";
  }
}
