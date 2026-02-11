/**
 * Interactive Presentation Routes — Step-by-step generation with user approval.
 *
 * Flow:
 *   1. POST /api/v1/interactive/start          — Run planner + outline, return outline for review
 *   2. POST /api/v1/interactive/:id/approve-outline — User approves/edits outline, run writers
 *   3. GET  /api/v1/interactive/:id/content     — Get generated slide content
 *   4. POST /api/v1/interactive/:id/update-slide — User edits a single slide's content
 *   5. POST /api/v1/interactive/:id/assemble    — Run theme + layout + composer + assembly
 */
import { Router, Request, Response } from "express";
import {
  createPresentation,
  getPresentation,
  updatePresentationProgress,
} from "./presentationDb";
import {
  runPlanner,
  runOutline,
  runWriterParallel,
  runWriterSingle,
  runTheme,
  runLayout,
  runHtmlComposer,
  buildFallbackData,
  type PlannerResult,
  type OutlineResult,
  type OutlineSlide,
  type SlideContent,
} from "./pipeline/generator";
import { renderSlide, renderPresentation } from "./pipeline/templateEngine";
import { getThemePreset } from "./pipeline/themes";
import { wsManager } from "./wsManager";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

const router = Router();

// ═══════════════════════════════════════════════════════
// STEP 1: Start — Run planner + outline
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/start", async (req: Request, res: Response) => {
  try {
    const { prompt, config = {} } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(422).json({ detail: "prompt is required" });
      return;
    }

    // Create presentation record
    const presentation = await createPresentation({
      prompt,
      mode: "interactive",
      config,
    });

    const presentationId = presentation.presentationId;

    // Update status
    await updatePresentationProgress(presentationId, {
      status: "processing",
      currentStep: "planning",
      progressPercent: 5,
    });

    // Notify via WS
    wsManager.sendProgress(presentationId, {
      node_name: "planner",
      current_step: "planning",
      progress_percentage: 5,
      message: "Анализ темы...",
    });

    // Run planner
    const plannerResult = await runPlanner(prompt);
    const language = plannerResult.language || "ru";

    wsManager.sendProgress(presentationId, {
      node_name: "outline",
      current_step: "outlining",
      progress_percentage: 10,
      message: "Создание структуры...",
    });

    // Run outline
    const outline = await runOutline(prompt, plannerResult.branding, language);

    // Store intermediate state
    await updatePresentationProgress(presentationId, {
      status: "awaiting_outline_approval",
      currentStep: "awaiting_outline_approval",
      progressPercent: 15,
      title: plannerResult.presentation_title,
      language,
      slideCount: outline.slides.length,
      pipelineState: {
        plannerResult,
        outline,
      },
    });

    // Notify via WS
    wsManager.sendProgress(presentationId, {
      node_name: "outline",
      current_step: "awaiting_outline_approval",
      progress_percentage: 15,
      message: "Структура готова — ожидает утверждения",
    });

    res.status(201).json({
      presentation_id: presentationId,
      status: "awaiting_outline_approval",
      title: plannerResult.presentation_title,
      language,
      outline: {
        presentation_title: outline.presentation_title,
        target_audience: outline.target_audience,
        narrative_arc: outline.narrative_arc,
        slides: outline.slides,
      },
    });
  } catch (error: any) {
    console.error("[Interactive] Start error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 2: Approve outline — User approves/edits, then run writers
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/approve-outline", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_outline_approval") {
      res.status(400).json({ detail: `Cannot approve outline in status: ${p.status}` });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const plannerResult: PlannerResult = pipelineState.plannerResult;
    const language = p.language || "ru";

    // User may have edited the outline
    const userOutline: OutlineResult = req.body.outline || pipelineState.outline;

    // Renumber slides
    userOutline.slides = userOutline.slides.map((s: OutlineSlide, i: number) => ({
      ...s,
      slide_number: i + 1,
    }));

    // Update status to processing writers
    await updatePresentationProgress(presentationId, {
      status: "processing",
      currentStep: "writing",
      progressPercent: 20,
      slideCount: userOutline.slides.length,
      pipelineState: {
        ...pipelineState,
        outline: userOutline,
      },
    });

    wsManager.sendProgress(presentationId, {
      node_name: "writer",
      current_step: "writing",
      progress_percentage: 20,
      message: `Написание контента для ${userOutline.slides.length} слайдов...`,
    });

    // Respond immediately — writing happens in background
    res.json({
      presentation_id: presentationId,
      status: "processing",
      message: "Outline approved. Writing content...",
      slide_count: userOutline.slides.length,
    });

    // Run writers in background
    try {
      const content = await runWriterParallel(userOutline, language);

      // Store content in pipeline state
      await updatePresentationProgress(presentationId, {
        status: "awaiting_content_approval",
        currentStep: "awaiting_content_approval",
        progressPercent: 45,
        pipelineState: {
          ...pipelineState,
          outline: userOutline,
          content,
        },
      });

      wsManager.sendProgress(presentationId, {
        node_name: "writer",
        current_step: "awaiting_content_approval",
        progress_percentage: 45,
        message: "Контент готов — ожидает утверждения",
      });
    } catch (error: any) {
      console.error(`[Interactive] Writer failed for ${presentationId}:`, error);
      await updatePresentationProgress(presentationId, {
        status: "failed",
        currentStep: "error",
        errorInfo: { error_type: "WriterError", error_message: error.message },
      });
      wsManager.sendError(presentationId, {
        error_message: error.message || "Writer failed",
        error_type: "WriterError",
      });
    }
  } catch (error: any) {
    console.error("[Interactive] Approve outline error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 3: Get content — Return generated slide content for review
// ═══════════════════════════════════════════════════════

router.get("/api/v1/interactive/:id/content", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    const pipelineState = p.pipelineState as any;

    res.json({
      presentation_id: presentationId,
      status: p.status,
      title: p.title,
      outline: pipelineState?.outline || null,
      content: pipelineState?.content || null,
    });
  } catch (error: any) {
    console.error("[Interactive] Get content error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 4: Update slide — User edits a single slide's content
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/update-slide", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_content_approval") {
      res.status(400).json({ detail: `Cannot update slides in status: ${p.status}` });
      return;
    }

    const { slide_number, title, text, key_message, notes } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const content: SlideContent[] = pipelineState.content || [];

    // Find and update the slide
    const slideIndex = content.findIndex((s: SlideContent) => s.slide_number === slide_number);
    if (slideIndex === -1) {
      res.status(404).json({ detail: `Slide ${slide_number} not found` });
      return;
    }

    if (title !== undefined) content[slideIndex].title = title;
    if (text !== undefined) content[slideIndex].text = text;
    if (key_message !== undefined) content[slideIndex].key_message = key_message;
    if (notes !== undefined) content[slideIndex].notes = notes;

    await updatePresentationProgress(presentationId, {
      pipelineState: {
        ...pipelineState,
        content,
      },
    });

    res.json({
      presentation_id: presentationId,
      slide_number,
      updated: true,
      slide: content[slideIndex],
    });
  } catch (error: any) {
    console.error("[Interactive] Update slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 5: Assemble — Run theme + layout + composer + final assembly
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/assemble", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_content_approval") {
      res.status(400).json({ detail: `Cannot assemble in status: ${p.status}` });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const plannerResult: PlannerResult = pipelineState.plannerResult;
    const outline: OutlineResult = pipelineState.outline;
    const content: SlideContent[] = pipelineState.content;
    const config = (p.config as Record<string, any>) || {};

    // Update status
    await updatePresentationProgress(presentationId, {
      status: "assembling",
      currentStep: "designing",
      progressPercent: 50,
    });

    // Respond immediately — assembly happens in background
    res.json({
      presentation_id: presentationId,
      status: "assembling",
      message: "Content approved. Assembling presentation...",
    });

    // Run assembly in background
    try {
      // Theme
      wsManager.sendProgress(presentationId, {
        node_name: "theme",
        current_step: "designing",
        progress_percentage: 55,
        message: "Создание визуальной темы...",
      });

      const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
      const theme = await runTheme(
        plannerResult.presentation_title,
        plannerResult.branding,
        outline.target_audience,
        themePreset,
      );

      // Layout
      wsManager.sendProgress(presentationId, {
        node_name: "layout",
        current_step: "layout_selection",
        progress_percentage: 65,
        message: "Выбор макетов для слайдов...",
      });

      const layoutDecisions = await runLayout(content);

      // HTML Composer
      wsManager.sendProgress(presentationId, {
        node_name: "composer",
        current_step: "composing",
        progress_percentage: 70,
        message: "Сборка HTML-слайдов...",
      });

      const slides: Array<{ layoutId: string; data: Record<string, any>; html: string }> = [];
      const layoutMap = new Map(layoutDecisions.map((d) => [d.slide_number, d.layout_name]));

      const batchSize = 5;
      for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (slideContent) => {
            const layoutName = layoutMap.get(slideContent.slide_number) || "text-slide";
            const data = await runHtmlComposer(slideContent, layoutName, theme.css_variables).catch(() =>
              buildFallbackData(slideContent, layoutName),
            );
            const html = renderSlide(layoutName, data);
            return { layoutId: layoutName, data, html };
          }),
        );
        slides.push(...batchResults);

        const progress = 70 + ((i + batch.length) / content.length) * 20;
        wsManager.sendProgress(presentationId, {
          node_name: "composer",
          current_step: "composing",
          progress_percentage: Math.round(progress),
          message: `Собрано ${Math.min(i + batchSize, content.length)} из ${content.length} слайдов`,
          html_content: batchResults[batchResults.length - 1]?.html,
        });
      }

      // Final assembly
      wsManager.sendProgress(presentationId, {
        node_name: "assembler",
        current_step: "assembling",
        progress_percentage: 95,
        message: "Финальная сборка презентации...",
      });

      const language = p.language || "ru";
      const fullHtml = renderPresentation(
        slides,
        theme.css_variables,
        plannerResult.presentation_title,
        language,
        themePreset?.fontsUrl,
      );

      // Upload HTML to S3
      const fileKey = `presentations/${presentationId}/presentation-${nanoid(8)}.html`;
      const { url: htmlUrl } = await storagePut(fileKey, fullHtml, "text/html");

      // Update DB with results
      await updatePresentationProgress(presentationId, {
        status: "completed",
        currentStep: "completed",
        progressPercent: 100,
        title: plannerResult.presentation_title,
        themeCss: theme.css_variables,
        slideCount: slides.length,
        finalHtmlSlides: slides.map((s) => ({
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
        slide_count: slides.length,
        title: plannerResult.presentation_title,
      });

      console.log(`[Interactive] Presentation ${presentationId} completed: ${slides.length} slides`);
    } catch (error: any) {
      console.error(`[Interactive] Assembly failed for ${presentationId}:`, error);
      await updatePresentationProgress(presentationId, {
        status: "failed",
        currentStep: "error",
        errorInfo: { error_type: "AssemblyError", error_message: error.message },
      });
      wsManager.sendError(presentationId, {
        error_message: error.message || "Assembly failed",
        error_type: "AssemblyError",
      });
    }
  } catch (error: any) {
    console.error("[Interactive] Assemble error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

export function registerInteractiveRoutes(app: import("express").Express) {
  app.use(router);
}
