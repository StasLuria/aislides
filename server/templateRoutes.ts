/**
 * Template API Routes — Express REST endpoints for custom template management.
 *
 * Routes:
 *   POST   /api/v1/templates/upload   — upload a PPTX/HTML template file
 *   GET    /api/v1/templates          — list custom templates
 *   GET    /api/v1/templates/:id      — get template details
 *   DELETE /api/v1/templates/:id      — delete a custom template
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import {
  createCustomTemplate,
  getCustomTemplate,
  listCustomTemplates,
  updateCustomTemplate,
  deleteCustomTemplate,
} from "./templateDb";
import { extractFromPptx, extractFromHtml, generateThemeFromExtraction } from "./templateParser";
import { storagePut } from "./storage";
import { renderSlide, renderPresentation, BASE_CSS } from "./pipeline/templateEngine";

const router = Router();

// ── Supported file types ──────────────────────────────
const TEMPLATE_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt (legacy, limited support)
  "text/html",
  "application/xhtml+xml",
];

const MAX_TEMPLATE_SIZE = 50 * 1024 * 1024; // 50MB

// ── Multer config ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_TEMPLATE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (TEMPLATE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: PPTX, HTML`));
    }
  },
});

// ═══════════════════════════════════════════════════════
// UPLOAD TEMPLATE
// ═══════════════════════════════════════════════════════

router.post(
  "/api/v1/templates/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(422).json({ detail: "No file uploaded" });
        return;
      }

      // Multer may encode Cyrillic filenames as latin-1; fix by re-encoding to UTF-8
      let rawName = req.body.name || file.originalname.replace(/\.[^.]+$/, "");
      try {
        // Detect double-encoded UTF-8 (latin-1 interpretation of UTF-8 bytes)
        const buf = Buffer.from(rawName, "latin1");
        const decoded = buf.toString("utf-8");
        // If decoding changes the string and produces valid Cyrillic, use it
        if (decoded !== rawName && /[\u0400-\u04FF]/.test(decoded)) {
          rawName = decoded;
        }
      } catch { /* keep original */ }
      const customName = rawName;

      // Upload source file to S3
      const fileId = nanoid(16);
      const ext = file.originalname.split(".").pop() || "bin";
      const s3Key = `templates/${fileId}/source.${ext}`;
      const { url: sourceFileUrl } = await storagePut(s3Key, file.buffer, file.mimetype);

      // Create template record in DB with "analyzing" status
      const template = await createCustomTemplate({
        userId: null, // TODO: get from auth context when available
        name: customName,
        sourceFileUrl,
        sourceFilename: file.originalname,
        sourceMimeType: file.mimetype,
        status: "analyzing",
      });

      // Start async analysis (don't block response)
      analyzeTemplateAsync(template.templateId, file.buffer, file.mimetype).catch((err) => {
        console.error(`[Templates] Analysis failed for ${template.templateId}:`, err);
      });

      res.json({
        template_id: template.templateId,
        name: template.name,
        status: "analyzing",
        message: "Шаблон загружен и анализируется. Это займёт 10-20 секунд.",
      });
    } catch (err: any) {
      console.error("[Templates] Upload error:", err);
      res.status(500).json({ detail: err.message || "Upload failed" });
    }
  },
);

// ═══════════════════════════════════════════════════════
// LIST TEMPLATES
// ═══════════════════════════════════════════════════════

router.get("/api/v1/templates", async (req: Request, res: Response) => {
  try {
    const templates = await listCustomTemplates(undefined, 50);
    res.json(
      templates.map((t) => ({
        template_id: t.templateId,
        name: t.name,
        description: t.description,
        thumbnail_url: t.thumbnailUrl,
        color_palette: t.colorPalette,
        font_families: t.fontFamilies,
        mood: t.mood,
        status: t.status,
        css_variables: t.cssVariables,
        fonts_url: t.fontsUrl,
        created_at: t.createdAt,
      })),
    );
  } catch (err: any) {
    console.error("[Templates] List error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// GET TEMPLATE DETAILS
// ═══════════════════════════════════════════════════════

router.get("/api/v1/templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await getCustomTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ detail: "Template not found" });
      return;
    }

    res.json({
      template_id: template.templateId,
      name: template.name,
      description: template.description,
      source_file_url: template.sourceFileUrl,
      source_filename: template.sourceFilename,
      thumbnail_url: template.thumbnailUrl,
      css_variables: template.cssVariables,
      fonts_url: template.fontsUrl,
      color_palette: template.colorPalette,
      font_families: template.fontFamilies,
      mood: template.mood,
      status: template.status,
      error_message: template.errorMessage,
      created_at: template.createdAt,
    });
  } catch (err: any) {
    console.error("[Templates] Get error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// DELETE TEMPLATE
// ═══════════════════════════════════════════════════════

router.delete("/api/v1/templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await getCustomTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ detail: "Template not found" });
      return;
    }

    await deleteCustomTemplate(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Templates] Delete error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// ASYNC ANALYSIS
// ═══════════════════════════════════════════════════════

/**
 * Analyze an uploaded template file asynchronously.
 * Extracts colors/fonts from the file, then uses LLM to generate CSS variables.
 */
async function analyzeTemplateAsync(
  templateId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  try {
    console.log(`[Templates] Starting analysis for ${templateId}`);

    // 1. Extract theme info based on file type
    let extracted;
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      mimeType === "application/vnd.ms-powerpoint"
    ) {
      extracted = await extractFromPptx(buffer);
    } else {
      extracted = extractFromHtml(buffer.toString("utf-8"));
    }

    console.log(
      `[Templates] Extracted ${extracted.colors.length} colors, ${extracted.fonts.length} fonts for ${templateId}`,
    );

    // 2. Use LLM to generate CSS theme
    const theme = await generateThemeFromExtraction(extracted);
    console.log(`[Templates] LLM generated theme for ${templateId}: ${theme.suggestedName}`);

    // 3. Generate thumbnail preview
    let thumbnailUrl: string | undefined;
    try {
      thumbnailUrl = await generateThumbnail(templateId, theme.cssVariables, theme.fontsUrl);
    } catch (thumbErr) {
      console.warn(`[Templates] Thumbnail generation failed for ${templateId}:`, thumbErr);
    }

    // 4. Update template record with results
    await updateCustomTemplate(templateId, {
      cssVariables: theme.cssVariables,
      fontsUrl: theme.fontsUrl,
      colorPalette: theme.colorPalette,
      fontFamilies: theme.fontFamilies,
      mood: theme.mood,
      description: theme.mood,
      thumbnailUrl: thumbnailUrl || null,
      status: "ready",
    });

    console.log(`[Templates] Analysis complete for ${templateId}`);
  } catch (err: any) {
    console.error(`[Templates] Analysis failed for ${templateId}:`, err);
    await updateCustomTemplate(templateId, {
      status: "error",
      errorMessage: err.message || "Analysis failed",
    });
  }
}

/**
 * Generate a thumbnail preview by rendering a sample slide with the custom theme.
 */
async function generateThumbnail(
  templateId: string,
  cssVariables: string,
  fontsUrl: string,
): Promise<string> {
  // Render a sample title slide with the custom theme
  const sampleData = {
    title: "Пример презентации",
    description: "Создано с использованием вашего шаблона",
    presenterName: "AI Slides",
    presentationDate: new Date().toLocaleDateString("ru-RU"),
    initials: "AI",
  };

  const slideHtml = renderSlide("title-slide", sampleData);

  const fullHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1280" />
<link href="${fontsUrl}" rel="stylesheet" />
<style>${BASE_CSS}</style>
<style>${cssVariables}</style>
</head>
<body style="margin:0;padding:0;">
<div style="width:1280px;height:720px;overflow:hidden;">
${slideHtml}
</div>
</body></html>`;

  const s3Key = `templates/${templateId}/thumbnail-${nanoid(8)}.html`;
  const { url } = await storagePut(s3Key, fullHtml, "text/html");
  return url;
}

// ═══════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════

export function registerTemplateRoutes(app: import("express").Express) {
  app.use(router);
}
