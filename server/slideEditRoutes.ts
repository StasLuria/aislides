/**
 * Slide Edit Routes — Edit individual slides in completed presentations
 * without full regeneration.
 *
 * Routes:
 *   GET    /api/v1/presentations/:id/slides                  — get all slide data (layout + data)
 *   GET    /api/v1/presentations/:id/slides/:index            — get single slide data
 *   GET    /api/v1/presentations/:id/slides/:index/editable   — get slide HTML with inline editing
 *   PUT    /api/v1/presentations/:id/slides/:index            — update slide text/data fields
 *   PATCH  /api/v1/presentations/:id/slides/:index            — update single field inline
 *   POST   /api/v1/presentations/:id/slides/:index/image      — upload/replace slide image
 *   DELETE /api/v1/presentations/:id/slides/:index/image      — remove slide image
 *   POST   /api/v1/presentations/:id/slides/:index/layout     — change slide layout
 *   POST   /api/v1/presentations/:id/reassemble               — re-render full HTML from edited slides
 *   POST   /api/v1/presentations/:id/reorder                  — rearrange slides in a new order
 *   POST   /api/v1/presentations/:id/slides/:index/reorder-items — reorder items within a slide array
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { getPresentation, updatePresentationProgress } from "./presentationDb";
import { renderSlide, renderPresentation, BASE_CSS } from "./pipeline/templateEngine";
import { getThemePreset } from "./pipeline/themes";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { buildEditableSlideHtml, getEditableFields, setFieldValue } from "./pipeline/inlineFieldInjector";
import { saveSlideVersion, listSlideVersions, getSlideVersion } from "./versionDb";

const router = Router();

/**
 * Normalize slide data from DB — handles legacy `layout_id` key migration to `layoutId`.
 * Some older presentations stored slides with `layout_id` instead of `layoutId`.
 */
function normalizeSlides(rawSlides: any[]): any[] {
  return rawSlides.map((s: any) => ({
    ...s,
    layoutId: s.layoutId || s.layout_id || "text-slide",
  }));
}

// Multer for image uploads (5MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

// ═══════════════════════════════════════════════════════
// GET all slides — returns array of { layoutId, data } for editing
// ═══════════════════════════════════════════════════════

router.get("/api/v1/presentations/:id/slides", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    res.json({
      presentation_id: p.presentationId,
      title: p.title,
      theme_preset: config.theme_preset || "corporate_blue",
      theme_css: p.themeCss || themePreset.cssVariables,
      fonts_url: themePreset.fontsUrl,
      language: p.language || "ru",
      slides: slides.map((s: any, i: number) => ({
        index: i,
        layoutId: s.layoutId,
        data: s.data,
      })),
    });
  } catch (error: any) {
    console.error("[SlideEdit] Get slides error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// GET single slide — returns { layoutId, data, html }
// ═══════════════════════════════════════════════════════

router.get("/api/v1/presentations/:id/slides/:index", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range (0-${slides.length - 1})` });
      return;
    }

    const slide = slides[index];
    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    // Render the slide HTML
    const slideHtml = renderSlide(slide.layoutId, slide.data);

    // Wrap in standalone HTML for preview
    const html = buildSlidePreviewHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slide.layoutId,
      data: slide.data,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Get slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// PUT slide — update text/data fields on a single slide
// ═══════════════════════════════════════════════════════

router.put("/api/v1/presentations/:id/slides/:index", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const { data: newData } = req.body;

    if (!newData || typeof newData !== "object") {
      res.status(422).json({ detail: "data object is required" });
      return;
    }

    // Save version snapshot BEFORE modifying
    const oldSlideHtml = renderSlide(slides[index].layoutId, slides[index].data);
    await saveSlideVersion({
      presentationId: req.params.id,
      slideIndex: index,
      slideHtml: oldSlideHtml,
      slideData: slides[index].data,
      changeType: "edit",
      changeDescription: "Full data update via PUT",
    });

    // Merge new data into existing slide data (shallow merge)
    const updatedData = { ...slides[index].data, ...newData };
    slides[index] = { ...slides[index], data: updatedData };

    // Re-render the slide HTML
    const slideHtml = renderSlide(slides[index].layoutId, updatedData);

    // Save updated slides to DB
    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    const html = buildSlidePreviewHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slides[index].layoutId,
      data: updatedData,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Update slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST slide image — upload/replace image on a slide
// ═══════════════════════════════════════════════════════

router.post(
  "/api/v1/presentations/:id/slides/:index/image",
  upload.single("image"),
  async (req: Request, res: Response) => {
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

      const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
      const index = parseInt(req.params.index);

      if (isNaN(index) || index < 0 || index >= slides.length) {
        res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
        return;
      }

      if (!req.file) {
        res.status(422).json({ detail: "Image file is required" });
        return;
      }

      // Upload to S3
      const ext = req.file.originalname.split(".").pop() || "png";
      const fileKey = `presentations/${req.params.id}/slide-${index}-${nanoid(8)}.${ext}`;
      const { url: imageUrl } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

      // Update slide data with new image
      const slideData = slides[index].data;
      slideData.image = { url: imageUrl, alt: slideData.title || "" };
      slideData.backgroundImage = { url: imageUrl, alt: slideData.title || "" };

      // If the slide layout doesn't support images, switch to image-text
      const imageLayouts = new Set(["image-text", "image-fullscreen", "title-slide"]);
      if (!imageLayouts.has(slides[index].layoutId)) {
        slides[index].layoutId = "image-text";
      }

      slides[index] = { ...slides[index], data: slideData };

      // Re-render the slide HTML
      const slideHtml = renderSlide(slides[index].layoutId, slideData);

      // Save updated slides to DB
      await updatePresentationProgress(req.params.id, {
        finalHtmlSlides: slides,
      });

      const config = (p.config as Record<string, any>) || {};
      const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

      const html = buildSlidePreviewHtml(
        slideHtml,
        p.themeCss || themePreset.cssVariables,
        themePreset.fontsUrl,
        p.language || "ru",
      );

      res.json({
        presentation_id: p.presentationId,
        index,
        layoutId: slides[index].layoutId,
        data: slideData,
        image_url: imageUrl,
        html,
      });
    } catch (error: any) {
      console.error("[SlideEdit] Upload image error:", error);
      if (error.message?.includes("Only JPEG")) {
        res.status(422).json({ detail: error.message });
        return;
      }
      res.status(500).json({ detail: error.message || "Internal server error" });
    }
  },
);

// ═══════════════════════════════════════════════════════
// DELETE slide image — remove image from a slide
// ═══════════════════════════════════════════════════════

router.delete("/api/v1/presentations/:id/slides/:index/image", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    // Remove image data
    const slideData = slides[index].data;
    delete slideData.image;
    delete slideData.backgroundImage;

    // If layout was image-dependent, switch to text-slide
    const imageLayouts = new Set(["image-text", "image-fullscreen"]);
    if (imageLayouts.has(slides[index].layoutId)) {
      slides[index].layoutId = "text-slide";
    }

    slides[index] = { ...slides[index], data: slideData };

    // Re-render
    const slideHtml = renderSlide(slides[index].layoutId, slideData);

    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    const html = buildSlidePreviewHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slides[index].layoutId,
      data: slideData,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Delete image error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// GET editable slide HTML — returns slide HTML with inline editing script
// ═══════════════════════════════════════════════════════

router.get("/api/v1/presentations/:id/slides/:index/editable", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range (0-${slides.length - 1})` });
      return;
    }

    const slide = slides[index];
    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    // Render the slide HTML
    const slideHtml = renderSlide(slide.layoutId, slide.data);

    // Wrap in editable HTML with inline editing script
    const html = buildEditableSlideHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
      slide.layoutId,
      slide.data,
      BASE_CSS,
    );

    const fields = getEditableFields(slide.layoutId, slide.data);

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slide.layoutId,
      data: slide.data,
      html,
      editableFields: fields,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Get editable slide error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// PATCH slide field — update a single text field inline
// ═══════════════════════════════════════════════════════

router.patch("/api/v1/presentations/:id/slides/:index", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const { field, value } = req.body;

    if (!field || typeof field !== "string") {
      res.status(422).json({ detail: "field name is required" });
      return;
    }
    if (typeof value !== "string") {
      res.status(422).json({ detail: "value must be a string" });
      return;
    }

    // Validate field is editable for this layout
    const editableFields = getEditableFields(slides[index].layoutId, slides[index].data);
    const fieldDef = editableFields.find(f => f.key === field);
    if (!fieldDef) {
      res.status(422).json({ detail: `Field '${field}' is not editable for layout '${slides[index].layoutId}'` });
      return;
    }

    // Save version snapshot BEFORE modifying
    const oldSlideHtml = renderSlide(slides[index].layoutId, slides[index].data);
    await saveSlideVersion({
      presentationId: req.params.id,
      slideIndex: index,
      slideHtml: oldSlideHtml,
      slideData: slides[index].data,
      changeType: "edit",
      changeDescription: `Field '${field}' updated`,
    });

    // Update the specific field using dot-notation path support
    setFieldValue(slides[index].data, field, value);

    // Re-render the slide HTML
    const slideHtml = renderSlide(slides[index].layoutId, slides[index].data);

    // Save updated slides to DB
    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    // Return editable HTML for the updated slide
    const html = buildEditableSlideHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
      slides[index].layoutId,
      slides[index].data,
      BASE_CSS,
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slides[index].layoutId,
      data: slides[index].data,
      field,
      value,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Patch slide field error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST change layout — switch a slide to a different layout
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/slides/:index/layout", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const { layoutId } = req.body;
    if (!layoutId || typeof layoutId !== "string") {
      res.status(422).json({ detail: "layoutId is required" });
      return;
    }

    // Save version snapshot BEFORE modifying
    const oldSlideHtml = renderSlide(slides[index].layoutId, slides[index].data);
    await saveSlideVersion({
      presentationId: req.params.id,
      slideIndex: index,
      slideHtml: oldSlideHtml,
      slideData: slides[index].data,
      changeType: "edit",
      changeDescription: `Layout changed to '${layoutId}'`,
    });

    // Update layout
    slides[index] = { ...slides[index], layoutId };

    // Re-render
    const slideHtml = renderSlide(layoutId, slides[index].data);

    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    const html = buildSlidePreviewHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId,
      data: slides[index].data,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Change layout error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST reassemble — re-render full HTML from edited slides and upload to S3
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/reassemble", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides to assemble" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const language = p.language || "ru";

    // Re-render all slides
    const renderedSlides = slides.map((s: any) => ({
      layoutId: s.layoutId,
      data: s.data,
      html: renderSlide(s.layoutId, s.data),
    }));

    const fullHtml = renderPresentation(
      renderedSlides,
      p.themeCss || themePreset.cssVariables,
      p.title || "Presentation",
      language,
      themePreset.fontsUrl,
    );

    // Upload new HTML to S3
    const fileKey = `presentations/${req.params.id}/presentation-edited-${nanoid(8)}.html`;
    const { url: htmlUrl } = await storagePut(fileKey, fullHtml, "text/html");

    // Update result URLs
    const resultUrls = (p.resultUrls as Record<string, any>) || {};
    resultUrls.html_preview = htmlUrl;

    await updatePresentationProgress(req.params.id, {
      resultUrls,
    });

    res.json({
      presentation_id: p.presentationId,
      html_url: htmlUrl,
      slide_count: slides.length,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Reassemble error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST reorder — rearrange slides in a new order
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/reorder", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides to reorder" });
      return;
    }

    const { order } = req.body;

    // Validate order array
    if (!Array.isArray(order)) {
      res.status(422).json({ detail: "order must be an array of slide indices" });
      return;
    }

    if (order.length !== slides.length) {
      res.status(422).json({ detail: `order length (${order.length}) must match slide count (${slides.length})` });
      return;
    }

    // Validate all indices are present exactly once
    const sorted = [...order].sort((a, b) => a - b);
    const expected = Array.from({ length: slides.length }, (_, i) => i);
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      res.status(422).json({ detail: "order must contain each index from 0 to " + (slides.length - 1) + " exactly once" });
      return;
    }

    // Reorder slides
    const reorderedSlides = order.map((idx: number) => slides[idx]);

    // Save reordered slides to DB
    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: reorderedSlides,
    });

    // Re-render full presentation HTML
    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");
    const language = p.language || "ru";

    const renderedSlides = reorderedSlides.map((s: any) => ({
      layoutId: s.layoutId,
      data: s.data,
      html: renderSlide(s.layoutId, s.data),
    }));

    const fullHtml = renderPresentation(
      renderedSlides,
      p.themeCss || themePreset.cssVariables,
      p.title || "Presentation",
      language,
      themePreset.fontsUrl,
    );

    // Upload new HTML to S3
    const fileKey = `presentations/${req.params.id}/presentation-reordered-${nanoid(8)}.html`;
    const { url: htmlUrl } = await storagePut(fileKey, fullHtml, "text/html");

    // Update result URLs
    const resultUrls = (p.resultUrls as Record<string, any>) || {};
    resultUrls.html_preview = htmlUrl;

    await updatePresentationProgress(req.params.id, {
      resultUrls,
    });

    res.json({
      presentation_id: p.presentationId,
      html_url: htmlUrl,
      slide_count: reorderedSlides.length,
      order,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Reorder error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST reorder items — reorder elements within a slide array
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/slides/:index/reorder-items", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const { arrayPath, order } = req.body;

    if (!arrayPath || typeof arrayPath !== "string") {
      res.status(422).json({ detail: "arrayPath is required (e.g. 'bullets', 'stages', 'milestones')" });
      return;
    }

    if (!Array.isArray(order)) {
      res.status(422).json({ detail: "order must be an array of indices" });
      return;
    }

    // Navigate to the array using dot-notation path
    const slideData = slides[index].data;
    const pathParts = arrayPath.split(".");
    let target: any = slideData;
    for (const part of pathParts) {
      if (target == null || typeof target !== "object") {
        res.status(422).json({ detail: `Invalid arrayPath: '${arrayPath}' - '${part}' not found` });
        return;
      }
      target = target[part];
    }

    if (!Array.isArray(target)) {
      res.status(422).json({ detail: `'${arrayPath}' is not an array in slide data` });
      return;
    }

    // Validate order indices
    if (order.length !== target.length) {
      res.status(422).json({ detail: `order length (${order.length}) must match array length (${target.length})` });
      return;
    }

    const sorted = [...order].sort((a, b) => a - b);
    const expected = Array.from({ length: target.length }, (_, i) => i);
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      res.status(422).json({ detail: "order must contain each index from 0 to " + (target.length - 1) + " exactly once" });
      return;
    }

    // Save version snapshot BEFORE modifying
    const oldSlideHtml = renderSlide(slides[index].layoutId, slides[index].data);
    await saveSlideVersion({
      presentationId: req.params.id,
      slideIndex: index,
      slideHtml: oldSlideHtml,
      slideData: slides[index].data,
      changeType: "edit",
      changeDescription: `Reordered '${arrayPath}' items`,
    });

    // Apply reorder
    const reordered = order.map((idx: number) => target[idx]);

    // Set the reordered array back into the data
    let parentObj: any = slideData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      parentObj = parentObj[pathParts[i]];
    }
    parentObj[pathParts[pathParts.length - 1]] = reordered;

    // Re-render the slide HTML
    const slideHtml = renderSlide(slides[index].layoutId, slideData);

    // Save updated slides to DB
    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    // Return editable HTML for the updated slide
    const html = buildEditableSlideHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
      slides[index].layoutId,
      slides[index].data,
      BASE_CSS,
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slides[index].layoutId,
      data: slideData,
      html,
      arrayPath,
      order,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Reorder items error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// GET slide versions — list version history for a slide
// ═══════════════════════════════════════════════════════

router.get("/api/v1/presentations/:id/slides/:index/versions", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    const index = parseInt(req.params.index);
    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const versions = await listSlideVersions(req.params.id, index);

    res.json({
      presentation_id: req.params.id,
      slide_index: index,
      versions: versions.map((v) => ({
        id: v.id,
        version_number: v.versionNumber,
        change_type: v.changeType,
        change_description: v.changeDescription,
        created_at: v.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[SlideEdit] List versions error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// GET slide version preview — get HTML preview of a specific version
// ═══════════════════════════════════════════════════════

router.get("/api/v1/presentations/:id/slides/:index/versions/:versionId", async (req: Request, res: Response) => {
  try {
    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    const versionId = parseInt(req.params.versionId);
    if (isNaN(versionId)) {
      res.status(400).json({ detail: "Invalid version ID" });
      return;
    }

    const version = await getSlideVersion(versionId);
    if (!version || version.presentationId !== req.params.id) {
      res.status(404).json({ detail: "Version not found" });
      return;
    }

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    const html = buildSlidePreviewHtml(
      version.slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      id: version.id,
      version_number: version.versionNumber,
      slide_index: version.slideIndex,
      change_type: version.changeType,
      change_description: version.changeDescription,
      slide_data: version.slideData,
      html,
      created_at: version.createdAt,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Get version error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST restore slide version — restore a slide to a previous version
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/slides/:index/versions/:versionId/restore", async (req: Request, res: Response) => {
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

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    const index = parseInt(req.params.index);

    if (isNaN(index) || index < 0 || index >= slides.length) {
      res.status(404).json({ detail: `Slide index ${req.params.index} out of range` });
      return;
    }

    const versionId = parseInt(req.params.versionId);
    if (isNaN(versionId)) {
      res.status(400).json({ detail: "Invalid version ID" });
      return;
    }

    const version = await getSlideVersion(versionId);
    if (!version || version.presentationId !== req.params.id || version.slideIndex !== index) {
      res.status(404).json({ detail: "Version not found for this slide" });
      return;
    }

    // Save current state as a version before restoring
    const currentSlideHtml = renderSlide(slides[index].layoutId, slides[index].data);
    await saveSlideVersion({
      presentationId: req.params.id,
      slideIndex: index,
      slideHtml: currentSlideHtml,
      slideData: slides[index].data,
      changeType: "edit",
      changeDescription: `Before restore to version ${version.versionNumber}`,
    });

    // Restore the slide data from the version
    const restoredData = version.slideData as any;
    slides[index] = {
      ...slides[index],
      data: restoredData,
    };

    // Re-render the slide HTML
    const slideHtml = renderSlide(slides[index].layoutId, restoredData);

    // Save updated slides to DB
    await updatePresentationProgress(req.params.id, {
      finalHtmlSlides: slides,
    });

    const config = (p.config as Record<string, any>) || {};
    const themePreset = getThemePreset(config.theme_preset || "corporate_blue");

    const html = buildSlidePreviewHtml(
      slideHtml,
      p.themeCss || themePreset.cssVariables,
      themePreset.fontsUrl,
      p.language || "ru",
    );

    res.json({
      presentation_id: p.presentationId,
      index,
      layoutId: slides[index].layoutId,
      data: restoredData,
      restored_from_version: version.versionNumber,
      html,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Restore version error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// POST change-theme — switch theme and re-render all slides
// ═══════════════════════════════════════════════════════

router.post("/api/v1/presentations/:id/change-theme", async (req: Request, res: Response) => {
  try {
    const { theme_preset_id } = req.body;
    if (!theme_preset_id || typeof theme_preset_id !== "string") {
      res.status(400).json({ detail: "theme_preset_id is required" });
      return;
    }

    const p = await getPresentation(req.params.id);
    if (!p) {
      res.status(404).json({ detail: "Presentation not found" });
      return;
    }

    if (p.status !== "completed") {
      res.status(400).json({ detail: "Presentation is not completed yet" });
      return;
    }

    // Get the new theme
    let newTheme: ReturnType<typeof getThemePreset>;
    try {
      newTheme = getThemePreset(theme_preset_id);
    } catch {
      res.status(400).json({ detail: `Unknown theme: ${theme_preset_id}` });
      return;
    }

    const slides = normalizeSlides((p.finalHtmlSlides as any[]) || []);
    if (slides.length === 0) {
      res.status(400).json({ detail: "No slides to re-render" });
      return;
    }

    const language = p.language || "ru";

    // Re-render all slides with the new theme
    const renderedSlides = slides.map((s: any) => ({
      layoutId: s.layoutId,
      data: s.data,
      html: renderSlide(s.layoutId, s.data),
    }));

    const fullHtml = renderPresentation(
      renderedSlides,
      newTheme.cssVariables,
      p.title || "Presentation",
      language,
      newTheme.fontsUrl,
    );

    // Upload new HTML to S3
    const fileKey = `presentations/${req.params.id}/presentation-theme-${theme_preset_id}-${nanoid(8)}.html`;
    const { url: htmlUrl } = await storagePut(fileKey, fullHtml, "text/html");

    // Update config with new theme and save new CSS + result URLs
    const config = { ...((p.config as Record<string, any>) || {}), theme_preset: theme_preset_id };
    const resultUrls = { ...((p.resultUrls as Record<string, any>) || {}), html_preview: htmlUrl };

    await updatePresentationProgress(req.params.id, {
      config,
      themeCss: newTheme.cssVariables,
      resultUrls,
    });

    res.json({
      presentation_id: p.presentationId,
      theme_preset_id: theme_preset_id,
      theme_name: newTheme.name,
      html_url: htmlUrl,
      slide_count: slides.length,
    });
  } catch (error: any) {
    console.error("[SlideEdit] Change theme error:", error);
    res.status(500).json({ detail: error.message || "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════
// GET available themes — returns list of theme presets
// ═══════════════════════════════════════════════════════

router.get("/api/v1/themes", (_req: Request, res: Response) => {
  // Import from shared to get the base list
  const { THEME_PRESETS_BASE } = require("../shared/themes");
  res.json(THEME_PRESETS_BASE);
});

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function buildSlidePreviewHtml(
  slideHtml: string,
  themeCss: string,
  fontsUrl: string,
  language: string,
): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>${BASE_CSS}</style>
  <style>${themeCss}</style>
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
}

export function registerSlideEditRoutes(app: import("express").Express) {
  app.use(router);
}
