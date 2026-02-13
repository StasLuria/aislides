/**
 * Chat API Routes — Express REST + SSE endpoints for chat-based presentation creation.
 *
 * Routes:
 *   POST   /api/v1/chat/sessions              — create a new chat session
 *   GET    /api/v1/chat/sessions              — list chat sessions
 *   GET    /api/v1/chat/sessions/:id          — get session details
 *   DELETE /api/v1/chat/sessions/:id          — delete a session
 *   POST   /api/v1/chat/sessions/:id/message  — send message (SSE streaming response)
 *   POST   /api/v1/chat/sessions/:id/action   — trigger action button (SSE streaming response)
 */
import { Router, Request, Response } from "express";
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  deleteChatSession,
} from "./chatDb";
import { processMessage, processAction, type SSEEvent } from "./chatOrchestrator";

const router = Router();

// ── Helper: Set up SSE response ────────────────────────
function setupSSE(res: Response): (event: SSEEvent) => void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Send initial comment to establish connection
  res.write(": connected\n\n");

  return (event: SSEEvent) => {
    try {
      const data = JSON.stringify({ type: event.type, data: event.data });
      res.write(`data: ${data}\n\n`);
    } catch {
      // Connection may be closed
    }
  };
}

// ── Create Session ─────────────────────────────────────
router.post("/api/v1/chat/sessions", async (req: Request, res: Response) => {
  try {
    const session = await createChatSession();
    res.status(201).json({
      session_id: session.sessionId,
      topic: session.topic,
      phase: session.phase,
      messages: session.messages || [],
      created_at: session.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[Chat API] Create session error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── List Sessions ──────────────────────────────────────
router.get("/api/v1/chat/sessions", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = await listChatSessions(undefined, limit);

    res.json(
      sessions.map((s) => ({
        session_id: s.sessionId,
        topic: s.topic || "Новый чат",
        phase: s.phase,
        mode: s.mode,
        presentation_id: s.presentationId,
        message_count: (s.messages || []).length,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      })),
    );
  } catch (error: any) {
    console.error("[Chat API] List sessions error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Get Session ────────────────────────────────────────
router.get("/api/v1/chat/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = await getChatSession(req.params.id);
    if (!session) {
      res.status(404).json({ detail: "Session not found" });
      return;
    }

    res.json({
      session_id: session.sessionId,
      topic: session.topic,
      phase: session.phase,
      mode: session.mode,
      presentation_id: session.presentationId,
      messages: session.messages || [],
      metadata: session.metadata,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[Chat API] Get session error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Delete Session ─────────────────────────────────────
router.delete("/api/v1/chat/sessions/:id", async (req: Request, res: Response) => {
  try {
    await deleteChatSession(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Chat API] Delete session error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Send Message (SSE Streaming) ───────────────────────
router.post("/api/v1/chat/sessions/:id/message", async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    res.status(422).json({ detail: "message is required" });
    return;
  }

  const session = await getChatSession(req.params.id);
  if (!session) {
    res.status(404).json({ detail: "Session not found" });
    return;
  }

  const writer = setupSSE(res);

  // Handle client disconnect
  req.on("close", () => {
    // Client disconnected — nothing to clean up
  });

  try {
    await processMessage(req.params.id, message, writer);
  } catch (error: any) {
    console.error("[Chat API] Message processing error:", error);
    writer({ type: "error", data: error.message || "Processing failed" });
    writer({ type: "done", data: null });
  }

  res.end();
});

// ── Trigger Action (SSE Streaming) ─────────────────────
router.post("/api/v1/chat/sessions/:id/action", async (req: Request, res: Response) => {
  const { action_id } = req.body;

  if (!action_id || typeof action_id !== "string") {
    res.status(422).json({ detail: "action_id is required" });
    return;
  }

  const session = await getChatSession(req.params.id);
  if (!session) {
    res.status(404).json({ detail: "Session not found" });
    return;
  }

  const writer = setupSSE(res);

  req.on("close", () => {
    // Client disconnected
  });

  try {
    await processAction(req.params.id, action_id, writer);
  } catch (error: any) {
    console.error("[Chat API] Action processing error:", error);
    writer({ type: "error", data: error.message || "Action failed" });
    writer({ type: "done", data: null });
  }

  res.end();
});

export function registerChatRoutes(app: import("express").Express) {
  app.use(router);
}
