import { describe, it, expect } from "vitest";
import { getThemePreset, isDarkTheme, listThemeIds, THEME_PRESETS } from "./themes";

describe("Theme Presets", () => {
  it("should have exactly 13 theme presets", () => {
    expect(THEME_PRESETS).toHaveLength(13);
  });

  it("should have unique IDs", () => {
    const ids = THEME_PRESETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each theme should have all required fields", () => {
    for (const theme of THEME_PRESETS) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.nameRu).toBeTruthy();
      expect(theme.previewColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.previewGradient).toContain("linear-gradient");
      if (theme.id !== 'bspb_corporate') {
        expect(theme.fontsUrl).toContain("fonts.googleapis.com");
      }
      expect(theme.cssVariables).toContain(":root");
      expect(theme.mood).toBeTruthy();
    }
  });

  it("each theme CSS should contain all required variables", () => {
    const requiredVars = [
      "--card-background-color",
      "--card-background-gradient",
      "--slide-bg-gradient",
      "--slide-bg-accent-gradient",
      "--text-heading-color",
      "--text-body-color",
      "--primary-accent-color",
      "--primary-accent-light",
      "--secondary-accent-color",
      "--heading-font-family",
      "--body-font-family",
      "--decorative-shape-color",
      "--card-border-color",
      "--card-shadow",
    ];

    for (const theme of THEME_PRESETS) {
      for (const varName of requiredVars) {
        expect(theme.cssVariables, `Theme "${theme.id}" missing ${varName}`).toContain(varName);
      }
    }
  });

  it("getThemePreset should return correct theme by ID", () => {
    const theme = getThemePreset("ocean_deep");
    expect(theme.id).toBe("ocean_deep");
    expect(theme.name).toBe("Ocean Deep");
  });

  it("getThemePreset should fall back to bspb_corporate for unknown ID", () => {
    const theme = getThemePreset("nonexistent_theme");
    expect(theme.id).toBe("bspb_corporate");
  });

  it("isDarkTheme should correctly identify dark themes", () => {
    expect(isDarkTheme("cosmic_dark")).toBe(true);
    expect(isDarkTheme("midnight_noir")).toBe(true);
    expect(isDarkTheme("corporate_blue")).toBe(false);
    expect(isDarkTheme("rose_gold")).toBe(false);
  });

  it("listThemeIds should return all theme IDs", () => {
    const ids = listThemeIds();
    expect(ids).toHaveLength(13);
    expect(ids).toContain("bspb_corporate");
    expect(ids).toContain("corporate_blue");
    expect(ids).toContain("cosmic_dark");
    expect(ids).toContain("citrus_energy");
  });

  it("dark themes should have light text colors", () => {
    const darkThemes = THEME_PRESETS.filter((t) => isDarkTheme(t.id));
    for (const theme of darkThemes) {
      // Dark themes should have light heading text
      const headingColor = theme.cssVariables.match(/--text-heading-color:\s*([^;]+)/)?.[1]?.trim();
      expect(headingColor).toBeTruthy();
      // Light colors typically start with #e, #f, or have high values
      if (headingColor) {
        const r = parseInt(headingColor.slice(1, 3), 16);
        expect(r, `Dark theme "${theme.id}" heading color too dark: ${headingColor}`).toBeGreaterThan(180);
      }
    }
  });

  it("light themes should have dark text colors", () => {
    const lightThemes = THEME_PRESETS.filter((t) => !isDarkTheme(t.id));
    for (const theme of lightThemes) {
      const headingColor = theme.cssVariables.match(/--text-heading-color:\s*([^;]+)/)?.[1]?.trim();
      expect(headingColor).toBeTruthy();
      if (headingColor) {
        const r = parseInt(headingColor.slice(1, 3), 16);
        expect(r, `Light theme "${theme.id}" heading color too light: ${headingColor}`).toBeLessThan(100);
      }
    }
  });
});
