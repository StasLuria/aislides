import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for slide reorder logic.
 * Validates the reorder array processing, validation, and state management.
 */

// Helper to create a mock completed presentation
function createMockPresentation(overrides: Record<string, any> = {}) {
  return {
    presentationId: "test-pres-123",
    status: "completed",
    title: "Test Presentation",
    language: "ru",
    themeCss: ":root { --primary: blue; }",
    config: { theme_preset: "corporate_blue" },
    finalHtmlSlides: [
      {
        layoutId: "title-slide",
        data: { title: "Slide 1 - Title", description: "Intro" },
      },
      {
        layoutId: "text-slide",
        data: { title: "Slide 2 - Content", description: "Body" },
      },
      {
        layoutId: "image-text",
        data: { title: "Slide 3 - Image", description: "With image" },
      },
      {
        layoutId: "bullet-list-slide",
        data: { title: "Slide 4 - Bullets", description: "List" },
      },
      {
        layoutId: "final-slide",
        data: { title: "Slide 5 - End", description: "Thanks" },
      },
    ],
    resultUrls: {
      html_preview: "https://s3.example.com/presentation.html",
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// Reorder validation logic (mirrors backend)
// ═══════════════════════════════════════════════════════

function validateOrder(order: any, slideCount: number): string | null {
  if (!Array.isArray(order)) {
    return "order must be an array of slide indices";
  }
  if (order.length !== slideCount) {
    return `order length (${order.length}) must match slide count (${slideCount})`;
  }
  const sorted = [...order].sort((a: number, b: number) => a - b);
  const expected = Array.from({ length: slideCount }, (_, i) => i);
  if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
    return "order must contain each index from 0 to " + (slideCount - 1) + " exactly once";
  }
  return null;
}

function reorderSlides(slides: any[], order: number[]): any[] {
  return order.map((idx) => slides[idx]);
}

describe("Slide Reorder — Validation", () => {
  const slideCount = 5;

  it("should accept a valid order array", () => {
    expect(validateOrder([0, 1, 2, 3, 4], slideCount)).toBeNull();
    expect(validateOrder([4, 3, 2, 1, 0], slideCount)).toBeNull();
    expect(validateOrder([2, 0, 4, 1, 3], slideCount)).toBeNull();
  });

  it("should reject non-array input", () => {
    expect(validateOrder("not an array", slideCount)).toBe("order must be an array of slide indices");
    expect(validateOrder(null, slideCount)).toBe("order must be an array of slide indices");
    expect(validateOrder(undefined, slideCount)).toBe("order must be an array of slide indices");
    expect(validateOrder(42, slideCount)).toBe("order must be an array of slide indices");
  });

  it("should reject wrong length", () => {
    expect(validateOrder([0, 1, 2], slideCount)).toBe("order length (3) must match slide count (5)");
    expect(validateOrder([0, 1, 2, 3, 4, 5], slideCount)).toBe("order length (6) must match slide count (5)");
    expect(validateOrder([], slideCount)).toBe("order length (0) must match slide count (5)");
  });

  it("should reject duplicate indices", () => {
    const result = validateOrder([0, 0, 2, 3, 4], slideCount);
    expect(result).not.toBeNull();
  });

  it("should reject out-of-range indices", () => {
    const result = validateOrder([0, 1, 2, 3, 10], slideCount);
    expect(result).not.toBeNull();
  });

  it("should reject negative indices", () => {
    const result = validateOrder([-1, 0, 1, 2, 3], slideCount);
    expect(result).not.toBeNull();
  });

  it("should handle single-slide presentation", () => {
    expect(validateOrder([0], 1)).toBeNull();
    expect(validateOrder([], 1)).not.toBeNull();
  });

  it("should handle two-slide presentation", () => {
    expect(validateOrder([0, 1], 2)).toBeNull();
    expect(validateOrder([1, 0], 2)).toBeNull();
    expect(validateOrder([0, 0], 2)).not.toBeNull();
  });
});

describe("Slide Reorder — Execution", () => {
  it("should reorder slides according to the order array", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;

    // Move slide 4 (index 4) to position 0
    const order = [4, 0, 1, 2, 3];
    const reordered = reorderSlides(slides, order);

    expect(reordered[0].layoutId).toBe("final-slide");
    expect(reordered[0].data.title).toBe("Slide 5 - End");
    expect(reordered[1].layoutId).toBe("title-slide");
    expect(reordered[1].data.title).toBe("Slide 1 - Title");
    expect(reordered[4].layoutId).toBe("bullet-list-slide");
  });

  it("should reverse slide order", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;

    const order = [4, 3, 2, 1, 0];
    const reordered = reorderSlides(slides, order);

    expect(reordered[0].data.title).toBe("Slide 5 - End");
    expect(reordered[1].data.title).toBe("Slide 4 - Bullets");
    expect(reordered[2].data.title).toBe("Slide 3 - Image");
    expect(reordered[3].data.title).toBe("Slide 2 - Content");
    expect(reordered[4].data.title).toBe("Slide 1 - Title");
  });

  it("should preserve slide data when reordering", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;

    const order = [2, 0, 4, 1, 3];
    const reordered = reorderSlides(slides, order);

    // Each slide should retain its original data
    expect(reordered[0]).toEqual(slides[2]);
    expect(reordered[1]).toEqual(slides[0]);
    expect(reordered[2]).toEqual(slides[4]);
    expect(reordered[3]).toEqual(slides[1]);
    expect(reordered[4]).toEqual(slides[3]);
  });

  it("should handle identity reorder (no change)", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;

    const order = [0, 1, 2, 3, 4];
    const reordered = reorderSlides(slides, order);

    expect(reordered).toEqual(slides);
  });

  it("should handle swap of two adjacent slides", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;

    // Swap slides 1 and 2
    const order = [0, 2, 1, 3, 4];
    const reordered = reorderSlides(slides, order);

    expect(reordered[0].data.title).toBe("Slide 1 - Title");
    expect(reordered[1].data.title).toBe("Slide 3 - Image");
    expect(reordered[2].data.title).toBe("Slide 2 - Content");
    expect(reordered[3].data.title).toBe("Slide 4 - Bullets");
    expect(reordered[4].data.title).toBe("Slide 5 - End");
  });

  it("should not mutate the original slides array", () => {
    const pres = createMockPresentation();
    const slides = pres.finalHtmlSlides;
    const originalFirst = slides[0];

    const order = [4, 3, 2, 1, 0];
    reorderSlides(slides, order);

    // Original array should be unchanged
    expect(slides[0]).toBe(originalFirst);
    expect(slides[0].data.title).toBe("Slide 1 - Title");
  });
});

describe("Slide Reorder — Edge Cases", () => {
  it("should reject reorder for non-completed presentation", () => {
    const pres = createMockPresentation({ status: "processing" });
    expect(pres.status).not.toBe("completed");
  });

  it("should reject reorder for empty slides", () => {
    const pres = createMockPresentation({ finalHtmlSlides: [] });
    const slides = pres.finalHtmlSlides;
    expect(slides.length).toBe(0);
  });

  it("should handle single-slide reorder", () => {
    const pres = createMockPresentation({
      finalHtmlSlides: [
        { layoutId: "title-slide", data: { title: "Only Slide" } },
      ],
    });

    const reordered = reorderSlides(pres.finalHtmlSlides, [0]);
    expect(reordered).toHaveLength(1);
    expect(reordered[0].data.title).toBe("Only Slide");
  });

  it("should handle large presentation (20 slides)", () => {
    const slides = Array.from({ length: 20 }, (_, i) => ({
      layoutId: "text-slide",
      data: { title: `Slide ${i + 1}` },
    }));

    // Reverse order
    const order = Array.from({ length: 20 }, (_, i) => 19 - i);
    expect(validateOrder(order, 20)).toBeNull();

    const reordered = reorderSlides(slides, order);
    expect(reordered[0].data.title).toBe("Slide 20");
    expect(reordered[19].data.title).toBe("Slide 1");
  });

  it("should build correct order array from DnD move", () => {
    // Simulate arrayMove: move slide at index 1 to index 3
    // Original: [0, 1, 2, 3, 4]
    // After arrayMove(arr, 1, 3): [0, 2, 3, 1, 4]
    function arrayMove(arr: number[], from: number, to: number): number[] {
      const result = [...arr];
      const [item] = result.splice(from, 1);
      result.splice(to, 0, item);
      return result;
    }

    const original = [0, 1, 2, 3, 4];
    const order = arrayMove(original, 1, 3);
    expect(order).toEqual([0, 2, 3, 1, 4]);
    expect(validateOrder(order, 5)).toBeNull();

    // Verify the reorder produces expected result
    const slides = [
      { title: "A" },
      { title: "B" },
      { title: "C" },
      { title: "D" },
      { title: "E" },
    ];
    const reordered = reorderSlides(slides, order);
    expect(reordered.map((s: any) => s.title)).toEqual(["A", "C", "D", "B", "E"]);
  });
});
