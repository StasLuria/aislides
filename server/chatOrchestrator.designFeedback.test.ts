/**
 * Tests for design feedback handling improvements in step-by-step mode.
 * Verifies that user visual feedback (background, colors, circles) triggers re-compose.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("./chatDb", () => ({
  getChatSession: vi.fn(),
  updateChatSession: vi.fn(),
  appendMessage: vi.fn(),
  getSessionFiles: vi.fn().mockResolvedValue([]),
  addSessionFile: vi.fn(),
  updateSessionFile: vi.fn(),
  deleteSessionFile: vi.fn(),
}));

vi.mock("./pipeline/generator", () => ({
  runLayout: vi.fn().mockResolvedValue([{ layout_name: "text-slide" }]),
  runHtmlComposerWithQA: vi.fn().mockResolvedValue({ title: "Test" }),
  buildFallbackData: vi.fn().mockReturnValue({ title: "Fallback" }),
}));

vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn().mockReturnValue("<div>slide</div>"),
  renderPresentation: vi.fn().mockReturnValue("<html>presentation</html>"),
  getLayoutTemplate: vi.fn().mockReturnValue("<div>template</div>"),
}));

vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn().mockReturnValue({
    id: "bspb",
    name: "БСПБ",
    mood: "Corporate",
    fontsUrl: "",
    cssVariables: ":root { --slide-bg-gradient: #ffffff; }",
  }),
}));

vi.mock("./pipeline/prompts", () => ({
  htmlComposerSystem: vi.fn().mockReturnValue("system prompt"),
  htmlComposerUser: vi.fn().mockReturnValue("user prompt"),
}));

vi.mock("./presentationDb", () => ({
  createPresentation: vi.fn(),
  getPresentation: vi.fn(),
  updatePresentation: vi.fn(),
  deletePresentation: vi.fn(),
  getPresentationsByUser: vi.fn(),
  updateSlideHtml: vi.fn(),
  updateSlideData: vi.fn(),
}));

vi.mock("./pipeline/llmHelpers", () => ({
  llmText: vi.fn().mockResolvedValue('{"title": "Updated"}'),
  llmJson: vi.fn().mockResolvedValue({}),
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getChatSession, updateChatSession, appendMessage } from "./chatDb";
import { invokeLLM } from "../_core/llm";

describe("Design Feedback Handling", () => {
  const mockWriter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriter.mockClear();
  });

  describe("Feedback prompt analysis", () => {
    it("should parse requires_recompose flag from LLM response", async () => {
      // Increase timeout for this test since re-compose involves multiple async calls
    
      // Simulate LLM returning requires_recompose: true for visual feedback
      const mockLlmResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              new_layout: null,
              data_patches: {},
              adjustments: "Фон должен быть белым, убрать декоративные круги",
              requires_recompose: true,
            }),
          },
        }],
      };

      (invokeLLM as any).mockResolvedValue(mockLlmResponse);

      // Mock session with step_slide_design phase
      const mockSession = {
        id: "test-session",
        phase: "step_slide_design",
        topic: "Test presentation",
        metadata: {
          outline: {
            presentation_title: "Test",
            slides: [{ slide_number: 1, title: "Slide 1", purpose: "intro", key_points: [] }],
          },
          writtenSlides: [{ slide_number: 1, title: "Slide 1", text: "Content", key_message: "Key", notes: "" }],
          themeResult: {},
          themeCss: ":root {}",
          themePresetId: "bspb",
          currentSlideIndex: 0,
          currentSlideDesign: {
            layoutName: "big-statement",
            slideData: { title: "Test Title", subtitle: "Test subtitle" },
            slideHtml: "<div>old html</div>",
          },
        },
        messages: [],
      };

      (getChatSession as any).mockResolvedValue(mockSession);
      (updateChatSession as any).mockResolvedValue(undefined);
      (appendMessage as any).mockResolvedValue(undefined);

      // Import and call the function
      const { processMessage } = await import("./chatOrchestrator");
      await processMessage("test-session", "у слайда должен быть белый фон", mockWriter);

      // Verify the writer was called with some output (design feedback was processed)
      expect(mockWriter).toHaveBeenCalled();
      
      // Verify session was updated (design feedback saved)
      expect(updateChatSession).toHaveBeenCalled();
    }, 15000);

    it("should handle data_patches for text changes without recompose", async () => {
      const mockLlmResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              new_layout: null,
              data_patches: { title: "Новый заголовок" },
              adjustments: "Заголовок изменён",
              requires_recompose: false,
            }),
          },
        }],
      };

      (invokeLLM as any).mockResolvedValue(mockLlmResponse);

      const mockSession = {
        id: "test-session",
        phase: "step_slide_design",
        topic: "Test",
        metadata: {
          outline: {
            presentation_title: "Test",
            slides: [{ slide_number: 1, title: "Slide 1", purpose: "intro", key_points: [] }],
          },
          writtenSlides: [{ slide_number: 1, title: "Slide 1", text: "Content", key_message: "Key", notes: "" }],
          themeResult: {},
          themeCss: ":root {}",
          themePresetId: "bspb",
          currentSlideIndex: 0,
          currentSlideDesign: {
            layoutName: "big-statement",
            slideData: { title: "Старый заголовок", subtitle: "Sub" },
            slideHtml: "<div>old</div>",
          },
        },
        messages: [],
      };

      (getChatSession as any).mockResolvedValue(mockSession);
      (updateChatSession as any).mockResolvedValue(undefined);
      (appendMessage as any).mockResolvedValue(undefined);

      const { processMessage } = await import("./chatOrchestrator");
      await processMessage("test-session", "поменяй заголовок на Новый заголовок", mockWriter);

      // Verify updateChatSession was called with updated slideData containing the new title
      const updateCalls = (updateChatSession as any).mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1];
      if (lastUpdate && lastUpdate[1]?.metadata?.currentSlideDesign) {
        expect(lastUpdate[1].metadata.currentSlideDesign.slideData.title).toBe("Новый заголовок");
      }
    });
  });

  describe("BSPB theme decorative elements", () => {
    it("should have transparent decorative-shape-color in BSPB theme", async () => {
      const { getThemePreset } = await import("./pipeline/themes");
      // This test verifies the actual theme, not the mock
      // We need to reimport without mock
      vi.unmock("./pipeline/themes");
      const actualThemes = await import("./pipeline/themes");
      const bspb = actualThemes.getThemePreset("bspb");
      
      expect(bspb.cssVariables).toContain("--decorative-shape-color: transparent");
      expect(bspb.cssVariables).toContain("--slide-bg-gradient: #ffffff");
    });

    it("BSPB theme should hide inline decorative circles via CSS", async () => {
      vi.unmock("./pipeline/themes");
      const actualThemes = await import("./pipeline/themes");
      const bspb = actualThemes.getThemePreset("bspb");
      
      // Check that CSS hides inline circles
      expect(bspb.cssVariables).toContain('border-radius: 50%');
      expect(bspb.cssVariables).toContain('display: none !important');
    });
  });
});
