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
import {
  createPresentation,
  getPresentation,
  listPresentations,
  updatePresentationProgress,
  deletePresentation,
  toggleShare,
  getPresentationByShareToken,
} from "./presentationDb";
import { generatePresentation, type PipelineProgress } from "./pipeline/generator";
import { wsManager } from "./wsManager";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { generatePptx } from "./pptxExport";
import { generatePdf } from "./pdfExport";
import { getThemePreset } from "./pipeline/themes";
import { logExportEvent } from "./analyticsDb";

const router = Router();

// ── Health ──────────────────────────────────────────────
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", service: "presentation-generator", version: "2.0.0" });
});

// ── Create Presentation ─────────────────────────────────
router.post("/api/v1/presentations", async (req: Request, res: Response) => {
  try {
    const { prompt, mode = "batch", config = {} } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(422).json({ detail: "prompt is required" });
      return;
    }

    const presentation = await createPresentation({
      prompt,
      mode,
      config,
    });

    // Start generation in background
    startGeneration(presentation.presentationId, prompt, config).catch((err) => {
      console.error(`[Pipeline] Fatal error for ${presentation.presentationId}:`, err);
    });

    res.status(201).json({
      presentation_id: presentation.presentationId,
      status: "pending",
      prompt,
      mode,
      config,
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

    // Notify owner about the failure
    notifyOwner({
      title: `⚠️ Ошибка генерации: ${presentationId.slice(0, 8)}`,
      content: [
        `**Presentation ID:** ${presentationId}`,
        `**Error:** ${error.message || "Unknown error"}`,
        `**Type:** ${error.name || "GenerationError"}`,
        `**Time:** ${new Date().toISOString()}`,
      ].join("\n"),
    }).catch((err) => console.error("[Notify] Failed to send error notification:", err));
  }
}

// ── Share ───────────────────────────────────────────
router.post("/api/v1/presentations/:id/share", async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body || {};
    const result = await toggleShare(req.params.id, enabled);
    if (!result) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }
    res.json(result);
  } catch (error: any) {
    console.error("[API] Share toggle error:", error);
    res.status(500).json({ detail: error.message || "Failed to toggle share" });
  }
});

router.get("/api/v1/presentations/:id/share", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }
    res.json({
      shareToken: p.shareToken || null,
      shareEnabled: p.shareEnabled || false,
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message });
  }
});

// ── Public shared view ─────────────────────────────────
router.get("/api/v1/shared/:token", async (req: Request, res: Response) => {
  try {
    const p = await getPresentationByShareToken(req.params.token);
    if (!p) {
      res.status(404).json({ detail: "Shared presentation not found or sharing is disabled" });
      return;
    }

    // Return limited data for public view (no pipeline state, no config)
    res.json({
      presentation_id: p.presentationId,
      title: p.title || p.prompt.substring(0, 100),
      status: p.status,
      slide_count: p.slideCount,
      result_urls: p.resultUrls || {},
      theme_css: p.themeCss,
      language: p.language,
      created_at: p.createdAt,
    });
  } catch (error: any) {
    console.error("[API] Shared view error:", error);
    res.status(500).json({ detail: error.message });
  }
});

router.get("/api/v1/shared/:token/slides", async (req: Request, res: Response) => {
  try {
    const p = await getPresentationByShareToken(req.params.token);
    if (!p) {
      res.status(404).json({ detail: "Shared presentation not found or sharing is disabled" });
      return;
    }

    const slides = (p.finalHtmlSlides as any[]) || [];
    res.json({
      presentation_id: p.presentationId,
      title: p.title || p.prompt.substring(0, 100),
      theme_css: p.themeCss,
      language: p.language,
      slides: slides.map((s: any, i: number) => ({
        index: i,
        layoutId: s.layoutId || s.layout_id || "text-slide",
        data: s.data || {},
      })),
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message });
  }
});

router.get("/api/v1/shared/:token/html", async (req: Request, res: Response) => {
  try {
    const p = await getPresentationByShareToken(req.params.token);
    if (!p) {
      res.status(404).json({ detail: "Shared presentation not found" });
      return;
    }

    const urls = (p.resultUrls as Record<string, any>) || {};
    const htmlUrl = urls.html_preview || urls.html;
    if (!htmlUrl) {
      res.status(404).json({ detail: "HTML not available" });
      return;
    }

    res.json({ html_url: htmlUrl });
  } catch (error: any) {
    res.status(500).json({ detail: error.message });
  }
});

router.get("/api/v1/shared/:token/export/pptx", async (req: Request, res: Response) => {
  try {
    const p = await getPresentationByShareToken(req.params.token);
    if (!p) {
      res.status(404).json({ detail: "Shared presentation not found" });
      return;
    }

    if (p.status !== "completed") {
      res.status(400).json({ detail: "Presentation is not completed yet" });
      return;
    }

    const slides = (p.finalHtmlSlides as any[]) || [];
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides available" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const cssVariables = p.themeCss || themePreset.cssVariables;
    const title = p.title || p.prompt.substring(0, 100);

    const pptxBuffer = await generatePptx(
      slides.map((s: any) => ({
        layoutId: s.layoutId || s.layout_id || "text-slide",
        data: s.data || {},
      })),
      title,
      cssVariables,
    );

    const safeTitle = title.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-]/g, "").substring(0, 60).trim() || "presentation";
    const filename = `${safeTitle}.pptx`;

    // Log export event for A/B theme quality tracking (shared)
    logExportEvent(p.presentationId, "pptx", config.theme_preset || null, true).catch(() => {});

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(pptxBuffer);
  } catch (error: any) {
    console.error("[API] Shared PPTX export error:", error);
    res.status(500).json({ detail: error.message || "PPTX export failed" });
  }
});

// ── Export PPTX ────────────────────────────────────────
router.get("/api/v1/presentations/:id/export/pptx", async (req: Request, res: Response) => {
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

    const slides = (p.finalHtmlSlides as any[]) || [];
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides available" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const cssVariables = p.themeCss || themePreset.cssVariables;
    const title = p.title || p.prompt.substring(0, 100);

    const pptxBuffer = await generatePptx(
      slides.map((s: any) => ({
        layoutId: s.layoutId || s.layout_id || "text-slide",
        data: s.data || {},
      })),
      title,
      cssVariables,
    );

    const safeTitle = title.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-]/g, "").substring(0, 60).trim() || "presentation";
    const filename = `${safeTitle}.pptx`;

    // Log export event for A/B theme quality tracking
    logExportEvent(req.params.id, "pptx", config.theme_preset || null, false).catch(() => {});

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(pptxBuffer);
  } catch (error: any) {
    console.error("[API] PPTX export error:", error);
    res.status(500).json({ detail: error.message || "PPTX export failed" });
  }
});

// ── PDF Export (authenticated) ─────────────────────────────────
router.get("/api/v1/presentations/:id/export/pdf", async (req: Request, res: Response) => {
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

    const slides = (p.finalHtmlSlides as any[]) || [];
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides available" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const cssVariables = p.themeCss || themePreset.cssVariables;
    const title = p.title || p.prompt.substring(0, 100);

    const pdfBuffer = await generatePdf(
      slides.map((s: any) => ({
        layoutId: s.layoutId || s.layout_id || "text-slide",
        data: s.data || {},
      })),
      title,
      cssVariables,
    );

    const safeTitle = title.replace(/[^a-zA-Z0-9\u0430-\u044f\u0410-\u042f\u0451\u0401\s-]/g, "").substring(0, 60).trim() || "presentation";
    const filename = `${safeTitle}.pdf`;

    // Log export event for A/B theme quality tracking
    logExportEvent(req.params.id, "pdf", config.theme_preset || null, false).catch(() => {});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API] PDF export error:", error);
    res.status(500).json({ detail: error.message || "PDF export failed" });
  }
});

// ── PDF Export (shared) ─────────────────────────────────
router.get("/api/v1/shared/:token/export/pdf", async (req: Request, res: Response) => {
  try {
    const p = await getPresentationByShareToken(req.params.token);
    if (!p) {
      res.status(404).json({ detail: "Shared presentation not found" });
      return;
    }

    if (p.status !== "completed") {
      res.status(400).json({ detail: "Presentation is not completed yet" });
      return;
    }

    const slides = (p.finalHtmlSlides as any[]) || [];
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides available" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const cssVariables = p.themeCss || themePreset.cssVariables;
    const title = p.title || p.prompt.substring(0, 100);

    const pdfBuffer = await generatePdf(
      slides.map((s: any) => ({
        layoutId: s.layoutId || s.layout_id || "text-slide",
        data: s.data || {},
      })),
      title,
      cssVariables,
    );

    const safeTitle = title.replace(/[^a-zA-Z0-9\u0430-\u044f\u0410-\u042f\u0451\u0401\s-]/g, "").substring(0, 60).trim() || "presentation";
    const filename = `${safeTitle}.pdf`;

    // Log export event for A/B theme quality tracking (shared)
    logExportEvent(p.presentationId, "pdf", config.theme_preset || null, true).catch(() => {});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API] Shared PDF export error:", error);
    res.status(500).json({ detail: error.message || "PDF export failed" });
  }
});

export function registerPresentationRoutes(app: import("express").Express) {
  app.use(router);
}
