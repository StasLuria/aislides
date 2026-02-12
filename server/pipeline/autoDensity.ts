/**
 * Auto-Density Fallback System
 *
 * Estimates the rendered height of a slide based on its layout, data, and density level.
 * If the estimated height exceeds 720px, escalates to a more compact density.
 *
 * This is a server-side heuristic (no DOM available), so we use conservative
 * height estimates based on known template structures and CSS variable values.
 */

type DensityLevel = "normal" | "compact" | "dense";

// CSS variable values per density level (from BASE_CSS)
const DENSITY_PARAMS: Record<DensityLevel, {
  titleSize: number;
  titleLh: number;
  subtitleSize: number;
  bodySize: number;
  bodyLh: number;
  smallSize: number;
  tinySize: number;
  cardPadding: number;
  gap: number;
  gapSm: number;
  iconSize: number;
  valueSize: number;
  bulletClamp: number;
  descClamp: number;
}> = {
  normal: {
    titleSize: 36, titleLh: 1.1, subtitleSize: 20,
    bodySize: 16, bodyLh: 1.5, smallSize: 14, tinySize: 12,
    cardPadding: 24, gap: 16, gapSm: 12,
    iconSize: 48, valueSize: 28, bulletClamp: 3, descClamp: 2,
  },
  compact: {
    titleSize: 30, titleLh: 1.1, subtitleSize: 17,
    bodySize: 14, bodyLh: 1.4, smallSize: 13, tinySize: 11,
    cardPadding: 18, gap: 12, gapSm: 8,
    iconSize: 40, valueSize: 24, bulletClamp: 2, descClamp: 1,
  },
  dense: {
    titleSize: 26, titleLh: 1.1, subtitleSize: 15,
    bodySize: 13, bodyLh: 1.35, smallSize: 12, tinySize: 10,
    cardPadding: 14, gap: 10, gapSm: 6,
    iconSize: 36, valueSize: 20, bulletClamp: 2, descClamp: 1,
  },
};

const SLIDE_HEIGHT = 720;

// Common padding: top 36px + bottom 32px = 68px
const SLIDE_PADDING_V = 68;
// Footer height ~30px
const FOOTER_HEIGHT = 30;
// Available content height
const AVAILABLE_HEIGHT = SLIDE_HEIGHT - SLIDE_PADDING_V - FOOTER_HEIGHT;

// Helper: count items
function countItems(field: any): number {
  return Array.isArray(field) ? field.length : 0;
}

// Helper: estimate text lines based on character count and container width
function estimateTextLines(text: string, fontSize: number, containerWidth: number = 1180): number {
  if (!text) return 0;
  // Average character width ≈ 0.55 * fontSize for proportional fonts
  const charsPerLine = Math.floor(containerWidth / (fontSize * 0.55));
  return Math.ceil(text.length / Math.max(charsPerLine, 1));
}

// Helper: clamp lines
function clampLines(lines: number, maxLines: number): number {
  return Math.min(lines, maxLines);
}

/**
 * Estimate the content height for a given layout, data, and density level.
 * Returns estimated height in pixels.
 */
export function estimateContentHeight(
  layoutId: string,
  data: Record<string, any>,
  density: DensityLevel,
): number {
  const p = DENSITY_PARAMS[density];

  // Title block height (most layouts have a title + accent line)
  const titleText = data.title || "";
  const titleLines = clampLines(estimateTextLines(titleText, p.titleSize, 1100), 2);
  const titleBlockH = titleLines * (p.titleSize * p.titleLh) + 12 + 16; // title + accent-line + margin-bottom

  // Subtitle block
  const subtitleText = data.subtitle || "";
  const subtitleH = subtitleText
    ? clampLines(estimateTextLines(subtitleText, p.subtitleSize, 1100), 2) * (p.subtitleSize * 1.3) + 8
    : 0;

  const headerH = titleBlockH + subtitleH;

  switch (layoutId) {
    case "title-slide":
    case "section-header":
    case "final-slide":
    case "image-fullscreen":
    case "video-embed":
    case "quote-slide":
      // These layouts are static / don't overflow
      return AVAILABLE_HEIGHT;

    case "text-slide": {
      // Description + bullets
      const descText = data.description || "";
      const descLines = clampLines(estimateTextLines(descText, p.bodySize), 4);
      const descH = descLines * (p.bodySize * p.bodyLh) + (descText ? 12 : 0);

      const bullets = data.bullets || [];
      let bulletsH = 0;
      for (const bullet of bullets) {
        const text = typeof bullet === "string" ? bullet : bullet?.text || bullet?.title || "";
        const desc = typeof bullet === "object" ? bullet?.description || "" : "";
        const bulletTitleLines = clampLines(estimateTextLines(text, p.bodySize), p.bulletClamp);
        const bulletDescLines = desc ? clampLines(estimateTextLines(desc, p.smallSize), p.descClamp) : 0;
        bulletsH += bulletTitleLines * (p.bodySize * p.bodyLh) + bulletDescLines * (p.smallSize * 1.4) + p.gapSm + 8;
      }

      return headerH + descH + bulletsH;
    }

    case "icons-numbers": {
      const metrics = data.metrics || [];
      const count = metrics.length;
      if (count === 0) return headerH;

      const cols = count <= 3 ? count : (count <= 4 ? 2 : 3);
      const rows = Math.ceil(count / cols);

      // Each card: icon(32px) + value(valueSize) + label(tinySize) + desc(tinySize*2lines) + gaps + padding
      const cardContentH = 32 + 4 + // icon + gap
        p.valueSize * 1.1 + p.gapSm + // value
        p.tinySize * 1.2 + p.gapSm + // label
        p.tinySize * 1.3 * 2 + // description (2 lines)
        p.cardPadding * 2; // top + bottom padding

      const gridH = rows * cardContentH + (rows - 1) * p.gap;
      return headerH + gridH;
    }

    case "bullet-list-slide":
    case "checklist": {
      const items = data.items || data.bullets || [];
      let itemsH = 0;
      for (const item of items) {
        const text = typeof item === "string" ? item : item?.text || item?.title || "";
        const desc = typeof item === "object" ? item?.description || "" : "";
        const titleLines = clampLines(estimateTextLines(text, p.bodySize), p.bulletClamp);
        const descLines = desc ? clampLines(estimateTextLines(desc, p.smallSize), p.descClamp) : 0;
        itemsH += titleLines * (p.bodySize * p.bodyLh) + descLines * (p.smallSize * 1.4) + p.gapSm + 12;
      }
      return headerH + itemsH;
    }

    case "two-column":
    case "comparison":
    case "pros-cons": {
      // Two columns side by side — height is max of both
      const leftItems = data.leftColumn?.bullets || data.optionA?.points || data.pros?.items || [];
      const rightItems = data.rightColumn?.bullets || data.optionB?.points || data.cons?.items || [];

      const estimateColumnH = (items: any[]) => {
        let h = 0;
        for (const item of items) {
          const text = typeof item === "string" ? item : item?.text || item?.title || "";
          const lines = clampLines(estimateTextLines(text, p.smallSize, 500), p.bulletClamp);
          h += lines * (p.smallSize * 1.4) + p.gapSm + 8;
        }
        return h;
      };

      const colH = Math.max(estimateColumnH(leftItems), estimateColumnH(rightItems));
      // Column header ~40px
      return headerH + 40 + colH;
    }

    case "timeline": {
      const events = data.events || [];
      let eventsH = 0;
      for (const event of events) {
        const titleLines = clampLines(estimateTextLines(event?.title || "", p.bodySize, 400), 1);
        const descLines = clampLines(estimateTextLines(event?.description || "", p.smallSize, 400), p.descClamp);
        eventsH += titleLines * (p.bodySize * p.bodyLh) + descLines * (p.smallSize * 1.4) + 24 + p.gapSm;
      }
      return headerH + eventsH;
    }

    case "process-steps": {
      const steps = data.steps || [];
      // Horizontal layout — height is the tallest step
      let maxStepH = 0;
      for (const step of steps) {
        const titleLines = clampLines(estimateTextLines(step?.title || "", p.smallSize, 200), 2);
        const descLines = clampLines(estimateTextLines(step?.description || "", p.tinySize, 200), p.descClamp);
        const stepH = p.iconSize + 8 + titleLines * (p.smallSize * 1.3) + descLines * (p.tinySize * 1.3) + p.cardPadding * 2;
        maxStepH = Math.max(maxStepH, stepH);
      }
      // But if too many steps, they wrap to rows
      const cols = Math.min(steps.length, 5);
      const rows = Math.ceil(steps.length / cols);
      return headerH + rows * maxStepH + (rows - 1) * p.gap;
    }

    case "team-profiles": {
      const members = data.members || [];
      const count = members.length;
      const cols = count <= 3 ? count : (count <= 4 ? 2 : 3);
      const rows = Math.ceil(count / cols);

      // Each card: avatar(80px) + name + role + bio
      const cardH = 80 + 8 + p.bodySize * 1.3 + p.smallSize * 1.3 + p.tinySize * 1.3 * 2 + p.cardPadding * 2;
      return headerH + rows * cardH + (rows - 1) * p.gap;
    }

    case "swot-analysis": {
      const quadrants = [
        data.strengths?.items || [],
        data.weaknesses?.items || [],
        data.opportunities?.items || [],
        data.threats?.items || [],
      ];
      const maxItems = Math.max(...quadrants.map(q => q.length));
      // 2x2 grid, each quadrant has header + items
      const quadrantH = 32 + maxItems * (p.smallSize * 1.4 + p.gapSm);
      return headerH + 2 * quadrantH + p.gap;
    }

    case "matrix-2x2": {
      const quadrants = [
        data.topLeft?.items || [],
        data.topRight?.items || [],
        data.bottomLeft?.items || [],
        data.bottomRight?.items || [],
      ];
      const maxItems = Math.max(...quadrants.map(q => q.length));
      const quadrantH = 32 + maxItems * (p.smallSize * 1.4 + p.gapSm);
      return headerH + 2 * quadrantH + p.gap;
    }

    case "table-slide": {
      const rows = data.rows || [];
      const rowH = p.bodySize * p.bodyLh + p.cardPadding;
      const headerRowH = p.bodySize * 1.3 + p.cardPadding + 4;
      return headerH + headerRowH + rows.length * rowH;
    }

    case "funnel": {
      const stages = data.stages || [];
      let stagesH = 0;
      for (const stage of stages) {
        stagesH += 48 + p.gapSm; // Each funnel stage ~48px + gap
      }
      return headerH + stagesH;
    }

    case "roadmap": {
      const milestones = data.milestones || [];
      // Horizontal timeline — but can overflow if too many
      const cols = Math.min(milestones.length, 5);
      const rows = Math.ceil(milestones.length / cols);
      let maxMilestoneH = 0;
      for (const m of milestones) {
        const titleLines = clampLines(estimateTextLines(m?.title || "", p.smallSize, 200), 2);
        const descLines = clampLines(estimateTextLines(m?.description || "", p.tinySize, 200), p.descClamp);
        const mH = titleLines * (p.smallSize * 1.3) + descLines * (p.tinySize * 1.3) + 40;
        maxMilestoneH = Math.max(maxMilestoneH, mH);
      }
      return headerH + rows * maxMilestoneH + (rows - 1) * p.gap + 40; // 40px for timeline line
    }

    case "pyramid": {
      const levels = data.levels || [];
      // Pyramid stacks vertically
      let pyramidH = 0;
      for (const level of levels) {
        pyramidH += 36 + p.gapSm; // Each level ~36px + gap
      }
      return headerH + pyramidH + 20;
    }

    case "image-text": {
      // Two-panel: image left, text right (50/50 split)
      const bullets = data.bullets || [];
      let bulletsH = 0;
      for (const bullet of bullets) {
        const text = typeof bullet === "string" ? bullet : bullet?.text || bullet?.title || "";
        const desc = typeof bullet === "object" ? bullet?.description || "" : "";
        const titleLines = clampLines(estimateTextLines(text, p.bodySize, 500), p.bulletClamp);
        const descLines = desc ? clampLines(estimateTextLines(desc, p.smallSize, 500), p.descClamp) : 0;
        bulletsH += titleLines * (p.bodySize * p.bodyLh) + descLines * (p.smallSize * 1.4) + p.gapSm + 8;
      }
      const descText = data.description || "";
      const descH = descText ? estimateTextLines(descText, p.smallSize, 500) * (p.smallSize * 1.4) + 12 : 0;
      return headerH + descH + bulletsH;
    }

    case "highlight-stats": {
      // Main stat + supporting stats
      const supportingStats = data.supportingStats || [];
      const mainStatH = 80; // Big number + label
      const supportH = supportingStats.length * (p.valueSize * 1.1 + p.tinySize * 1.2 + p.gapSm);
      return headerH + mainStatH + supportH;
    }

    case "logo-grid": {
      const logos = data.logos || [];
      const count = logos.length;
      const cols = count <= 4 ? count : (count <= 6 ? 3 : 4);
      const rows = Math.ceil(count / cols);
      const logoH = 80 + p.gapSm; // Each logo ~80px + gap
      return headerH + rows * logoH + (rows - 1) * p.gap;
    }

    default:
      // Unknown layout — assume it fits
      return AVAILABLE_HEIGHT;
  }
}

/**
 * Determine the optimal density level for a slide.
 * Starts with the density from computeDensity, then escalates if estimated height overflows.
 *
 * @param layoutId - The layout template ID
 * @param data - The slide data
 * @param initialDensity - The density computed by computeDensity
 * @returns The optimal density level (may be same or more compact than initial)
 */
export function autoDensity(
  layoutId: string,
  data: Record<string, any>,
  initialDensity: DensityLevel,
): DensityLevel {
  const densityOrder: DensityLevel[] = ["normal", "compact", "dense"];
  const startIdx = densityOrder.indexOf(initialDensity);

  for (let i = startIdx; i < densityOrder.length; i++) {
    const density = densityOrder[i];
    const estimatedH = estimateContentHeight(layoutId, data, density);

    if (estimatedH <= AVAILABLE_HEIGHT) {
      if (i > startIdx) {
        console.log(
          `[autoDensity] Layout "${layoutId}": escalated ${initialDensity} → ${density} ` +
          `(estimated ${Math.round(estimatedH)}px ≤ ${AVAILABLE_HEIGHT}px)`
        );
      }
      return density;
    }
  }

  // Even dense doesn't fit — return dense as the most compact option
  console.warn(
    `[autoDensity] Layout "${layoutId}": content overflows even at dense ` +
    `(estimated ${Math.round(estimateContentHeight(layoutId, data, "dense"))}px > ${AVAILABLE_HEIGHT}px)`
  );
  return "dense";
}
