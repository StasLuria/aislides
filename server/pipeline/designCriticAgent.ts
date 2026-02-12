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
  category: "contrast" | "overflow" | "balance" | "font_size" | "whitespace" | "color_harmony" | "consistency";
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
    } else if (ratio < 4.5) {
      issues.push({
        slideNumber,
        category: "contrast",
        severity: "warning",
        message: `Heading text contrast marginal (${ratio.toFixed(1)}:1). Consider increasing for better readability.`,
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
        severity: "error",
        message: `Body text contrast too low (${ratio.toFixed(1)}:1). WCAG AA requires >= 4.5:1 for normal text.`,
        fix: `/* Increase body text contrast */ p, span, li { color: #1f2937 !important; }`,
      });
    }
  }

  // Section headers use white text on accent gradient — check white on accent
  if (layoutId === "section-header" && accentColor) {
    const white = { r: 255, g: 255, b: 255 };
    const ratio = contrastRatio(white, accentColor);
    if (ratio < 3) {
      issues.push({
        slideNumber,
        category: "contrast",
        severity: "error",
        message: `White text on accent background has low contrast (${ratio.toFixed(1)}:1). Darken the accent color.`,
        fix: `/* Darken section header background */ .slide { filter: brightness(0.85); }`,
      });
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════
// VALIDATOR 2: TEXT OVERFLOW DETECTION
// ═══════════════════════════════════════════════════════

/** Maximum character thresholds per layout element */
const TEXT_LIMITS: Record<string, { title: number; description: number; bullet_title: number; bullet_desc: number }> = {
  "title-slide": { title: 80, description: 200, bullet_title: 60, bullet_desc: 150 },
  "section-header": { title: 60, description: 150, bullet_title: 60, bullet_desc: 150 },
  "text-slide": { title: 70, description: 200, bullet_title: 50, bullet_desc: 120 },
  "two-column": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "image-text": { title: 60, description: 150, bullet_title: 45, bullet_desc: 100 },
  "icons-numbers": { title: 60, description: 100, bullet_title: 30, bullet_desc: 80 },
  "process-steps": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "timeline": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "comparison": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "final-slide": { title: 80, description: 200, bullet_title: 60, bullet_desc: 150 },
  "quote-slide": { title: 60, description: 300, bullet_title: 60, bullet_desc: 150 },
  "table-slide": { title: 60, description: 150, bullet_title: 30, bullet_desc: 80 },
  "chart-slide": { title: 70, description: 200, bullet_title: 60, bullet_desc: 150 },
  "agenda-table-of-contents": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "team-profiles": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "logo-grid": { title: 60, description: 150, bullet_title: 40, bullet_desc: 100 },
  "video-embed": { title: 70, description: 200, bullet_title: 60, bullet_desc: 150 },
};

const DEFAULT_LIMITS = { title: 70, description: 200, bullet_title: 50, bullet_desc: 120 };

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

  // Check title
  if (data.title && typeof data.title === "string" && data.title.length > limits.title) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: data.title.length > limits.title * 1.5 ? "error" : "warning",
      message: `Title too long (${data.title.length} chars, max ${limits.title}). May overflow or wrap awkwardly.`,
      fix: `/* Reduce title font size */ h1 { font-size: 85% !important; line-height: 1.15 !important; }`,
    });
  }

  // Check description
  if (data.description && typeof data.description === "string" && data.description.length > limits.description) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: data.description.length > limits.description * 1.5 ? "error" : "warning",
      message: `Description too long (${data.description.length} chars, max ${limits.description}). May overflow slide bounds.`,
    });
  }

  // Check bullets
  if (data.bullets && Array.isArray(data.bullets)) {
    for (let i = 0; i < data.bullets.length; i++) {
      const bullet = data.bullets[i];
      if (typeof bullet === "object" && bullet) {
        if (bullet.title && bullet.title.length > limits.bullet_title) {
          issues.push({
            slideNumber,
            category: "overflow",
            severity: "warning",
            message: `Bullet ${i + 1} title too long (${bullet.title.length} chars, max ${limits.bullet_title}).`,
          });
        }
        if (bullet.description && bullet.description.length > limits.bullet_desc) {
          issues.push({
            slideNumber,
            category: "overflow",
            severity: "warning",
            message: `Bullet ${i + 1} description too long (${bullet.description.length} chars, max ${limits.bullet_desc}).`,
          });
        }
      }
    }
  }

  // Check quote text
  if (data.quote && typeof data.quote === "string" && data.quote.length > 250) {
    issues.push({
      slideNumber,
      category: "overflow",
      severity: data.quote.length > 400 ? "error" : "warning",
      message: `Quote too long (${data.quote.length} chars, max 250). Long quotes lose impact and may overflow.`,
    });
  }

  // Check table cell content
  if (data.rows && Array.isArray(data.rows)) {
    for (let r = 0; r < data.rows.length; r++) {
      if (Array.isArray(data.rows[r])) {
        for (let c = 0; c < data.rows[r].length; c++) {
          const cell = String(data.rows[r][c] || "");
          if (cell.length > 60) {
            issues.push({
              slideNumber,
              category: "overflow",
              severity: "warning",
              message: `Table cell [row ${r + 1}, col ${c + 1}] too long (${cell.length} chars). May cause column squeeze.`,
            });
          }
        }
      }
    }
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
      if (ratio > 2) {
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
      if (ratio > 2) {
        issues.push({
          slideNumber,
          category: "balance",
          severity: "warning",
          message: `Comparison options unbalanced (${aPoints} vs ${bPoints} points). Even counts look more professional.`,
        });
      }
    }
  }

  // Icons-numbers: odd number of metrics looks unbalanced in grid
  if (layoutId === "icons-numbers") {
    const count = data.metrics?.length || 0;
    if (count === 1) {
      issues.push({
        slideNumber,
        category: "balance",
        severity: "warning",
        message: `Only 1 metric — consider adding more for visual impact, or use a different layout.`,
      });
    }
    if (count === 5 || count === 7) {
      issues.push({
        slideNumber,
        category: "balance",
        severity: "info",
        message: `${count} metrics creates uneven grid. Consider ${count - 1} or ${count + 1} for balanced layout.`,
      });
    }
  }

  // Empty content areas
  if (layoutId === "text-slide" && (!data.bullets || data.bullets.length === 0)) {
    issues.push({
      slideNumber,
      category: "balance",
      severity: "error",
      message: `Text slide has no bullets — slide will appear empty.`,
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
  caption: 11,     // Smallest allowed text
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

  // Check for critically small text
  const tooSmall = sizes.filter((s) => s < MIN_FONT_SIZES.caption);
  if (tooSmall.length > 0) {
    issues.push({
      slideNumber,
      category: "font_size",
      severity: "error",
      message: `Found ${tooSmall.length} text element(s) below ${MIN_FONT_SIZES.caption}px minimum (${tooSmall.map((s) => s + "px").join(", ")}). Text will be unreadable at projection distance.`,
      fix: `/* Enforce minimum font size */ * { min-font-size: ${MIN_FONT_SIZES.caption}px; } [style*="font-size: ${Math.min(...tooSmall)}px"] { font-size: ${MIN_FONT_SIZES.caption}px !important; }`,
    });
  }

  // Check heading size (first h1 font-size in the HTML)
  const h1Match = html.match(/<h1[^>]*style="[^"]*font-size:\s*(\d+(?:\.\d+)?)(px)/i);
  if (h1Match) {
    const h1Size = parseFloat(h1Match[1]);
    if (h1Size < MIN_FONT_SIZES.heading) {
      issues.push({
        slideNumber,
        category: "font_size",
        severity: "warning",
        message: `Heading font size (${h1Size}px) is below recommended ${MIN_FONT_SIZES.heading}px for presentations.`,
        fix: `h1 { font-size: ${MIN_FONT_SIZES.heading}px !important; }`,
      });
    }
  }

  // Check font size range — too much variation looks chaotic
  if (sizes.length >= 3) {
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    const ratio = maxSize / minSize;
    if (ratio > 6) {
      issues.push({
        slideNumber,
        category: "font_size",
        severity: "info",
        message: `Wide font size range (${minSize}px to ${maxSize}px, ratio ${ratio.toFixed(1)}x). Consider limiting to 3-4 distinct sizes for visual hierarchy.`,
      });
    }
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
  // Each content item needs ~80px height minimum
  const estimatedContentHeight = totalItems * 80 + 120; // 120 for title area
  const availableHeight = 600; // approximate usable height

  if (estimatedContentHeight > availableHeight * 1.2) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "warning",
      message: `Content likely exceeds slide area (${totalItems} items, ~${estimatedContentHeight}px estimated vs ${availableHeight}px available). Reduce content or use smaller font.`,
      fix: `/* Reduce spacing for dense content */ .slide { line-height: 1.3 !important; } .slide > div { gap: 8px !important; }`,
    });
  }

  // Check total text density (chars per slide)
  if (totalTextChars > 800) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "warning",
      message: `High text density (${totalTextChars} chars). Presentations should have ~200-400 chars per slide for readability.`,
    });
  }

  // Check for slides that are too sparse (except title/section/final)
  const sparseExempt = new Set(["title-slide", "section-header", "final-slide", "image-fullscreen", "quote-slide", "video-embed"]);
  if (!sparseExempt.has(layoutId) && totalItems === 0 && totalTextChars < 50) {
    issues.push({
      slideNumber,
      category: "whitespace",
      severity: "warning",
      message: `Slide appears nearly empty. Add more content or use a simpler layout.`,
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
    const isGray = Math.abs(color.r - color.g) < 20 && Math.abs(color.g - color.b) < 20;
    if (isGray) continue;

    // Check if the color is close to theme colors
    const distPrimary = colorDistance(color, primaryAccent);
    const distSecondary = secondaryAccent ? colorDistance(color, secondaryAccent) : 999;

    if (distPrimary > 150 && distSecondary > 150) {
      offThemeCount++;
    }
  }

  if (offThemeCount > 3) {
    issues.push({
      slideNumber,
      category: "color_harmony",
      severity: "warning",
      message: `${offThemeCount} colors don't match the theme palette. Use theme CSS variables for consistency.`,
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
 * Detects: layout repetition, missing variety, structural monotony.
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

  // Check for excessive repetition of one layout
  for (const [layout, count] of Array.from(layoutCounts.entries())) {
    const percentage = count / contentSlides.length;
    if (percentage > 0.6 && contentSlides.length >= 5) {
      issues.push({
        slideNumber: 0, // Presentation-level issue
        category: "consistency",
        severity: "warning",
        message: `Layout "${layout}" used ${count}/${contentSlides.length} times (${Math.round(percentage * 100)}%). Mix in different layouts for visual variety.`,
      });
    }
  }

  // Check for consecutive same-layout slides
  for (let i = 1; i < slides.length; i++) {
    if (
      slides[i].layoutId === slides[i - 1].layoutId &&
      !["title-slide", "final-slide", "section-header"].includes(slides[i].layoutId)
    ) {
      // Allow up to 2 consecutive, flag 3+
      if (i + 1 < slides.length && slides[i + 1].layoutId === slides[i].layoutId) {
        issues.push({
          slideNumber: slides[i].slideNumber,
          category: "consistency",
          severity: "info",
          message: `3+ consecutive slides with "${slides[i].layoutId}" layout. Alternate layouts to maintain audience engagement.`,
        });
      }
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
// MAIN CRITIC FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the full Design Critic analysis on all slides.
 * Returns issues, score, and CSS fixes.
 */
export function runDesignCritic(
  slides: SlideDesignData[],
  themeCssVariables: string,
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
  }

  // Run cross-slide validators
  allIssues.push(...checkConsistency(slides));

  // Generate CSS fixes
  const cssFixesPerSlide = generateCssFixes(allIssues);

  // Calculate overall score
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  let score = 10;
  score -= errorCount * 1.5;
  score -= warningCount * 0.5;
  score -= infoCount * 0.1;
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
  else if (score >= 6) parts.push("Design is acceptable but has room for improvement.");
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
