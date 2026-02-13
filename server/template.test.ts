/**
 * Tests for the custom template feature:
 * - extractFromHtml (pure function, no LLM)
 * - themeToPreset (pure function)
 * - Template API route responses (integration-style via HTTP)
 */
import { describe, expect, it } from "vitest";
import { extractFromHtml, themeToPreset, type GeneratedTheme, type ExtractedThemeInfo } from "./templateParser";

// ═══════════════════════════════════════════════════════
// extractFromHtml
// ═══════════════════════════════════════════════════════

describe("extractFromHtml", () => {
  it("extracts hex colors from CSS variables", () => {
    const html = `
      <style>
        :root {
          --primary-color: #3B82F6;
          --secondary-color: #10B981;
          --bg-color: #FFFFFF;
        }
      </style>
      <div>Hello</div>
    `;
    const result = extractFromHtml(html);
    expect(result.colors.length).toBeGreaterThanOrEqual(3);
    expect(result.colors.some((c) => c.hex === "#3B82F6")).toBe(true);
    expect(result.colors.some((c) => c.hex === "#10B981")).toBe(true);
    expect(result.colors.some((c) => c.hex === "#FFFFFF")).toBe(true);
  });

  it("extracts colors from inline styles", () => {
    const html = `
      <div style="color: #FF5733; background-color: #2C3E50;">
        Content
      </div>
    `;
    const result = extractFromHtml(html);
    expect(result.colors.some((c) => c.hex === "#FF5733")).toBe(true);
    expect(result.colors.some((c) => c.hex === "#2C3E50")).toBe(true);
  });

  it("extracts font families", () => {
    const html = `
      <style>
        body { font-family: 'Inter', sans-serif; }
        h1 { font-family: "Montserrat", sans-serif; }
      </style>
    `;
    const result = extractFromHtml(html);
    expect(result.fonts).toContain("Inter");
    expect(result.fonts).toContain("Montserrat");
  });

  it("deduplicates colors", () => {
    const html = `
      <style>
        :root { --color-a: #FF0000; }
        .box { color: #ff0000; }
      </style>
    `;
    const result = extractFromHtml(html);
    // Should not have duplicate #FF0000 (case-insensitive)
    const redColors = result.colors.filter(
      (c) => c.hex.toLowerCase() === "#ff0000",
    );
    expect(redColors.length).toBe(1);
  });

  it("deduplicates fonts", () => {
    const html = `
      <style>
        .a { font-family: 'Roboto', sans-serif; }
        .b { font-family: 'Roboto', monospace; }
      </style>
    `;
    const result = extractFromHtml(html);
    const robotoCount = result.fonts.filter((f) => f === "Roboto").length;
    expect(robotoCount).toBe(1);
  });

  it("limits colors to 20", () => {
    // Generate HTML with 30 unique colors
    const colorVars = Array.from({ length: 30 }, (_, i) => {
      const hex = i.toString(16).padStart(6, "0").toUpperCase();
      return `--color-${i}: #${hex};`;
    }).join("\n");
    const html = `<style>:root { ${colorVars} }</style>`;
    const result = extractFromHtml(html);
    expect(result.colors.length).toBeLessThanOrEqual(20);
  });

  it("limits fonts to 5", () => {
    const fontRules = Array.from(
      { length: 10 },
      (_, i) => `.f${i} { font-family: 'Font${i}'; }`,
    ).join("\n");
    const html = `<style>${fontRules}</style>`;
    const result = extractFromHtml(html);
    expect(result.fonts.length).toBeLessThanOrEqual(5);
  });

  it("returns rawSnippets truncated to 15000 chars", () => {
    const html = "x".repeat(20000);
    const result = extractFromHtml(html);
    expect(result.rawSnippets.length).toBeLessThanOrEqual(15000);
  });

  it("handles empty HTML gracefully", () => {
    const result = extractFromHtml("");
    expect(result.colors).toEqual([]);
    expect(result.fonts).toEqual([]);
    expect(result.rawSnippets).toBe("");
  });

  it("handles HTML with no styles", () => {
    const html = "<html><body><h1>Hello World</h1></body></html>";
    const result = extractFromHtml(html);
    expect(result.colors).toEqual([]);
    expect(result.fonts).toEqual([]);
    expect(result.rawSnippets.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════
// themeToPreset
// ═══════════════════════════════════════════════════════

describe("themeToPreset", () => {
  const sampleTheme: GeneratedTheme = {
    cssVariables: ":root { --primary-accent-color: #3B82F6; --text-heading-color: #111; --slide-bg-gradient: linear-gradient(#fff, #f0f0f0); }",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
    colorPalette: [
      { name: "Primary", hex: "#3B82F6" },
      { name: "Secondary", hex: "#10B981" },
    ],
    fontFamilies: ["Inter", "Roboto"],
    mood: "Modern corporate with blue accents",
    suggestedName: "Корпоративный синий",
    previewColor: "#3B82F6",
    previewGradient: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
  };

  it("creates a preset with custom_ prefix on id", () => {
    const preset = themeToPreset("abc123", "My Template", sampleTheme);
    expect(preset.id).toBe("custom_abc123");
  });

  it("uses suggestedName for nameRu", () => {
    const preset = themeToPreset("abc123", "My Template", sampleTheme);
    expect(preset.nameRu).toBe("Корпоративный синий");
  });

  it("falls back to name when suggestedName is empty", () => {
    const themeNoName = { ...sampleTheme, suggestedName: "" };
    const preset = themeToPreset("abc123", "Fallback Name", themeNoName);
    expect(preset.nameRu).toBe("Fallback Name");
  });

  it("passes through cssVariables and fontsUrl", () => {
    const preset = themeToPreset("abc123", "My Template", sampleTheme);
    expect(preset.cssVariables).toBe(sampleTheme.cssVariables);
    expect(preset.fontsUrl).toBe(sampleTheme.fontsUrl);
  });

  it("passes through mood", () => {
    const preset = themeToPreset("abc123", "My Template", sampleTheme);
    expect(preset.mood).toBe("Modern corporate with blue accents");
  });

  it("passes through previewColor and previewGradient", () => {
    const preset = themeToPreset("abc123", "My Template", sampleTheme);
    expect(preset.previewColor).toBe("#3B82F6");
    expect(preset.previewGradient).toBe("linear-gradient(135deg, #3B82F6, #1D4ED8)");
  });
});
