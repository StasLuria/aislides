/**
 * QA Agent — validates HTML Composer output for quality and completeness.
 * Two-layer validation:
 *   1. Structural validation (fast, no LLM) — checks required fields, content density, icon format
 *   2. LLM review (optional, for critical slides) — checks content quality and coherence
 *
 * If validation fails, returns specific issues for the HTML Composer to fix on retry.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface QAIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface QAResult {
  passed: boolean;
  issues: QAIssue[];
  feedbackForRetry: string; // Formatted string for HTML Composer retry prompt
}

// ═══════════════════════════════════════════════════════
// LAYOUT REQUIREMENTS — minimum content per layout type
// ═══════════════════════════════════════════════════════

interface LayoutRequirement {
  requiredFields: string[];
  minBullets?: number;
  minMetrics?: number;
  minSteps?: number;
  minEvents?: number;
  minRows?: number;
  minSections?: number;
  minPoints?: number;
  minCards?: number;
  minFeatures?: number;
  bulletNeedsTitleAndDesc?: boolean;
}

const LAYOUT_REQUIREMENTS: Record<string, LayoutRequirement> = {
  "title-slide": {
    requiredFields: ["title"],
  },
  "section-header": {
    requiredFields: ["title"],
  },
  "text-slide": {
    requiredFields: ["title", "bullets"],
    minBullets: 3,
    bulletNeedsTitleAndDesc: true,
  },
  "two-column": {
    requiredFields: ["title", "leftColumn", "rightColumn"],
    minBullets: 2, // per column
  },
  "image-text": {
    requiredFields: ["title", "bullets"],
    minBullets: 2,
    bulletNeedsTitleAndDesc: true,
  },
  "image-fullscreen": {
    requiredFields: ["title"],
  },
  "quote-slide": {
    requiredFields: ["title", "quote"],
  },
  "chart-slide": {
    requiredFields: ["title", "chartData"],
  },
  "table-slide": {
    requiredFields: ["title", "headers", "rows"],
    minRows: 2,
  },
  "icons-numbers": {
    requiredFields: ["title", "metrics"],
    minMetrics: 3,
  },
  "timeline": {
    requiredFields: ["title", "events"],
    minEvents: 3,
  },
  "process-steps": {
    requiredFields: ["title", "steps"],
    minSteps: 3,
  },
  "comparison": {
    requiredFields: ["title", "optionA", "optionB"],
    minPoints: 3,
  },
  "final-slide": {
    requiredFields: ["title"],
  },
  "agenda-table-of-contents": {
    requiredFields: ["title", "sections"],
    minSections: 3,
  },
  "team-profiles": {
    requiredFields: ["title"],
  },
  "logo-grid": {
    requiredFields: ["title"],
  },
  "video-embed": {
    requiredFields: ["title"],
  },
  "stats-chart": {
    requiredFields: ["title", "stats"],
    minMetrics: 2,
  },
  "chart-text": {
    requiredFields: ["title"],
    minBullets: 2,
    bulletNeedsTitleAndDesc: true,
  },
  "hero-stat": {
    requiredFields: ["title", "mainStat"],
  },
  "scenario-cards": {
    requiredFields: ["title", "scenarios"],
  },
  "numbered-steps-v2": {
    requiredFields: ["title", "steps"],
    minSteps: 3,
  },
  "timeline-horizontal": {
    requiredFields: ["title", "events"],
    minEvents: 3,
  },
  "text-with-callout": {
    requiredFields: ["title", "bullets"],
    minBullets: 3,
    bulletNeedsTitleAndDesc: true,
  },
  "dual-chart": {
    requiredFields: ["title", "leftChart", "rightChart"],
  },
  "risk-matrix": {
    requiredFields: ["title", "matrixColumns", "matrixRows", "mitigations"],
  },
  "card-grid": {
    requiredFields: ["title", "cards"],
    minCards: 3,
  },
  "financial-formula": {
    requiredFields: ["title", "formulaParts"],
  },
  "big-statement": {
    requiredFields: ["title"],
  },
  "verdict-analysis": {
    requiredFields: ["title", "criteria", "verdictTitle", "verdictText"],
  },
  "vertical-timeline": {
    requiredFields: ["title", "events"],
    minEvents: 3,
  },
  "comparison-table": {
    requiredFields: ["title", "columns", "features"],
    minFeatures: 2,
  },
  "quote-highlight": {
    requiredFields: ["title", "quote", "author"],
  },
  "highlight-stats": {
    requiredFields: ["title", "mainStat"],
  },
  "waterfall-chart": {
    requiredFields: ["title", "bars"],
  },
  "swot-analysis": {
    requiredFields: ["title", "strengths", "weaknesses", "opportunities", "threats"],
  },
  "funnel": {
    requiredFields: ["title", "stages"],
  },
  "roadmap": {
    requiredFields: ["title", "milestones"],
  },
  "pyramid": {
    requiredFields: ["title", "levels"],
  },
  "matrix-2x2": {
    requiredFields: ["title", "quadrants"],
  },
  "pros-cons": {
    requiredFields: ["title", "pros", "cons"],
  },
  "checklist": {
    requiredFields: ["title", "items"],
  },
};

// ═══════════════════════════════════════════════════════
// STRUCTURAL VALIDATION
// ═══════════════════════════════════════════════════════

/**
 * Validate slide data against layout requirements.
 * Fast, deterministic — no LLM call needed.
 */
export function validateSlideData(
  data: Record<string, any>,
  layoutName: string,
): QAResult {
  const issues: QAIssue[] = [];
  const req = LAYOUT_REQUIREMENTS[layoutName];

  if (!req) {
    // Unknown layout — just check for title
    if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
      issues.push({ field: "title", severity: "error", message: "Title is missing or empty" });
    }
    return buildResult(issues);
  }

  // 1. Check required fields exist and are non-empty
  for (const field of req.requiredFields) {
    const value = getNestedValue(data, field);
    if (value === undefined || value === null) {
      issues.push({ field, severity: "error", message: `Required field "${field}" is missing` });
    } else if (typeof value === "string" && value.trim().length === 0) {
      issues.push({ field, severity: "error", message: `Required field "${field}" is empty` });
    }
  }

  // 2. Check content density — bullets
  if (req.minBullets && data.bullets) {
    if (!Array.isArray(data.bullets)) {
      issues.push({ field: "bullets", severity: "error", message: "bullets must be an array" });
    } else {
      if (data.bullets.length < req.minBullets) {
        issues.push({
          field: "bullets",
          severity: "error",
          message: `Need at least ${req.minBullets} bullets, got ${data.bullets.length}. Add more content.`,
        });
      }
      // Check bullet structure
      if (req.bulletNeedsTitleAndDesc) {
        for (let i = 0; i < data.bullets.length; i++) {
          const bullet = data.bullets[i];
          if (typeof bullet === "string") {
            issues.push({
              field: `bullets[${i}]`,
              severity: "error",
              message: `Bullet ${i + 1} is a plain string. Must be object with "title" and "description" fields.`,
            });
          } else if (bullet && typeof bullet === "object") {
            if (!bullet.title || (typeof bullet.title === "string" && bullet.title.trim().length === 0)) {
              issues.push({
                field: `bullets[${i}].title`,
                severity: "warning",
                message: `Bullet ${i + 1} has empty title.`,
              });
            }
          }
        }
      }
    }
  }

  // 3. Check two-column bullets
  if (layoutName === "two-column") {
    const minPerCol = req.minBullets || 2;
    if (data.leftColumn && Array.isArray(data.leftColumn.bullets)) {
      if (data.leftColumn.bullets.length < minPerCol) {
        issues.push({
          field: "leftColumn.bullets",
          severity: "error",
          message: `Left column needs at least ${minPerCol} bullets, got ${data.leftColumn.bullets.length}.`,
        });
      }
    }
    if (data.rightColumn && Array.isArray(data.rightColumn.bullets)) {
      if (data.rightColumn.bullets.length < minPerCol) {
        issues.push({
          field: "rightColumn.bullets",
          severity: "error",
          message: `Right column needs at least ${minPerCol} bullets, got ${data.rightColumn.bullets.length}.`,
        });
      }
    }
    // Check column titles
    if (data.leftColumn && (!data.leftColumn.title || data.leftColumn.title.trim().length === 0)) {
      issues.push({ field: "leftColumn.title", severity: "warning", message: "Left column title is empty." });
    }
    if (data.rightColumn && (!data.rightColumn.title || data.rightColumn.title.trim().length === 0)) {
      issues.push({ field: "rightColumn.title", severity: "warning", message: "Right column title is empty." });
    }
  }

  // 4. Check metrics (icons-numbers)
  if (req.minMetrics && data.metrics) {
    if (!Array.isArray(data.metrics)) {
      issues.push({ field: "metrics", severity: "error", message: "metrics must be an array" });
    } else {
      if (data.metrics.length < req.minMetrics) {
        issues.push({
          field: "metrics",
          severity: "error",
          message: `Need at least ${req.minMetrics} metrics, got ${data.metrics.length}.`,
        });
      }
      // Check icon format
      for (let i = 0; i < data.metrics.length; i++) {
        const metric = data.metrics[i];
        if (metric.icon) {
          if (typeof metric.icon === "string") {
            issues.push({
              field: `metrics[${i}].icon`,
              severity: "error",
              message: `Metric ${i + 1} icon is a string "${metric.icon}". Must be object {name, url}. Use Lucide icon URL format.`,
            });
          } else if (typeof metric.icon === "object" && !metric.icon.url) {
            issues.push({
              field: `metrics[${i}].icon.url`,
              severity: "error",
              message: `Metric ${i + 1} icon is missing "url" field. Format: {name: "icon-name", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/icon-name.svg"}`,
            });
          }
        }
        // Check value exists
        if (!metric.value || (typeof metric.value === "string" && metric.value.trim().length === 0)) {
          issues.push({
            field: `metrics[${i}].value`,
            severity: "warning",
            message: `Metric ${i + 1} has empty value. Should be a specific number like "85%", "$2.4M", "150+".`,
          });
        }
      }
    }
  }

  // 5. Check steps (process-steps)
  if (req.minSteps && data.steps) {
    if (!Array.isArray(data.steps)) {
      issues.push({ field: "steps", severity: "error", message: "steps must be an array" });
    } else if (data.steps.length < req.minSteps) {
      issues.push({
        field: "steps",
        severity: "error",
        message: `Need at least ${req.minSteps} steps, got ${data.steps.length}.`,
      });
    }
  }

  // 6. Check events (timeline)
  if (req.minEvents && data.events) {
    if (!Array.isArray(data.events)) {
      issues.push({ field: "events", severity: "error", message: "events must be an array" });
    } else if (data.events.length < req.minEvents) {
      issues.push({
        field: "events",
        severity: "error",
        message: `Need at least ${req.minEvents} events, got ${data.events.length}.`,
      });
    }
  }

  // 7. Check rows (table-slide)
  if (req.minRows && data.rows) {
    if (!Array.isArray(data.rows)) {
      issues.push({ field: "rows", severity: "error", message: "rows must be an array" });
    } else if (data.rows.length < req.minRows) {
      issues.push({
        field: "rows",
        severity: "error",
        message: `Need at least ${req.minRows} rows, got ${data.rows.length}.`,
      });
    }
  }

  // 8. Check comparison points
  if (req.minPoints && layoutName === "comparison") {
    const minPts = req.minPoints;
    if (data.optionA && Array.isArray(data.optionA.points) && data.optionA.points.length < minPts) {
      issues.push({
        field: "optionA.points",
        severity: "error",
        message: `Option A needs at least ${minPts} points, got ${data.optionA.points.length}.`,
      });
    }
    if (data.optionB && Array.isArray(data.optionB.points) && data.optionB.points.length < minPts) {
      issues.push({
        field: "optionB.points",
        severity: "error",
        message: `Option B needs at least ${minPts} points, got ${data.optionB.points.length}.`,
      });
    }
  }

  // 9. Check sections (agenda)
  if (req.minSections && data.sections) {
    if (!Array.isArray(data.sections)) {
      issues.push({ field: "sections", severity: "error", message: "sections must be an array" });
    } else if (data.sections.length < req.minSections) {
      issues.push({
        field: "sections",
        severity: "error",
        message: `Need at least ${req.minSections} sections, got ${data.sections.length}.`,
      });
    }
  }

  // 10. Check cards (card-grid)
  if (req.minCards && data.cards) {
    if (!Array.isArray(data.cards)) {
      issues.push({ field: "cards", severity: "error", message: "cards must be an array" });
    } else {
      if (data.cards.length < req.minCards) {
        issues.push({
          field: "cards",
          severity: "error",
          message: `Need at least ${req.minCards} cards, got ${data.cards.length}.`,
        });
      }
      // Check icon format in cards
      for (let i = 0; i < data.cards.length; i++) {
        const card = data.cards[i];
        if (card.icon && typeof card.icon === "string") {
          issues.push({
            field: `cards[${i}].icon`,
            severity: "error",
            message: `Card ${i + 1} icon is a string "${card.icon}". Must be object {name, url}. Use Lucide icon URL format.`,
          });
        }
      }
    }
  }

  // 11. Check features (comparison-table)
  if (req.minFeatures && data.features) {
    if (!Array.isArray(data.features)) {
      issues.push({ field: "features", severity: "error", message: "features must be an array" });
    } else {
      if (data.features.length < req.minFeatures) {
        issues.push({
          field: "features",
          severity: "error",
          message: `Need at least ${req.minFeatures} features, got ${data.features.length}.`,
        });
      }
      // Check values length matches columns length
      if (data.columns && Array.isArray(data.columns)) {
        const colCount = data.columns.length;
        for (let i = 0; i < data.features.length; i++) {
          const feature = data.features[i];
          if (feature.values && Array.isArray(feature.values) && feature.values.length !== colCount) {
            issues.push({
              field: `features[${i}].values`,
              severity: "error",
              message: `Feature "${feature.name}" has ${feature.values.length} values but ${colCount} columns. Must match.`,
            });
          }
        }
      }
    }
  }

  // 12. Check verdict-analysis required fields
  if (layoutName === "verdict-analysis") {
    if (data.verdictColor && typeof data.verdictColor === "string" && !data.verdictColor.startsWith("#")) {
      issues.push({
        field: "verdictColor",
        severity: "error",
        message: `verdictColor must be a hex color string (e.g. "#16a34a"), got "${data.verdictColor}".`,
      });
    }
  }

  // 13. Check financial-formula parts
  if (layoutName === "financial-formula" && data.formulaParts) {
    if (!Array.isArray(data.formulaParts)) {
      issues.push({ field: "formulaParts", severity: "error", message: "formulaParts must be an array" });
    } else {
      for (let i = 0; i < data.formulaParts.length; i++) {
        const part = data.formulaParts[i];
        if (part.type === "operator" && !part.symbol) {
          issues.push({
            field: `formulaParts[${i}].symbol`,
            severity: "error",
            message: `Operator part ${i + 1} is missing "symbol" field. Use "+", "-", "×", etc.`,
          });
        }
      }
    }
  }

  // 14. Check vertical-timeline events have dates
  if (layoutName === "vertical-timeline" && data.events && Array.isArray(data.events)) {
    for (let i = 0; i < data.events.length; i++) {
      const event = data.events[i];
      if (!event.title || (typeof event.title === "string" && event.title.trim().length === 0)) {
        issues.push({
          field: `events[${i}].title`,
          severity: "error",
          message: `Event ${i + 1} has empty title.`,
        });
      }
      if (event.icon && typeof event.icon === "string") {
        issues.push({
          field: `events[${i}].icon`,
          severity: "error",
          message: `Event ${i + 1} icon is a string. Must be object {name, url}.`,
        });
      }
    }
  }

  // 15. Check quote-highlight
  if (layoutName === "quote-highlight") {
    if (data.quote && typeof data.quote === "string" && data.quote.length > 500) {
      issues.push({
        field: "quote",
        severity: "warning",
        message: `Quote is very long (${data.quote.length} chars). Keep under 300 chars for best display.`,
      });
    }
  }

  // 16. Check chart data
  if (layoutName === "chart-slide" && data.chartData) {
    if (!data.chartData.labels || !Array.isArray(data.chartData.labels) || data.chartData.labels.length === 0) {
      issues.push({ field: "chartData.labels", severity: "error", message: "Chart must have labels array." });
    }
    if (!data.chartData.datasets || !Array.isArray(data.chartData.datasets) || data.chartData.datasets.length === 0) {
      issues.push({ field: "chartData.datasets", severity: "error", message: "Chart must have at least one dataset." });
    }
  }

  return buildResult(issues);
}

// ═══════════════════════════════════════════════════════
// AUTO-FIX — attempt to fix common issues without LLM
// ═══════════════════════════════════════════════════════

/**
 * Attempt to auto-fix common data issues.
 * Returns the fixed data and whether any fixes were applied.
 */
export function autoFixSlideData(
  data: Record<string, any>,
  layoutName: string,
): { data: Record<string, any>; fixed: boolean } {
  let fixed = false;
  const result = { ...data };

  // Fix 1: Convert string bullets to {title, description} objects
  if (result.bullets && Array.isArray(result.bullets)) {
    result.bullets = result.bullets.map((bullet: any) => {
      if (typeof bullet === "string") {
        fixed = true;
        const colonIdx = bullet.indexOf(":");
        if (colonIdx > 0 && colonIdx < 60) {
          return {
            title: bullet.substring(0, colonIdx).replace(/^\*\*|\*\*$/g, "").trim(),
            description: bullet.substring(colonIdx + 1).trim(),
          };
        }
        return { title: bullet.trim(), description: "" };
      }
      return bullet;
    });
  }

  // Fix 2: Fix emoji/string icons in metrics
  if (result.metrics && Array.isArray(result.metrics)) {
    const defaultIcons = ["bar-chart", "trending-up", "users", "target", "zap", "shield", "globe", "star"];
    result.metrics = result.metrics.map((metric: any, i: number) => {
      if (!metric.icon || typeof metric.icon === "string") {
        fixed = true;
        const iconName = defaultIcons[i % defaultIcons.length];
        return {
          ...metric,
          icon: {
            name: iconName,
            url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`,
          },
        };
      }
      if (typeof metric.icon === "object" && !metric.icon.url && metric.icon.name) {
        fixed = true;
        return {
          ...metric,
          icon: {
            ...metric.icon,
            url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${metric.icon.name}.svg`,
          },
        };
      }
      return metric;
    });
  }

  // Fix 3: Ensure two-column has column titles
  if (layoutName === "two-column") {
    if (result.leftColumn && !result.leftColumn.title) {
      result.leftColumn = { ...result.leftColumn, title: "Аспект 1" };
      fixed = true;
    }
    if (result.rightColumn && !result.rightColumn.title) {
      result.rightColumn = { ...result.rightColumn, title: "Аспект 2" };
      fixed = true;
    }
  }

  // Fix 4: Ensure process-steps have numbers
  if (result.steps && Array.isArray(result.steps)) {
    result.steps = result.steps.map((step: any, i: number) => {
      if (!step.number) {
        fixed = true;
        return { ...step, number: i + 1 };
      }
      return step;
    });
  }

  // Fix 5: Ensure agenda sections have numbers
  if (result.sections && Array.isArray(result.sections)) {
    result.sections = result.sections.map((section: any, i: number) => {
      if (!section.number) {
        fixed = true;
        return { ...section, number: i + 1 };
      }
      return section;
    });
  }

  // Fix 6: Fix emoji/string icons in cards (card-grid)
  if (result.cards && Array.isArray(result.cards)) {
    const defaultIcons = ["layers", "shield", "zap", "globe", "star", "target"];
    result.cards = result.cards.map((card: any, i: number) => {
      if (!card.icon || typeof card.icon === "string") {
        fixed = true;
        const iconName = typeof card.icon === "string" && card.icon.length > 1 && !card.icon.includes(" ")
          ? card.icon
          : defaultIcons[i % defaultIcons.length];
        return {
          ...card,
          icon: {
            name: iconName,
            url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`,
          },
        };
      }
      if (typeof card.icon === "object" && !card.icon.url && card.icon.name) {
        fixed = true;
        return {
          ...card,
          icon: {
            ...card.icon,
            url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${card.icon.name}.svg`,
          },
        };
      }
      return card;
    });
  }

  // Fix 7: Fix verdict-analysis color names to hex
  if (layoutName === "verdict-analysis" && result.verdictColor && !result.verdictColor.startsWith("#")) {
    const colorMap: Record<string, string> = {
      green: "#16a34a", red: "#dc2626", amber: "#f59e0b", orange: "#f59e0b",
      yellow: "#eab308", blue: "#2563eb", LOW: "#16a34a", MEDIUM: "#f59e0b", HIGH: "#dc2626",
    };
    const mapped = colorMap[result.verdictColor] || colorMap[result.verdictColor.toUpperCase()];
    if (mapped) {
      result.verdictColor = mapped;
      fixed = true;
    }
  }

  // Fix 8: Fix financial-formula operator parts missing symbol
  if (layoutName === "financial-formula" && result.formulaParts && Array.isArray(result.formulaParts)) {
    result.formulaParts = result.formulaParts.map((part: any) => {
      if (part.type === "operator" && !part.symbol) {
        fixed = true;
        return { ...part, symbol: part.value || "+" };
      }
      return part;
    });
  }

  // Fix 9: Fix vertical-timeline string icons to objects
  if (layoutName === "vertical-timeline" && result.events && Array.isArray(result.events)) {
    result.events = result.events.map((event: any) => {
      if (event.icon && typeof event.icon === "string") {
        fixed = true;
        const iconName = event.icon.length > 1 && !event.icon.includes(" ") ? event.icon : "circle";
        return {
          ...event,
          icon: {
            name: iconName,
            url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`,
          },
        };
      }
      return event;
    });
  }

  // Fix 10: Fix comparison-table feature_label → featureLabel
  if (layoutName === "comparison-table" && result.feature_label && !result.featureLabel) {
    result.featureLabel = result.feature_label;
    delete result.feature_label;
    fixed = true;
  }

  // Fix 11: Fix checklist items missing status colors
  if (layoutName === "checklist" && result.items && Array.isArray(result.items)) {
    result.items = result.items.map((item: any) => {
      if (item.done !== undefined && !item.statusColor) {
        fixed = true;
        return {
          ...item,
          status: item.done ? "Готово" : "В процессе",
          statusColor: item.done ? "#dcfce7" : "#fef9c3",
          statusTextColor: item.done ? "#166534" : "#854d0e",
        };
      }
      return item;
    });
  }

  return { data: result, fixed };
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current && typeof current === "object" ? current[key] : undefined;
  }, obj as any);
}

function buildResult(issues: QAIssue[]): QAResult {
  const hasErrors = issues.some((i) => i.severity === "error");
  const feedbackLines = issues
    .filter((i) => i.severity === "error")
    .map((i) => `- ${i.field}: ${i.message}`);

  return {
    passed: !hasErrors,
    issues,
    feedbackForRetry: feedbackLines.length > 0
      ? `Fix these data issues:\n${feedbackLines.join("\n")}`
      : "",
  };
}
