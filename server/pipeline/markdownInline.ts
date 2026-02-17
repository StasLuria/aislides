/**
 * Inline Markdown Parser — converts **bold** and *italic* markers
 * in slide text to HTML <strong> and <em> tags.
 *
 * This is intentionally minimal: we only support bold and italic
 * because slide text should remain clean and readable.
 * Full markdown (headers, lists, links) is NOT appropriate for slide content.
 */

/**
 * Convert inline markdown markers to HTML tags.
 * Supports:
 *   - **text** → <strong>text</strong>
 *   - *text*   → <em>text</em>
 *   - \n       → <br> (preserves line breaks from inline editing)
 *
 * Order matters: bold (**) is processed before italic (*) to avoid conflicts.
 * Newline conversion is done last to avoid interfering with markdown parsing.
 */
export function parseInlineMarkdown(text: string): string {
  if (!text || typeof text !== "string") return text || "";

  let result = text;

  // 1. Bold: **text** → <strong>text</strong>
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 2. Italic: *text* → <em>text</em> (but not inside <strong> tags)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // 3. Newlines: \n → <br> (preserves line breaks from contentEditable editing)
  // Only convert if the text actually contains newlines (from user editing)
  if (result.includes("\n")) {
    result = result.replace(/\n/g, "<br>");
  }

  return result;
}

/**
 * Recursively process all string values in a slide data object,
 * converting inline markdown to HTML.
 * Skips keys that start with _ (internal metadata) and url/src fields.
 */
export function processSlideDataMarkdown(data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== "object") return data;

  const SKIP_KEYS = new Set(["url", "src", "href", "image_url", "icon", "_slideNumber", "_totalSlides", "_presentationTitle", "_slide_index", "name", "chartSvg", "leftChartSvg", "rightChartSvg"]);

  function processValue(key: string, value: any): any {
    // Skip internal/url keys
    if (SKIP_KEYS.has(key) || key.startsWith("_")) return value;

    if (typeof value === "string") {
      return parseInlineMarkdown(value);
    }

    if (Array.isArray(value)) {
      return value.map((item, i) => {
        if (typeof item === "string") return parseInlineMarkdown(item);
        if (typeof item === "object" && item !== null) return processObject(item);
        return item;
      });
    }

    if (typeof value === "object" && value !== null) {
      return processObject(value);
    }

    return value;
  }

  function processObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processValue(key, value);
    }
    return result;
  }

  return processObject(data);
}
