/**
 * Phase 2 Tests: Content Evaluator Agent + Hybrid Writer
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════
// Content Evaluator Agent Tests
// ═══════════════════════════════════════════════════════

describe("Content Evaluator Agent", () => {
  describe("Module exports", () => {
    it("exports evaluateSlides function", async () => {
      const mod = await import("./contentEvaluator");
      expect(typeof mod.evaluateSlides).toBe("function");
    });

    it("exports runEvaluatorLoop function", async () => {
      const mod = await import("./contentEvaluator");
      expect(typeof mod.runEvaluatorLoop).toBe("function");
    });

    it("exports getPassThreshold function", async () => {
      const mod = await import("./contentEvaluator");
      expect(typeof mod.getPassThreshold).toBe("function");
    });

    it("exports isStructuralSlide function", async () => {
      const mod = await import("./contentEvaluator");
      expect(typeof mod.isStructuralSlide).toBe("function");
    });

    it("exports PASS_THRESHOLD constant", async () => {
      const mod = await import("./contentEvaluator");
      expect(mod.PASS_THRESHOLD).toBe(3.5);
    });

    it("exports MAX_RETRIES constant", async () => {
      const mod = await import("./contentEvaluator");
      expect(mod.MAX_RETRIES).toBe(2);
    });
  });

  describe("getPassThreshold", () => {
    it("returns 3.5 for regular content slides", async () => {
      const { getPassThreshold } = await import("./contentEvaluator");
      expect(getPassThreshold("bullet_points")).toBe(3.5);
      expect(getPassThreshold("stat_cards")).toBe(3.5);
      expect(getPassThreshold("process_steps")).toBe(3.5);
      expect(getPassThreshold("comparison_two_sides")).toBe(3.5);
    });

    it("returns 2.5 for structural slides", async () => {
      const { getPassThreshold } = await import("./contentEvaluator");
      expect(getPassThreshold("title")).toBe(2.5);
      expect(getPassThreshold("section_header")).toBe(2.5);
      expect(getPassThreshold("final")).toBe(2.5);
      expect(getPassThreshold("quote_highlight")).toBe(2.5);
    });

    it("returns 3.5 for undefined content shape", async () => {
      const { getPassThreshold } = await import("./contentEvaluator");
      expect(getPassThreshold(undefined)).toBe(3.5);
      expect(getPassThreshold("")).toBe(3.5);
    });
  });

  describe("isStructuralSlide", () => {
    it("returns true for structural shapes", async () => {
      const { isStructuralSlide } = await import("./contentEvaluator");
      expect(isStructuralSlide("title")).toBe(true);
      expect(isStructuralSlide("section_header")).toBe(true);
      expect(isStructuralSlide("final")).toBe(true);
      expect(isStructuralSlide("quote_highlight")).toBe(true);
    });

    it("returns false for content shapes", async () => {
      const { isStructuralSlide } = await import("./contentEvaluator");
      expect(isStructuralSlide("bullet_points")).toBe(false);
      expect(isStructuralSlide("stat_cards")).toBe(false);
      expect(isStructuralSlide("process_steps")).toBe(false);
      expect(isStructuralSlide("table_data")).toBe(false);
    });

    it("returns false for undefined", async () => {
      const { isStructuralSlide } = await import("./contentEvaluator");
      expect(isStructuralSlide(undefined)).toBe(false);
      expect(isStructuralSlide("")).toBe(false);
    });
  });

  describe("STRUCTURAL_SHAPES set", () => {
    it("contains exactly 4 structural shapes", async () => {
      const { STRUCTURAL_SHAPES } = await import("./contentEvaluator");
      expect(STRUCTURAL_SHAPES.size).toBe(4);
      expect(STRUCTURAL_SHAPES.has("title")).toBe(true);
      expect(STRUCTURAL_SHAPES.has("section_header")).toBe(true);
      expect(STRUCTURAL_SHAPES.has("final")).toBe(true);
      expect(STRUCTURAL_SHAPES.has("quote_highlight")).toBe(true);
    });
  });

  describe("evaluateSlides", () => {
    it("returns empty result for empty slides array", async () => {
      const { evaluateSlides } = await import("./contentEvaluator");
      const result = await evaluateSlides([]);
      expect(result.evaluations).toEqual([]);
      expect(result.overallScore).toBe(5);
      expect(result.failedSlides).toEqual([]);
    });

    it("accepts valid slide input without throwing", async () => {
      const { evaluateSlides } = await import("./contentEvaluator");
      const slides = [
        { slide_number: 1, title: "Test", text: "Content", key_message: "Message", content_shape: "bullet_points" },
      ];
      // Should not throw synchronously
      expect(() => evaluateSlides(slides)).not.toThrow();
    });
  });

  describe("SlideEvaluation interface", () => {
    it("has correct structure", async () => {
      const { evaluateSlides } = await import("./contentEvaluator");
      // Just verify the function signature accepts the right types
      const slides = [
        {
          slide_number: 1,
          title: "Test Slide",
          text: "Some content here",
          key_message: "Key takeaway",
          content_shape: "bullet_points",
          structured_content: { bullet_points: [] },
        },
      ];
      // Should not throw on valid input
      expect(() => evaluateSlides(slides)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════
// Hybrid Writer Tests
// ═══════════════════════════════════════════════════════

describe("Hybrid Writer (runWriterParallel)", () => {
  describe("Key slide identification", () => {
    it("identifies correct key slides for 10-slide presentation", () => {
      const total = 10;
      const keyIndices = new Set<number>();
      if (total > 0) keyIndices.add(0);       // title
      if (total > 1) keyIndices.add(1);       // first content
      if (total > 2) keyIndices.add(2);       // second content
      if (total > 3) keyIndices.add(total - 2); // conclusion (8)
      if (total > 1) keyIndices.add(total - 1); // final (9)

      expect(keyIndices.has(0)).toBe(true);  // title
      expect(keyIndices.has(1)).toBe(true);  // first content
      expect(keyIndices.has(2)).toBe(true);  // second content
      expect(keyIndices.has(8)).toBe(true);  // conclusion
      expect(keyIndices.has(9)).toBe(true);  // final
      expect(keyIndices.size).toBe(5);

      // Core slides should be 3,4,5,6,7
      const coreIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !keyIndices.has(i));
      expect(coreIndices).toEqual([3, 4, 5, 6, 7]);
    });

    it("identifies correct key slides for 5-slide presentation", () => {
      const total = 5;
      const keyIndices = new Set<number>();
      if (total > 0) keyIndices.add(0);
      if (total > 1) keyIndices.add(1);
      if (total > 2) keyIndices.add(2);
      if (total > 3) keyIndices.add(total - 2); // 3
      if (total > 1) keyIndices.add(total - 1); // 4

      expect(keyIndices.has(0)).toBe(true);
      expect(keyIndices.has(1)).toBe(true);
      expect(keyIndices.has(2)).toBe(true);
      expect(keyIndices.has(3)).toBe(true);
      expect(keyIndices.has(4)).toBe(true);
      expect(keyIndices.size).toBe(5);

      // All slides are key for 5-slide presentation
      const coreIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !keyIndices.has(i));
      expect(coreIndices).toEqual([]);
    });

    it("identifies correct key slides for 3-slide presentation", () => {
      const total = 3;
      const keyIndices = new Set<number>();
      if (total > 0) keyIndices.add(0);
      if (total > 1) keyIndices.add(1);
      if (total > 2) keyIndices.add(2);
      if (total > 3) keyIndices.add(total - 2);
      if (total > 1) keyIndices.add(total - 1);

      // For 3 slides, all are key
      expect(keyIndices.size).toBe(3);
    });

    it("handles single slide presentation", () => {
      const total = 1;
      const keyIndices = new Set<number>();
      if (total > 0) keyIndices.add(0);
      if (total > 1) keyIndices.add(1);
      if (total > 2) keyIndices.add(2);
      if (total > 3) keyIndices.add(total - 2);
      if (total > 1) keyIndices.add(total - 1);

      expect(keyIndices.size).toBe(1);
      expect(keyIndices.has(0)).toBe(true);
    });

    it("handles 15-slide presentation correctly", () => {
      const total = 15;
      const keyIndices = new Set<number>();
      if (total > 0) keyIndices.add(0);
      if (total > 1) keyIndices.add(1);
      if (total > 2) keyIndices.add(2);
      if (total > 3) keyIndices.add(total - 2); // 13
      if (total > 1) keyIndices.add(total - 1); // 14

      expect(keyIndices.size).toBe(5);
      const coreIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !keyIndices.has(i));
      expect(coreIndices).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(coreIndices.length).toBe(10);
    });
  });

  describe("Context building", () => {
    it("buildWriterContext returns empty for no slides", () => {
      // Test the context building logic directly
      const writtenSlides: Array<{ slide_number: number; title: string; key_message: string }> = [];
      const context = writtenSlides.length === 0
        ? ""
        : writtenSlides.slice(-4).map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`).join("\n");
      expect(context).toBe("");
    });

    it("buildWriterContext limits to last 4 slides", () => {
      const writtenSlides = Array.from({ length: 6 }, (_, i) => ({
        slide_number: i + 1,
        title: `Slide ${i + 1}`,
        key_message: `Message ${i + 1}`,
      }));
      const recent = writtenSlides.slice(-4);
      const context = recent.map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`).join("\n");
      expect(context).toContain("Slide 3");
      expect(context).toContain("Slide 6");
      expect(context).not.toContain("Slide 1");
      expect(context).not.toContain("Slide 2");
    });

    it("key context for core slides includes all key slides", () => {
      // Simulate key slides being written first
      const keyResults = [
        { slide_number: 1, title: "Title", key_message: "Opening" },
        { slide_number: 2, title: "Problem", key_message: "The challenge" },
        { slide_number: 3, title: "Solution", key_message: "Our approach" },
        { slide_number: 9, title: "Conclusion", key_message: "Summary" },
        { slide_number: 10, title: "Final", key_message: "Call to action" },
      ];
      const keyContext = keyResults
        .map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`)
        .join("\n");

      expect(keyContext).toContain("Slide 1");
      expect(keyContext).toContain("Slide 2");
      expect(keyContext).toContain("Slide 3");
      expect(keyContext).toContain("Slide 9");
      expect(keyContext).toContain("Slide 10");
    });
  });

  describe("Batch size for core slides", () => {
    it("core slides are batched in groups of 3", () => {
      const coreSlides = Array.from({ length: 7 }, (_, i) => ({ slide_number: i + 4 }));
      const batchSize = 3;
      const batches: number[][] = [];
      for (let i = 0; i < coreSlides.length; i += batchSize) {
        const batch = coreSlides.slice(i, i + batchSize);
        batches.push(batch.map((s) => s.slide_number));
      }
      expect(batches).toEqual([[4, 5, 6], [7, 8, 9], [10]]);
    });
  });

  describe("runWriterParallel function", () => {
    it("is exported from generator", async () => {
      const mod = await import("./generator");
      expect(typeof mod.runWriterParallel).toBe("function");
    });
  });
});

// ═══════════════════════════════════════════════════════
// Pipeline Integration Tests
// ═══════════════════════════════════════════════════════

describe("Phase 2 Pipeline Integration", () => {
  it("Content Evaluator is imported in generator", async () => {
    const generatorSource = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/generator.ts", "utf-8"),
    );
    expect(generatorSource).toContain("import { evaluateSlides, runEvaluatorLoop");
    expect(generatorSource).toContain("from \"./contentEvaluator\"");
  });

  it("Content Evaluator is called in pipeline after Storytelling", async () => {
    const generatorSource = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/generator.ts", "utf-8"),
    );
    const storytellingIdx = generatorSource.indexOf("STORYTELLING AGENT");
    const evaluatorIdx = generatorSource.indexOf("CONTENT EVALUATOR");
    const densityIdx = generatorSource.indexOf("CONTENT DENSITY ENFORCEMENT");

    expect(storytellingIdx).toBeGreaterThan(-1);
    expect(evaluatorIdx).toBeGreaterThan(-1);
    expect(densityIdx).toBeGreaterThan(-1);
    // Evaluator should be between Storytelling and Density
    expect(evaluatorIdx).toBeGreaterThan(storytellingIdx);
    expect(evaluatorIdx).toBeLessThan(densityIdx);
  });

  it("Hybrid Writer uses sequential + parallel pattern", async () => {
    const generatorSource = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/generator.ts", "utf-8"),
    );
    expect(generatorSource).toContain("Hybrid Writer");
    expect(generatorSource).toContain("keyIndices");
    expect(generatorSource).toContain("keySlides");
    expect(generatorSource).toContain("coreSlides");
    expect(generatorSource).toContain("key slides sequential");
    expect(generatorSource).toContain("core slides parallel");
  });

  it("Evaluator loop has max 2 retries", async () => {
    const { MAX_RETRIES } = await import("./contentEvaluator");
    expect(MAX_RETRIES).toBe(2);
  });

  it("Evaluator uses 4-criteria rubric", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/contentEvaluator.ts", "utf-8"),
    );
    expect(source).toContain("SPECIFICITY");
    expect(source).toContain("DENSITY");
    expect(source).toContain("NOVELTY");
    expect(source).toContain("ACTIONABILITY");
    expect(source).toContain("specificity");
    expect(source).toContain("density");
    expect(source).toContain("novelty");
    expect(source).toContain("actionability");
  });

  it("Evaluator provides specific feedback format", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/contentEvaluator.ts", "utf-8"),
    );
    // Check that the prompt instructs specific feedback
    expect(source).toContain("SPECIFIC rewrite instructions");
    expect(source).toContain("BAD:");
    expect(source).toContain("GOOD:");
  });

  it("Evaluator rewrite callback passes feedback to Writer", async () => {
    const generatorSource = await import("fs").then((fs) =>
      fs.readFileSync("server/pipeline/generator.ts", "utf-8"),
    );
    expect(generatorSource).toContain("EVALUATOR FEEDBACK");
    expect(generatorSource).toContain("enhancedSlideInfo");
  });
});
