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
import multer from "multer";
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
import { autoSelectTheme } from "./pipeline/themeSelector";
import { wsManager } from "./wsManager";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
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
      images: pipelineState?.images || {},
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
// STEP 4b: Regenerate slide — Re-run AI writer for a single slide
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/regenerate-slide", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_content_approval") {
      res.status(400).json({ detail: `Cannot regenerate slide in status: ${p.status}` });
      return;
    }

    const { slide_number } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const outline: OutlineResult = pipelineState.outline;
    const content: SlideContent[] = pipelineState.content || [];
    const language = p.language || "ru";

    // Find the outline slide info
    const outlineSlide = outline.slides.find((s: OutlineSlide) => s.slide_number === slide_number);
    if (!outlineSlide) {
      res.status(404).json({ detail: `Slide ${slide_number} not found in outline` });
      return;
    }

    // Find the content slide index
    const slideIndex = content.findIndex((s: SlideContent) => s.slide_number === slide_number);
    if (slideIndex === -1) {
      res.status(404).json({ detail: `Slide ${slide_number} not found in content` });
      return;
    }

    // Build context for the writer
    const allTitles = outline.slides.map((s: OutlineSlide) => `${s.slide_number}. ${s.title}`).join("\n");
    const targetAudience = outline.target_audience || "general";
    const presentationTitle = outline.presentation_title || p.title || "";

    // Call AI writer for this single slide
    const regenerated = await runWriterSingle(
      outlineSlide,
      presentationTitle,
      allTitles,
      targetAudience,
      language,
    );

    // Replace the slide content in the array
    content[slideIndex] = {
      ...regenerated,
      slide_number, // ensure slide_number is preserved
    };

    // Persist updated content
    await updatePresentationProgress(presentationId, {
      pipelineState: {
        ...pipelineState,
        content,
      },
    });

    res.json({
      presentation_id: presentationId,
      slide_number,
      regenerated: true,
      slide: content[slideIndex],
    });
  } catch (error: any) {
    console.error("[Interactive] Regenerate slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 4c: Generate image — AI-generate an illustration for a slide
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/generate-image", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_content_approval") {
      res.status(400).json({ detail: `Cannot generate image in status: ${p.status}` });
      return;
    }

    const { slide_number, prompt } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(422).json({ detail: "prompt is required" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const content: SlideContent[] = pipelineState?.content || [];

    const slideContent = content.find((s: SlideContent) => s.slide_number === slide_number);
    if (!slideContent) {
      res.status(404).json({ detail: `Slide ${slide_number} not found` });
      return;
    }

    // Generate image via AI
    const result = await generateImage({ prompt: prompt.trim() });

    if (!result.url) {
      res.status(500).json({ detail: "Image generation returned no URL" });
      return;
    }

    // Store image in pipelineState.images map
    const images: Record<number, { url: string; prompt: string }> = pipelineState.images || {};
    images[slide_number] = { url: result.url, prompt: prompt.trim() };

    await updatePresentationProgress(presentationId, {
      pipelineState: {
        ...pipelineState,
        images,
      },
    });

    res.json({
      presentation_id: presentationId,
      slide_number,
      image_url: result.url,
      prompt: prompt.trim(),
    });
  } catch (error: any) {
    console.error("[Interactive] Generate image error:", error);
    res.status(500).json({ detail: error.message || "Image generation failed" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 4d: Suggest image prompt — LLM suggests an image description
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/suggest-image-prompt", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    const { slide_number } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const content: SlideContent[] = pipelineState?.content || [];

    const slideContent = content.find((s: SlideContent) => s.slide_number === slide_number);
    if (!slideContent) {
      res.status(404).json({ detail: `Slide ${slide_number} not found` });
      return;
    }

    // Use LLM to suggest an image prompt
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert at creating image generation prompts for presentation slides. Given slide content, suggest a concise, vivid image description suitable for AI image generation. The image should be professional, relevant to the slide topic, and work well as a presentation illustration. Output ONLY the image prompt text, nothing else. Write in English for best image generation quality. Keep it under 100 words.`,
        },
        {
          role: "user",
          content: `Slide title: ${slideContent.title}\nSlide text: ${slideContent.text}\nKey message: ${slideContent.key_message || "N/A"}`,
        },
      ],
    });

    const suggestedPrompt = typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content.trim()
      : "Professional business illustration";

    res.json({
      presentation_id: presentationId,
      slide_number,
      suggested_prompt: suggestedPrompt,
    });
  } catch (error: any) {
    console.error("[Interactive] Suggest image prompt error:", error);
    res.status(500).json({ detail: error.message || "Failed to suggest image prompt" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 4e: Remove image — Remove a generated image from a slide
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/remove-image", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const p = await getPresentation(presentationId);

    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "awaiting_content_approval") {
      res.status(400).json({ detail: `Cannot remove image in status: ${p.status}` });
      return;
    }

    const { slide_number } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const images: Record<number, { url: string; prompt: string }> = pipelineState.images || {};

    delete images[slide_number];

    await updatePresentationProgress(presentationId, {
      pipelineState: {
        ...pipelineState,
        images,
      },
    });

    res.json({
      presentation_id: presentationId,
      slide_number,
      removed: true,
    });
  } catch (error: any) {
    console.error("[Interactive] Remove image error:", error);
    res.status(500).json({ detail: error.message || "Failed to remove image" });
  }
});

// ═══════════════════════════════════════════════════════
// STEP 4f: Upload image — User uploads their own image for a slide
// ═══════════════════════════════════════════════════════

// Multer config: memory storage, 5MB limit, image types only
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Недопустимый формат файла: ${file.mimetype}. Разрешены: JPG, PNG, WebP, GIF`));
    }
  },
});

router.post("/api/v1/interactive/:id/upload-image", (req: Request, res: Response) => {
  upload.single("image")(req, res, async (err: any) => {
    try {
      // Handle multer errors
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ detail: "Файл слишком большой. Максимальный размер: 5 МБ" });
          return;
        }
        res.status(422).json({ detail: err.message || "Ошибка загрузки файла" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(422).json({ detail: "Файл не передан. Используйте поле 'image'" });
        return;
      }

      const presentationId = req.params.id;
      const slideNumber = parseInt(req.body.slide_number, 10);

      if (!slideNumber || isNaN(slideNumber)) {
        res.status(422).json({ detail: "slide_number is required" });
        return;
      }

      const p = await getPresentation(presentationId);
      if (!p) {
        res.status(404).json({ detail: "Presentation not found" });
        return;
      }

      if (p.status !== "awaiting_content_approval") {
        res.status(400).json({ detail: `Cannot upload image in status: ${p.status}` });
        return;
      }

      const pipelineState = p.pipelineState as any;
      const content: SlideContent[] = pipelineState?.content || [];

      const slideContent = content.find((s: SlideContent) => s.slide_number === slideNumber);
      if (!slideContent) {
        res.status(404).json({ detail: `Slide ${slideNumber} not found` });
        return;
      }

      // Determine file extension from mimetype
      const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const ext = extMap[file.mimetype] || "png";

      // Upload to S3
      const fileKey = `presentations/${presentationId}/user-upload-slide${slideNumber}-${nanoid(8)}.${ext}`;
      const { url: imageUrl } = await storagePut(fileKey, file.buffer, file.mimetype);

      // Store in pipelineState.images map (same structure as AI-generated images)
      const images: Record<number, { url: string; prompt: string }> = pipelineState.images || {};
      images[slideNumber] = { url: imageUrl, prompt: `[Загружено пользователем] ${file.originalname}` };

      await updatePresentationProgress(presentationId, {
        pipelineState: {
          ...pipelineState,
          images,
        },
      });

      res.json({
        presentation_id: presentationId,
        slide_number: slideNumber,
        image_url: imageUrl,
        filename: file.originalname,
        size: file.size,
      });
    } catch (error: any) {
      console.error("[Interactive] Upload image error:", error);
      res.status(500).json({ detail: error.message || "Image upload failed" });
    }
  });
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

      let themePreset;
      if (config.theme_preset === "auto" || !config.theme_preset) {
        // Use presentation title + branding as the prompt for theme selection
        const themePrompt = `${plannerResult.presentation_title} — ${plannerResult.branding.industry} ${plannerResult.branding.style_preference}`;
        const autoResult = await autoSelectTheme(themePrompt);
        themePreset = getThemePreset(autoResult.themeId);
        console.log(`[Interactive] Auto-selected theme: ${autoResult.themeId} (${autoResult.method})`);
        // Save the resolved theme back to config for subsequent operations
        config.theme_preset = autoResult.themeId;
      } else {
        themePreset = getThemePreset(config.theme_preset);
      }
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

      // Get generated images from pipelineState
      const generatedImages: Record<number, { url: string; prompt: string }> = pipelineState.images || {};

      // Layout fixup: remap image-requiring layouts that have no image to text-based alternatives
      const IMAGE_REQUIRING_LAYOUTS = new Set(["image-text", "image-fullscreen", "quote-slide"]);
      const FALLBACK_LAYOUTS = ["text-slide", "two-column", "process-steps", "icons-numbers"];
      let fallbackIdx = 0;
      for (const [slideNum, layout] of Array.from(layoutMap.entries())) {
        if (IMAGE_REQUIRING_LAYOUTS.has(layout) && !generatedImages[slideNum]) {
          const replacement = FALLBACK_LAYOUTS[fallbackIdx % FALLBACK_LAYOUTS.length];
          console.log(`[Interactive] Layout fixup: slide ${slideNum} "${layout}" \u2192 "${replacement}" (no image)`);
          layoutMap.set(slideNum, replacement);
          fallbackIdx++;
        }
      }

      const batchSize = 5;
      for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (slideContent) => {
            let layoutName = layoutMap.get(slideContent.slide_number) || "text-slide";
            const slideImage = generatedImages[slideContent.slide_number];

            // Override layout to image-text if image exists (unless title/final/section)
            if (slideImage && !["title-slide", "final-slide", "section-header"].includes(layoutName)) {
              layoutName = "image-text";
            }

            let data = await runHtmlComposer(slideContent, layoutName, theme.css_variables).catch(() =>
              buildFallbackData(slideContent, layoutName),
            );

            // Post-process: truncate description for title/final slides to prevent overflow
            if ((layoutName === "title-slide" || layoutName === "final-slide") && data.description && data.description.length > 200) {
              data.description = data.description.substring(0, 200);
            }

            // Inject image data into template data
            if (slideImage) {
              data.image = { url: slideImage.url, alt: slideContent.title };
              data.backgroundImage = { url: slideImage.url, alt: slideContent.title };
            }

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

// ═══════════════════════════════════════════════════════
// PREVIEW: Render a single slide as standalone HTML
// ═══════════════════════════════════════════════════════

router.post("/api/v1/interactive/:id/preview-slide", async (req: Request, res: Response) => {
  try {
    const presentationId = req.params.id;
    const { slide_number } = req.body;

    if (!slide_number || typeof slide_number !== "number") {
      res.status(422).json({ detail: "slide_number is required" });
      return;
    }

    const p = await getPresentation(presentationId);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    const pipelineState = p.pipelineState as any;
    const content: SlideContent[] = pipelineState?.content || [];
    const config = (p.config as Record<string, any>) || {};

    const slideContent = content.find((s: SlideContent) => s.slide_number === slide_number);
    if (!slideContent) {
      res.status(404).json({ detail: `Slide ${slide_number} not found` });
      return;
    }

    // Get theme preset
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    // Check if there's a generated image for this slide
    const images: Record<number, { url: string; prompt: string }> = pipelineState.images || {};
    const slideImage = images[slide_number];

    // Determine layout — use image-text if image exists (unless title/final slide)
    let layoutName = pickLayoutForPreview(slideContent, content.length, slide_number);
    if (slideImage && layoutName !== "title-slide" && layoutName !== "final-slide") {
      layoutName = "image-text";
    }

    // Build slide data from content using the canonical buildFallbackData
    const slideData = buildFallbackData(slideContent, layoutName);
    // Inject image data if available
    if (slideImage?.url) {
      slideData.image = { url: slideImage.url, alt: slideContent.title };
      slideData.backgroundImage = { url: slideImage.url, alt: slideContent.title };
    }

    // Render the slide HTML
    const slideHtml = renderSlide(layoutName, slideData);

    // Import BASE_CSS from templateEngine
    const { BASE_CSS } = await import("./pipeline/templateEngine");

    // Wrap in a standalone HTML document
    const html = `<!DOCTYPE html>
<html lang="${p.language || 'ru'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${themePreset.fontsUrl}" rel="stylesheet" />
  <style>${BASE_CSS}</style>
  <style>${themePreset.cssVariables}</style>
  <style>
    body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="slide" style="width:1280px; height:720px; overflow:hidden;">
    ${slideHtml}
  </div>
</body>
</html>`;

    res.json({
      presentation_id: presentationId,
      slide_number,
      layout: layoutName,
      html,
    });
  } catch (error: any) {
    console.error("[Interactive] Preview slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

/**
 * Quick layout picker for preview — no LLM call, uses heuristics.
 */
export function pickLayoutForPreview(slide: SlideContent, totalSlides: number, slideNumber: number): string {
  // First slide → title
  if (slideNumber === 1) return "title-slide";
  // Last slide → final
  if (slideNumber === totalSlides) return "final-slide";

  const text = slide.text || "";
  const hasDataPoints = slide.data_points && slide.data_points.length > 0;
  const hasBullets = text.includes("\n-") || text.includes("\n•") || text.includes("\n*");
  const bulletCount = (text.match(/\n[-•*]/g) || []).length;

  // Data-heavy → chart or metrics
  if (hasDataPoints && slide.data_points.length >= 3) return "metrics-slide";
  if (hasDataPoints && slide.data_points.length >= 1) return "two-column-slide";

  // Many bullets → bullet-list
  if (bulletCount >= 4) return "bullet-list-slide";

  // Short text with strong key message → quote
  if (text.length < 200 && slide.key_message && slide.key_message.length > 20) return "quote-slide";

  // Medium content → text slide
  if (hasBullets || text.length > 300) return "text-slide";

  // Default
  return "text-slide";
}

export function registerInteractiveRoutes(app: import("express").Express) {
  app.use(router);
}
