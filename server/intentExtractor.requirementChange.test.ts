/**
 * Tests for mid-conversation requirement change detection and merging.
 * Covers: detectRequirementChange, mergeRequirements, formatChangeConfirmation, regexDetectChange
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectRequirementChange,
  mergeRequirements,
  formatChangeConfirmation,
  defaultRequirements,
  type UserRequirements,
  type RequirementChangeResult,
} from "./pipeline/intentExtractor";

// ═══════════════════════════════════════════════════════
// mergeRequirements
// ═══════════════════════════════════════════════════════

describe("mergeRequirements", () => {
  const base: UserRequirements = {
    topic: "AI в медицине",
    slideCount: 10,
    enableImages: true,
    userWillAddImages: false,
    styleHints: ["корпоративный"],
    structureHints: ["начать с проблемы"],
    audience: "руководство",
    purpose: "отчёт",
    language: "ru",
    customInstructions: [],
    topicIsClear: true,
    clarifyingQuestion: null,
    confidence: 0.9,
  };

  it("should not change anything when changes are empty", () => {
    const result = mergeRequirements(base, {});
    expect(result.slideCount).toBe(10);
    expect(result.enableImages).toBe(true);
    expect(result.audience).toBe("руководство");
  });

  it("should update slideCount when provided", () => {
    const result = mergeRequirements(base, { slideCount: 15 });
    expect(result.slideCount).toBe(15);
    expect(result.enableImages).toBe(true); // unchanged
  });

  it("should update enableImages to false", () => {
    const result = mergeRequirements(base, { enableImages: false });
    expect(result.enableImages).toBe(false);
    expect(result.slideCount).toBe(10); // unchanged
  });

  it("should update enableImages to true", () => {
    const baseNoImages = { ...base, enableImages: false as boolean | null };
    const result = mergeRequirements(baseNoImages, { enableImages: true });
    expect(result.enableImages).toBe(true);
  });

  it("should replace styleHints entirely", () => {
    const result = mergeRequirements(base, { styleHints: ["минималистичный", "тёмный"] });
    expect(result.styleHints).toEqual(["минималистичный", "тёмный"]);
  });

  it("should append structureHints", () => {
    const result = mergeRequirements(base, { structureHints: ["добавить SWOT"] });
    expect(result.structureHints).toEqual(["начать с проблемы", "добавить SWOT"]);
  });

  it("should update audience", () => {
    const result = mergeRequirements(base, { audience: "студенты" });
    expect(result.audience).toBe("студенты");
  });

  it("should update language", () => {
    const result = mergeRequirements(base, { language: "en" });
    expect(result.language).toBe("en");
  });

  it("should update userWillAddImages and enableImages together", () => {
    const result = mergeRequirements(base, { userWillAddImages: true, enableImages: false });
    expect(result.userWillAddImages).toBe(true);
    expect(result.enableImages).toBe(false);
  });

  it("should append customInstructions", () => {
    const baseWithInstr = { ...base, customInstructions: ["инструкция 1"] };
    const result = mergeRequirements(baseWithInstr, { customInstructions: ["инструкция 2"] });
    expect(result.customInstructions).toEqual(["инструкция 1", "инструкция 2"]);
  });

  it("should not overwrite with null values", () => {
    const result = mergeRequirements(base, { slideCount: null } as any);
    expect(result.slideCount).toBe(10); // unchanged
  });

  it("should handle multiple changes at once", () => {
    const result = mergeRequirements(base, {
      slideCount: 5,
      enableImages: false,
      audience: "инвесторы",
      styleHints: ["яркий"],
    });
    expect(result.slideCount).toBe(5);
    expect(result.enableImages).toBe(false);
    expect(result.audience).toBe("инвесторы");
    expect(result.styleHints).toEqual(["яркий"]);
    expect(result.purpose).toBe("отчёт"); // unchanged
  });
});

// ═══════════════════════════════════════════════════════
// formatChangeConfirmation
// ═══════════════════════════════════════════════════════

describe("formatChangeConfirmation", () => {
  it("should format a simple slide count change", () => {
    const change: RequirementChangeResult = {
      isRequirementChange: true,
      changedFields: ["slideCount"],
      changes: { slideCount: 7 },
      changeSummary: "Количество слайдов: 7",
      confidence: 0.9,
    };
    const reqs = { ...defaultRequirements("test"), slideCount: 7 };
    const msg = formatChangeConfirmation(change, reqs);
    expect(msg).toContain("обновил параметры");
    expect(msg).toContain("7");
  });

  it("should format an image toggle change", () => {
    const change: RequirementChangeResult = {
      isRequirementChange: true,
      changedFields: ["enableImages"],
      changes: { enableImages: false },
      changeSummary: "Картинки отключены",
      confidence: 0.85,
    };
    const reqs = { ...defaultRequirements("test"), enableImages: false as boolean | null };
    const msg = formatChangeConfirmation(change, reqs);
    expect(msg).toContain("обновил параметры");
    expect(msg).toContain("Картинки отключены");
  });

  it("should include updated summary", () => {
    const change: RequirementChangeResult = {
      isRequirementChange: true,
      changedFields: ["audience"],
      changes: { audience: "студенты" },
      changeSummary: "Аудитория: студенты",
      confidence: 0.9,
    };
    const reqs = { ...defaultRequirements("test"), audience: "студенты", slideCount: 5 };
    const msg = formatChangeConfirmation(change, reqs);
    expect(msg).toContain("Актуальные параметры");
    expect(msg).toContain("студенты");
  });
});

// ═══════════════════════════════════════════════════════
// detectRequirementChange (regex fallback path)
// ═══════════════════════════════════════════════════════

describe("detectRequirementChange", () => {
  const baseReqs: UserRequirements = {
    topic: "AI в медицине",
    slideCount: 10,
    enableImages: true,
    userWillAddImages: false,
    styleHints: ["корпоративный"],
    structureHints: [],
    audience: "руководство",
    purpose: "отчёт",
    language: "ru",
    customInstructions: [],
    topicIsClear: true,
    clarifyingQuestion: null,
    confidence: 0.9,
  };

  // Mock invokeLLM to test regex fallback
  vi.mock("../_core/llm", () => ({
    invokeLLM: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect 'добавь ещё 2 слайда' as a requirement change", async () => {
    const result = await detectRequirementChange("добавь ещё 2 слайда", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changedFields).toContain("slideCount");
    expect(result.changes.slideCount).toBe(12); // 10 + 2
  });

  it("should detect 'сделай 7 слайдов вместо 10' as a requirement change", async () => {
    const result = await detectRequirementChange("сделай 7 слайдов вместо 10", "step_structure", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changedFields).toContain("slideCount");
    expect(result.changes.slideCount).toBe(7);
  });

  it("should detect 'без картинок' as a requirement change", async () => {
    const result = await detectRequirementChange("без картинок пожалуйста", "mode_selection", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changedFields).toContain("enableImages");
    expect(result.changes.enableImages).toBe(false);
  });

  it("should detect 'всё-таки добавь картинки' as enabling images", async () => {
    const noImgReqs = { ...baseReqs, enableImages: false as boolean | null };
    const result = await detectRequirementChange("всё-таки добавь картинки", "step_slide_content", noImgReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changedFields).toContain("enableImages");
    expect(result.changes.enableImages).toBe(true);
  });

  it("should detect 'картинки я сам добавлю' as userWillAddImages", async () => {
    const result = await detectRequirementChange("картинки я сам добавлю потом", "mode_selection", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changedFields).toContain("userWillAddImages");
    expect(result.changes.userWillAddImages).toBe(true);
    expect(result.changes.enableImages).toBe(false);
  });

  it("should NOT detect 'поменяй заголовок' as a requirement change", async () => {
    const result = await detectRequirementChange("поменяй заголовок на Итоги", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(false);
  });

  it("should NOT detect 'готово' as a requirement change", async () => {
    const result = await detectRequirementChange("готово", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(false);
  });

  it("should NOT detect 'сделай текст короче' as a requirement change", async () => {
    const result = await detectRequirementChange("сделай текст короче", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(false);
  });

  it("should NOT detect 'добавь больше данных' as a requirement change", async () => {
    const result = await detectRequirementChange("добавь больше данных на этот слайд", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(false);
  });

  it("should NOT detect 'убери этот пункт' as a requirement change", async () => {
    const result = await detectRequirementChange("убери этот пункт", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(false);
  });

  it("should detect 'включи картинки' as enabling images", async () => {
    const noImgReqs = { ...baseReqs, enableImages: false as boolean | null };
    const result = await detectRequirementChange("включи картинки", "step_slide_design", noImgReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changes.enableImages).toBe(true);
  });

  it("should detect 'убери картинки' as disabling images", async () => {
    const result = await detectRequirementChange("убери картинки", "step_slide_design", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changes.enableImages).toBe(false);
  });

  it("should detect 'еще 3 слайда' as adding slides", async () => {
    const result = await detectRequirementChange("еще 3 слайда", "step_slide_content", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changes.slideCount).toBe(13); // 10 + 3
  });

  it("should detect 'хочу 5 слайдов' as setting slides", async () => {
    const result = await detectRequirementChange("хочу 5 слайдов", "step_structure", baseReqs);
    expect(result.isRequirementChange).toBe(true);
    expect(result.changes.slideCount).toBe(5);
  });
}, 15000);
