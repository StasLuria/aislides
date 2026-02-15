import { describe, it, expect } from "vitest";
import { renderSlide, getLayoutTemplate, renderPresentation } from "./pipeline/templateEngine";

describe("Template Engine - Layout Templates", () => {
  it("should have all expected layout templates", () => {
    const expectedLayouts = [
      "title-slide",
      "section-header",
      "text-slide",
      "two-column",
      "image-text",
      "image-fullscreen",
      "quote-slide",
      "chart-slide",
      "table-slide",
      "icons-numbers",
      "timeline",
      "process-steps",
      "comparison",
      "final-slide",
      "agenda-table-of-contents",
      "team-profiles",
      "logo-grid",
      "video-embed",
    ];

    for (const layout of expectedLayouts) {
      const template = getLayoutTemplate(layout);
      expect(template, `Template "${layout}" should exist`).toBeTruthy();
    }
  });

  it("should render text-slide with inline styles for vertical centering", () => {
    const data = {
      title: "Test Title",
      bullets: [
        { title: "Point 1", description: "Description 1" },
        { title: "Point 2", description: "Description 2" },
        { title: "Point 3", description: "Description 3" },
      ],
    };

    const html = renderSlide("text-slide", data, "");
    // Should use inline flex styles for vertical centering
    expect(html).toContain("display: flex");
    expect(html).toContain("flex-direction: column");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("Test Title");
    expect(html).toContain("Point 1");
    expect(html).toContain("Description 1");
  });

  it("should render two-column with inline styles for vertical centering", () => {
    const data = {
      title: "Two Column Test",
      leftColumn: { title: "Left", bullets: ["A", "B", "C"] },
      rightColumn: { title: "Right", bullets: ["X", "Y", "Z"] },
    };

    const html = renderSlide("two-column", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("Two Column Test");
    expect(html).toContain("Left");
    expect(html).toContain("Right");
  });

  it("should render icons-numbers with inline styles for vertical centering", () => {
    const data = {
      title: "Key Metrics",
      metrics: [
        { label: "Revenue", value: "$2.4M", description: "Annual revenue", icon: { name: "dollar-sign", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/dollar-sign.svg" } },
        { label: "Users", value: "15K", description: "Active users", icon: { name: "users", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg" } },
        { label: "Growth", value: "85%", description: "Year over year", icon: { name: "trending-up", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/trending-up.svg" } },
      ],
    };

    const html = renderSlide("icons-numbers", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("$2.4M");
    expect(html).toContain("Revenue");
  });

  it("should render comparison with inline styles for vertical centering", () => {
    const data = {
      title: "Compare",
      optionA: { title: "Option A", points: ["Pro 1", "Pro 2", "Pro 3"], color: "#22c55e" },
      optionB: { title: "Option B", points: ["Con 1", "Con 2", "Con 3"], color: "#ef4444" },
    };

    const html = renderSlide("comparison", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("Option A");
    expect(html).toContain("Option B");
  });

  it("should render section-header with centered content", () => {
    const data = {
      title: "Section Title",
      subtitle: "Section subtitle text",
    };

    const html = renderSlide("section-header", data, "");
    expect(html).toContain("justify-content: center");
    expect(html).toContain("align-items: center");
    expect(html).toContain("height: 100%");
    expect(html).toContain("Section Title");
  });

  it("should render final-slide with centered content", () => {
    const data = {
      title: "Спасибо!",
      subtitle: "Thank you for your attention",
      thankYouText: "Questions?",
    };

    const html = renderSlide("final-slide", data, "");
    expect(html).toContain("justify-content: center");
    expect(html).toContain("align-items: center");
    expect(html).toContain("height: 100%");
    expect(html).toContain("Спасибо!");
  });

  it("should render timeline with inline styles for vertical centering", () => {
    const data = {
      title: "Timeline",
      events: [
        { date: "2024", title: "Event 1", description: "Desc 1" },
        { date: "2025", title: "Event 2", description: "Desc 2" },
      ],
    };

    const html = renderSlide("timeline", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("Event 1");
  });

  it("should render process-steps with inline styles for vertical centering", () => {
    const data = {
      title: "Process",
      steps: [
        { number: 1, title: "Step 1", description: "Do this" },
        { number: 2, title: "Step 2", description: "Then this" },
        { number: 3, title: "Step 3", description: "Finally" },
      ],
    };

    const html = renderSlide("process-steps", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("align-items: center");
    expect(html).toContain("Step 1");
  });

  it("should render agenda-table-of-contents with vertical centering", () => {
    const data = {
      title: "Agenda",
      sections: [
        { number: 1, title: "Introduction", description: "Overview" },
        { number: 2, title: "Main Topic", description: "Details" },
      ],
    };

    const html = renderSlide("agenda-table-of-contents", data, "");
    expect(html).toContain("display: flex");
    expect(html).toContain("height: 100%");
    expect(html).toContain("justify-content: center");
    expect(html).toContain("Introduction");
  });

  it("should render BSPB title-slide with cathedral background and blue panel", () => {
    const data = {
      title: "Стратегия развития банка",
      description: "Подразделение IT",
      presentationDate: "15.02.2026",
      presenterName: "Иванов И.И.",
      initials: "ИИ",
    };

    const html = renderSlide("title-slide", data, "");
    // Should have BSPB-specific class
    expect(html).toContain("bspb-title-slide");
    // Should have Kazan Cathedral background photo
    expect(html).toContain("axBJgpxbruLZDqPX.jpg");
    // Should have BSPB logo
    expect(html).toContain("YgWUGGIfCqwHIQEd.png");
    // Should have red accent brush stroke
    expect(html).toContain("xPDYGlxYLgYvmYKL.png");
    // Should have blue panel
    expect(html).toContain("rgba(0,87,171,0.9)");
    // Should have white title text
    expect(html).toContain("color: #ffffff");
    // Should render title
    expect(html).toContain("Стратегия развития банка");
    // Should render description
    expect(html).toContain("Подразделение IT");
    // Should render date
    expect(html).toContain("15.02.2026");
  });

  it("should render BSPB title-slide without description when not provided", () => {
    const data = {
      title: "Только заголовок",
    };

    const html = renderSlide("title-slide", data, "");
    expect(html).toContain("bspb-title-slide");
    expect(html).toContain("Только заголовок");
    // Should not have description paragraph
    expect(html).not.toContain("rgba(255,255,255,0.9); font-family: Arial");
  });

  it("renderPresentation should wrap slides in proper containers with 1280x720", () => {
    const slides = [
      { layoutId: "text-slide", data: { title: "Slide 1", bullets: [{ title: "A", description: "B" }] }, html: "<div>Slide 1</div>" },
      { layoutId: "text-slide", data: { title: "Slide 2", bullets: [{ title: "C", description: "D" }] }, html: "<div>Slide 2</div>" },
    ];

    const result = renderPresentation(slides, ":root { --primary: #000; }", "Test Presentation", "ru");
    expect(result).toContain("width:1280px");
    expect(result).toContain("height:720px");
    expect(result).toContain("Slide 1");
    expect(result).toContain("Slide 2");
  });
});
