/**
 * Tests for Design Critic Agent
 * Covers: color utilities, contrast checker, text overflow, layout balance,
 * font sizing, whitespace, color harmony, consistency, auto-fix, and main critic.
 */
import { describe, it, expect } from "vitest";
import {
  parseColor,
  relativeLuminance,
  contrastRatio,
  parseThemeVariables,
  checkContrast,
  checkTextOverflow,
  checkLayoutBalance,
  checkFontSizing,
  checkWhitespace,
  checkColorHarmony,
  colorDistance,
  checkConsistency,
  generateCssFixes,
  runDesignCritic,
  autoFixSlideData,
  type SlideDesignData,
  type DesignIssue,
} from "./designCriticAgent";

// ═══════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════

describe("parseColor", () => {
  it("parses 6-digit hex colors", () => {
    expect(parseColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("#2563eb")).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses 3-digit hex colors", () => {
    expect(parseColor("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses rgb() colors", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("rgb(37, 99, 235)")).toEqual({ r: 37, g: 99, b: 235 });
  });

  it("parses rgba() colors", () => {
    expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses named colors", () => {
    expect(parseColor("white")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("black")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor("red")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for invalid colors", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("not-a-color")).toBeNull();
    expect(parseColor("hsl(0, 100%, 50%)")).toBeNull();
  });

  it("handles case insensitivity", () => {
    expect(parseColor("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("WHITE")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("relativeLuminance", () => {
  it("returns 0 for black", () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it("returns 1 for white", () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 2);
  });

  it("returns intermediate values for colors", () => {
    const lum = relativeLuminance(37, 99, 235);
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

describe("contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for same colors", () => {
    const ratio = contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
    expect(ratio).toBe(1);
  });

  it("passes WCAG AA for dark text on white", () => {
    const ratio = contrastRatio({ r: 15, g: 23, b: 42 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeGreaterThan(4.5);
  });

  it("fails WCAG AA for light gray on white", () => {
    const ratio = contrastRatio({ r: 200, g: 200, b: 200 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeLessThan(4.5);
  });
});

describe("colorDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(colorDistance({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBe(0);
  });

  it("returns max distance for black vs white", () => {
    const dist = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(dist).toBeCloseTo(441.67, 0);
  });

  it("returns small distance for similar colors", () => {
    const dist = colorDistance({ r: 37, g: 99, b: 235 }, { r: 40, g: 100, b: 230 });
    expect(dist).toBeLessThan(10);
  });
});

// ═══════════════════════════════════════════════════════
// THEME PARSER
// ═══════════════════════════════════════════════════════

describe("parseThemeVariables", () => {
  it("extracts CSS variables from theme string", () => {
    const css = `:root {
  --text-heading-color: #0f172a;
  --text-body-color: #475569;
  --primary-accent-color: #2563eb;
  --card-background-color: #ffffff;
}`;
    const vars = parseThemeVariables(css);
    expect(vars["--text-heading-color"]).toBe("#0f172a");
    expect(vars["--text-body-color"]).toBe("#475569");
    expect(vars["--primary-accent-color"]).toBe("#2563eb");
    expect(vars["--card-background-color"]).toBe("#ffffff");
  });

  it("handles gradients and complex values", () => {
    const css = `--slide-bg-gradient: linear-gradient(135deg, #f8faff 0%, #e8f0fe 50%);`;
    const vars = parseThemeVariables(css);
    expect(vars["--slide-bg-gradient"]).toContain("linear-gradient");
  });

  it("returns empty object for empty input", () => {
    expect(parseThemeVariables("")).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════
// CONTRAST CHECKER
// ═══════════════════════════════════════════════════════

describe("checkContrast", () => {
  const goodTheme: Record<string, string> = {
    "--text-heading-color": "#0f172a",
    "--text-body-color": "#475569",
    "--card-background-color": "#ffffff",
    "--primary-accent-color": "#2563eb",
  };

  it("returns no issues for high-contrast theme", () => {
    const issues = checkContrast(1, goodTheme, "text-slide");
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("detects low heading contrast", () => {
    const badTheme = { ...goodTheme, "--text-heading-color": "#d0d0d0" };
    const issues = checkContrast(1, badTheme, "text-slide");
    expect(issues.some((i) => i.category === "contrast")).toBe(true);
  });

  it("detects low body text contrast", () => {
    const badTheme = { ...goodTheme, "--text-body-color": "#c0c0c0" };
    const issues = checkContrast(1, badTheme, "text-slide");
    expect(issues.some((i) => i.category === "contrast" && i.severity === "error")).toBe(true);
  });

  it("checks white-on-accent for section headers", () => {
    const lightAccent = { ...goodTheme, "--primary-accent-color": "#ffff00" }; // Yellow — bad for white text
    const issues = checkContrast(1, lightAccent, "section-header");
    expect(issues.some((i) => i.message.includes("White text on accent"))).toBe(true);
  });

  it("passes white-on-dark-accent for section headers", () => {
    const darkAccent = { ...goodTheme, "--primary-accent-color": "#1e3a8a" }; // Dark blue — good for white text
    const issues = checkContrast(1, darkAccent, "section-header");
    const errors = issues.filter((i) => i.severity === "error" && i.message.includes("White text"));
    expect(errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// TEXT OVERFLOW
// ═══════════════════════════════════════════════════════

describe("checkTextOverflow", () => {
  it("returns no issues for normal-length content", () => {
    const data = {
      title: "Market Analysis",
      bullets: [
        { title: "Revenue Growth", description: "Increased by 40% in Q3" },
        { title: "Customer Base", description: "Expanded to 500+ clients" },
      ],
    };
    const issues = checkTextOverflow(1, data, "text-slide");
    expect(issues).toHaveLength(0);
  });

  it("detects overly long title", () => {
    const data = {
      title: "A".repeat(100),
      bullets: [],
    };
    const issues = checkTextOverflow(1, data, "text-slide");
    expect(issues.some((i) => i.category === "overflow" && i.message.includes("Title too long"))).toBe(true);
  });

  it("detects overly long bullet descriptions", () => {
    const data = {
      title: "Test",
      bullets: [
        { title: "Point", description: "D".repeat(200) },
      ],
    };
    const issues = checkTextOverflow(1, data, "text-slide");
    expect(issues.some((i) => i.message.includes("description too long"))).toBe(true);
  });

  it("detects long quote text", () => {
    const data = {
      title: "Quote",
      quote: "Q".repeat(300),
    };
    const issues = checkTextOverflow(1, data, "quote-slide");
    expect(issues.some((i) => i.message.includes("Quote too long"))).toBe(true);
  });

  it("detects long table cells", () => {
    const data = {
      title: "Data",
      headers: ["A", "B"],
      rows: [["Short", "C".repeat(80)]],
    };
    const issues = checkTextOverflow(1, data, "table-slide");
    expect(issues.some((i) => i.message.includes("Table cell"))).toBe(true);
  });

  it("uses layout-specific limits", () => {
    // icons-numbers has stricter limits (70 chars)
    const data = {
      title: "T".repeat(75), // Over 70 limit for icons-numbers
    };
    const issues = checkTextOverflow(1, data, "icons-numbers");
    expect(issues.some((i) => i.message.includes("Title too long"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT BALANCE
// ═══════════════════════════════════════════════════════

describe("checkLayoutBalance", () => {
  it("detects unbalanced two-column layout", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Left", bullets: ["a", "b", "c", "d", "e"] },
      rightColumn: { title: "Right", bullets: ["x"] },
    };
    const issues = checkLayoutBalance(1, data, "two-column");
    expect(issues.some((i) => i.message.includes("unbalanced"))).toBe(true);
  });

  it("accepts balanced two-column layout", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Left", bullets: ["a", "b", "c"] },
      rightColumn: { title: "Right", bullets: ["x", "y", "z"] },
    };
    const issues = checkLayoutBalance(1, data, "two-column");
    expect(issues.filter((i) => i.severity === "warning" || i.severity === "error")).toHaveLength(0);
  });

  it("detects unbalanced comparison", () => {
    const data = {
      title: "A vs B",
      optionA: { title: "A", points: ["1", "2", "3", "4", "5"] },
      optionB: { title: "B", points: ["x"] },
    };
    const issues = checkLayoutBalance(1, data, "comparison");
    expect(issues.some((i) => i.message.includes("unbalanced"))).toBe(true);
  });

  it("warns about single metric", () => {
    const data = {
      title: "KPI",
      metrics: [{ value: "42%", label: "Growth" }],
    };
    const issues = checkLayoutBalance(1, data, "icons-numbers");
    expect(issues.some((i) => i.message.includes("Only 1 metric"))).toBe(true);
  });

  it("suggests even grid for odd metric counts", () => {
    const data = {
      title: "KPIs",
      metrics: Array(5).fill({ value: "42%", label: "Metric" }),
    };
    const issues = checkLayoutBalance(1, data, "icons-numbers");
    expect(issues.some((i) => i.category === "balance" && i.severity === "info")).toBe(true);
  });

  it("detects empty text slide", () => {
    const data = { title: "Empty", bullets: [] };
    const issues = checkLayoutBalance(1, data, "text-slide");
    expect(issues.some((i) => i.message.includes("no bullets"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// FONT SIZING
// ═══════════════════════════════════════════════════════

describe("checkFontSizing", () => {
  it("detects critically small font sizes", () => {
    const html = `<div style="font-size: 8px;">Tiny text</div>`;
    const issues = checkFontSizing(1, html, "text-slide");
    expect(issues.some((i) => i.category === "font_size" && i.severity === "error")).toBe(true);
  });

  it("accepts normal font sizes", () => {
    const html = `<h1 style="font-size: 48px;">Title</h1><p style="font-size: 16px;">Body</p>`;
    const issues = checkFontSizing(1, html, "text-slide");
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("warns about small heading size", () => {
    const html = `<h1 style="font-size: 18px;">Small Heading</h1>`;
    const issues = checkFontSizing(1, html, "text-slide");
    expect(issues.some((i) => i.message.includes("Heading font size"))).toBe(true);
  });

  it("detects wide font size range", () => {
    const html = `
      <h1 style="font-size: 60px;">Big</h1>
      <p style="font-size: 16px;">Medium</p>
      <span style="font-size: 8px;">Tiny</span>
    `;
    const issues = checkFontSizing(1, html, "text-slide");
    // Should have both "too small" error and "wide range" info
    expect(issues.length).toBeGreaterThan(0);
  });

  it("returns no issues for empty HTML", () => {
    const issues = checkFontSizing(1, "", "text-slide");
    expect(issues).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// WHITESPACE
// ═══════════════════════════════════════════════════════

describe("checkWhitespace", () => {
  it("warns about excessive content density", () => {
    const data = {
      title: "Dense Slide",
      bullets: Array(10).fill({ title: "Point", description: "A long description that takes up space on the slide" }),
    };
    const issues = checkWhitespace(1, data, "text-slide");
    expect(issues.some((i) => i.category === "whitespace")).toBe(true);
  });

  it("warns about high text density", () => {
    const data = {
      title: "T".repeat(50),
      description: "D".repeat(300),
      bullets: Array(8).fill({ title: "T".repeat(50), description: "D".repeat(120) }),
    };
    const issues = checkWhitespace(1, data, "text-slide");
    expect(issues.some((i) => i.message.includes("text density"))).toBe(true);
  });

  it("accepts normal content density", () => {
    const data = {
      title: "Normal Slide",
      bullets: [
        { title: "Point 1", description: "Brief description" },
        { title: "Point 2", description: "Another brief point" },
        { title: "Point 3", description: "Third point here" },
      ],
    };
    const issues = checkWhitespace(1, data, "text-slide");
    const warnings = issues.filter((i) => i.severity === "warning" || i.severity === "error");
    expect(warnings).toHaveLength(0);
  });

  it("warns about empty content slides", () => {
    const data = { title: "E" };
    const issues = checkWhitespace(1, data, "text-slide");
    expect(issues.some((i) => i.message.includes("empty"))).toBe(true);
  });

  it("exempts title/section/final slides from empty check", () => {
    const data = { title: "Title" };
    expect(checkWhitespace(1, data, "title-slide").filter((i) => i.message.includes("empty"))).toHaveLength(0);
    expect(checkWhitespace(1, data, "section-header").filter((i) => i.message.includes("empty"))).toHaveLength(0);
    expect(checkWhitespace(1, data, "final-slide").filter((i) => i.message.includes("empty"))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// COLOR HARMONY
// ═══════════════════════════════════════════════════════

describe("checkColorHarmony", () => {
  const themeVars: Record<string, string> = {
    "--primary-accent-color": "#2563eb",
    "--secondary-accent-color": "#0ea5e9",
  };

  it("accepts HTML with theme-consistent colors", () => {
    const html = `<div style="color: #2563eb; background-color: #ffffff;">
      <span style="color: #0f172a;">Text</span>
    </div>`;
    const issues = checkColorHarmony(1, html, themeVars);
    expect(issues.filter((i) => i.severity === "warning")).toHaveLength(0);
  });

  it("detects off-theme colors", () => {
    // Many bright colors that don't match blue theme (need >5 off-theme colors)
    const html = `
      <div style="color: #ff0000;">Red</div>
      <div style="color: #00ff00;">Green</div>
      <div style="background-color: #ff00ff;">Magenta</div>
      <div style="color: #ff8800;">Orange</div>
      <div style="color: #ffcc00;">Yellow</div>
      <div style="color: #cc3300;">Dark Orange</div>
      <div style="color: #ff3366;">Hot Pink</div>
      <div style="color: #99cc00;">Lime</div>
    `;
    const issues = checkColorHarmony(1, html, themeVars);
    expect(issues.some((i) => i.category === "color_harmony")).toBe(true);
  });

  it("ignores neutral colors (black, white, gray)", () => {
    const html = `
      <div style="color: #000000;">Black</div>
      <div style="color: #ffffff;">White</div>
      <div style="color: #808080;">Gray</div>
      <div style="color: #333333;">Dark gray</div>
    `;
    const issues = checkColorHarmony(1, html, themeVars);
    expect(issues.filter((i) => i.category === "color_harmony")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// CONSISTENCY
// ═══════════════════════════════════════════════════════

describe("checkConsistency", () => {
  function makeSlide(num: number, layout: string): SlideDesignData {
    return { slideNumber: num, layoutId: layout, data: { title: `Slide ${num}` }, html: "<div>test</div>" };
  }

  it("detects excessive layout repetition", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide"),
      makeSlide(3, "text-slide"),
      makeSlide(4, "text-slide"),
      makeSlide(5, "text-slide"),
      makeSlide(6, "text-slide"),
      makeSlide(7, "text-slide"),
      makeSlide(8, "final-slide"),
    ];
    const issues = checkConsistency(slides);
    expect(issues.some((i) => i.message.includes("text-slide"))).toBe(true);
  });

  it("detects low layout variety", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      ...Array.from({ length: 9 }, (_, i) => makeSlide(i + 2, i % 2 === 0 ? "text-slide" : "two-column")),
      makeSlide(11, "final-slide"),
    ];
    const issues = checkConsistency(slides);
    expect(issues.some((i) => i.message.includes("unique layout"))).toBe(true);
  });

  it("detects 3+ consecutive same layouts", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide"),
      makeSlide(3, "text-slide"),
      makeSlide(4, "text-slide"),
      makeSlide(5, "icons-numbers"),
      makeSlide(6, "final-slide"),
    ];
    const issues = checkConsistency(slides);
    expect(issues.some((i) => i.message.includes("consecutive"))).toBe(true);
  });

  it("accepts varied layout usage", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide"),
      makeSlide(3, "icons-numbers"),
      makeSlide(4, "two-column"),
      makeSlide(5, "process-steps"),
      makeSlide(6, "image-text"),
      makeSlide(7, "timeline"),
      makeSlide(8, "final-slide"),
    ];
    const issues = checkConsistency(slides);
    const warnings = issues.filter((i) => i.severity === "warning");
    expect(warnings).toHaveLength(0);
  });

  it("handles small presentations gracefully", () => {
    const slides = [makeSlide(1, "title-slide"), makeSlide(2, "text-slide")];
    const issues = checkConsistency(slides);
    expect(issues).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// CSS FIX GENERATION
// ═══════════════════════════════════════════════════════

describe("generateCssFixes", () => {
  it("generates CSS fixes from issues with fix suggestions", () => {
    const issues: DesignIssue[] = [
      {
        slideNumber: 1,
        category: "contrast",
        severity: "error",
        message: "Low contrast",
        fix: "h1 { color: #000 !important; }",
      },
      {
        slideNumber: 1,
        category: "overflow",
        severity: "warning",
        message: "Title too long",
        fix: "h1 { font-size: 85% !important; }",
      },
      {
        slideNumber: 2,
        category: "font_size",
        severity: "error",
        message: "Too small",
        fix: "* { min-font-size: 11px; }",
      },
    ];

    const fixes = generateCssFixes(issues);
    expect(fixes.size).toBe(2);
    expect(fixes.get(1)).toContain("color: #000");
    expect(fixes.get(1)).toContain("font-size: 85%");
    expect(fixes.get(2)).toContain("min-font-size");
  });

  it("skips issues without fixes", () => {
    const issues: DesignIssue[] = [
      { slideNumber: 1, category: "balance", severity: "warning", message: "Unbalanced" },
    ];
    const fixes = generateCssFixes(issues);
    expect(fixes.size).toBe(0);
  });

  it("skips presentation-level issues (slideNumber 0)", () => {
    const issues: DesignIssue[] = [
      { slideNumber: 0, category: "consistency", severity: "warning", message: "Repetitive", fix: "some fix" },
    ];
    const fixes = generateCssFixes(issues);
    expect(fixes.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// MAIN DESIGN CRITIC
// ═══════════════════════════════════════════════════════

describe("runDesignCritic", () => {
  const themeCss = `:root {
  --card-background-color: #ffffff;
  --text-heading-color: #0f172a;
  --text-body-color: #475569;
  --primary-accent-color: #2563eb;
  --secondary-accent-color: #0ea5e9;
}`;

  function makeSlide(num: number, layout: string, data: Record<string, any> = {}, html: string = ""): SlideDesignData {
    return {
      slideNumber: num,
      layoutId: layout,
      data: { title: `Slide ${num}`, ...data },
      html: html || `<h1 style="font-size: 48px; color: #0f172a;">Slide ${num}</h1><p style="font-size: 16px; color: #475569;">Content</p>`,
    };
  }

  it("returns a valid result with score and summary", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide", {
        bullets: [
          { title: "Point 1", description: "Description" },
          { title: "Point 2", description: "Description" },
          { title: "Point 3", description: "Description" },
        ],
      }),
      makeSlide(3, "icons-numbers", {
        metrics: [
          { value: "42%", label: "Growth" },
          { value: "$2.4M", label: "Revenue" },
          { value: "150+", label: "Clients" },
        ],
      }),
      makeSlide(4, "final-slide"),
    ];

    const result = runDesignCritic(slides, themeCss);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(10);
    expect(result.summary).toBeTruthy();
    expect(result.summary).toContain("Design score:");
  });

  it("detects issues in problematic presentation", () => {
    const slides = [
      makeSlide(1, "title-slide", { title: "A".repeat(100) }),
      makeSlide(2, "text-slide", {
        title: "B".repeat(100),
        bullets: Array(10).fill({ title: "Long title here", description: "Very long description that goes on and on" }),
      }, `<h1 style="font-size: 8px;">Tiny</h1>`),
    ];

    const result = runDesignCritic(slides, themeCss);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(10);
  });

  it("generates CSS fixes for fixable issues", () => {
    // Create a slide with tiny font that should trigger a fix
    const slides = [
      makeSlide(1, "text-slide", { title: "Test" }, `<h1 style="font-size: 8px;">Tiny</h1><p style="font-size: 16px;">Normal</p>`),
    ];

    const result = runDesignCritic(slides, themeCss);

    // Should have at least one fix for the tiny font
    const fontIssues = result.issues.filter((i) => i.category === "font_size" && i.fix);
    expect(fontIssues.length).toBeGreaterThan(0);
  });

  it("scores well-designed presentation highly", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide", {
        bullets: [
          { title: "Point 1", description: "Brief description" },
          { title: "Point 2", description: "Another point" },
          { title: "Point 3", description: "Third point" },
        ],
      }),
      makeSlide(3, "icons-numbers", {
        metrics: [
          { value: "42%", label: "A" },
          { value: "85%", label: "B" },
          { value: "120", label: "C" },
          { value: "$5M", label: "D" },
        ],
      }),
      makeSlide(4, "two-column", {
        leftColumn: { title: "Left", bullets: ["a", "b", "c"] },
        rightColumn: { title: "Right", bullets: ["x", "y", "z"] },
      }),
      makeSlide(5, "process-steps", {
        steps: [
          { number: 1, title: "Step 1", description: "First" },
          { number: 2, title: "Step 2", description: "Second" },
          { number: 3, title: "Step 3", description: "Third" },
        ],
      }),
      makeSlide(6, "final-slide"),
    ];

     const result = runDesignCritic(slides, themeCss);
    // Well-designed presentation should score 7+
    expect(result.overallScore).toBeGreaterThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════
// AUTO-FIX ENGINE (enhanced v2)
// ═══════════════════════════════════════════════════════

describe("autoFixSlideData", () => {
  it("smart-truncates title that exceeds 1.3x limit", () => {
    const longTitle = "A".repeat(200);
    const data = { title: longTitle };
    const fixes = autoFixSlideData(data, "text-slide");
    // text-slide title limit = 80, trigger at 80*1.3=104
    expect(fixes.length).toBeGreaterThan(0);
    expect(data.title.length).toBeLessThanOrEqual(84); // 80 + "..."
    expect(fixes.some(f => f.includes("smart-truncated"))).toBe(true);
  });

  it("does not truncate title under 1.3x limit", () => {
    const data = { title: "Short title that fits" };
    const fixes = autoFixSlideData(data, "text-slide");
    expect(data.title).toBe("Short title that fits");
  });

  it("limits bullets to max count for non-text layouts", () => {
    const data = {
      bullets: Array.from({ length: 10 }, (_, i) => ({
        title: `Bullet ${i + 1}`,
        description: `Description ${i + 1}`,
      })),
    };
    const fixes = autoFixSlideData(data, "two-column");
    expect(data.bullets.length).toBeLessThanOrEqual(6);
    expect(fixes.some(f => f.includes("Bullets limited"))).toBe(true);
  });

  it("allows up to 8 bullets for text-slide", () => {
    const data = {
      bullets: Array.from({ length: 8 }, (_, i) => ({
        title: `Bullet ${i + 1}`,
        description: "Desc",
      })),
    };
    const fixes = autoFixSlideData(data, "text-slide");
    expect(data.bullets.length).toBe(8);
  });

  it("limits metrics to 6", () => {
    const data = {
      metrics: Array.from({ length: 9 }, (_, i) => ({
        value: `${(i + 1) * 10}%`,
        label: `Metric ${i + 1}`,
      })),
    };
    const fixes = autoFixSlideData(data, "icons-numbers");
    expect(data.metrics.length).toBe(6);
    expect(fixes).toContain("Metrics limited to 6 items");
  });

  it("limits steps to 7", () => {
    const data = {
      steps: Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        title: `Step ${i + 1}`,
        description: "Description",
      })),
    };
    const fixes = autoFixSlideData(data, "process-steps");
    expect(data.steps.length).toBe(7);
    expect(fixes).toContain("Steps limited to 7 items");
  });

  it("limits events to 8", () => {
    const data = {
      events: Array.from({ length: 12 }, (_, i) => ({
        date: `202${i}`,
        title: `Event ${i + 1}`,
      })),
    };
    const fixes = autoFixSlideData(data, "timeline");
    expect(data.events.length).toBe(8);
    expect(fixes).toContain("Events limited to 8 items");
  });

  it("limits table rows to 8 and truncates long cells", () => {
    const data = {
      rows: [
        ["Short", "A".repeat(80), "OK"],
        ...Array.from({ length: 9 }, () => ["a", "b", "c"]),
      ],
    };
    const fixes = autoFixSlideData(data, "table-slide");
    expect(data.rows.length).toBe(8);
    expect(data.rows[0][1].length).toBeLessThanOrEqual(60);
    expect(fixes.some(f => f.includes("Table rows limited"))).toBe(true);
    expect(fixes.some(f => f.includes("Table cell"))).toBe(true);
  });

  it("limits kanban cards per column to 4", () => {
    const data = {
      columns: [
        {
          title: "To Do",
          cards: Array.from({ length: 7 }, (_, i) => ({ title: `Card ${i + 1}` })),
        },
        {
          title: "Done",
          cards: [{ title: "Card 1" }],
        },
      ],
    };
    const fixes = autoFixSlideData(data, "kanban-board");
    expect(data.columns[0].cards.length).toBe(4);
    expect(data.columns[1].cards.length).toBe(1);
    expect(fixes.some(f => f.includes("Kanban column"))).toBe(true);
  });

  it("limits comparison features to 6", () => {
    const data = {
      features: Array.from({ length: 10 }, (_, i) => ({
        name: `Feature ${i + 1}`,
        optionA: "Yes",
        optionB: "No",
      })),
    };
    const fixes = autoFixSlideData(data, "comparison-table");
    expect(data.features.length).toBe(6);
    expect(fixes).toContain("Comparison features limited to 6 rows");
  });

  it("rebalances two-column layout when columns are very uneven", () => {
    const data = {
      leftColumn: {
        bullets: [
          { title: "A", description: "a" },
          { title: "B", description: "b" },
          { title: "C", description: "c" },
          { title: "D", description: "d" },
          { title: "E", description: "e" },
        ],
      },
      rightColumn: {
        bullets: [
          { title: "X", description: "x" },
        ],
      },
    };
    const fixes = autoFixSlideData(data, "two-column");
    expect(fixes.some(f => f.includes("rebalanced"))).toBe(true);
    const leftLen = data.leftColumn.bullets.length;
    const rightLen = data.rightColumn.bullets.length;
    expect(Math.abs(leftLen - rightLen)).toBeLessThanOrEqual(1);
  });

  it("does not rebalance two-column when columns are roughly even", () => {
    const data = {
      leftColumn: {
        bullets: [
          { title: "A", description: "a" },
          { title: "B", description: "b" },
          { title: "C", description: "c" },
        ],
      },
      rightColumn: {
        bullets: [
          { title: "X", description: "x" },
          { title: "Y", description: "y" },
        ],
      },
    };
    const fixes = autoFixSlideData(data, "two-column");
    expect(fixes.some(f => f.includes("rebalanced"))).toBe(false);
  });

  it("limits SWOT quadrant items to 4", () => {
    const data = {
      strengths: ["s1", "s2", "s3", "s4", "s5", "s6"],
      weaknesses: ["w1", "w2"],
      opportunities: ["o1", "o2", "o3", "o4", "o5"],
      threats: ["t1"],
    };
    const fixes = autoFixSlideData(data, "swot-analysis");
    expect(data.strengths.length).toBe(4);
    expect(data.weaknesses.length).toBe(2);
    expect(data.opportunities.length).toBe(4);
    expect(data.threats.length).toBe(1);
    expect(fixes.some(f => f.includes("SWOT strengths"))).toBe(true);
    expect(fixes.some(f => f.includes("SWOT opportunities"))).toBe(true);
  });

  it("limits org-chart members and departments", () => {
    const data = {
      members: Array.from({ length: 12 }, (_, i) => ({ name: `Member ${i + 1}` })),
      departments: Array.from({ length: 7 }, (_, i) => ({ name: `Dept ${i + 1}` })),
    };
    const fixes = autoFixSlideData(data, "org-chart");
    expect(data.members.length).toBe(9);
    expect(data.departments.length).toBe(5);
    expect(fixes.some(f => f.includes("Org-chart members"))).toBe(true);
    expect(fixes.some(f => f.includes("Org-chart departments"))).toBe(true);
  });

  it("truncates long quotes", () => {
    const data = { quote: "A".repeat(300) };
    const fixes = autoFixSlideData(data, "quote-highlight");
    expect(data.quote.length).toBeLessThanOrEqual(244);
    expect(fixes.some(f => f.includes("Quote smart-truncated"))).toBe(true);
  });

  it("limits cards to 6", () => {
    const data = {
      cards: Array.from({ length: 9 }, (_, i) => ({ title: `Card ${i + 1}` })),
    };
    const fixes = autoFixSlideData(data, "card-grid");
    expect(data.cards.length).toBe(6);
    expect(fixes).toContain("Cards limited to 6 items");
  });

  it("limits checklist items to 8", () => {
    const data = {
      items: Array.from({ length: 12 }, (_, i) => ({
        text: `Item ${i + 1}`,
        checked: i < 5,
      })),
    };
    const fixes = autoFixSlideData(data, "checklist");
    expect(data.items.length).toBe(8);
    expect(fixes).toContain("Checklist items limited to 8");
  });

  it("returns empty array when no fixes needed", () => {
    const data = {
      title: "Short title",
      description: "Short description",
      bullets: [
        { title: "A", description: "Brief" },
        { title: "B", description: "Brief" },
      ],
    };
    const fixes = autoFixSlideData(data, "text-slide");
    expect(fixes).toEqual([]);
  });
});
