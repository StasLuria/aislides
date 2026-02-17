/**
 * Tests for markdownInline.ts — inline markdown to HTML conversion.
 * Covers: bold, italic, newline-to-br, and SVG chart key skipping.
 */
import { describe, it, expect } from "vitest";
import { parseInlineMarkdown, processSlideDataMarkdown } from "./pipeline/markdownInline";

describe("parseInlineMarkdown", () => {
  it("converts **bold** to <strong>", () => {
    expect(parseInlineMarkdown("Hello **world**")).toBe("Hello <strong>world</strong>");
  });

  it("converts *italic* to <em>", () => {
    expect(parseInlineMarkdown("Hello *world*")).toBe("Hello <em>world</em>");
  });

  it("converts newlines to <br>", () => {
    expect(parseInlineMarkdown("line1\nline2")).toBe("line1<br>line2");
  });

  it("handles empty string", () => {
    expect(parseInlineMarkdown("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(parseInlineMarkdown(null as any)).toBe("");
    expect(parseInlineMarkdown(undefined as any)).toBe("");
  });
});

describe("processSlideDataMarkdown", () => {
  it("processes string values in slide data", () => {
    const data = { title: "Hello **world**", description: "Some *text*" };
    const result = processSlideDataMarkdown(data);
    expect(result.title).toBe("Hello <strong>world</strong>");
    expect(result.description).toBe("Some <em>text</em>");
  });

  it("skips url, src, href keys", () => {
    const data = {
      url: "https://example.com/**bold**",
      src: "https://example.com/*italic*",
      href: "https://example.com/**link**",
    };
    const result = processSlideDataMarkdown(data);
    expect(result.url).toBe("https://example.com/**bold**");
    expect(result.src).toBe("https://example.com/*italic*");
    expect(result.href).toBe("https://example.com/**link**");
  });

  it("skips keys starting with _", () => {
    const data = { _slideNumber: "**1**", _totalSlides: "*10*" };
    const result = processSlideDataMarkdown(data);
    expect(result._slideNumber).toBe("**1**");
    expect(result._totalSlides).toBe("*10*");
  });

  it("MUST skip chartSvg to prevent <br> corruption of SVG content", () => {
    const svgContent = `<svg viewBox="0 0 600 340" width="100%" height="100%">
  <!-- Grid -->
  <line x1="60" y1="270" x2="580" y2="270" stroke="#e5e7eb" />
  <text x="52" y="274" fill="#9ca3af">0%</text>
  <rect x="145" y="30" width="60" height="240" rx="4" fill="#6366f1" />
</svg>`;

    const data = { chartSvg: svgContent, title: "Test **bold**" };
    const result = processSlideDataMarkdown(data);

    // chartSvg MUST NOT have <br> tags — they break SVG rendering
    expect(result.chartSvg).not.toContain("<br>");
    // chartSvg should be unchanged
    expect(result.chartSvg).toBe(svgContent);
    // Other fields should still be processed
    expect(result.title).toBe("Test <strong>bold</strong>");
  });

  it("MUST skip leftChartSvg and rightChartSvg", () => {
    const svg = `<svg viewBox="0 0 300 200">\n  <rect x="10" y="10" width="50" height="80" />\n</svg>`;
    const data = {
      leftChartSvg: svg,
      rightChartSvg: svg,
      description: "Some\ntext",
    };
    const result = processSlideDataMarkdown(data);

    expect(result.leftChartSvg).not.toContain("<br>");
    expect(result.rightChartSvg).not.toContain("<br>");
    expect(result.leftChartSvg).toBe(svg);
    expect(result.rightChartSvg).toBe(svg);
    // description should have <br>
    expect(result.description).toBe("Some<br>text");
  });

  it("processes nested arrays and objects", () => {
    const data = {
      items: [
        { title: "**Bold item**", url: "https://skip.me/**bold**" },
        "Plain *italic* text",
      ],
    };
    const result = processSlideDataMarkdown(data);
    expect(result.items[0].title).toBe("<strong>Bold item</strong>");
    expect(result.items[0].url).toBe("https://skip.me/**bold**");
    expect(result.items[1]).toBe("Plain <em>italic</em> text");
  });
});
