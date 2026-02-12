/**
 * Tests for Quality Improvement Round 3:
 * - Enhanced Outline Agent prompts (few-shot examples, narrative arcs)
 * - Slide footers (slide numbers + presentation title)
 * - Inline markdown parsing (**bold**, *italic*)
 * - Image generation improvements (limit increase, better prompts)
 */
import { describe, it, expect } from "vitest";
import { parseInlineMarkdown, processSlideDataMarkdown } from "./pipeline/markdownInline";
import { renderSlide, renderPresentation } from "./pipeline/templateEngine";
import { outlineSystem, outlineUser, writerSystem, htmlComposerSystem } from "./pipeline/prompts";

// ═══════════════════════════════════════════════════════
// INLINE MARKDOWN PARSING
// ═══════════════════════════════════════════════════════

describe("parseInlineMarkdown", () => {
  it("should convert **bold** to <strong>", () => {
    expect(parseInlineMarkdown("This is **bold** text")).toBe(
      "This is <strong>bold</strong> text"
    );
  });

  it("should convert *italic* to <em>", () => {
    expect(parseInlineMarkdown("This is *italic* text")).toBe(
      "This is <em>italic</em> text"
    );
  });

  it("should handle both bold and italic in the same string", () => {
    const result = parseInlineMarkdown("**Bold** and *italic* together");
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("should handle multiple bold markers", () => {
    const result = parseInlineMarkdown("**First** and **Second** bold");
    expect(result).toBe("<strong>First</strong> and <strong>Second</strong> bold");
  });

  it("should handle numbers in bold", () => {
    expect(parseInlineMarkdown("Growth of **47%** in Q3")).toBe(
      "Growth of <strong>47%</strong> in Q3"
    );
  });

  it("should return empty string for null/undefined", () => {
    expect(parseInlineMarkdown(null as any)).toBe("");
    expect(parseInlineMarkdown(undefined as any)).toBe("");
    expect(parseInlineMarkdown("")).toBe("");
  });

  it("should not modify text without markdown markers", () => {
    expect(parseInlineMarkdown("Plain text without markers")).toBe(
      "Plain text without markers"
    );
  });
});

describe("processSlideDataMarkdown", () => {
  it("should process bullet descriptions", () => {
    const data = {
      title: "Test Slide",
      bullets: [
        { title: "Point **one**", description: "Growth of **47%** in Q3" },
        { title: "Point two", description: "This is *important* data" },
      ],
    };
    const result = processSlideDataMarkdown(data);
    expect(result.bullets[0].title).toBe("Point <strong>one</strong>");
    expect(result.bullets[0].description).toBe("Growth of <strong>47%</strong> in Q3");
    expect(result.bullets[1].description).toBe("This is <em>important</em> data");
  });

  it("should skip url and icon fields", () => {
    const data = {
      title: "Test",
      icon: { name: "star", url: "https://cdn.example.com/**bold**/icon.svg" },
      image: { url: "https://example.com/**test**.png" },
    };
    const result = processSlideDataMarkdown(data);
    expect(result.icon.url).toBe("https://cdn.example.com/**bold**/icon.svg");
    expect(result.image.url).toBe("https://example.com/**test**.png");
  });

  it("should skip internal metadata fields", () => {
    const data = {
      title: "Test",
      _slideNumber: 1,
      _totalSlides: 10,
      _presentationTitle: "**Bold Title**",
    };
    const result = processSlideDataMarkdown(data);
    expect(result._presentationTitle).toBe("**Bold Title**");
    expect(result._slideNumber).toBe(1);
  });

  it("should handle null/undefined data", () => {
    expect(processSlideDataMarkdown(null as any)).toBeNull();
    expect(processSlideDataMarkdown(undefined as any)).toBeUndefined();
  });

  it("should process nested objects recursively", () => {
    const data = {
      title: "Test",
      leftColumn: {
        title: "**Left**",
        bullets: ["Point *one*", "Point **two**"],
      },
    };
    const result = processSlideDataMarkdown(data);
    expect(result.leftColumn.title).toBe("<strong>Left</strong>");
    expect(result.leftColumn.bullets[0]).toBe("Point <em>one</em>");
    expect(result.leftColumn.bullets[1]).toBe("Point <strong>two</strong>");
  });
});

// ═══════════════════════════════════════════════════════
// SLIDE FOOTER RENDERING
// ═══════════════════════════════════════════════════════

describe("Slide Footer", () => {
  it("should add footer to text-slide", () => {
    const html = renderSlide("text-slide", {
      title: "Test Slide",
      bullets: [
        { title: "Point 1", description: "Description 1" },
        { title: "Point 2", description: "Description 2" },
        { title: "Point 3", description: "Description 3" },
      ],
      _slideNumber: 3,
      _totalSlides: 10,
      _presentationTitle: "My Presentation",
    });
    expect(html).toContain("slide-footer");
    expect(html).toContain("slide-footer-title");
    expect(html).toContain("slide-footer-number");
    expect(html).toContain("My Presentation");
    expect(html).toContain("3");
    expect(html).toContain("10");
  });

  it("should NOT add footer to title-slide", () => {
    const html = renderSlide("title-slide", {
      title: "My Presentation",
      description: "Subtitle here",
      _slideNumber: 1,
      _totalSlides: 10,
      _presentationTitle: "My Presentation",
    });
    expect(html).not.toContain("slide-footer");
  });

  it("should NOT add footer to final-slide", () => {
    const html = renderSlide("final-slide", {
      title: "Thank You",
      subtitle: "Questions?",
      thankYouText: "Thanks!",
      _slideNumber: 10,
      _totalSlides: 10,
      _presentationTitle: "My Presentation",
    });
    expect(html).not.toContain("slide-footer");
  });

  it("should add footer to section-header", () => {
    const html = renderSlide("section-header", {
      title: "Section 1",
      subtitle: "Introduction",
      _slideNumber: 2,
      _totalSlides: 10,
      _presentationTitle: "My Presentation",
    });
    expect(html).toContain("slide-footer");
    expect(html).toContain("2");
  });

  it("should escape HTML in presentation title", () => {
    const html = renderSlide("text-slide", {
      title: "Test",
      bullets: [{ title: "A", description: "B" }, { title: "C", description: "D" }, { title: "E", description: "F" }],
      _slideNumber: 1,
      _totalSlides: 5,
      _presentationTitle: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should handle missing metadata gracefully", () => {
    const html = renderSlide("text-slide", {
      title: "Test",
      bullets: [{ title: "A", description: "B" }, { title: "C", description: "D" }, { title: "E", description: "F" }],
    });
    // Should still render footer, just with empty values
    expect(html).toContain("slide-footer");
  });
});

// ═══════════════════════════════════════════════════════
// FOOTER CSS IN BASE_CSS
// ═══════════════════════════════════════════════════════

describe("Footer CSS in renderPresentation", () => {
  it("should include slide-footer CSS in full presentation", () => {
    const html = renderPresentation(
      [
        { layoutId: "title-slide", data: { title: "Test" } },
        { layoutId: "text-slide", data: { title: "Content", bullets: [{ title: "A", description: "B" }] } },
      ],
      ":root { --primary-accent-color: #6366f1; }",
      "Test Presentation",
    );
    expect(html).toContain(".slide-footer");
    expect(html).toContain(".slide-footer-title");
    expect(html).toContain(".slide-footer-number");
  });
});

// ═══════════════════════════════════════════════════════
// ENHANCED OUTLINE AGENT PROMPTS
// ═══════════════════════════════════════════════════════

describe("Enhanced Outline Agent Prompts", () => {
  it("should include few-shot examples", () => {
    const system = outlineSystem("ru");
    expect(system).toContain("few_shot_examples");
    expect(system).toContain("Business Strategy");
    expect(system).toContain("Technology/Product");
    expect(system).toContain("Educational/Training");
  });

  it("should include narrative arc types", () => {
    const system = outlineSystem("ru");
    expect(system).toContain("narrative_arc_types");
    expect(system).toContain("PROBLEM-SOLUTION");
    expect(system).toContain("JOURNEY");
    expect(system).toContain("FRAMEWORK");
    expect(system).toContain("DATA-DRIVEN");
    expect(system).toContain("VISION");
  });

  it("should mention engaging slide titles", () => {
    const system = outlineSystem("ru");
    expect(system).toContain("engaging and specific");
  });

  it("should include language parameter", () => {
    const system = outlineSystem("en");
    expect(system).toContain("en");
  });

  it("should have improved user prompt", () => {
    const user = outlineUser("AI in healthcare", '{"company_name": "MedTech"}');
    expect(user).toContain("narrative arc type");
    expect(user).toContain("concrete facts");
    expect(user).toContain("AI in healthcare");
  });
});

// ═══════════════════════════════════════════════════════
// ENHANCED WRITER PROMPTS
// ═══════════════════════════════════════════════════════

describe("Enhanced Writer Prompts", () => {
  it("should mention bold markers in writer system", () => {
    const system = writerSystem("ru", "Test", "Slide 1, Slide 2", "Business audience");
    expect(system).toContain("**bold**");
    expect(system).toContain("emphasis");
  });

  it("should include content density rules", () => {
    const system = writerSystem("ru", "Test", "Slide 1", "General");
    expect(system).toContain("content_density_rules");
    expect(system).toContain("4-5 bullet points");
  });
});

// ═══════════════════════════════════════════════════════
// ENHANCED HTML COMPOSER PROMPTS
// ═══════════════════════════════════════════════════════

describe("Enhanced HTML Composer Prompts", () => {
  it("should mention markdown support in composer", () => {
    const system = htmlComposerSystem();
    expect(system).toContain("**bold**");
    expect(system).toContain("<strong>");
    expect(system).toContain("*italic*");
    expect(system).toContain("<em>");
  });

  it("should include review feedback when provided", () => {
    const system = htmlComposerSystem("Fix bullet count");
    expect(system).toContain("review_feedback");
    expect(system).toContain("Fix bullet count");
  });
});

// ═══════════════════════════════════════════════════════
// IMAGE GENERATION IMPROVEMENTS
// ═══════════════════════════════════════════════════════

describe("Image Generation Config", () => {
  // We can't easily test the actual function call, but we can verify
  // the prompt improvements are in the source code
  it("should have improved image selection prompt in generator", async () => {
    // Read the generator source to verify the prompt improvements
    const fs = await import("fs");
    const generatorSource = fs.readFileSync(
      "/home/ubuntu/presentation-frontend/server/pipeline/generator.ts",
      "utf-8"
    );

    // Verify increased limit
    expect(generatorSource).toContain("selectSlidesForImages(content, layoutMap, 5)");

    // Verify improved prompt
    expect(generatorSource).toContain("prompt_guidelines");
    expect(generatorSource).toContain("3D isometric illustration");
    expect(generatorSource).toContain("gradient mesh");
    expect(generatorSource).toContain("Dribbble");
  });
});

// ═══════════════════════════════════════════════════════
// MARKDOWN INTEGRATION IN TEMPLATE ENGINE
// ═══════════════════════════════════════════════════════

describe("Markdown in rendered slides", () => {
  it("should render bold text in bullet descriptions", () => {
    const html = renderSlide("text-slide", {
      title: "Test",
      bullets: [
        { title: "Growth", description: "Revenue grew by **47%** this quarter" },
        { title: "Users", description: "Active users reached **1.2M**" },
        { title: "NPS", description: "Score improved to **85** points" },
      ],
    });
    expect(html).toContain("<strong>47%</strong>");
    expect(html).toContain("<strong>1.2M</strong>");
    expect(html).toContain("<strong>85</strong>");
  });

  it("should render italic text in bullet descriptions", () => {
    const html = renderSlide("text-slide", {
      title: "Test",
      bullets: [
        { title: "Note", description: "This is *critically important* for success" },
        { title: "Point 2", description: "Regular text" },
        { title: "Point 3", description: "More text" },
      ],
    });
    expect(html).toContain("<em>critically important</em>");
  });

  it("should not break icon URLs with markdown processing", () => {
    const html = renderSlide("icons-numbers", {
      title: "Key Metrics",
      metrics: [
        {
          label: "Revenue",
          value: "$2.4M",
          description: "Growth of **47%**",
          icon: { name: "trending-up", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/trending-up.svg" },
        },
        {
          label: "Users",
          value: "150K",
          description: "Active users",
          icon: { name: "users", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg" },
        },
        {
          label: "NPS",
          value: "85",
          description: "Customer satisfaction",
          icon: { name: "star", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/star.svg" },
        },
      ],
    });
    // Icon URLs should not be modified
    expect(html).toContain("https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/trending-up.svg");
    // But description should have bold
    expect(html).toContain("<strong>47%</strong>");
  });
});
