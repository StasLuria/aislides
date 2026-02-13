import { describe, expect, it } from "vitest";

/**
 * Test the keyboard navigation logic extracted from Viewer.tsx.
 * Since the actual component uses React hooks (useCallback, useState),
 * we test the pure navigation logic that determines the next slide index
 * and the transition direction based on key presses.
 */

type NavigationResult = {
  nextSlide: number;
  transition: string;
  prevented: boolean;
};

/**
 * Pure function that mirrors the keyboard navigation logic in Viewer.tsx
 */
function handleKeyNavigation(
  key: string,
  currentSlide: number,
  totalSlides: number,
  isEditing: boolean,
  isFullscreen: boolean,
  targetTag: string = "DIV",
  isContentEditable: boolean = false,
): NavigationResult | null {
  // Don't capture keys when editing text
  if (targetTag === "INPUT" || targetTag === "TEXTAREA" || isContentEditable) {
    return null;
  }

  if (key === "ArrowRight" || key === " " || key === "ArrowDown") {
    const next = Math.min(currentSlide + 1, totalSlides - 1);
    return {
      nextSlide: next,
      transition: next !== currentSlide ? "slide-left" : "",
      prevented: true,
    };
  } else if (key === "ArrowLeft" || key === "ArrowUp") {
    const next = Math.max(currentSlide - 1, 0);
    return {
      nextSlide: next,
      transition: next !== currentSlide ? "slide-right" : "",
      prevented: true,
    };
  }

  return null;
}

describe("Viewer keyboard navigation", () => {
  describe("ArrowDown navigates to next slide", () => {
    it("moves forward from slide 0", () => {
      const result = handleKeyNavigation("ArrowDown", 0, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(1);
      expect(result!.transition).toBe("slide-left");
      expect(result!.prevented).toBe(true);
    });

    it("does not exceed last slide", () => {
      const result = handleKeyNavigation("ArrowDown", 9, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(9);
      expect(result!.transition).toBe("");
    });
  });

  describe("ArrowUp navigates to previous slide", () => {
    it("moves backward from slide 5", () => {
      const result = handleKeyNavigation("ArrowUp", 5, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(4);
      expect(result!.transition).toBe("slide-right");
      expect(result!.prevented).toBe(true);
    });

    it("does not go below slide 0", () => {
      const result = handleKeyNavigation("ArrowUp", 0, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(0);
      expect(result!.transition).toBe("");
    });
  });

  describe("ArrowRight navigates to next slide", () => {
    it("moves forward from slide 3", () => {
      const result = handleKeyNavigation("ArrowRight", 3, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(4);
      expect(result!.transition).toBe("slide-left");
    });
  });

  describe("ArrowLeft navigates to previous slide", () => {
    it("moves backward from slide 3", () => {
      const result = handleKeyNavigation("ArrowLeft", 3, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(2);
      expect(result!.transition).toBe("slide-right");
    });
  });

  describe("Space navigates to next slide", () => {
    it("moves forward from slide 0", () => {
      const result = handleKeyNavigation(" ", 0, 10, false, false);
      expect(result).not.toBeNull();
      expect(result!.nextSlide).toBe(1);
      expect(result!.transition).toBe("slide-left");
    });
  });

  describe("ignores keys when editing text", () => {
    it("ignores ArrowDown in INPUT", () => {
      const result = handleKeyNavigation("ArrowDown", 0, 10, false, false, "INPUT");
      expect(result).toBeNull();
    });

    it("ignores ArrowUp in TEXTAREA", () => {
      const result = handleKeyNavigation("ArrowUp", 5, 10, false, false, "TEXTAREA");
      expect(result).toBeNull();
    });

    it("ignores ArrowDown in contentEditable", () => {
      const result = handleKeyNavigation("ArrowDown", 0, 10, false, false, "DIV", true);
      expect(result).toBeNull();
    });
  });

  describe("boundary conditions", () => {
    it("handles single slide presentation", () => {
      const resultDown = handleKeyNavigation("ArrowDown", 0, 1, false, false);
      expect(resultDown!.nextSlide).toBe(0);
      expect(resultDown!.transition).toBe("");

      const resultUp = handleKeyNavigation("ArrowUp", 0, 1, false, false);
      expect(resultUp!.nextSlide).toBe(0);
      expect(resultUp!.transition).toBe("");
    });

    it("handles middle of presentation", () => {
      const result = handleKeyNavigation("ArrowDown", 5, 10, false, false);
      expect(result!.nextSlide).toBe(6);
    });
  });
});
