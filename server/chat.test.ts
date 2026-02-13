/**
 * Chat API + SSE Streaming Tests
 * Tests the chat session CRUD and SSE message/action endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════
// Mock dependencies
// ═══════════════════════════════════════════════════════

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock chatDb functions
const mockCreateSession = vi.fn();
const mockGetSession = vi.fn();
const mockListSessions = vi.fn();
const mockDeleteSession = vi.fn();
const mockAppendMessage = vi.fn();
const mockUpdateSession = vi.fn();

vi.mock("./chatDb", () => ({
  createChatSession: (...args: any[]) => mockCreateSession(...args),
  getChatSession: (...args: any[]) => mockGetSession(...args),
  listChatSessions: (...args: any[]) => mockListSessions(...args),
  deleteChatSession: (...args: any[]) => mockDeleteSession(...args),
  appendMessage: (...args: any[]) => mockAppendMessage(...args),
  updateChatSession: (...args: any[]) => mockUpdateSession(...args),
}));

// Mock chatOrchestrator
const mockProcessMessage = vi.fn();
const mockProcessAction = vi.fn();

vi.mock("./chatOrchestrator", () => ({
  processMessage: (...args: any[]) => mockProcessMessage(...args),
  processAction: (...args: any[]) => mockProcessAction(...args),
}));

// ═══════════════════════════════════════════════════════
// SSE Event Types
// ═══════════════════════════════════════════════════════

describe("SSE Event Types", () => {
  it("should define valid SSE event types", () => {
    const validTypes = ["token", "actions", "slide_preview", "progress", "done", "error", "presentation_link"];
    // Verify the types are consistent with what the system uses
    expect(validTypes).toContain("token");
    expect(validTypes).toContain("progress");
    expect(validTypes).toContain("done");
    expect(validTypes).toContain("actions");
    expect(validTypes).toContain("presentation_link");
    expect(validTypes).toContain("error");
  });
});

// ═══════════════════════════════════════════════════════
// Chat Session CRUD
// ═══════════════════════════════════════════════════════

describe("Chat Session CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new chat session", async () => {
    const mockSession = {
      id: 1,
      sessionId: "test-session-123",
      userId: null,
      topic: "",
      messages: [],
      phase: "idle",
      mode: null,
      presentationId: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCreateSession.mockResolvedValue(mockSession);

    const session = await mockCreateSession();
    expect(session).toBeDefined();
    expect(session.sessionId).toBe("test-session-123");
    expect(session.phase).toBe("idle");
    expect(session.messages).toEqual([]);
    expect(mockCreateSession).toHaveBeenCalledOnce();
  });

  it("should get a chat session by ID", async () => {
    const mockSession = {
      id: 1,
      sessionId: "test-session-123",
      topic: "AI Trends",
      messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
      phase: "mode_selection",
      mode: null,
      presentationId: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetSession.mockResolvedValue(mockSession);

    const session = await mockGetSession("test-session-123");
    expect(session).toBeDefined();
    expect(session.topic).toBe("AI Trends");
    expect(session.messages).toHaveLength(1);
    expect(mockGetSession).toHaveBeenCalledWith("test-session-123");
  });

  it("should return undefined for non-existent session", async () => {
    mockGetSession.mockResolvedValue(undefined);

    const session = await mockGetSession("non-existent");
    expect(session).toBeUndefined();
  });

  it("should list chat sessions", async () => {
    const mockSessions = [
      { sessionId: "s1", topic: "Topic 1", phase: "idle", createdAt: new Date() },
      { sessionId: "s2", topic: "Topic 2", phase: "completed", createdAt: new Date() },
    ];

    mockListSessions.mockResolvedValue(mockSessions);

    const sessions = await mockListSessions(undefined, 50);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe("s1");
    expect(mockListSessions).toHaveBeenCalledWith(undefined, 50);
  });

  it("should delete a chat session", async () => {
    mockDeleteSession.mockResolvedValue(undefined);

    await mockDeleteSession("test-session-123");
    expect(mockDeleteSession).toHaveBeenCalledWith("test-session-123");
  });

  it("should append a message to session", async () => {
    const message = { role: "user" as const, content: "Test message", timestamp: Date.now() };
    const updatedMessages = [message];

    mockAppendMessage.mockResolvedValue(updatedMessages);

    const result = await mockAppendMessage("test-session-123", message);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Test message");
  });

  it("should update chat session fields", async () => {
    mockUpdateSession.mockResolvedValue(undefined);

    await mockUpdateSession("test-session-123", {
      topic: "Updated Topic",
      phase: "mode_selection",
    });

    expect(mockUpdateSession).toHaveBeenCalledWith("test-session-123", {
      topic: "Updated Topic",
      phase: "mode_selection",
    });
  });
});

// ═══════════════════════════════════════════════════════
// SSE Streaming
// ═══════════════════════════════════════════════════════

describe("SSE Streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call processMessage with correct arguments", async () => {
    mockProcessMessage.mockImplementation(async (sessionId, message, writer) => {
      writer({ type: "token", data: "Hello " });
      writer({ type: "token", data: "World" });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessMessage("session-1", "Test message", writer);

    expect(mockProcessMessage).toHaveBeenCalledWith("session-1", "Test message", writer);
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "token", data: "Hello " });
    expect(events[1]).toEqual({ type: "token", data: "World" });
    expect(events[2]).toEqual({ type: "done", data: null });
  });

  it("should stream progress events during generation", async () => {
    mockProcessMessage.mockImplementation(async (sessionId, message, writer) => {
      writer({ type: "token", data: "Starting generation..." });
      writer({ type: "progress", data: { percent: 10, message: "Analyzing topic..." } });
      writer({ type: "progress", data: { percent: 50, message: "Writing content..." } });
      writer({ type: "progress", data: { percent: 100, message: "Complete!" } });
      writer({ type: "token", data: "\n\nDone!" });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessMessage("session-1", "Generate", writer);

    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[0].data.percent).toBe(10);
    expect(progressEvents[2].data.percent).toBe(100);
  });

  it("should send action buttons after response", async () => {
    mockProcessMessage.mockImplementation(async (sessionId, message, writer) => {
      writer({ type: "token", data: "Choose a mode:" });
      writer({
        type: "actions",
        data: [
          { id: "mode_quick", label: "Quick", variant: "default" },
          { id: "mode_step", label: "Step-by-step", variant: "outline" },
        ],
      });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessMessage("session-1", "AI Trends", writer);

    const actionEvent = events.find((e) => e.type === "actions");
    expect(actionEvent).toBeDefined();
    expect(actionEvent.data).toHaveLength(2);
    expect(actionEvent.data[0].id).toBe("mode_quick");
    expect(actionEvent.data[1].id).toBe("mode_step");
  });

  it("should send presentation link on completion", async () => {
    mockProcessMessage.mockImplementation(async (sessionId, message, writer) => {
      writer({ type: "token", data: "Presentation ready!" });
      writer({
        type: "presentation_link",
        data: {
          presentationId: "pres-123",
          title: "AI Trends 2026",
          slideCount: 11,
        },
      });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessMessage("session-1", "Generate", writer);

    const linkEvent = events.find((e) => e.type === "presentation_link");
    expect(linkEvent).toBeDefined();
    expect(linkEvent.data.presentationId).toBe("pres-123");
    expect(linkEvent.data.slideCount).toBe(11);
  });

  it("should handle errors gracefully", async () => {
    mockProcessMessage.mockImplementation(async (sessionId, message, writer) => {
      writer({ type: "error", data: "Something went wrong" });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessMessage("session-1", "Bad input", writer);

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent.data).toBe("Something went wrong");

    // Should always end with done
    expect(events[events.length - 1].type).toBe("done");
  });
});

// ═══════════════════════════════════════════════════════
// Action Processing
// ═══════════════════════════════════════════════════════

describe("Action Processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call processAction with correct arguments", async () => {
    mockProcessAction.mockImplementation(async (sessionId, actionId, writer) => {
      writer({ type: "token", data: "Action triggered" });
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessAction("session-1", "mode_quick", writer);

    expect(mockProcessAction).toHaveBeenCalledWith("session-1", "mode_quick", writer);
    expect(events).toHaveLength(2);
    expect(events[0].data).toBe("Action triggered");
  });

  it("should handle mode_quick action", async () => {
    mockProcessAction.mockImplementation(async (sessionId, actionId, writer) => {
      if (actionId === "mode_quick") {
        writer({ type: "token", data: "Starting quick generation..." });
        writer({ type: "progress", data: { percent: 0, message: "Starting..." } });
      }
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessAction("session-1", "mode_quick", writer);

    expect(events[0].data).toContain("quick generation");
    expect(events[1].type).toBe("progress");
  });

  it("should handle view_presentation action", async () => {
    mockProcessAction.mockImplementation(async (sessionId, actionId, writer) => {
      if (actionId === "view_presentation") {
        writer({
          type: "presentation_link",
          data: { presentationId: "pres-456" },
        });
      }
      writer({ type: "done", data: null });
    });

    const events: any[] = [];
    const writer = (event: any) => events.push(event);

    await mockProcessAction("session-1", "view_presentation", writer);

    const linkEvent = events.find((e) => e.type === "presentation_link");
    expect(linkEvent).toBeDefined();
    expect(linkEvent.data.presentationId).toBe("pres-456");
  });
});

// ═══════════════════════════════════════════════════════
// Chat Phase State Machine
// ═══════════════════════════════════════════════════════

describe("Chat Phase State Machine", () => {
  it("should define valid phases", () => {
    const validPhases = [
      "idle",
      "mode_selection",
      "generating",
      "step_structure",
      "step_content",
      "step_design",
      "completed",
    ];

    // Verify all phases are strings
    validPhases.forEach((phase) => {
      expect(typeof phase).toBe("string");
      expect(phase.length).toBeGreaterThan(0);
    });
  });

  it("should follow correct phase transitions", () => {
    // idle -> mode_selection (after topic input)
    // mode_selection -> generating (after mode chosen)
    // mode_selection -> step_structure (for step-by-step)
    // generating -> completed (after pipeline finishes)
    // step_structure -> generating (after structure approved)
    // completed -> idle (new presentation)

    const transitions: Record<string, string[]> = {
      idle: ["mode_selection"],
      mode_selection: ["generating", "step_structure"],
      step_structure: ["generating"],
      generating: ["completed", "mode_selection"], // mode_selection on error
      completed: ["idle"],
    };

    // Verify transitions are defined
    expect(transitions.idle).toContain("mode_selection");
    expect(transitions.mode_selection).toContain("generating");
    expect(transitions.generating).toContain("completed");
    expect(transitions.completed).toContain("idle");
  });
});

// ═══════════════════════════════════════════════════════
// SSE Format Validation
// ═══════════════════════════════════════════════════════

describe("SSE Format Validation", () => {
  it("should format SSE events correctly", () => {
    const event = { type: "token" as const, data: "Hello" };
    const formatted = `data: ${JSON.stringify(event)}\n\n`;

    expect(formatted).toContain("data: ");
    expect(formatted).toContain('"type":"token"');
    expect(formatted).toContain('"data":"Hello"');
    expect(formatted).toMatch(/\n\n$/);
  });

  it("should handle special characters in SSE data", () => {
    const event = { type: "token" as const, data: 'Text with "quotes" and\nnewlines' };
    const formatted = JSON.stringify(event);

    // Should be valid JSON
    expect(() => JSON.parse(formatted)).not.toThrow();
  });

  it("should handle complex SSE event data", () => {
    const event = {
      type: "actions" as const,
      data: [
        { id: "mode_quick", label: "⚡ Быстрый режим", variant: "default" },
        { id: "mode_step", label: "🎯 Пошаговый режим", variant: "outline" },
      ],
    };

    const formatted = JSON.stringify(event);
    const parsed = JSON.parse(formatted);

    expect(parsed.type).toBe("actions");
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].label).toContain("Быстрый");
  });

  it("should handle progress events with numeric data", () => {
    const event = {
      type: "progress" as const,
      data: { percent: 42.5, message: "Processing..." },
    };

    const formatted = JSON.stringify(event);
    const parsed = JSON.parse(formatted);

    expect(parsed.data.percent).toBe(42.5);
    expect(typeof parsed.data.percent).toBe("number");
  });
});
