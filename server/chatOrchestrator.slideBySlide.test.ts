/**
 * Tests for the slide-by-slide (step-by-step) workflow in chatOrchestrator.
 *
 * These tests verify:
 * 1. processAction("approve_slide_content") transitions from content → design phase
 * 2. processAction("approve_slide_design") transitions to next slide or finalization
 * 3. processMessage in step_slide_content phase handles text as edit feedback
 * 4. processMessage in step_slide_design phase handles text as design feedback
 * 5. handleAddNewSlide flow (via "готово + ещё слайд" pattern)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSEEvent, SSEWriter } from "./chatOrchestrator";

// ── Mock all heavy dependencies ──

// Mock chatDb
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

// Mock pipeline/generator
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

// Mock templateEngine
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn(() => "<div class='slide'>Rendered slide</div>"),
  renderPresentation: vi.fn(() => "<html><body>Full presentation</body></html>"),
  renderSlidePreview: vi.fn((html: string) => `<!DOCTYPE html><html><body>${html}</body></html>`),
  BASE_CSS: ":root {}",
  getLayoutTemplate: vi.fn(() => "<div>{{title}}</div>"),
}));

// Mock themes
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

// Mock themeSelector
vi.mock("./pipeline/themeSelector", () => ({
  autoSelectTheme: vi.fn(async () => ({ themeId: "corporate_blue", confidence: 0.9 })),
}));

// Mock presentationTypeClassifier
vi.mock("./pipeline/presentationTypeClassifier", () => ({
  classifyPresentation: vi.fn(() => ({
    type: "business",
    writerHint: undefined,
    layoutHint: undefined,
  })),
}));

// Mock adaptiveSizing
vi.mock("./pipeline/adaptiveSizing", () => ({
  analyzeContentDensity: vi.fn(() => ({ density: "normal" })),
  generateAdaptiveStyles: vi.fn(() => ""),
}));

// Mock interactiveRoutes
vi.mock("./interactiveRoutes", () => ({
  pickLayoutForPreview: vi.fn(async () => "text-slide"),
}));

// Mock presentationDb
vi.mock("./presentationDb", () => ({
  createPresentation: vi.fn(async () => "test-pres-id"),
  updatePresentationProgress: vi.fn(async () => {}),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ url: "https://s3.example.com/test.html", key: "test.html" })),
}));

// Mock LLM
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

// Mock _core/env
vi.mock("./_core/env", () => ({
  ENV: {
    BUILT_IN_FORGE_API_URL: "http://localhost",
    BUILT_IN_FORGE_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key",
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "abc12345"),
}));

// ── Import after mocks ──
import { processAction, processMessage } from "./chatOrchestrator";

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

describe("Slide-by-slide workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSession();
  });

  describe("processAction: approve_slide_content", () => {
    it("transitions from step_slide_content to step_slide_design and generates design", async () => {
      const { writer, events } = createWriter();

      await processAction("test-session-1", "approve_slide_content", writer);

      // Should have a user message appended
      expect(mockMessages.some((m) => m.content === "✅ Контент утверждён")).toBe(true);

      // Should have slide_preview event
      const slidePreview = events.find((e) => e.type === "slide_preview");
      expect(slidePreview).toBeDefined();
      expect(slidePreview?.data?.slideNumber).toBe(1);

      // Should have actions for design approval
      const actionsEvent = events.find((e) => e.type === "actions");
      expect(actionsEvent).toBeDefined();
      const actions = actionsEvent?.data as any[];
      expect(actions?.some((a: any) => a.id === "approve_slide_design")).toBe(true);

      // Should have done event
      expect(events.some((e) => e.type === "done")).toBe(true);
    });

    it("saves proposed content to writtenSlides", async () => {
      const { writer } = createWriter();

      await processAction("test-session-1", "approve_slide_content", writer);

      // Check that updateChatSession was called with writtenSlides containing the approved content
      const { updateChatSession: mockUpdate } = await import("./chatDb");
      const calls = (mockUpdate as any).mock.calls;
      const designPhaseCall = calls.find((c: any) => c[1]?.phase === "step_slide_design");
      expect(designPhaseCall).toBeDefined();
      const meta = designPhaseCall?.[1]?.metadata;
      expect(meta?.writtenSlides?.length).toBeGreaterThan(0);
      expect(meta?.writtenSlides?.[0]?.title).toBe("Введение");
    });
  });

  describe("processAction: approve_slide_design", () => {
    it("moves to next slide content when not the last slide", async () => {
      // Set up: slide 1 design is ready, 2 more slides to go
      resetSession({
        phase: "step_slide_design",
        metadata: {
          ...mockSession.metadata,
          currentSlideIndex: 0,
          currentSlideDesign: {
            layoutName: "text-slide",
            slideData: { title: "Введение" },
            slideHtml: "<div>Slide 1</div>",
          },
          writtenSlides: [{
            slide_number: 1,
            title: "Введение",
            key_message: "Welcome",
            text: "Intro text",
            notes: "",
            data_points: [],
          }],
          approvedSlides: [],
        },
      });
      mockSession.phase = "step_slide_design";

      const { writer, events } = createWriter();

      await processAction("test-session-1", "approve_slide_design", writer);

      // Should have a user message appended
      expect(mockMessages.some((m) => m.content === "✅ Дизайн утверждён")).toBe(true);

      // Should mention moving to next slide
      const tokenEvents = events.filter((e) => e.type === "token");
      const transitionToken = tokenEvents.find((e) => typeof e.data === "string" && e.data.includes("слайду 2"));
      expect(transitionToken).toBeDefined();
    });

    it("finalizes presentation when last slide is approved", async () => {
      // Set up: last slide (3 of 3) design is ready
      resetSession({
        phase: "step_slide_design",
        metadata: {
          ...mockSession.metadata,
          currentSlideIndex: 2, // last slide (index 2 of 3)
          currentSlideDesign: {
            layoutName: "text-slide",
            slideData: { title: "Заключение" },
            slideHtml: "<div>Slide 3</div>",
          },
          writtenSlides: [
            { slide_number: 1, title: "Введение", key_message: "Welcome", text: "Intro", notes: "", data_points: [] },
            { slide_number: 2, title: "Основная часть", key_message: "Main", text: "Main content", notes: "", data_points: [] },
            { slide_number: 3, title: "Заключение", key_message: "Conclusion", text: "Conclusion", notes: "", data_points: [] },
          ],
          approvedSlides: [
            { slideNumber: 1, layoutId: "text-slide", data: {}, html: "<div>1</div>" },
            { slideNumber: 2, layoutId: "text-slide", data: {}, html: "<div>2</div>" },
          ],
        },
      });
      mockSession.phase = "step_slide_design";

      const { writer, events } = createWriter();

      await processAction("test-session-1", "approve_slide_design", writer);

      // Should have presentation_link event
      const presLink = events.find((e) => e.type === "presentation_link");
      expect(presLink).toBeDefined();

      // Should have view_presentation action
      const actionsEvent = events.filter((e) => e.type === "actions").pop();
      expect(actionsEvent).toBeDefined();
      const actions = actionsEvent?.data as any[];
      expect(actions?.some((a: any) => a.id === "view_presentation")).toBe(true);
    });
  });

  describe("processMessage in step_slide_content phase", () => {
    it("routes text messages to handleSlideContentFeedback", async () => {
      resetSession();
      mockSession.phase = "step_slide_content";

      const { writer, events } = createWriter();

      await processMessage("test-session-1", "Измени заголовок на 'Обзор'", writer);

      // Should have token events with edit feedback
      const tokenEvents = events.filter((e) => e.type === "token");
      expect(tokenEvents.length).toBeGreaterThan(0);

      // Should still offer approve_slide_content action
      const actionsEvent = events.find((e) => e.type === "actions");
      expect(actionsEvent).toBeDefined();
      const actions = actionsEvent?.data as any[];
      expect(actions?.some((a: any) => a.id === "approve_slide_content")).toBe(true);
    });
  });

  describe("processMessage in step_slide_design phase", () => {
    it("routes text messages to handleSlideDesignFeedback", async () => {
      resetSession({
        phase: "step_slide_design",
        metadata: {
          ...mockSession.metadata,
          currentSlideDesign: {
            layoutName: "text-slide",
            slideData: { title: "Test" },
            slideHtml: "<div>Test</div>",
          },
          writtenSlides: [{
            slide_number: 1,
            title: "Введение",
            key_message: "Welcome",
            text: "Intro",
            notes: "",
            data_points: [],
          }],
        },
      });
      mockSession.phase = "step_slide_design";

      const { writer, events } = createWriter();

      await processMessage("test-session-1", "Используй другой макет", writer);

      // Should have token events
      const tokenEvents = events.filter((e) => e.type === "token");
      expect(tokenEvents.length).toBeGreaterThan(0);

      // Should offer approve_slide_design action
      const actionsEvent = events.find((e) => e.type === "actions");
      expect(actionsEvent).toBeDefined();
      const actions = actionsEvent?.data as any[];
      expect(actions?.some((a: any) => a.id === "approve_slide_design")).toBe(true);
    });
  });

  describe("slide_progress events", () => {
    it("emits slide_progress with content phase during proposeSlideContent", async () => {
      resetSession({
        phase: "step_structure",
        metadata: {
          outline: {
            presentation_title: "Test Presentation",
            slides: [
              { slide_number: 1, title: "Slide 1", purpose: "Intro", key_points: ["P1"], speaker_notes_hint: "" },
              { slide_number: 2, title: "Slide 2", purpose: "Main", key_points: ["P2"], speaker_notes_hint: "" },
            ],
            target_audience: "General",
          },
          plannerResult: { language: "ru", branding: { company_name: "Test" } },
          currentSlideIndex: undefined,
          writtenSlides: undefined,
          approvedSlides: undefined,
        },
      });
      mockSession.phase = "step_structure";

      const { writer, events } = createWriter();
      await processAction("test-session-1", "approve_structure", writer);

      const slideProgressEvents = events.filter((e) => e.type === "slide_progress");
      expect(slideProgressEvents.length).toBeGreaterThan(0);

      const first = slideProgressEvents[0];
      expect(first.data).toMatchObject({
        currentSlide: 1,
        totalSlides: 2,
        phase: "content",
      });
      expect(first.data.slideTitle).toBeDefined();
    });

    it("emits slide_progress with design phase during generateSlideDesign", async () => {
      resetSession();
      mockSession.phase = "step_slide_content";

      const { writer, events } = createWriter();
      await processAction("test-session-1", "approve_slide_content", writer);

      const slideProgressEvents = events.filter((e) => e.type === "slide_progress");
      const designProgress = slideProgressEvents.find((e) => e.data?.phase === "design");
      expect(designProgress).toBeDefined();
      expect(designProgress?.data).toMatchObject({
        currentSlide: 1,
        totalSlides: 3,
        phase: "design",
      });
    });

    it("emits null slide_progress when finalizing presentation", async () => {
      resetSession({
        phase: "step_slide_design",
        metadata: {
          ...mockSession.metadata,
          currentSlideIndex: 2,
          currentSlideDesign: {
            layoutName: "text-slide",
            slideData: { title: "Заключение" },
            slideHtml: "<div>Slide 3</div>",
          },
          writtenSlides: [
            { slide_number: 1, title: "Введение", key_message: "W", text: "I", notes: "", data_points: [] },
            { slide_number: 2, title: "Основная часть", key_message: "M", text: "M", notes: "", data_points: [] },
            { slide_number: 3, title: "Заключение", key_message: "C", text: "C", notes: "", data_points: [] },
          ],
          approvedSlides: [
            { slideNumber: 1, layoutId: "text-slide", data: {}, html: "<div>1</div>" },
            { slideNumber: 2, layoutId: "text-slide", data: {}, html: "<div>2</div>" },
          ],
        },
      });
      mockSession.phase = "step_slide_design";

      const { writer, events } = createWriter();
      await processAction("test-session-1", "approve_slide_design", writer);

      const slideProgressEvents = events.filter((e) => e.type === "slide_progress");
      const nullProgress = slideProgressEvents.find((e) => e.data === null);
      expect(nullProgress).toBeDefined();
    });
  });

  describe("formatSlideContentForDisplay", () => {
    it("is called during proposeSlideContent and includes key fields", async () => {
      // Reset to a state where we can trigger proposeSlideContent via structure approval
      resetSession({
        phase: "step_structure",
        metadata: {
          outline: {
            presentation_title: "Test Presentation",
            slides: [
              { slide_number: 1, title: "Slide 1", purpose: "Intro", key_points: ["P1"], speaker_notes_hint: "" },
            ],
            target_audience: "General",
          },
          plannerResult: { language: "ru", branding: { company_name: "Test" } },
          currentSlideIndex: undefined,
          writtenSlides: undefined,
          approvedSlides: undefined,
        },
      });
      mockSession.phase = "step_structure";

      const { writer, events } = createWriter();

      // Trigger structure approval which calls proposeSlideContent
      await processAction("test-session-1", "approve_structure", writer);

      // Should have token events containing content display
      const tokenEvents = events.filter((e) => e.type === "token");
      const contentToken = tokenEvents.find(
        (e) => typeof e.data === "string" && e.data.includes("Контент слайда")
      );
      expect(contentToken).toBeDefined();
    });
  });
});
