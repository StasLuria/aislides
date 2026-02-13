/**
 * Template Parser — extracts theme information from uploaded PPTX/HTML files.
 * Uses JSZip to parse PPTX XML, then LLM to generate CSS variables.
 */
import JSZip from "jszip";
import { invokeLLM } from "./_core/llm";
import type { ThemePreset } from "./pipeline/themes";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ExtractedThemeInfo {
  /** Extracted color values from the template */
  colors: Array<{ name: string; hex: string }>;
  /** Font families found */
  fonts: string[];
  /** Raw XML/HTML snippets for LLM analysis */
  rawSnippets: string;
}

export interface GeneratedTheme {
  /** CSS variables block (:root { ... }) */
  cssVariables: string;
  /** Google Fonts URL */
  fontsUrl: string;
  /** Color palette for display */
  colorPalette: Array<{ name: string; hex: string }>;
  /** Font families */
  fontFamilies: string[];
  /** Mood/style description */
  mood: string;
  /** Suggested template name */
  suggestedName: string;
  /** Preview color (primary accent) */
  previewColor: string;
  /** Preview gradient */
  previewGradient: string;
}

// ═══════════════════════════════════════════════════════
// PPTX PARSING
// ═══════════════════════════════════════════════════════

/**
 * Extract theme information from a PPTX file buffer.
 * Parses the XML inside the PPTX to find colors, fonts, and styles.
 */
export async function extractFromPptx(buffer: Buffer): Promise<ExtractedThemeInfo> {
  const zip = await JSZip.loadAsync(buffer);
  const colors: Array<{ name: string; hex: string }> = [];
  const fonts: string[] = [];
  const snippets: string[] = [];

  // 1. Parse theme XML (ppt/theme/theme1.xml)
  const themeFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith("ppt/theme/") && f.endsWith(".xml"),
  );

  for (const themeFile of themeFiles) {
    const xml = await zip.file(themeFile)?.async("text");
    if (!xml) continue;
    snippets.push(`--- ${themeFile} ---\n${xml.substring(0, 8000)}`);

    // Extract color scheme
    const colorSchemeMatch = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
    if (colorSchemeMatch) {
      const schemeXml = colorSchemeMatch[1];
      const colorPatterns = [
        { name: "dk1", label: "Dark 1" },
        { name: "dk2", label: "Dark 2" },
        { name: "lt1", label: "Light 1" },
        { name: "lt2", label: "Light 2" },
        { name: "accent1", label: "Accent 1" },
        { name: "accent2", label: "Accent 2" },
        { name: "accent3", label: "Accent 3" },
        { name: "accent4", label: "Accent 4" },
        { name: "accent5", label: "Accent 5" },
        { name: "accent6", label: "Accent 6" },
        { name: "hlink", label: "Hyperlink" },
        { name: "folHlink", label: "Followed Hyperlink" },
      ];

      for (const cp of colorPatterns) {
        const regex = new RegExp(
          `<a:${cp.name}>\\s*(?:<a:srgbClr val="([A-Fa-f0-9]{6})"\\s*/>|<a:sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"[^>]*/>)`,
        );
        const match = schemeXml.match(regex);
        if (match) {
          const hex = match[1] || match[2];
          if (hex) {
            colors.push({ name: cp.label, hex: `#${hex}` });
          }
        }
      }
    }

    // Extract font scheme
    const fontSchemeMatch = xml.match(/<a:fontScheme[^>]*>([\s\S]*?)<\/a:fontScheme>/);
    if (fontSchemeMatch) {
      const fontXml = fontSchemeMatch[1];
      // Major font (headings)
      const majorMatch = fontXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
      if (majorMatch) fonts.push(majorMatch[1]);
      // Minor font (body)
      const minorMatch = fontXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
      if (minorMatch && minorMatch[1] !== majorMatch?.[1]) fonts.push(minorMatch[1]);
    }
  }

  // 2. Parse slide master for additional style info
  const slideMasters = Object.keys(zip.files).filter(
    (f) => f.startsWith("ppt/slideMasters/") && f.endsWith(".xml"),
  );

  for (const masterFile of slideMasters.slice(0, 2)) {
    const xml = await zip.file(masterFile)?.async("text");
    if (!xml) continue;
    // Take a smaller snippet for context
    snippets.push(`--- ${masterFile} (truncated) ---\n${xml.substring(0, 4000)}`);
  }

  // 3. Parse slide layouts for layout patterns
  const slideLayouts = Object.keys(zip.files).filter(
    (f) => f.startsWith("ppt/slideLayouts/") && f.endsWith(".xml"),
  );

  for (const layoutFile of slideLayouts.slice(0, 3)) {
    const xml = await zip.file(layoutFile)?.async("text");
    if (!xml) continue;
    snippets.push(`--- ${layoutFile} (truncated) ---\n${xml.substring(0, 3000)}`);
  }

  // 4. Parse actual slides for content examples
  const slideFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml") && !f.includes("_rels"),
  );

  for (const slideFile of slideFiles.slice(0, 3)) {
    const xml = await zip.file(slideFile)?.async("text");
    if (!xml) continue;
    snippets.push(`--- ${slideFile} (truncated) ---\n${xml.substring(0, 3000)}`);
  }

  return {
    colors,
    fonts: Array.from(new Set(fonts)),
    rawSnippets: snippets.join("\n\n"),
  };
}

// ═══════════════════════════════════════════════════════
// HTML PARSING
// ═══════════════════════════════════════════════════════

/**
 * Extract theme information from an HTML file.
 */
export function extractFromHtml(html: string): ExtractedThemeInfo {
  const colors: Array<{ name: string; hex: string }> = [];
  const fonts: string[] = [];

  // Extract colors from CSS variables
  const cssVarPattern = /--[\w-]+:\s*(#[A-Fa-f0-9]{3,8})/g;
  let match;
  while ((match = cssVarPattern.exec(html)) !== null) {
    colors.push({ name: match[0].split(":")[0].trim(), hex: match[1] });
  }

  // Extract colors from inline styles
  const inlineColorPattern = /(?:color|background(?:-color)?)\s*:\s*(#[A-Fa-f0-9]{3,8})/gi;
  while ((match = inlineColorPattern.exec(html)) !== null) {
    if (!colors.some((c) => c.hex.toLowerCase() === match![1].toLowerCase())) {
      colors.push({ name: "inline", hex: match[1] });
    }
  }

  // Extract font families
  const fontPattern = /font-family\s*:\s*['"]?([^;'"]+)/gi;
  while ((match = fontPattern.exec(html)) !== null) {
    const fontName = match[1].split(",")[0].trim().replace(/['"]/g, "");
    if (fontName && !fonts.includes(fontName)) {
      fonts.push(fontName);
    }
  }

  return {
    colors: colors.slice(0, 20),
    fonts: Array.from(new Set(fonts)).slice(0, 5),
    rawSnippets: html.substring(0, 15000),
  };
}

// ═══════════════════════════════════════════════════════
// LLM THEME GENERATION
// ═══════════════════════════════════════════════════════

const THEME_GENERATION_SYSTEM = `You are a presentation design expert. You analyze uploaded presentation templates and generate CSS theme variables that match the template's visual style.

You MUST respond with valid JSON only, no markdown, no explanation.

The CSS variables you generate must follow this exact format:
:root {
  --card-background-color: <hex>;
  --card-background-gradient: <gradient>;
  --slide-bg-gradient: <gradient>;
  --slide-bg-accent-gradient: <gradient>;
  --text-heading-color: <hex>;
  --text-body-color: <hex>;
  --primary-accent-color: <hex>;
  --primary-accent-light: <hex>;
  --secondary-accent-color: <hex>;
  --heading-font-family: '<font>';
  --body-font-family: '<font>';
  --decorative-shape-color: <rgba>;
  --card-border-color: <rgba>;
  --card-shadow: <box-shadow>;
}

Guidelines:
- Use the extracted colors to determine the primary accent, secondary accent, heading, and body text colors
- Ensure good contrast between text and backgrounds
- Create harmonious gradients based on the template's color scheme
- Use the extracted fonts or suggest similar Google Fonts alternatives
- The slide-bg-gradient should be a subtle light gradient for content slides
- The slide-bg-accent-gradient should be a bold gradient for section headers
- Card backgrounds should be white or very light with subtle gradients`;

/**
 * Use LLM to analyze extracted theme info and generate CSS variables.
 */
export async function generateThemeFromExtraction(
  extracted: ExtractedThemeInfo,
): Promise<GeneratedTheme> {
  const userPrompt = `Analyze this presentation template and generate a complete CSS theme.

EXTRACTED COLORS:
${extracted.colors.map((c) => `  ${c.name}: ${c.hex}`).join("\n")}

EXTRACTED FONTS:
${extracted.fonts.join(", ") || "None found — suggest appropriate Google Fonts"}

RAW TEMPLATE DATA:
${extracted.rawSnippets.substring(0, 12000)}

Generate a JSON response with these fields:
{
  "cssVariables": ":root { ... }",
  "fontsUrl": "https://fonts.googleapis.com/css2?family=...",
  "colorPalette": [{"name": "Primary", "hex": "#..."}, ...],
  "fontFamilies": ["Font1", "Font2"],
  "mood": "Brief description of the visual style and mood",
  "suggestedName": "Template Name in Russian",
  "previewColor": "#hex of primary accent",
  "previewGradient": "linear-gradient(135deg, #hex1, #hex2)"
}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: THEME_GENERATION_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "theme_generation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            cssVariables: { type: "string", description: "Complete :root CSS variables block" },
            fontsUrl: { type: "string", description: "Google Fonts import URL" },
            colorPalette: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  hex: { type: "string" },
                },
                required: ["name", "hex"],
                additionalProperties: false,
              },
            },
            fontFamilies: { type: "array", items: { type: "string" } },
            mood: { type: "string" },
            suggestedName: { type: "string" },
            previewColor: { type: "string" },
            previewGradient: { type: "string" },
          },
          required: [
            "cssVariables",
            "fontsUrl",
            "colorPalette",
            "fontFamilies",
            "mood",
            "suggestedName",
            "previewColor",
            "previewGradient",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM returned empty response for theme generation");
  }

  const parsed = JSON.parse(content) as GeneratedTheme;

  // Validate the CSS variables contain required properties
  const requiredVars = ["--primary-accent-color", "--text-heading-color", "--slide-bg-gradient"];
  for (const v of requiredVars) {
    if (!parsed.cssVariables.includes(v)) {
      throw new Error(`Generated CSS missing required variable: ${v}`);
    }
  }

  return parsed;
}

/**
 * Convert a GeneratedTheme to a ThemePreset-compatible object.
 */
export function themeToPreset(templateId: string, name: string, theme: GeneratedTheme): ThemePreset {
  return {
    id: `custom_${templateId}`,
    name,
    nameRu: theme.suggestedName || name,
    previewColor: theme.previewColor,
    previewGradient: theme.previewGradient,
    cssVariables: theme.cssVariables,
    fontsUrl: theme.fontsUrl,
    mood: theme.mood,
  };
}
