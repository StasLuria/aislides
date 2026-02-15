/**
 * Tests for renderSlidePreview — ensures slide HTML is wrapped
 * with full CSS (BASE_CSS + theme) for correct rendering in chat previews.
 */
import { describe, it, expect } from "vitest";
import { renderSlidePreview, BASE_CSS } from "./templateEngine";

describe("renderSlidePreview", () => {
  it("returns a full HTML document", () => {
    const html = renderSlidePreview("<div>Test Slide</div>", ":root { --primary: blue; }");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes BASE_CSS in the output", () => {
    const html = renderSlidePreview("<div>Slide</div>", ":root {}");
    // BASE_CSS contains .slide class definition
    expect(html).toContain(BASE_CSS);
  });

  it("includes theme CSS variables in the output", () => {
    const themeCss = ":root { --slide-bg-gradient: #ffffff; --primary-color: #003366; }";
    const html = renderSlidePreview("<div>Slide</div>", themeCss);
    expect(html).toContain("--slide-bg-gradient: #ffffff");
    expect(html).toContain("--primary-color: #003366");
  });

  it("wraps slide HTML inside a .slide div with fixed dimensions", () => {
    const slideContent = '<div class="content">Hello World</div>';
    const html = renderSlidePreview(slideContent, ":root {}");
    expect(html).toContain('class="slide"');
    expect(html).toContain("width:1280px");
    expect(html).toContain("height:720px");
    expect(html).toContain(slideContent);
  });

  it("uses custom fonts URL when provided", () => {
    const customFonts = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap";
    const html = renderSlidePreview("<div>Slide</div>", ":root {}", customFonts);
    expect(html).toContain(customFonts);
  });

  it("falls back to Inter font when no fonts URL provided", () => {
    const html = renderSlidePreview("<div>Slide</div>", ":root {}");
    expect(html).toContain("family=Inter");
  });

  it("sets body overflow to hidden", () => {
    const html = renderSlidePreview("<div>Slide</div>", ":root {}");
    expect(html).toContain("overflow: hidden");
  });

  it("preserves BSPB theme CSS with decorative element hiding", () => {
    const bspbCss = `:root {
      --slide-bg-gradient: #ffffff;
      --decorative-shape-color: transparent;
    }
    div[style*="border-radius: 50%"] { display: none !important; }`;
    const html = renderSlidePreview("<div>Slide</div>", bspbCss);
    expect(html).toContain("--slide-bg-gradient: #ffffff");
    expect(html).toContain("--decorative-shape-color: transparent");
    expect(html).toContain('display: none !important');
  });
});
