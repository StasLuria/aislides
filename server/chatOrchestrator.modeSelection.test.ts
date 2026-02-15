/**
 * Tests for the mode selection flow bug fixes in chatOrchestrator.
 *
 * These tests verify:
 * 1. processAction("mode_step") directly calls handleModeSelection (not processMessage)
 * 2. processAction("mode_quick") directly calls handleModeSelection (not processMessage)
 * 3. Error handling sanitizes SQL errors (no raw DB errors shown to users)
 * 4. handleTopicInput updates phase BEFORE streaming
 * 5. step_structure phase is handled in the switch statement
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
    if (updates.topic !== undefined) mockSession.topic = updates.topic;
    if (updates.mode) mockSession.mode = updates.mode;
    if (updates.metadata) mockSession.metadata = { ...mockSession.metadata, ...updates.metadata };
    if (updates.presentationId !== undefined) mockSession.presentationId = updates.presentationId;
  }),
  appendMessage: vi.fn(async (_id: string, msg: any) => {
    mockMessages.push(msg);
    mockSession.messages = [...(mockSession.messages || []), msg];
    return mockSession.messages;
  }),
  getSessionFiles: vi.fn(async () => []),
}));

// Mock presentationsDb (needed for startQuickGeneration/startStepByStepGeneration)
vi.mock("./presentationDb", () => ({
  createPresentation: vi.fn(async () => ({
    presentationId: "pres-test-123",
    prompt: "Test",
    mode: "interactive",
  })),
  updatePresentationProgress: vi.fn(async () => {}),
  getPresentation: vi.fn(async () => null),
  listPresentations: vi.fn(async () => []),
  deletePresentation: vi.fn(async () => {}),
  toggleShare: vi.fn(async () => ({})),
  getPresentationByShareToken: vi.fn(async () => null),
}));

// Mock pipeline/generator
vi.mock("./pipeline/generator", () => ({
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
  runWriterSingle: vi.fn(async () => ({})),
  runLayout: vi.fn(async () => []),
  runHtmlComposerWithQA: vi.fn(async () => ({})),
  buildFallbackData: vi.fn(() => ({})),
  runTheme: vi.fn(async () => ({
    theme_name: "Corporate Blue",
    colors: { primary: "#2563eb" },
    css_variables: ":root { --primary: #2563eb; }",
    font_pair: { heading: "Inter", body: "Source Sans 3" },
  })),
  generatePresentation: vi.fn(async () => ({})),
}));

// Mock templateEngine
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn(() => "<div class='slide'>Rendered slide</div>"),
  renderPresentation: vi.fn(() => "<html><body>Full presentation</body></html>"),
  renderSlidePreview: vi.fn((html: string) => `<!DOCTYPE html><html><body>${html}</body></html>`),
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
    category: "corporate",
    descRu: "Корпоративный стиль",
    previewColor: "#2563eb",
    previewGradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    cssVariables: ":root { --primary: #2563eb; }",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    mood: "Professional",
  })),
  autoSelectTheme: vi.fn(async () => ({ themeId: "corporate_blue" })),
  THEME_PRESETS: [],
}));

// Mock LLM
vi.mock("./pipeline/llmClient", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "Отличная тема!" } }],
  })),
  streamLLM: vi.fn(async function* () {
    yield { choices: [{ delta: { content: "Отличная тема!" } }] };
  }),
}));

// Mock db
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock inlineFieldInjector
vi.mock("./pipeline/inlineFieldInjector", () => ({
  injectInlineEditableFields: vi.fn((html: string) => html),
}));

// Mock classifyPresentation
vi.mock("./pipeline/presentationTypeClassifier", () => ({
  classifyPresentation: vi.fn(() => ({
    type: "corporate",
    writerHint: "",
    layoutHint: "",
  })),
}));

// ── Import after mocks ──
const { processAction, processMessage } = await import("./chatOrchestrator");
const { updateChatSession, getChatSession } = await import("./chatDb");

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

function createWriter(): { writer: SSEWriter; events: SSEEvent[] } {
  const events: SSEEvent[] = [];
  const writer: SSEWriter = (event: SSEEvent) => { events.push(event); };
  return { writer, events };
}

function resetMockSession(overrides: Record<string, any> = {}) {
  Object.keys(mockSession).forEach(k => delete mockSession[k]);
  Object.assign(mockSession, {
    id: 1,
    sessionId: "test-session-1",
    userId: 1,
    topic: "",
    messages: [],
    phase: "idle",
    mode: null,
    presentationId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  mockMessages.length = 0;
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe("Mode Selection Bug Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSession();
  });

  describe("processAction mode_step bypasses processMessage", () => {
    it("should set phase to mode_selection before calling handleModeSelection", async () => {
      resetMockSession({
        phase: "idle",
        topic: "AI Trends 2026",
      });

      const { writer } = createWriter();
      await processAction("test-session-1", "mode_step", writer);

      // Verify updateChatSession was called to set phase to mode_selection
      const updateCalls = vi.mocked(updateChatSession).mock.calls;
      const phaseUpdates = updateCalls.filter(
        call => (call[1] as any)?.phase === "mode_selection"
      );
      expect(phaseUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it("should not overwrite topic with mode button text", async () => {
      resetMockSession({
        phase: "idle",
        topic: "AI Trends 2026",
      });

      const { writer } = createWriter();
      await processAction("test-session-1", "mode_step", writer);

      // The topic should NOT be overwritten with "🎯 Пошаговый режим"
      const updateCalls = vi.mocked(updateChatSession).mock.calls;
      const topicUpdates = updateCalls.filter(
        call => (call[1] as any)?.topic === "🎯 Пошаговый режим"
      );
      expect(topicUpdates).toHaveLength(0);
    });

    it("should append a user message for mode selection", async () => {
      resetMockSession({
        phase: "idle",
        topic: "AI Trends 2026",
      });

      const { writer } = createWriter();
      await processAction("test-session-1", "mode_step", writer);

      const userMessages = mockMessages.filter(m => m.role === "user");
      expect(userMessages.some(m => m.content.includes("Пошаговый режим"))).toBe(true);
    });
  });

  describe("processAction mode_quick bypasses processMessage", () => {
    it("should set phase to mode_selection before calling handleModeSelection", async () => {
      resetMockSession({
        phase: "idle",
        topic: "AI Trends 2026",
      });

      const { writer } = createWriter();
      await processAction("test-session-1", "mode_quick", writer);

      const updateCalls = vi.mocked(updateChatSession).mock.calls;
      const phaseUpdates = updateCalls.filter(
        call => (call[1] as any)?.phase === "mode_selection"
      );
      expect(phaseUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it("should not overwrite topic with mode button text", async () => {
      resetMockSession({
        phase: "idle",
        topic: "AI Trends 2026",
      });

      const { writer } = createWriter();
      await processAction("test-session-1", "mode_quick", writer);

      const updateCalls = vi.mocked(updateChatSession).mock.calls;
      const topicUpdates = updateCalls.filter(
        call => (call[1] as any)?.topic === "⚡ Быстрый режим"
      );
      expect(topicUpdates).toHaveLength(0);
    });
  });

  describe("Error message sanitization", () => {
    it("should not show raw SQL errors to users in processMessage catch", async () => {
      resetMockSession({ phase: "idle" });

      // Make the first updateChatSession call throw a DB error
      // (this simulates the handleTopicInput phase update failing)
      vi.mocked(updateChatSession).mockRejectedValueOnce(
        new Error("Failed query: update `chat_sessions` set `topic` = ?, `phase` = ? where `chat_sessions`.`sessionId` = ?")
      );

      const { writer, events } = createWriter();
      await processMessage("test-session-1", "Test topic", writer);

      // Check that the error message shown to user does NOT contain raw SQL
      const tokenEvents = events.filter(e => e.type === "token");
      for (const tokenEvent of tokenEvents) {
        if (typeof tokenEvent.data === "string" && tokenEvent.data.includes("ошибка")) {
          expect(tokenEvent.data).not.toContain("Failed query");
          expect(tokenEvent.data).not.toContain("chat_sessions");
          expect(tokenEvent.data).not.toContain("sessionId");
        }
      }
    });

    it("should show user-friendly message for DB errors", async () => {
      resetMockSession({ phase: "idle" });

      vi.mocked(updateChatSession).mockRejectedValueOnce(
        new Error("Failed query: ALTER TABLE...")
      );

      const { writer, events } = createWriter();
      await processMessage("test-session-1", "Test topic", writer);

      const tokenEvents = events.filter(e => e.type === "token");
      const hasUserFriendlyError = tokenEvents.some(e =>
        typeof e.data === "string" && e.data.includes("внутренняя ошибка")
      );
      expect(hasUserFriendlyError).toBe(true);
    });

    it("should still show non-DB errors with their message", async () => {
      resetMockSession({ phase: "idle" });

      vi.mocked(updateChatSession).mockRejectedValueOnce(
        new Error("Network timeout")
      );

      const { writer, events } = createWriter();
      await processMessage("test-session-1", "Test topic", writer);

      const tokenEvents = events.filter(e => e.type === "token");
      const hasNetworkError = tokenEvents.some(e =>
        typeof e.data === "string" && e.data.includes("Network timeout")
      );
      expect(hasNetworkError).toBe(true);
    });
  });

  describe("handleTopicInput updates phase first", () => {
    it("should call updateChatSession with phase=mode_selection as the first DB update", async () => {
      resetMockSession({ phase: "idle" });

      const updateCallOrder: any[] = [];
      vi.mocked(updateChatSession).mockImplementation(async (_id: string, updates: any) => {
        updateCallOrder.push({ ...updates });
        if (updates.phase) mockSession.phase = updates.phase;
        if (updates.topic !== undefined) mockSession.topic = updates.topic;
        if (updates.metadata) mockSession.metadata = { ...mockSession.metadata, ...updates.metadata };
      });

      const { writer } = createWriter();
      await processMessage("test-session-1", "AI Trends 2026", writer);

      // The FIRST updateChatSession call should set phase to mode_selection
      expect(updateCallOrder.length).toBeGreaterThan(0);
      expect(updateCallOrder[0]).toEqual(
        expect.objectContaining({
          phase: "mode_selection",
          topic: "AI Trends 2026",
        })
      );
    });
  });

  describe("step_structure phase is handled", () => {
    it("should not fall through to default handler for step_structure phase", async () => {
      resetMockSession({
        phase: "step_structure",
        topic: "AI Trends 2026",
        metadata: {
          outline: {
            presentation_title: "AI Trends 2026",
            slides: [
              { title: "Intro", purpose: "Introduction" },
              { title: "Main", purpose: "Main content" },
            ],
          },
          plannerResult: { language: "ru", branding: {} },
        },
      });

      const { writer, events } = createWriter();
      await processMessage("test-session-1", "Добавь ещё один слайд", writer);

      // Should produce some output (not crash)
      expect(events.length).toBeGreaterThan(0);
      // Should have a done event
      const doneEvents = events.filter(e => e.type === "done");
      expect(doneEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
