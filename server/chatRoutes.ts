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
import multer from "multer";
import { nanoid } from "nanoid";
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  deleteChatSession,
} from "./chatDb";
import { processMessage, processAction, type SSEEvent } from "./chatOrchestrator";
import { extractTextFromFile, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE, MAX_FILES_PER_MESSAGE } from "./fileExtractor";
import { storagePut } from "./storage";
import { chatFiles } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";

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

// ── Update Session Title ───────────────────────────────────
router.patch("/api/v1/chat/sessions/:id/title", async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== "string") {
      res.status(422).json({ detail: "title is required" });
      return;
    }

    const session = await getChatSession(req.params.id);
    if (!session) {
      res.status(404).json({ detail: "Session not found" });
      return;
    }

    const { updateChatSession } = await import("./chatDb");
    await updateChatSession(req.params.id, { topic: title.trim() });
    res.json({ success: true, topic: title.trim() });
  } catch (error: any) {
    console.error("[Chat API] Update title error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Delete Session ─────────────────────────────────────────
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

// ── Multer config for file uploads ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_MESSAGE,
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── Upload Files ───────────────────────────────────────────
router.post(
  "/api/v1/chat/sessions/:id/upload",
  upload.array("files", MAX_FILES_PER_MESSAGE),
  async (req: Request, res: Response) => {
    try {
      const session = await getChatSession(req.params.id);
      if (!session) {
        res.status(404).json({ detail: "Session not found" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(422).json({ detail: "No files uploaded" });
        return;
      }

      const results = [];

      for (const file of files) {
        const fileId = nanoid(16);
        const ext = file.originalname.split(".").pop() || "bin";
        const s3Key = `chat-files/${req.params.id}/${fileId}.${ext}`;

        // Upload to S3
        const { url: s3Url } = await storagePut(s3Key, file.buffer, file.mimetype);

        // Save file record with status "uploading"
        const db = await getDb();
        await db.insert(chatFiles).values({
          fileId,
          sessionId: req.params.id,
          filename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          s3Url,
          status: "uploading",
        });

        // Extract text in background (don't block response)
        extractTextFromFile(file.buffer, file.mimetype, file.originalname, s3Url)
          .then(async (extraction) => {
            const dbInner = await getDb();
            await dbInner
              .update(chatFiles)
              .set({
                extractedText: extraction.text || null,
                status: extraction.error ? "error" : "ready",
              })
              .where(eq(chatFiles.fileId, fileId));
            console.log(`[Upload] Extracted text from ${file.originalname}: ${(extraction.text || "").length} chars`);
          })
          .catch(async (err) => {
            console.error(`[Upload] Extraction failed for ${file.originalname}:`, err);
            const dbInner = await getDb();
            await dbInner
              .update(chatFiles)
              .set({ status: "error" })
              .where(eq(chatFiles.fileId, fileId));
          });

        results.push({
          file_id: fileId,
          filename: file.originalname,
          mime_type: file.mimetype,
          file_size: file.size,
          s3_url: s3Url,
          status: "uploading",
        });
      }

      res.status(201).json({ files: results });
    } catch (error: any) {
      console.error("[Chat API] Upload error:", error);
      if (error.message?.includes("Unsupported file type")) {
        res.status(422).json({ detail: error.message });
      } else {
        res.status(500).json({ detail: error.message || "Upload failed" });
      }
    }
  },
);

// ── Get Session Files ─────────────────────────────────────
router.get("/api/v1/chat/sessions/:id/files", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const files = await db
      .select()
      .from(chatFiles)
      .where(eq(chatFiles.sessionId, req.params.id));

    res.json(
      files.map((f) => ({
        file_id: f.fileId,
        filename: f.filename,
        mime_type: f.mimeType,
        file_size: f.fileSize,
        s3_url: f.s3Url,
        status: f.status,
        has_text: !!f.extractedText,
        created_at: f.createdAt.toISOString(),
      })),
    );
  } catch (error: any) {
    console.error("[Chat API] List files error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

export function registerChatRoutes(app: import("express").Express) {
  app.use(router);
}
