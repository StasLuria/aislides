import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for annotation API endpoints.
 * Verifies add and delete annotation routes for chat messages.
 */

// Mock chatDb
const mockSession = {
  sessionId: "test-session",
  messages: [
    { role: "user", content: "Hello world, this is a test message", timestamp: Date.now() },
    { role: "assistant", content: "AI response with some important text here", timestamp: Date.now() },
  ],
};

const mockGetChatSession = vi.fn();
const mockUpdateChatSession = vi.fn();

vi.mock("./chatDb", () => ({
  getChatSession: (...args: any[]) => mockGetChatSession(...args),
  updateChatSession: (...args: any[]) => mockUpdateChatSession(...args),
  createChatSession: vi.fn(),
  listChatSessions: vi.fn(),
  deleteChatSession: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

// Mock chatOrchestrator
vi.mock("./chatOrchestrator", () => ({
  processMessage: vi.fn(),
  processAction: vi.fn(),
}));

// Mock fileExtractor
vi.mock("./fileExtractor", () => ({
  extractTextFromFile: vi.fn(),
  SUPPORTED_MIME_TYPES: [],
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  MAX_FILES_PER_MESSAGE: 5,
}));

// Mock db
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  })),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  chatFiles: {},
}));

import express from "express";
import request from "supertest";
import { registerChatRoutes } from "./chatRoutes";

let app: express.Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = express();
  app.use(express.json());
  registerChatRoutes(app);

  mockGetChatSession.mockResolvedValue({
    ...mockSession,
    messages: JSON.parse(JSON.stringify(mockSession.messages)),
  });
  mockUpdateChatSession.mockResolvedValue(undefined);
});

describe("Annotation API", () => {
  describe("POST /api/v1/chat/sessions/:id/messages/:msgIndex/annotations", () => {
    it("should add an annotation to a message", async () => {
      const res = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({
          selectedText: "Hello world",
          note: "This is important",
          startOffset: 0,
          endOffset: 11,
        });

      expect(res.status).toBe(200);
      expect(res.body.annotations).toBeDefined();
      expect(res.body.annotations).toHaveLength(1);
      expect(res.body.annotations[0].selectedText).toBe("Hello world");
      expect(res.body.annotations[0].note).toBe("This is important");
      expect(res.body.annotations[0].startOffset).toBe(0);
      expect(res.body.annotations[0].endOffset).toBe(11);
      expect(res.body.annotations[0].id).toBeDefined();
      expect(res.body.annotations[0].createdAt).toBeDefined();

      expect(mockUpdateChatSession).toHaveBeenCalledWith("test-session", expect.objectContaining({
        messages: expect.any(Array),
      }));
    });

    it("should return 400 if selectedText is missing", async () => {
      const res = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({ note: "Missing selected text" });

      expect(res.status).toBe(400);
    });

    it("should return 400 if note is missing", async () => {
      const res = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({ selectedText: "Hello" });

      expect(res.status).toBe(400);
    });

    it("should return 404 if session not found", async () => {
      mockGetChatSession.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/v1/chat/sessions/nonexistent/messages/0/annotations")
        .send({ selectedText: "Hello", note: "Note" });

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid message index", async () => {
      const res = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/99/annotations")
        .send({ selectedText: "Hello", note: "Note" });

      expect(res.status).toBe(400);
    });

    it("should add multiple annotations to the same message", async () => {
      // First annotation
      const res1 = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({
          selectedText: "Hello",
          note: "First note",
          startOffset: 0,
          endOffset: 5,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.annotations).toHaveLength(1);

      // Update mock to include first annotation
      const updatedMessages = JSON.parse(JSON.stringify(mockSession.messages));
      updatedMessages[0].annotations = res1.body.annotations;
      mockGetChatSession.mockResolvedValue({
        ...mockSession,
        messages: updatedMessages,
      });

      // Second annotation
      const res2 = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({
          selectedText: "world",
          note: "Second note",
          startOffset: 6,
          endOffset: 11,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.annotations).toHaveLength(2);
    });
  });

  describe("DELETE /api/v1/chat/sessions/:id/messages/:msgIndex/annotations/:annotationId", () => {
    it("should delete an annotation", async () => {
      // First add an annotation
      const addRes = await request(app)
        .post("/api/v1/chat/sessions/test-session/messages/0/annotations")
        .send({
          selectedText: "Hello",
          note: "To be deleted",
          startOffset: 0,
          endOffset: 5,
        });

      const annotationId = addRes.body.annotations[0].id;

      // Update mock to include the annotation
      const updatedMessages = JSON.parse(JSON.stringify(mockSession.messages));
      updatedMessages[0].annotations = addRes.body.annotations;
      mockGetChatSession.mockResolvedValue({
        ...mockSession,
        messages: updatedMessages,
      });

      // Delete it
      const delRes = await request(app)
        .delete(`/api/v1/chat/sessions/test-session/messages/0/annotations/${annotationId}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);
    });

    it("should return 404 if session not found", async () => {
      mockGetChatSession.mockResolvedValue(null);
      const res = await request(app)
        .delete("/api/v1/chat/sessions/nonexistent/messages/0/annotations/some-id");

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid message index", async () => {
      const res = await request(app)
        .delete("/api/v1/chat/sessions/test-session/messages/99/annotations/some-id");

      expect(res.status).toBe(400);
    });
  });
});
