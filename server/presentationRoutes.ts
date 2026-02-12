/**
 * Presentation API Routes — Express REST endpoints matching the FastAPI backend contract.
 * Routes:
 *   POST   /api/v1/presentations              — create a new presentation
 *   GET    /api/v1/presentations               — list presentations
 *   GET    /api/v1/presentations/:id           — get presentation details
 *   GET    /api/v1/presentations/:id/html      — get the full HTML
 *   DELETE /api/v1/presentations/:id           — delete a presentation
 *   POST   /api/v1/presentations/:id/retry     — retry a failed presentation
 *   GET    /health                             — health check
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import {
  createPresentation,
  getPresentation,
  listPresentations,
  updatePresentationProgress,
  deletePresentation,
} from "./presentationDb";
import { generatePresentation, type PipelineProgress } from "./pipeline/generator";
import {
  extractTextFromFile,
  validateFile,
  summarizeExtractedContent,
  formatContentForPrompt,
  MAX_FILE_SIZE,
  type ExtractedContent,
} from "./pipeline/fileExtractor";
import { wsManager } from "./wsManager";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { presentations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Multer config: store in memory, 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

// ── Health ──────────────────────────────────────────────
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", service: "presentation-generator", version: "2.0.0" });
});

// ── Upload Source File ─────────────────────────────────
router.post("/api/v1/upload-source-file", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(422).json({ detail: "Файл не загружен" });
      return;
    }

    // Validate file
    const validation = validateFile(file.originalname, file.size, file.mimetype);
    if (!validation.valid) {
      res.status(422).json({ detail: validation.error });
      return;
    }

    // Extract text
    const extracted = await extractTextFromFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Upload original file to S3
    const fileKey = `source-files/${nanoid(16)}/${file.originalname}`;
    const { url: s3Url } = await storagePut(fileKey, file.buffer, file.mimetype);

    // Summarize if large
    let contextForPipeline = extracted.contextText;
    if (extracted.wasTruncated) {
      contextForPipeline = await summarizeExtractedContent(extracted);
    }

    const fileId = nanoid(16);

    res.json({
      file_id: fileId,
      filename: file.originalname,
      file_type: extracted.fileType,
      word_count: extracted.wordCount,
      page_count: extracted.pageCount || null,
      was_truncated: extracted.wasTruncated,
      s3_url: s3Url,
      context_preview: contextForPipeline.substring(0, 500) + (contextForPipeline.length > 500 ? "..." : ""),
      // Pass the full context back so frontend can include it in create request
      _extracted_context: contextForPipeline,
      _s3_url: s3Url,
    });

    console.log(`[Upload] File processed: ${file.originalname} (${extracted.fileType}, ${extracted.wordCount} words, truncated: ${extracted.wasTruncated})`);
  } catch (error: any) {
    console.error("[API] Upload source file error:", error);
    res.status(500).json({ detail: error.message || "Ошибка обработки файла" });
  }
});

// ── Create Presentation ─────────────────────────────────
router.post("/api/v1/presentations", async (req: Request, res: Response) => {
  try {
    const { prompt, mode = "batch", config = {}, source_file } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(422).json({ detail: "prompt is required" });
      return;
    }

    const presentation = await createPresentation({
      prompt,
      mode,
      config,
    });

    // If source file was uploaded, save its info to the presentation record
    if (source_file?.s3_url && source_file?.extracted_context) {
      const db = await getDb();
      if (db) {
        await db.update(presentations)
          .set({
            sourceFileUrl: source_file.s3_url,
            sourceFileName: source_file.filename || null,
            sourceFileType: source_file.file_type || null,
            sourceContent: source_file.extracted_context,
          })
          .where(eq(presentations.presentationId, presentation.presentationId));
      }
    }

    // Start generation in background, passing source content
    startGeneration(
      presentation.presentationId,
      prompt,
      config,
      source_file?.extracted_context || undefined,
    ).catch((err) => {
      console.error(`[Pipeline] Fatal error for ${presentation.presentationId}:`, err);
    });

    res.status(201).json({
      presentation_id: presentation.presentationId,
      status: "pending",
      prompt,
      mode,
      config,
      has_source_file: !!source_file?.extracted_context,
      created_at: presentation.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Create presentation error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── List Presentations ──────────────────────────────────
router.get("/api/v1/presentations", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const items = await listPresentations(undefined, limit);

    res.json(
      items.map((p) => ({
        presentation_id: p.presentationId,
        title: p.title || p.prompt.substring(0, 100),
        prompt: p.prompt,
        mode: p.mode,
        status: p.status,
        current_step: p.currentStep,
        slide_count: p.slideCount,
        progress_percent: p.progressPercent,
        config: p.config,
        result_urls: p.resultUrls,
        error_info: p.errorInfo,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
      })),
    );
  } catch (error: any) {
    console.error("[API] List presentations error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Get Presentation ────────────────────────────────────
router.get("/api/v1/presentations/:id", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    res.json({
      presentation_id: p.presentationId,
      title: p.title || p.prompt.substring(0, 100),
      prompt: p.prompt,
      mode: p.mode,
      status: p.status,
      current_step: p.currentStep,
      slide_count: p.slideCount,
      progress_percent: p.progressPercent,
      config: p.config,
      result_urls: p.resultUrls,
      pipeline_state: p.pipelineState,
      error_info: p.errorInfo,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Get presentation error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Get Presentation HTML ───────────────────────────────
router.get("/api/v1/presentations/:id/html", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "completed") {
      res.status(400).json({ detail: "Presentation is not completed yet" });
      return;
    }

    // If we have the result URL, redirect to it
    const resultUrls = p.resultUrls as Record<string, string> | null;
    if (resultUrls?.html_preview) {
      res.redirect(resultUrls.html_preview);
      return;
    }

    // Otherwise try to reconstruct from stored slides
    res.status(404).json({ detail: "HTML not available" });
  } catch (error: any) {
    console.error("[API] Get HTML error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Delete Presentation ─────────────────────────────────
router.delete("/api/v1/presentations/:id", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    await deletePresentation(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[API] Delete presentation error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ── Retry Failed Presentation ──────────────────────────
router.post("/api/v1/presentations/:id/retry", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "failed") {
      res.status(400).json({ detail: `Cannot retry presentation with status '${p.status}'. Only failed presentations can be retried.` });
      return;
    }

    // Reset the presentation state
    await updatePresentationProgress(p.presentationId, {
      status: "processing",
      currentStep: "starting",
      progressPercent: 0,
      errorInfo: {},
    });

    // Re-run the pipeline in background
    const config = (p.config as Record<string, any>) || {};
    startGeneration(p.presentationId, p.prompt, config).catch((err) => {
      console.error(`[Pipeline] Retry fatal error for ${p.presentationId}:`, err);
    });

    res.json({
      presentation_id: p.presentationId,
      status: "processing",
      message: "Pipeline restarted",
    });
  } catch (error: any) {
    console.error("[API] Retry presentation error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// BACKGROUND GENERATION
// ═══════════════════════════════════════════════════════

async function startGeneration(
  presentationId: string,
  prompt: string,
  config: Record<string, any>,
  sourceContent?: string,
) {
  try {
    // Update status to processing
    await updatePresentationProgress(presentationId, {
      status: "processing",
      currentStep: "starting",
      progressPercent: 0,
    });

    // Progress callback → WS + DB
    const onProgress = async (progress: PipelineProgress) => {
      // Send via WebSocket
      wsManager.sendProgress(presentationId, {
        node_name: progress.nodeName,
        current_step: progress.currentStep,
        progress_percentage: progress.progressPercent,
        html_content: progress.slidePreview,
        message: progress.message,
      });

      // Update DB
      await updatePresentationProgress(presentationId, {
        currentStep: progress.currentStep,
        progressPercent: progress.progressPercent,
      }).catch((err) => console.error("[Pipeline] DB update failed:", err));
    };

    // Run the pipeline with overall timeout (10 minutes)
    const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000;
    const result = await Promise.race([
      generatePresentation(prompt, {
        themePreset: config.theme_preset,
        enableImages: config.enable_images !== false, // enabled by default
        sourceContent,
      }, onProgress),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Pipeline timed out after 10 minutes")), PIPELINE_TIMEOUT_MS)
      ),
    ]);

    // Upload HTML to S3
    const fileKey = `presentations/${presentationId}/presentation-${nanoid(8)}.html`;
    const { url: htmlUrl } = await storagePut(fileKey, result.fullHtml, "text/html");

    // Update DB with results
    await updatePresentationProgress(presentationId, {
      status: "completed",
      currentStep: "completed",
      progressPercent: 100,
      title: result.title,
      language: result.language,
      themeCss: result.themeCss,
      slideCount: result.slides.length,
      finalHtmlSlides: result.slides.map((s) => ({
        layoutId: s.layoutId,
        data: s.data,
      })),
      resultUrls: {
        html_preview: htmlUrl,
      },
    });

    // Notify via WS
    wsManager.sendCompleted(presentationId, {
      result_urls: { html_preview: htmlUrl },
      slide_count: result.slides.length,
      title: result.title,
    });

    console.log(`[Pipeline] Presentation ${presentationId} completed: ${result.slides.length} slides`);
  } catch (error: any) {
    console.error(`[Pipeline] Generation failed for ${presentationId}:`, error);

    // Update DB with error
    await updatePresentationProgress(presentationId, {
      status: "failed",
      currentStep: "error",
      errorInfo: {
        error_type: error.name || "GenerationError",
        error_message: error.message || "Unknown error",
      },
    }).catch(() => {});

    // Notify via WS
    wsManager.sendError(presentationId, {
      error_message: error.message || "Generation failed",
      error_type: error.name || "GenerationError",
    });
  }
}

export function registerPresentationRoutes(app: import("express").Express) {
  app.use(router);
}
