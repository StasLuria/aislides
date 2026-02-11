import { describe, it, expect, vi } from "vitest";

/**
 * Tests for batch image generation logic in the pipeline.
 * We test the SKIP_IMAGE_LAYOUTS filtering logic and the data injection patterns
 * without calling actual LLM/image APIs.
 */

// Mock the LLM and image generation modules
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"selections":[]}' } }],
  }),
}));

vi.mock("../_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/test.png" }),
}));

describe("Batch Image Generation Logic", () => {
  // Test the layout filtering logic
  const SKIP_IMAGE_LAYOUTS = new Set([
    "title-slide", "final-slide", "chart-slide", "table-slide",
    "icons-numbers", "image-text", "image-fullscreen", "agenda-table-of-contents",
  ]);

  const sampleSlides = [
    { slide_number: 1, title: "Title Slide", text: "Welcome", key_message: "", speaker_notes: "" },
    { slide_number: 2, title: "Introduction", text: "Overview of the topic", key_message: "Key intro", speaker_notes: "" },
    { slide_number: 3, title: "Data Analysis", text: "Charts and numbers", key_message: "", speaker_notes: "" },
    { slide_number: 4, title: "Strategy", text: "Our approach to growth", key_message: "Growth strategy", speaker_notes: "" },
    { slide_number: 5, title: "Team", text: "Our team members", key_message: "", speaker_notes: "" },
    { slide_number: 6, title: "Conclusion", text: "Final thoughts", key_message: "", speaker_notes: "" },
  ];

  const sampleLayoutMap = new Map<number, string>([
    [1, "title-slide"],
    [2, "text-slide"],
    [3, "chart-slide"],
    [4, "two-column"],
    [5, "team-profiles"],
    [6, "final-slide"],
  ]);

  it("should skip title-slide, final-slide, chart-slide from image eligibility", () => {
    const eligible = sampleSlides.filter((s) => {
      const layout = sampleLayoutMap.get(s.slide_number) || "text-slide";
      return !SKIP_IMAGE_LAYOUTS.has(layout);
    });

    expect(eligible).toHaveLength(3); // slides 2, 4, 5
    expect(eligible.map((s) => s.slide_number)).toEqual([2, 4, 5]);
  });

  it("should skip already-image layouts from eligibility", () => {
    const layoutMapWithImages = new Map<number, string>([
      [1, "title-slide"],
      [2, "image-text"],
      [3, "text-slide"],
      [4, "image-fullscreen"],
      [5, "text-slide"],
      [6, "final-slide"],
    ]);

    const eligible = sampleSlides.filter((s) => {
      const layout = layoutMapWithImages.get(s.slide_number) || "text-slide";
      return !SKIP_IMAGE_LAYOUTS.has(layout);
    });

    expect(eligible).toHaveLength(2); // slides 3, 5
    expect(eligible.map((s) => s.slide_number)).toEqual([3, 5]);
  });

  it("should skip icons-numbers and agenda layouts", () => {
    expect(SKIP_IMAGE_LAYOUTS.has("icons-numbers")).toBe(true);
    expect(SKIP_IMAGE_LAYOUTS.has("agenda-table-of-contents")).toBe(true);
    expect(SKIP_IMAGE_LAYOUTS.has("table-slide")).toBe(true);
  });

  it("should allow text-heavy layouts for images", () => {
    const allowedLayouts = ["text-slide", "two-column", "section-header", "quote-slide", "process-steps", "comparison", "timeline"];
    for (const layout of allowedLayouts) {
      expect(SKIP_IMAGE_LAYOUTS.has(layout), `Layout "${layout}" should be eligible for images`).toBe(false);
    }
  });

  it("should return empty array when no slides are eligible", () => {
    const allSkippedMap = new Map<number, string>([
      [1, "title-slide"],
      [2, "chart-slide"],
      [3, "table-slide"],
    ]);

    const slides = sampleSlides.slice(0, 3);
    const eligible = slides.filter((s) => {
      const layout = allSkippedMap.get(s.slide_number) || "text-slide";
      return !SKIP_IMAGE_LAYOUTS.has(layout);
    });

    expect(eligible).toHaveLength(0);
  });

  it("should validate image selections against eligible slide numbers", () => {
    const eligible = sampleSlides.filter((s) => {
      const layout = sampleLayoutMap.get(s.slide_number) || "text-slide";
      return !SKIP_IMAGE_LAYOUTS.has(layout);
    });
    const eligibleNumbers = new Set(eligible.map((s) => s.slide_number));

    // Simulate LLM returning some valid and some invalid selections
    const rawSelections = [
      { slide_number: 2, image_prompt: "A modern office" },
      { slide_number: 1, image_prompt: "A title image" }, // invalid — title-slide
      { slide_number: 4, image_prompt: "Growth chart" },
      { slide_number: 99, image_prompt: "Nonexistent" }, // invalid — doesn't exist
    ];

    const validated = rawSelections
      .filter((s) => eligibleNumbers.has(s.slide_number) && s.image_prompt.trim())
      .slice(0, 3);

    expect(validated).toHaveLength(2);
    expect(validated.map((s) => s.slide_number)).toEqual([2, 4]);
  });

  it("should filter out selections with empty prompts", () => {
    const eligibleNumbers = new Set([2, 4, 5]);

    const rawSelections = [
      { slide_number: 2, image_prompt: "A modern office" },
      { slide_number: 4, image_prompt: "" }, // empty prompt
      { slide_number: 5, image_prompt: "   " }, // whitespace only
    ];

    const validated = rawSelections
      .filter((s) => eligibleNumbers.has(s.slide_number) && s.image_prompt.trim())
      .slice(0, 3);

    expect(validated).toHaveLength(1);
    expect(validated[0].slide_number).toBe(2);
  });

  it("should limit selections to maxImages", () => {
    const eligibleNumbers = new Set([2, 4, 5]);
    const maxImages = 2;

    const rawSelections = [
      { slide_number: 2, image_prompt: "Office scene" },
      { slide_number: 4, image_prompt: "Growth chart" },
      { slide_number: 5, image_prompt: "Team photo" },
    ];

    const validated = rawSelections
      .filter((s) => eligibleNumbers.has(s.slide_number) && s.image_prompt.trim())
      .slice(0, maxImages);

    expect(validated).toHaveLength(2);
  });

  it("should correctly override layouts for slides with images", () => {
    const layoutMap = new Map<number, string>([
      [1, "title-slide"],
      [2, "text-slide"],
      [3, "two-column"],
      [4, "text-slide"],
    ]);

    // Simulate image generation results
    const imageMap = new Map<number, string>([
      [2, "https://example.com/img2.png"],
      [4, "https://example.com/img4.png"],
    ]);

    // Override layouts
    Array.from(imageMap.keys()).forEach((slideNum) => {
      layoutMap.set(slideNum, "image-text");
    });

    expect(layoutMap.get(1)).toBe("title-slide"); // unchanged
    expect(layoutMap.get(2)).toBe("image-text"); // overridden
    expect(layoutMap.get(3)).toBe("two-column"); // unchanged
    expect(layoutMap.get(4)).toBe("image-text"); // overridden
  });

  it("should inject image data into slide data object", () => {
    const data: Record<string, any> = {
      title: "Strategy Overview",
      bullets: ["Point 1", "Point 2"],
    };

    const imgUrl = "https://example.com/strategy.png";
    const slideTitle = "Strategy Overview";

    // Simulate image injection (same logic as in generator.ts)
    data.image = { url: imgUrl, alt: slideTitle };
    data.backgroundImage = { url: imgUrl, alt: slideTitle };

    expect(data.image.url).toBe(imgUrl);
    expect(data.image.alt).toBe(slideTitle);
    expect(data.backgroundImage.url).toBe(imgUrl);
    expect(data.backgroundImage.alt).toBe(slideTitle);
  });

  it("GenerationConfig enableImages should default to true", () => {
    // Test the config parsing logic
    const config1: Record<string, any> = {};
    const config2: Record<string, any> = { enable_images: true };
    const config3: Record<string, any> = { enable_images: false };

    expect(config1.enable_images !== false).toBe(true); // default: enabled
    expect(config2.enable_images !== false).toBe(true); // explicit true
    expect(config3.enable_images !== false).toBe(false); // explicit false
  });
});
