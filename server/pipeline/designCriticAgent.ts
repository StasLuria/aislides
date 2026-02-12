/**
 * Design Critic Agent — validates visual quality of generated slides.
 *
 * Two-layer approach:
 *   1. Local validators (fast, deterministic) — contrast, overflow, balance, font sizing, whitespace
 *   2. LLM critique (optional) — holistic design review for overall presentation coherence
 *
 * Auto-fix: attempts to repair common visual issues by adjusting CSS overrides.
 */

import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface DesignIssue {
  slideNumber: number;
  category: "contrast" | "overflow" | "balance" | "font_size" | "whitespace" | "color_harmony" | "consistency" | "language_mixing";
  severity: "error" | "warning" | "info";
  message: string;
  fix?: string; // CSS fix suggestion
}

export interface DesignCritiqueResult {
  issues: DesignIssue[];
  overallScore: number; // 1-10
  cssFixesPerSlide: Map<number, string>;
  summary: string;
}

export interface SlideDesignData {
  slideNumber: number;
  layoutId: string;
  data: Record<string, any>;
  html: string;
}

// ═══════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Parse a CSS color string to RGB values.
 * Supports: #hex, #rrggbb, rgb(), rgba(), and named colors.
 */
export function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || typeof color !== "string") return null;

  const trimmed = color.trim().toLowerCase();

  // Named colors mapping (common ones used in presentations)
  const NAMED_COLORS: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
    transparent: { r: 255, g: 255, b: 255 }, // Treat as white for contrast
  };

  if (NAMED_COLORS[trimmed]) return NAMED_COLORS[trimmed];

  // Hex: #rgb or #rrggbb
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  return null;
}

/**
 * Calculate relative luminance per WCAG 2.0 formula.
 * Returns value between 0 (black) and 1 (white).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors per WCAG 2.0.
 * Returns ratio between 1:1 (no contrast) and 21:1 (max contrast).
 */
export function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ═══════════════════════════════════════════════════════
// THEME CSS VARIABLE PARSER
// ═══════════════════════════════════════════════════════

/**
 * Extract CSS variable values from a theme CSS string.
 */
export function parseThemeVariables(cssVariables: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const regex = /--([\w-]+)\s*:\s*([^;]+)/g;
  let match;
  while ((match = regex.exec(cssVariables)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 1: CONTRAST CHECKER
// ═══════════════════════════════════════════════════════

/**
 * Check text/background contrast ratios against WCAG AA standards.
 * WCAG AA requires:
 *   - Normal text (< 18px): contrast ratio >= 4.5:1
 *   - Large text (>= 18px bold or >= 24px): contrast ratio >= 3:1
 */
export function checkContrast(
  slideNumber: number,
  themeVars: Record<string, string>,
  layoutId: string,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  // Extract key colors from theme
  const headingColor = parseColor(themeVars["--text-heading-color"] || "#111827");
  const bodyColor = parseColor(themeVars["--text-body-color"] || "#4b5563");
  const bgColor = parseColor(themeVars["--card-background-color"] || "#ffffff");
  const accentColor = parseColor(themeVars["--primary-accent-color"] || "#2563eb");

  if (!headingColor || !bgColor) return issues;

  // Skip contrast check for layouts that use accent gradient backgrounds (white text on gradient)
  const accentBgLayouts = new Set(["section-header", "final-slide", "hero-stat"]);
  if (accentBgLayouts.has(layoutId)) {
    // These use white text on accent gradient — check white on accent
    if (accentColor) {
      const white = { r: 255, g: 255, b: 255 };
      const ratio = contrastRatio(white, accentColor);
      if (ratio < 2.5) {
        issues.push({
          slideNumber,
          category: "contrast",
          severity: "error",
          message: `White text on accent background has low contrast (${ratio.toFixed(1)}:1). Darken the accent color.`,
          fix: `/* Darken accent background */ .slide { filter: brightness(0.85); }`,
        });
      }
    }
    return issues; // Skip normal bg checks for accent layouts
  }

  // Check heading on background (large text — 3:1 minimum)
  if (headingColor && bgColor) {
    const ratio = contrastRatio(headingColor, bgColor);
    if (ratio < 3) {
      issues.push({
        slideNumber,
        category: "contrast",
        severity: "error",
        message: `Heading text contrast too low (${ratio.toFixed(1)}:1). WCAG AA requires >= 3:1 for large text.`,
        fix: `/* Increase heading contrast */ h1, h2 { color: #000000 !important; }`,
      });
    }
  }

  // Check body text on background (normal text — 4.5:1 minimum)
  if (bodyColor && bgColor) {
    const ratio = contrastRatio(bodyColor, bgColor);
    if (ratio < 4.5) {
      issues.push({
        slideNumber,
        category: "contrast",
        severity: "warning",
        message: `Body text contrast could be improved (${ratio.toFixed(1)}:1). WCAG AA recommends >= 4.5:1.`,
        fix: `/* Increase body text contrast */ p, span, li { color: #1f2937 !important; }`,
      });
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 2: TEXT OVERFLOW DETECTION
// ═══════════════════════════════════════════════════════

/** Maximum character thresholds per layout element — relaxed to match actual template capacity */
const TEXT_LIMITS: Record<string, { title: number; description: number; bullet_title: number; bullet_desc: number }> = {
  "title-slide": { title: 100, description: 250, bullet_title: 60, bullet_desc: 150 },
  "section-header": { title: 80, description: 200, bullet_title: 60, bullet_desc: 150 },
  "text-slide": { title: 90, description: 250, bullet_title: 60, bullet_desc: 150 },
  "two-column": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "image-text": { title: 80, description: 200, bullet_title: 55, bullet_desc: 120 },
  "icons-numbers": { title: 80, description: 150, bullet_title: 40, bullet_desc: 100 },
  "process-steps": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "timeline": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "comparison": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "final-slide": { title: 120, description: 250, bullet_title: 60, bullet_desc: 150 },
  "quote-slide": { title: 80, description: 350, bullet_title: 60, bullet_desc: 150 },
  "table-slide": { title: 80, description: 200, bullet_title: 40, bullet_desc: 100 },
  "chart-slide": { title: 90, description: 250, bullet_title: 60, bullet_desc: 150 },
  "chart-text": { title: 90, description: 250, bullet_title: 55, bullet_desc: 130 },
  "stats-chart": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "hero-stat": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "highlight-stats": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "agenda-table-of-contents": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "team-profiles": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "logo-grid": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "video-embed": { title: 90, description: 250, bullet_title: 60, bullet_desc: 150 },
  "text-with-callout": { title: 90, description: 250, bullet_title: 55, bullet_desc: 130 },
  "scenario-cards": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "numbered-steps-v2": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "timeline-horizontal": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "dual-chart": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "risk-matrix": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "waterfall-chart": { title: 90, description: 200, bullet_title: 50, bullet_desc: 120 },
  "swot-analysis": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "funnel": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "roadmap": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "pyramid": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "matrix-2x2": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "pros-cons": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
  "checklist": { title: 80, description: 200, bullet_title: 50, bullet_desc: 120 },
};

const DEFAULT_LIMITS = { title: 90, description: 250, bullet_title: 55, bullet_desc: 130 };

/**
 * Detect potential text overflow based on character counts.
 * Presentation slides have fixed dimensions (1280x720), so long text will overflow.
 */
export function checkTextOverflow(
  slideNumber: number,
  data: Record<string, any>,
  layoutId: string,
): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const limits = TEXT_LIMITS[layoutId] || DEFAULT_LIMITS;

  // Check title — only flag severe overflow (>1.5x limit)
  if (data.title && typeof data.title === "string" && data.title.length > limits.title * 1.5) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: "warning",
      message: `Title quite long (${data.title.length} chars, recommended max ${limits.title}). May need smaller font.`,
      fix: `/* Reduce title font size */ h1 { font-size: 85% !important; line-height: 1.15 !important; }`,
    });
  }

  // Check description — only flag severe overflow
  if (data.description && typeof data.description === "string" && data.description.length > limits.description * 1.5) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: "warning",
      message: `Description quite long (${data.description.length} chars, recommended max ${limits.description}).`,
    });
  }

  // Check bullets — only flag when significantly over limit
  if (data.bullets && Array.isArray(data.bullets)) {
    let longBullets = 0;
    for (let i = 0; i < data.bullets.length; i++) {
      const bullet = data.bullets[i];
      if (typeof bullet === "object" && bullet) {
        if (bullet.title && bullet.title.length > limits.bullet_title * 1.5) longBullets++;
        if (bullet.description && bullet.description.length > limits.bullet_desc * 1.5) longBullets++;
      }
    }
    if (longBullets > 0) {
      issues.push({
        slideNumber,
        category: "overflow",
        severity: "info",
        message: `${longBullets} bullet text(s) are quite long. Consider shortening for readability.`,
      });
    }
  }

  // Check quote text
  if (data.quote && typeof data.quote === "string" && data.quote.length > 350) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: "warning",
      message: `Quote too long (${data.quote.length} chars, max 350). Long quotes lose impact.`,
    });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 3: LAYOUT BALANCE
// ═══════════════════════════════════════════════════════

/**
 * Check layout balance — content distribution and visual weight.
 * Detects: uneven columns, too few/many items, missing visual elements.
 */
export function checkLayoutBalance(
  slideNumber: number,
  data: Record<string, any>,
  layoutId: string,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  // Two-column balance
  if (layoutId === "two-column") {
    const leftCount = data.leftColumn?.bullets?.length || 0;
    const rightCount = data.rightColumn?.bullets?.length || 0;
    if (leftCount > 0 && rightCount > 0) {
      const ratio = Math.max(leftCount, rightCount) / Math.min(leftCount, rightCount);
      if (ratio > 3) {
        issues.push({
          slideNumber,
          category: "balance",
          severity: "warning",
          message: `Columns are unbalanced (${leftCount} vs ${rightCount} items). Redistribute for visual harmony.`,
        });
      }
    }
  }

  // Comparison balance
  if (layoutId === "comparison") {
    const aPoints = data.optionA?.points?.length || 0;
    const bPoints = data.optionB?.points?.length || 0;
    if (aPoints > 0 && bPoints > 0) {
      const ratio = Math.max(aPoints, bPoints) / Math.min(aPoints, bPoints);
      if (ratio > 3) {
        issues.push({
          slideNumber,
          category: "balance",
          severity: "warning",
          message: `Comparison options unbalanced (${aPoints} vs ${bPoints} points).`,
        });
      }
    }
  }

  // Empty content areas — only flag truly empty slides
  if (layoutId === "text-slide" && (!data.bullets || data.bullets.length === 0) && !data.description) {
    issues.push({
      slideNumber,
      category: "balance",
      severity: "warning",
      message: `Text slide has no content — slide will appear empty.`,
    });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 4: FONT SIZING
// ═══════════════════════════════════════════════════════

/** Minimum font sizes for readability at projection distance (in px) */
const MIN_FONT_SIZES = {
  heading: 24,     // Headings must be readable from back of room
  subheading: 18,  // Subheadings
  body: 14,        // Body text minimum
  caption: 10,     // Smallest allowed text (relaxed from 11 to 10)
};

/**
 * Check font sizing in rendered HTML for readability.
 * Scans for inline font-size declarations that are too small.
 */
export function checkFontSizing(
  slideNumber: number,
  html: string,
  layoutId: string,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  // Extract all font-size declarations from inline styles
  const fontSizeRegex = /font-size:\s*(\d+(?:\.\d+)?)(px|em|rem)/gi;
  let match;
  const sizes: number[] = [];

  while ((match = fontSizeRegex.exec(html)) !== null) {
    let sizePx = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    // Convert to px approximation
    if (unit === "em" || unit === "rem") {
      sizePx = sizePx * 16;
    }

    sizes.push(sizePx);
  }

  if (sizes.length === 0) return issues;

  // Check for critically small text (below absolute minimum)
  const tooSmall = sizes.filter((s) => s < MIN_FONT_SIZES.caption);
  if (tooSmall.length > 0) {
    issues.push({
      slideNumber,
      category: "font_size",
      severity: "warning",
      message: `Found ${tooSmall.length} text element(s) below ${MIN_FONT_SIZES.caption}px (${tooSmall.map((s) => s + "px").join(", ")}). May be hard to read.`,
      fix: `/* Enforce minimum font size */ [style*="font-size: ${Math.min(...tooSmall)}px"] { font-size: ${MIN_FONT_SIZES.caption}px !important; }`,
    });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 5: WHITESPACE
// ═══════════════════════════════════════════════════════

/**
 * Check whitespace and padding adequacy.
 * Slides need breathing room — cramped content looks unprofessional.
 */
export function checkWhitespace(
  slideNumber: number,
  data: Record<string, any>,
  layoutId: string,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  // Calculate total content items
  let totalItems = 0;
  let totalTextChars = 0;

  if (data.bullets && Array.isArray(data.bullets)) {
    totalItems += data.bullets.length;
    totalTextChars += data.bullets.reduce((sum: number, b: any) => {
      if (typeof b === "string") return sum + b.length;
      return sum + (b?.title?.length || 0) + (b?.description?.length || 0);
    }, 0);
  }
  if (data.metrics && Array.isArray(data.metrics)) {
    totalItems += data.metrics.length;
  }
  if (data.steps && Array.isArray(data.steps)) {
    totalItems += data.steps.length;
  }
  if (data.events && Array.isArray(data.events)) {
    totalItems += data.events.length;
  }
  if (data.rows && Array.isArray(data.rows)) {
    totalItems += data.rows.length;
  }

  // Title + description add to total
  totalTextChars += (data.title?.length || 0) + (data.description?.length || 0);

  // Slide area: 1280x720 = 921,600 px²
  // Usable area after padding: ~1100x600 = 660,000 px²
  // Each content item needs ~70px height minimum
  const estimatedContentHeight = totalItems * 70 + 100; // 100 for title area
  const availableHeight = 620; // approximate usable height

  if (estimatedContentHeight > availableHeight * 1.4) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "warning",
      message: `Content may be dense (${totalItems} items). Consider reducing for better readability.`,
      fix: `/* Reduce spacing for dense content */ .slide { line-height: 1.3 !important; } .slide > div { gap: 8px !important; }`,
    });
  }

  // Check total text density (chars per slide) — only flag extreme cases
  if (totalTextChars > 1200) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "info",
      message: `High text density (${totalTextChars} chars). Consider splitting into multiple slides.`,
    });
  }

  // Check for slides that are too sparse (except title/section/final and visual layouts)
  const sparseExempt = new Set([
    "title-slide", "section-header", "final-slide", "image-fullscreen",
    "quote-slide", "video-embed", "hero-stat", "highlight-stats",
    "chart-slide", "stats-chart", "chart-text", "dual-chart",
  ]);
  if (!sparseExempt.has(layoutId) && totalItems === 0 && totalTextChars < 30) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "info",
      message: `Slide appears nearly empty. Consider adding more content.`,
    });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 6: COLOR HARMONY
// ═══════════════════════════════════════════════════════

/**
 * Check color harmony and consistency across the presentation.
 * Detects: off-theme colors in HTML, inconsistent accent usage.
 */
export function checkColorHarmony(
  slideNumber: number,
  html: string,
  themeVars: Record<string, string>,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  // Extract inline colors from HTML
  const colorRegex = /(?:color|background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))/gi;
  const inlineColors: string[] = [];
  let match;
  while ((match = colorRegex.exec(html)) !== null) {
    inlineColors.push(match[1]);
  }

  // Get theme accent colors
  const primaryAccent = parseColor(themeVars["--primary-accent-color"] || "#2563eb");
  const secondaryAccent = parseColor(themeVars["--secondary-accent-color"] || "#0ea5e9");

  if (!primaryAccent) return issues;

  // Check for "rogue" bright colors that don't match the theme
  let offThemeCount = 0;
  for (const colorStr of inlineColors) {
    const color = parseColor(colorStr);
    if (!color) continue;

    // Skip near-black, near-white, and gray colors (neutral, always OK)
    const lum = relativeLuminance(color.r, color.g, color.b);
    if (lum < 0.05 || lum > 0.9) continue; // Very dark or very light
    const isGray = Math.abs(color.r - color.g) < 25 && Math.abs(color.g - color.b) < 25;
    if (isGray) continue;

    // Check if the color is close to theme colors (relaxed threshold)
    const distPrimary = colorDistance(color, primaryAccent);
    const distSecondary = secondaryAccent ? colorDistance(color, secondaryAccent) : 999;

    if (distPrimary > 200 && distSecondary > 200) {
      offThemeCount++;
    }
  }

  // Only flag if many off-theme colors (relaxed from 3 to 6)
  if (offThemeCount > 6) {
    issues.push({
      slideNumber,
      category: "color_harmony",
      severity: "info",
      message: `${offThemeCount} colors diverge from the theme palette. Consider using theme CSS variables.`,
    });
  }

  return issues;
}

/**
 * Euclidean distance between two RGB colors.
 */
export function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2),
  );
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 7: CROSS-SLIDE CONSISTENCY
// ═══════════════════════════════════════════════════════

/**
 * Check consistency across all slides in the presentation.
 * Detects: layout repetition, missing variety, structural monotony, consecutive same layouts.
 */
export function checkConsistency(
  slides: SlideDesignData[],
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  if (slides.length < 3) return issues;

  // Count layout usage (excluding title and final)
  const contentSlides = slides.filter(
    (s) => !["title-slide", "final-slide", "section-header"].includes(s.layoutId),
  );

  const layoutCounts = new Map<string, number>();
  for (const slide of contentSlides) {
    layoutCounts.set(slide.layoutId, (layoutCounts.get(slide.layoutId) || 0) + 1);
  }

  // Check for excessive repetition of one layout (>50% of content slides)
  for (const [layout, count] of Array.from(layoutCounts.entries())) {
    const percentage = count / contentSlides.length;
    if (percentage > 0.5 && contentSlides.length >= 5) {
      issues.push({
        slideNumber: 0, // Presentation-level issue
        category: "consistency",
        severity: "warning",
        message: `Layout "${layout}" used ${count}/${contentSlides.length} times (${Math.round(percentage * 100)}%). Mix in different layouts for visual variety.`,
      });
    }
  }

  // Check for consecutive same-layout slides (flag 2+ consecutive, not just 3+)
  for (let i = 1; i < slides.length; i++) {
    const exemptLayouts = new Set(["title-slide", "final-slide", "section-header"]);
    if (
      slides[i].layoutId === slides[i - 1].layoutId &&
      !exemptLayouts.has(slides[i].layoutId)
    ) {
      issues.push({
        slideNumber: slides[i].slideNumber,
        category: "consistency",
        severity: "info",
        message: `Consecutive slides ${slides[i - 1].slideNumber} and ${slides[i].slideNumber} both use "${slides[i].layoutId}". Alternate layouts for better rhythm.`,
      });
    }
  }

  // Check layout variety (unique layouts used)
  const uniqueLayouts = layoutCounts.size;
  if (contentSlides.length >= 8 && uniqueLayouts < 3) {
    issues.push({
      slideNumber: 0,
      category: "consistency",
      severity: "warning",
      message: `Only ${uniqueLayouts} unique layout(s) for ${contentSlides.length} content slides. Use at least 3-4 different layouts.`,
    });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// AUTO-FIX ENGINE
// ═══════════════════════════════════════════════════════

/**
 * Generate CSS fixes for detected issues.
 * Returns a map of slide number → CSS override string.
 */
export function generateCssFixes(issues: DesignIssue[]): Map<number, string> {
  const fixMap = new Map<number, string>();

  for (const issue of issues) {
    if (!issue.fix || issue.slideNumber === 0) continue;

    const existing = fixMap.get(issue.slideNumber) || "";
    fixMap.set(issue.slideNumber, existing + "\n" + issue.fix);
  }

  return fixMap;
}

// ═══════════════════════════════════════════════════════
// LANGUAGE MIXING CHECK
// ═══════════════════════════════════════════════════════

/**
 * Check for language mixing in slide content.
 * When the target language is Russian, flag English-only titles or descriptions.
 * Allowed exceptions: proper nouns, abbreviations (AI, IoT, SaaS, etc.), currency symbols.
 */
export function checkLanguageMixing(
  slideNumber: number,
  data: Record<string, any>,
  language: string,
): DesignIssue[] {
  if (language !== "ru") return []; // Only enforce for Russian for now

  const issues: DesignIssue[] = [];

  // Regex: text that is primarily Latin characters (>70% Latin letters)
  // Allows: numbers, symbols, short abbreviations
  const isPrimarilyLatin = (text: string): boolean => {
    if (!text || text.length < 4) return false;
    // Remove known exceptions: abbreviations, numbers, symbols, URLs
    const cleaned = text
      .replace(/\b(AI|IoT|SaaS|API|CRM|ERP|IT|ML|NLP|B2B|B2C|ROI|KPI|CEO|CTO|CFO|HR|PR|R&D|MVP|SLA|SDK|UI|UX|VR|AR|ESG|IPO|GDP|GW|MW|kW|TWh|GWh)\b/gi, "")
      .replace(/[\d$€¥%+\-.,;:()\[\]{}#@&*/=<>|\\"'`~!?\u2014\u2013\u2026\u00b0]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();
    if (cleaned.length < 3) return false;
    const latinChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
    const cyrillicChars = (cleaned.match(/[\u0400-\u04FF]/g) || []).length;
    const totalAlpha = latinChars + cyrillicChars;
    if (totalAlpha === 0) return false;
    return latinChars / totalAlpha > 0.7;
  };

  // Check title
  const title = data.title;
  if (typeof title === "string" && isPrimarilyLatin(title)) {
    issues.push({
      slideNumber,
      category: "language_mixing",
      severity: "warning",
      message: `Slide ${slideNumber}: Title "${title.substring(0, 50)}..." appears to be in English instead of Russian`,
    });
  }

  // Check subtitle
  const subtitle = data.subtitle || data.description;
  if (typeof subtitle === "string" && isPrimarilyLatin(subtitle)) {
    issues.push({
      slideNumber,
      category: "language_mixing",
      severity: "warning",
      message: `Slide ${slideNumber}: Subtitle/description appears to be in English instead of Russian`,
    });
  }

  // Check bullets
  const bullets = data.bullets;
  if (Array.isArray(bullets)) {
    for (const bullet of bullets) {
      const bulletTitle = typeof bullet === "string" ? bullet : bullet?.title;
      if (typeof bulletTitle === "string" && isPrimarilyLatin(bulletTitle)) {
        issues.push({
          slideNumber,
          category: "language_mixing",
          severity: "info",
          message: `Slide ${slideNumber}: Bullet "${bulletTitle.substring(0, 40)}" appears to be in English`,
        });
        break; // One warning per slide is enough
      }
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// MAIN CRITIC FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the full Design Critic analysis on all slides.
 * Returns issues, score, and CSS fixes.
 *
 * Scoring formula (balanced):
 *   Start at 10, deduct per unique category of issue (not per individual issue).
 *   This prevents score collapse from many minor warnings on a single topic.
 */
export function runDesignCritic(
  slides: SlideDesignData[],
  themeCssVariables: string,
  language?: string,
): DesignCritiqueResult {
  const themeVars = parseThemeVariables(themeCssVariables);
  const allIssues: DesignIssue[] = [];

  // Run per-slide validators
  for (const slide of slides) {
    allIssues.push(...checkContrast(slide.slideNumber, themeVars, slide.layoutId));
    allIssues.push(...checkTextOverflow(slide.slideNumber, slide.data, slide.layoutId));
    allIssues.push(...checkLayoutBalance(slide.slideNumber, slide.data, slide.layoutId));
    allIssues.push(...checkFontSizing(slide.slideNumber, slide.html, slide.layoutId));
    allIssues.push(...checkWhitespace(slide.slideNumber, slide.data, slide.layoutId));
    allIssues.push(...checkColorHarmony(slide.slideNumber, slide.html, themeVars));
    if (language) {
      allIssues.push(...checkLanguageMixing(slide.slideNumber, slide.data, language));
    }
  }

  // Run cross-slide validators
  allIssues.push(...checkConsistency(slides));

  // Generate CSS fixes
  const cssFixesPerSlide = generateCssFixes(allIssues);

  // Calculate overall score — category-based deduction (not per-issue)
  const errorCategories = new Set(allIssues.filter((i) => i.severity === "error").map((i) => `${i.category}-${i.slideNumber}`));
  const warningCategories = new Set(allIssues.filter((i) => i.severity === "warning").map((i) => `${i.category}-${i.slideNumber}`));
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  let score = 10;
  score -= errorCategories.size * 1.0;    // Each unique error category-slide combo: -1.0
  score -= warningCategories.size * 0.3;  // Each unique warning category-slide combo: -0.3
  score -= Math.min(infoCount * 0.05, 1); // Info items: max -1.0 total
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  // Generate summary
  const summary = generateSummary(allIssues, score, slides.length);

  return {
    issues: allIssues,
    overallScore: score,
    cssFixesPerSlide,
    summary,
  };
}

function generateSummary(issues: DesignIssue[], score: number, slideCount: number): string {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const parts: string[] = [];
  parts.push(`Design score: ${score}/10 for ${slideCount} slides.`);

  if (errors > 0) parts.push(`${errors} error(s) need fixing.`);
  if (warnings > 0) parts.push(`${warnings} warning(s) to review.`);
  if (infos > 0) parts.push(`${infos} suggestion(s) for improvement.`);

  if (score >= 8) parts.push("Overall design quality is good.");
  else if (score >= 6) parts.push("Design is acceptable with minor improvements possible.");
  else if (score >= 4) parts.push("Design has some issues that could be improved.");
  else parts.push("Design needs significant improvements for professional quality.");

  // Category breakdown
  const categories = new Map<string, number>();
  for (const issue of issues) {
    categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
  }
  if (categories.size > 0) {
    const topCategories = Array.from(categories.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 3)
      .map((entry: [string, number]) => `${entry[0]} (${entry[1]})`)
      .join(", ");
    parts.push(`Top areas: ${topCategories}.`);
  }

  return parts.join(" ");
}

// ═══════════════════════════════════════════════════════
// LLM-BASED HOLISTIC CRITIQUE (optional, for premium quality)
// ═══════════════════════════════════════════════════════

/**
 * Run LLM-based holistic design critique.
 * Analyzes the overall visual coherence and professional quality.
 * This is an optional enhancement — local validators are the primary check.
 */
export async function runLlmDesignCritique(
  slides: SlideDesignData[],
  themeCssVariables: string,
  localResult: DesignCritiqueResult,
): Promise<{ suggestions: string[]; revisedScore: number }> {
  try {
    const slideDescriptions = slides.map((s) => ({
      slide: s.slideNumber,
      layout: s.layoutId,
      title: s.data.title || "",
      itemCount: (s.data.bullets?.length || 0) + (s.data.metrics?.length || 0) + (s.data.steps?.length || 0),
      hasImage: !!(s.data.image?.url),
    }));

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional presentation design critic. Analyze the slide structure and provide actionable design suggestions.

Focus on:
1. Visual rhythm — do layouts alternate well? Is there variety?
2. Information hierarchy — are the most important slides visually prominent?
3. Pacing — is the density appropriate for each section?
4. Professional polish — does the overall flow feel cohesive?

Local analysis already found ${localResult.issues.length} issues (score: ${localResult.overallScore}/10).

Respond in JSON: { "suggestions": ["..."], "revised_score": 8.5 }`,
        },
        {
          role: "user",
          content: `Presentation with ${slides.length} slides using theme variables:\n${themeCssVariables}\n\nSlide structure:\n${JSON.stringify(slideDescriptions, null, 2)}\n\nLocal issues found:\n${localResult.issues.slice(0, 10).map((i) => `[${i.severity}] Slide ${i.slideNumber}: ${i.message}`).join("\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "design_critique",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: { type: "string" },
                description: "3-5 actionable design improvement suggestions",
              },
              revised_score: {
                type: "number",
                description: "Revised design score from 1-10 considering holistic quality",
              },
            },
            required: ["suggestions", "revised_score"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return { suggestions: [], revisedScore: localResult.overallScore };

    const parsed = JSON.parse(content);
    return {
      suggestions: parsed.suggestions || [],
      revisedScore: Math.max(1, Math.min(10, parsed.revised_score || localResult.overallScore)),
    };
  } catch (err) {
    console.error("[DesignCritic] LLM critique failed:", err);
    return { suggestions: [], revisedScore: localResult.overallScore };
  }
}
