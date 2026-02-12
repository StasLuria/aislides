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
    expect(issues.some((i) => i.category === "contrast")).toBe(true);
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

  it("skips normal bg checks for accent-bg layouts (section-header, final-slide, hero-stat)", () => {
    // Even with bad heading/body contrast, accent layouts should only check white-on-accent
    const badTheme = { ...goodTheme, "--text-heading-color": "#d0d0d0", "--primary-accent-color": "#1e3a8a" };
    const issues = checkContrast(1, badTheme, "final-slide");
    // Should NOT have heading contrast error (because final-slide uses white text on accent)
    expect(issues.filter((i) => i.message.includes("Heading text contrast"))).toHaveLength(0);
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

  it("detects severely long title (>1.5x limit)", () => {
    const data = {
      title: "A".repeat(200), // Way over 90 * 1.5 = 135 limit for text-slide
      bullets: [],
    };
    const issues = checkTextOverflow(1, data, "text-slide");
    expect(issues.some((i) => i.category === "overflow" && i.message.includes("Title"))).toBe(true);
  });

  it("does not flag moderately long title (within 1.5x)", () => {
    const data = {
      title: "A".repeat(100), // Over 90 but under 135 (1.5x)
      bullets: [],
    };
    const issues = checkTextOverflow(1, data, "text-slide");
    expect(issues.filter((i) => i.message.includes("Title"))).toHaveLength(0);
  });

  it("detects long quote text", () => {
    const data = {
      title: "Quote",
      quote: "Q".repeat(400), // Over 350 limit
    };
    const issues = checkTextOverflow(1, data, "quote-slide");
    expect(issues.some((i) => i.message.includes("Quote too long"))).toBe(true);
  });

  it("uses layout-specific limits", () => {
    // icons-numbers has 80 char title limit, 1.5x = 120
    const data = {
      title: "T".repeat(130), // Over 120 (1.5x of 80)
    };
    const issues = checkTextOverflow(1, data, "icons-numbers");
    expect(issues.some((i) => i.message.includes("Title"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT BALANCE
// ═══════════════════════════════════════════════════════

describe("checkLayoutBalance", () => {
  it("detects unbalanced two-column layout (ratio > 3)", () => {
    const data = {
      title: "Comparison",
      leftColumn: { title: "Left", bullets: ["a", "b", "c", "d", "e", "f", "g"] },
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

  it("detects unbalanced comparison (ratio > 3)", () => {
    const data = {
      title: "A vs B",
      optionA: { title: "A", points: ["1", "2", "3", "4", "5", "6", "7"] },
      optionB: { title: "B", points: ["x"] },
    };
    const issues = checkLayoutBalance(1, data, "comparison");
    expect(issues.some((i) => i.message.includes("unbalanced"))).toBe(true);
  });

  it("detects empty text slide", () => {
    const data = { title: "Empty", bullets: [] };
    const issues = checkLayoutBalance(1, data, "text-slide");
    expect(issues.some((i) => i.message.includes("no content"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// FONT SIZING
// ═══════════════════════════════════════════════════════

describe("checkFontSizing", () => {
  it("detects critically small font sizes (below 10px)", () => {
    const html = `<div style="font-size: 8px;">Tiny text</div>`;
    const issues = checkFontSizing(1, html, "text-slide");
    expect(issues.some((i) => i.category === "font_size")).toBe(true);
  });

  it("accepts normal font sizes", () => {
    const html = `<h1 style="font-size: 48px;">Title</h1><p style="font-size: 16px;">Body</p>`;
    const issues = checkFontSizing(1, html, "text-slide");
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
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
      bullets: Array(12).fill({ title: "Point", description: "A long description that takes up space on the slide" }),
    };
    const issues = checkWhitespace(1, data, "text-slide");
    expect(issues.some((i) => i.category === "whitespace")).toBe(true);
  });

  it("warns about very high text density (>1200 chars)", () => {
    const data = {
      title: "T".repeat(100),
      description: "D".repeat(300),
      bullets: Array(8).fill({ title: "T".repeat(50), description: "D".repeat(100) }),
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

  it("exempts chart/stat layouts from empty check", () => {
    const data = { title: "Chart" };
    expect(checkWhitespace(1, data, "chart-slide").filter((i) => i.message.includes("empty"))).toHaveLength(0);
    expect(checkWhitespace(1, data, "hero-stat").filter((i) => i.message.includes("empty"))).toHaveLength(0);
    expect(checkWhitespace(1, data, "dual-chart").filter((i) => i.message.includes("empty"))).toHaveLength(0);
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
    expect(issues.filter((i) => i.severity === "warning" || i.severity === "error")).toHaveLength(0);
  });

  it("detects many off-theme colors (7+ needed to trigger)", () => {
    // Need 7+ off-theme colors to trigger (relaxed threshold)
    const html = `
      <div style="color: #ff0000;">Red</div>
      <div style="color: #00ff00;">Green</div>
      <div style="background-color: #ff00ff;">Magenta</div>
      <div style="color: #ff8800;">Orange</div>
      <div style="color: #aa0000;">DarkRed</div>
      <div style="color: #00aa00;">DarkGreen</div>
      <div style="background-color: #aa00aa;">DarkMagenta</div>
      <div style="color: #cc6600;">DarkOrange</div>
    `;
    const issues = checkColorHarmony(1, html, themeVars);
    expect(issues.some((i) => i.category === "color_harmony")).toBe(true);
  });

  it("does not flag 4 off-theme colors (below threshold)", () => {
    const html = `
      <div style="color: #ff0000;">Red</div>
      <div style="color: #00ff00;">Green</div>
      <div style="background-color: #ff00ff;">Magenta</div>
      <div style="color: #ff8800;">Orange</div>
    `;
    const issues = checkColorHarmony(1, html, themeVars);
    expect(issues.filter((i) => i.category === "color_harmony")).toHaveLength(0);
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

  it("detects excessive layout repetition (>50%)", () => {
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

  it("detects 2 consecutive same layouts", () => {
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide"),
      makeSlide(3, "text-slide"),
      makeSlide(4, "icons-numbers"),
      makeSlide(5, "final-slide"),
    ];
    const issues = checkConsistency(slides);
    expect(issues.some((i) => i.message.includes("Consecutive"))).toBe(true);
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
      makeSlide(1, "title-slide", { title: "A".repeat(200) }),
      makeSlide(2, "text-slide", {
        title: "B".repeat(200),
        bullets: Array(15).fill({ title: "Long title here that is really long", description: "Very long description that goes on and on and on and on" }),
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

  it("scores well-designed presentation highly (7+)", () => {
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

  it("uses category-based scoring (not per-issue)", () => {
    // Same category on multiple slides should not collapse the score
    const slides = [
      makeSlide(1, "title-slide"),
      makeSlide(2, "text-slide", { bullets: [{ title: "A", description: "B" }] }),
      makeSlide(3, "icons-numbers", { metrics: [{ value: "1", label: "A" }, { value: "2", label: "B" }] }),
      makeSlide(4, "final-slide"),
    ];

    const result = runDesignCritic(slides, themeCss);
    // With good theme, score should not collapse below 5
    expect(result.overallScore).toBeGreaterThanOrEqual(5);
  });
});
