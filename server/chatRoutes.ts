/**
 * Chat API Routes — Express REST endpoints for the unified chat-based presentation creator.
 * Routes:
 *   POST   /api/v1/chat/sessions           — create a new chat session
 *   GET    /api/v1/chat/sessions           — list chat sessions
 *   GET    /api/v1/chat/sessions/:id       — get chat session with messages
 *   POST   /api/v1/chat/sessions/:id/messages — send a message
 *   DELETE /api/v1/chat/sessions/:id       — delete a chat session
 */
import { Router, Request, Response } from "express";
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  deleteChatSession,
} from "./chatDb";
import { processUserMessage } from "./chatOrchestrator";

const router = Router();

// ── Create Session ──────────────────────────────────────
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const session = await createChatSession();
    res.status(201).json({
      session_id: session.sessionId,
      phase: session.phase,
      messages: session.messages,
      created_at: session.createdAt,
    });
  } catch (err: any) {
    console.error("[Chat API] Create session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── List Sessions ───────────────────────────────────────
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const sessions = await listChatSessions(undefined, limit);
    res.json({
      sessions: sessions.map((s) => ({
        session_id: s.sessionId,
        topic: s.topic,
        phase: s.phase,
        mode: s.mode,
        presentation_id: s.presentationId,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      })),
    });
  } catch (err: any) {
    console.error("[Chat API] List sessions error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get Session ─────────────────────────────────────────
router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = await getChatSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({
      session_id: session.sessionId,
      topic: session.topic,
      phase: session.phase,
      mode: session.mode,
      messages: session.messages,
      presentation_id: session.presentationId,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
  } catch (err: any) {
    console.error("[Chat API] Get session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Send Message ────────────────────────────────────────
router.post("/sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await processUserMessage(req.params.id, message.trim());

    res.json({
      messages: result.messages,
      phase: result.phase,
      presentation_id: result.presentationId,
    });
  } catch (err: any) {
    console.error("[Chat API] Send message error:", err);
    if (err.message === "Chat session not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Session ──────────────────────────────────────
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    await deleteChatSession(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Chat API] Delete session error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
