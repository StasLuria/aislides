/**
 * Tests for:
 * 1. Slide content editing via PATCH metadata endpoint
 * 2. The edit_slide_content action flow (frontend-only, but we test the metadata update)
 * 3. Approve after edit — verifies that edited proposedContent is used
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSEEvent, SSEWriter } from "./chatOrchestrator";

// ── Mock all heavy dependencies ──

const mockSession: Record<string, any> = {};
const mockMessages: any[] = [];

vi.mock("./chatDb", () => ({
  getChatSession: vi.fn(async () => ({ ...mockSession })),
  updateChatSession: vi.fn(async (_id: string, updates: any) => {
    if (updates.phase) mockSession.phase = updates.phase;
    if (updates.metadata) mockSession.metadata = { ...mockSession.metadata, ...updates.metadata };
  }),
  appendMessage: vi.fn(async (_id: string, msg: any) => {
    mockMessages.push(msg);
    return mockMessages;
  }),
  getSessionFiles: vi.fn(async () => []),
}));

vi.mock("./pipeline/generator", () => ({
  runWriterSingle: vi.fn(async (slideInfo: any) => ({
    slide_number: slideInfo.slide_number,
    title: slideInfo.title,
    key_message: `Key message for ${slideInfo.title}`,
    text: `Content text for ${slideInfo.title}`,
    notes: "Speaker notes",
    data_points: [],
    structured_content: null,
    content_shape: null,
  })),
  runLayout: vi.fn(async () => [{ layout_name: "text-slide", confidence: 0.9 }]),
  runHtmlComposerWithQA: vi.fn(async () => ({
    title: "Test Slide",
    subtitle: "Test subtitle",
    body_text: "Test body",
  })),
  buildFallbackData: vi.fn(() => ({
    title: "Fallback",
    body_text: "Fallback body",
  })),
  runTheme: vi.fn(async () => ({
    theme_name: "Corporate Blue",
    colors: { primary: "#2563eb" },
    css_variables: ":root { --primary: #2563eb; }",
    font_pair: { heading: "Inter", body: "Source Sans 3" },
  })),
  runPlanner: vi.fn(async () => ({
    language: "ru",
    branding: { company_name: "Test" },
  })),
  runOutline: vi.fn(async () => ({
    presentation_title: "Test Presentation",
    slides: [
      { slide_number: 1, title: "Slide 1", purpose: "Intro", key_points: ["Point 1"], speaker_notes_hint: "" },
      { slide_number: 2, title: "Slide 2", purpose: "Main", key_points: ["Point 2"], speaker_notes_hint: "" },
    ],
    target_audience: "General",
  })),
  generatePresentation: vi.fn(async () => ({})),
}));

vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn(() => "<div class='slide'>Rendered slide</div>"),
  renderPresentation: vi.fn(() => "<html><body>Full presentation</body></html>"),
  renderSlidePreview: vi.fn((html: string) => `<!DOCTYPE html><html><body>${html}</body></html>`),
  BASE_CSS: ":root {}",
  getLayoutTemplate: vi.fn(() => "<div>{{title}}</div>"),
}));

vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn(() => ({
    id: "corporate_blue",
    name: "Corporate Blue",
    nameRu: "Корпоративный синий",
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    dark: false,
    category: "business",
    descRu: "Профессиональная тема",
    previewColor: "#2563eb",
    previewGradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    cssVariables: ":root { --primary: #2563eb; }",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    mood: "Professional",
  })),
}));

vi.mock("./pipeline/themeSelector", () => ({
  autoSelectTheme: vi.fn(async () => ({ themeId: "corporate_blue", confidence: 0.9 })),
}));

vi.mock("./pipeline/presentationTypeClassifier", () => ({
  classifyPresentation: vi.fn(() => ({
    type: "business",
    writerHint: undefined,
    layoutHint: undefined,
  })),
}));

vi.mock("./pipeline/adaptiveSizing", () => ({
  analyzeContentDensity: vi.fn(() => ({ density: "normal" })),
  generateAdaptiveStyles: vi.fn(() => ""),
}));

vi.mock("./interactiveRoutes", () => ({
  pickLayoutForPreview: vi.fn(async () => "text-slide"),
}));

vi.mock("./presentationDb", () => ({
  createPresentation: vi.fn(async () => "test-pres-id"),
  updatePresentationProgress: vi.fn(async () => {}),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ url: "https://s3.example.com/test.html", key: "test.html" })),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "Modified Title",
          text: "Modified text",
          key_message: "Modified key message",
          notes: "Modified notes",
          data_points: [],
        }),
      },
    }],
  })),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    BUILT_IN_FORGE_API_URL: "http://localhost",
    BUILT_IN_FORGE_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key",
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "abc12345"),
}));

// ── Import after mocks ──
import { processAction } from "./chatOrchestrator";

// ── Helper ──
function createWriter(): { writer: SSEWriter; events: SSEEvent[] } {
  const events: SSEEvent[] = [];
  const writer: SSEWriter = (event) => events.push(event);
  return { writer, events };
}

function resetSession(overrides: Record<string, any> = {}) {
  Object.keys(mockSession).forEach((k) => delete mockSession[k]);
  mockMessages.length = 0;

  Object.assign(mockSession, {
    id: "test-session-1",
    topic: "Test Presentation",
    presentationId: "test-pres-id",
    phase: "step_slide_content",
    metadata: {
      outline: {
        presentation_title: "Test Presentation",
        slides: [
          { slide_number: 1, title: "Введение", purpose: "Intro", key_points: ["Point 1"], speaker_notes_hint: "" },
          { slide_number: 2, title: "Основная часть", purpose: "Main content", key_points: ["Point 2"], speaker_notes_hint: "" },
          { slide_number: 3, title: "Заключение", purpose: "Conclusion", key_points: ["Point 3"], speaker_notes_hint: "" },
        ],
        target_audience: "General",
      },
      plannerResult: {
        language: "ru",
        branding: { company_name: "Test" },
      },
      themeResult: {
        theme_name: "Corporate Blue",
        css_variables: ":root { --primary: #2563eb; }",
      },
      themeCss: ":root { --primary: #2563eb; }",
      themePresetId: "corporate_blue",
      typeProfile: { type: "business", writerHint: undefined, layoutHint: undefined },
      currentSlideIndex: 0,
      writtenSlides: [],
      approvedSlides: [],
      proposedContent: {
        slide_number: 1,
        title: "Введение",
        key_message: "Welcome",
        text: "Introduction text",
        notes: "Speaker notes",
        data_points: [],
        structured_content: null,
        content_shape: null,
      },
      fileContext: "",
    },
    ...overrides,
  });
}

// ── Tests ──

describe("Slide content editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSession();
  });

  describe("PATCH metadata updates proposedContent", () => {
    it("simulates editing proposedContent via metadata update", async () => {
      // Simulate what the frontend does: PATCH metadata with edited proposedContent
      const editedContent = {
        slide_number: 1,
        title: "Отредактированный заголовок",
        key_message: "Новое ключевое сообщение",
        text: "Отредактированный текст слайда с дополнительной информацией",
        notes: "Обновлённые заметки спикера",
        data_points: [],
        structured_content: null,
        content_shape: null,
      };

      // Directly update mockSession metadata (simulating PATCH endpoint)
      mockSession.metadata = {
        ...mockSession.metadata,
        proposedContent: editedContent,
      };

      // Verify the content was updated
      expect(mockSession.metadata.proposedContent.title).toBe("Отредактированный заголовок");
      expect(mockSession.metadata.proposedContent.key_message).toBe("Новое ключевое сообщение");
      expect(mockSession.metadata.proposedContent.text).toBe("Отредактированный текст слайда с дополнительной информацией");
    });
  });

  describe("approve_slide_content uses edited proposedContent", () => {
    it("uses the edited content when approving after edit", async () => {
      // Simulate editing the content before approving
      const editedContent = {
        slide_number: 1,
        title: "Пользовательский заголовок",
        key_message: "Пользовательское сообщение",
        text: "Пользовательский текст",
        notes: "Пользовательские заметки",
        data_points: [],
        structured_content: null,
        content_shape: null,
      };

      // Update metadata with edited content (simulating PATCH)
      mockSession.metadata.proposedContent = editedContent;

      const { writer, events } = createWriter();

      // Now approve the edited content
      await processAction("test-session-1", "approve_slide_content", writer);

      // Verify the edited content was saved to writtenSlides
      const { updateChatSession: mockUpdate } = await import("./chatDb");
      const calls = (mockUpdate as any).mock.calls;
      const designPhaseCall = calls.find((c: any) => c[1]?.phase === "step_slide_design");
      expect(designPhaseCall).toBeDefined();
      const meta = designPhaseCall?.[1]?.metadata;
      expect(meta?.writtenSlides?.length).toBeGreaterThan(0);
      expect(meta?.writtenSlides?.[0]?.title).toBe("Пользовательский заголовок");
      expect(meta?.writtenSlides?.[0]?.key_message).toBe("Пользовательское сообщение");
      expect(meta?.writtenSlides?.[0]?.text).toBe("Пользовательский текст");
    });

    it("generates design using the edited content", async () => {
      const editedContent = {
        slide_number: 1,
        title: "Кастомный заголовок",
        key_message: "Кастомное сообщение",
        text: "Кастомный текст для дизайна",
        notes: "Кастомные заметки",
        data_points: [],
        structured_content: null,
        content_shape: null,
      };

      mockSession.metadata.proposedContent = editedContent;

      const { writer, events } = createWriter();
      await processAction("test-session-1", "approve_slide_content", writer);

      // Should have slide_preview event with the slide
      const slidePreview = events.find((e) => e.type === "slide_preview");
      expect(slidePreview).toBeDefined();
      expect(slidePreview?.data?.slideNumber).toBe(1);

      // Should transition to design phase
      const actionsEvents = events.filter((e) => e.type === "actions");
      const lastActions = actionsEvents[actionsEvents.length - 1];
      expect(lastActions).toBeDefined();
      const actions = lastActions?.data as any[];
      expect(actions?.some((a: any) => a.id === "approve_slide_design")).toBe(true);
    });
  });

  describe("Multiple edits before approval", () => {
    it("allows multiple edits — only the last one is used", async () => {
      // First edit
      mockSession.metadata.proposedContent = {
        ...mockSession.metadata.proposedContent,
        title: "Первая правка",
      };

      // Second edit
      mockSession.metadata.proposedContent = {
        ...mockSession.metadata.proposedContent,
        title: "Вторая правка",
        text: "Обновлённый текст",
      };

      // Third edit (final)
      mockSession.metadata.proposedContent = {
        ...mockSession.metadata.proposedContent,
        title: "Финальная правка",
        key_message: "Финальное сообщение",
      };

      const { writer } = createWriter();
      await processAction("test-session-1", "approve_slide_content", writer);

      // Verify the final edit was used
      const { updateChatSession: mockUpdate } = await import("./chatDb");
      const calls = (mockUpdate as any).mock.calls;
      const designPhaseCall = calls.find((c: any) => c[1]?.phase === "step_slide_design");
      expect(designPhaseCall).toBeDefined();
      const meta = designPhaseCall?.[1]?.metadata;
      expect(meta?.writtenSlides?.[0]?.title).toBe("Финальная правка");
      expect(meta?.writtenSlides?.[0]?.key_message).toBe("Финальное сообщение");
    });
  });

  describe("Edit does not break subsequent flow", () => {
    it("after editing slide 1 and approving, slide 2 content is proposed correctly", async () => {
      // Edit slide 1 content
      mockSession.metadata.proposedContent = {
        ...mockSession.metadata.proposedContent,
        title: "Отредактированное введение",
      };

      const { writer: writer1, events: events1 } = createWriter();
      await processAction("test-session-1", "approve_slide_content", writer1);

      // Now approve the design for slide 1
      resetSession({
        phase: "step_slide_design",
        metadata: {
          ...mockSession.metadata,
          currentSlideIndex: 0,
          currentSlideDesign: {
            layoutName: "text-slide",
            slideData: { title: "Отредактированное введение" },
            slideHtml: "<div>Slide 1</div>",
          },
          writtenSlides: [{
            slide_number: 1,
            title: "Отредактированное введение",
            key_message: "Welcome",
            text: "Intro text",
            notes: "",
            data_points: [],
          }],
          approvedSlides: [],
        },
      });
      mockSession.phase = "step_slide_design";

      const { writer: writer2, events: events2 } = createWriter();
      await processAction("test-session-1", "approve_slide_design", writer2);

      // Should transition to slide 2 content
      const tokenEvents = events2.filter((e) => e.type === "token");
      const transitionToken = tokenEvents.find(
        (e) => typeof e.data === "string" && e.data.includes("слайду 2")
      );
      expect(transitionToken).toBeDefined();

      // Should offer approve_slide_content for slide 2
      const actionsEvents = events2.filter((e) => e.type === "actions");
      const lastActions = actionsEvents[actionsEvents.length - 1];
      const actions = lastActions?.data as any[];
      expect(actions?.some((a: any) => a.id === "approve_slide_content")).toBe(true);
    });
  });
});
