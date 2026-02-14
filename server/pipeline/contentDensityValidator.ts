/**
 * Content Density Validator — 6×6 Rule Enforcement
 * Enforces max limits on content elements per slide.
 * Auto-trims or auto-splits slides that exceed limits.
 */

export interface DensityLimits {
  maxBullets: number;
  maxStatCards: number;
  maxProcessSteps: number;
  maxCardGrid: number;
  maxTableRows: number;
  maxTableCols: number;
  maxTimelineEvents: number;
  maxComparisonItems: number;
  maxChecklistItems: number;
  maxBulletTitleWords: number;
  maxBulletDescWords: number;
}

export const DEFAULT_LIMITS: DensityLimits = {
  maxBullets: 6,
  maxStatCards: 4,
  maxProcessSteps: 5,
  maxCardGrid: 6,
  maxTableRows: 6,
  maxTableCols: 5,
  maxTimelineEvents: 6,
  maxComparisonItems: 5,
  maxChecklistItems: 8,
  maxBulletTitleWords: 10,
  maxBulletDescWords: 25,
};

export interface DensityResult {
  trimmed: boolean;
  splitRequired: boolean;
  splitSlides?: any[];
  trimmedFields: string[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Enforce density limits on a slide's structured_content.
 * Returns a modified copy with trimmed arrays and text.
 */
export function enforceContentDensity(
  slideContent: any,
  limits: DensityLimits = DEFAULT_LIMITS,
): DensityResult {
  const sc = slideContent.structured_content;
  if (!sc) return { trimmed: false, splitRequired: false, trimmedFields: [] };

  const trimmedFields: string[] = [];
  let splitRequired = false;

  // Trim bullet_points in text field
  if (slideContent.text) {
    const lines = slideContent.text.split("\n").filter((l: string) => l.trim());
    if (lines.length > limits.maxBullets) {
      splitRequired = lines.length > limits.maxBullets + 2;
      if (!splitRequired) {
        // Only trim if not splitting (splitting handles the full text)
        slideContent.text = lines.slice(0, limits.maxBullets).join("\n");
      }
      trimmedFields.push("text_bullets");
    }
  }

  // Trim stat_cards
  if (sc.stat_cards && Array.isArray(sc.stat_cards) && sc.stat_cards.length > limits.maxStatCards) {
    sc.stat_cards = sc.stat_cards.slice(0, limits.maxStatCards);
    trimmedFields.push("stat_cards");
  }

  // Trim process_steps
  if (sc.process_steps && Array.isArray(sc.process_steps) && sc.process_steps.length > limits.maxProcessSteps) {
    sc.process_steps = sc.process_steps.slice(0, limits.maxProcessSteps);
    trimmedFields.push("process_steps");
  }

  // Trim card_grid
  if (sc.card_grid && Array.isArray(sc.card_grid) && sc.card_grid.length > limits.maxCardGrid) {
    sc.card_grid = sc.card_grid.slice(0, limits.maxCardGrid);
    trimmedFields.push("card_grid");
  }

  // Trim timeline_events
  if (sc.timeline_events && Array.isArray(sc.timeline_events) && sc.timeline_events.length > limits.maxTimelineEvents) {
    sc.timeline_events = sc.timeline_events.slice(0, limits.maxTimelineEvents);
    trimmedFields.push("timeline_events");
  }

  // Trim comparison items
  if (sc.comparison_two_sides) {
    if (sc.comparison_two_sides.left_items?.length > limits.maxComparisonItems) {
      sc.comparison_two_sides.left_items = sc.comparison_two_sides.left_items.slice(0, limits.maxComparisonItems);
      trimmedFields.push("comparison_left");
    }
    if (sc.comparison_two_sides.right_items?.length > limits.maxComparisonItems) {
      sc.comparison_two_sides.right_items = sc.comparison_two_sides.right_items.slice(0, limits.maxComparisonItems);
      trimmedFields.push("comparison_right");
    }
  }

  // Trim checklist_items
  if (sc.checklist_items && Array.isArray(sc.checklist_items) && sc.checklist_items.length > limits.maxChecklistItems) {
    sc.checklist_items = sc.checklist_items.slice(0, limits.maxChecklistItems);
    trimmedFields.push("checklist_items");
  }

  // Trim table_data
  if (sc.table_data) {
    if (sc.table_data.headers?.length > limits.maxTableCols) {
      sc.table_data.headers = sc.table_data.headers.slice(0, limits.maxTableCols);
      trimmedFields.push("table_headers");
    }
    if (sc.table_data.rows?.length > limits.maxTableRows) {
      sc.table_data.rows = sc.table_data.rows.slice(0, limits.maxTableRows);
      trimmedFields.push("table_rows");
    }
    if (sc.table_data.rows) {
      sc.table_data.rows = sc.table_data.rows.map((row: any) => {
        // Handle both array rows and object rows (Record<string, string>)
        if (Array.isArray(row)) {
          return row.slice(0, limits.maxTableCols);
        }
        // Object row — trim to maxTableCols keys
        if (row && typeof row === "object") {
          const keys = Object.keys(row);
          if (keys.length > limits.maxTableCols) {
            const trimmed: Record<string, any> = {};
            for (let k = 0; k < limits.maxTableCols; k++) {
              trimmed[keys[k]] = row[keys[k]];
            }
            return trimmed;
          }
        }
        return row;
      });
    }
  }

  // Trim bullet titles and descriptions in key arrays
  const arrayFields = ["bullet_points", "stat_cards", "process_steps", "card_grid", "timeline_events", "checklist_items"];
  for (const field of arrayFields) {
    if (sc[field] && Array.isArray(sc[field])) {
      for (const item of sc[field]) {
        if (item.title && wordCount(item.title) > limits.maxBulletTitleWords) {
          item.title = trimWords(item.title, limits.maxBulletTitleWords);
          if (!trimmedFields.includes(`${field}_title`)) trimmedFields.push(`${field}_title`);
        }
        if (item.description && wordCount(item.description) > limits.maxBulletDescWords) {
          item.description = trimWords(item.description, limits.maxBulletDescWords);
          if (!trimmedFields.includes(`${field}_desc`)) trimmedFields.push(`${field}_desc`);
        }
      }
    }
  }

  return {
    trimmed: trimmedFields.length > 0,
    splitRequired,
    trimmedFields,
  };
}

/**
 * Auto-split a slide with too many bullets into 2 slides.
 * Returns an array of 1 (no split) or 2 slides.
 */
export function autoSplitSlide(slide: any): any[] {
  const text = slide.text || "";
  const lines = text.split("\n").filter((l: string) => l.trim());

  if (lines.length <= 6) return [slide];

  const mid = Math.ceil(lines.length / 2);
  const slide1 = {
    ...slide,
    text: lines.slice(0, mid).join("\n"),
    title: slide.title + " (1/2)",
  };
  const slide2 = {
    ...slide,
    text: lines.slice(mid).join("\n"),
    title: slide.title + " (2/2)",
    slide_number: slide.slide_number + 0.5,
  };

  return [slide1, slide2];
}

/**
 * Apply density enforcement to all slides in the content array.
 * Returns modified content with density limits enforced.
 */
export function enforceAllSlidesDensity(
  content: any[],
  limits: DensityLimits = DEFAULT_LIMITS,
): { content: any[]; totalTrimmed: number; totalSplit: number } {
  let totalTrimmed = 0;
  let totalSplit = 0;
  const result: any[] = [];

  for (const slide of content) {
    const density = enforceContentDensity(slide, limits);
    if (density.trimmed) {
      totalTrimmed++;
      console.log(`[Density] Slide ${slide.slide_number}: trimmed ${density.trimmedFields.join(", ")}`);
    }

    if (density.splitRequired) {
      const splits = autoSplitSlide(slide);
      if (splits.length > 1) {
        totalSplit++;
        console.log(`[Density] Slide ${slide.slide_number}: auto-split into ${splits.length} slides`);
      }
      result.push(...splits);
    } else {
      result.push(slide);
    }
  }

  // Renumber slides
  result.forEach((s, i) => {
    s.slide_number = i + 1;
  });

  return { content: result, totalTrimmed, totalSplit };
}
