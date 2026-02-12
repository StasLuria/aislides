/**
 * Presentation Generator Pipeline — orchestrates LLM agents to create presentations.
 * Pipeline: Planner → Outline → Writer (parallel) → Theme → Layout → HTML Composer → Assembly
 */
import { invokeLLM } from "../_core/llm";
import {
  masterPlannerUser,
  MASTER_PLANNER_SYSTEM,
  outlineSystem,
  outlineUser,
  writerSystem,
  writerUser,
  THEME_SYSTEM,
  themeUser,
  LAYOUT_SYSTEM,
  layoutUser,
  htmlComposerSystem,
  htmlComposerUser,
} from "./prompts";
import { renderSlide, renderPresentation, getLayoutTemplate } from "./templateEngine";
import { getThemePreset, type ThemePreset } from "./themes";
import { generateImage } from "../_core/imageGeneration";
import { validateSlideData, autoFixSlideData } from "./qaAgent";
import { analyzeContentDensity, generateAdaptiveStyles } from "./adaptiveSizing";
import { runStorytellingAgent } from "./storytellingAgent";
import { runOutlineCritic } from "./outlineCritic";
import { runSpeakerCoach, applySpeakerNotes } from "./speakerCoachAgent";
import { runDesignCritic, type SlideDesignData } from "./designCriticAgent";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface GenerationConfig {
  themePreset?: string;
  enableImages?: boolean;
}

export interface PipelineProgress {
  nodeName: string;
  currentStep: string;
  progressPercent: number;
  slidePreview?: string;
  message?: string;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

export interface PlannerResult {
  source_type: string;
  language: string;
  presentation_title: string;
  branding: {
    company_name: string;
    industry: string;
    style_preference: string;
    color_hint: string;
  };
}

export interface OutlineSlide {
  slide_number: number;
  title: string;
  purpose: string;
  key_points: string[];
  speaker_notes_hint: string;
}

export interface OutlineResult {
  presentation_title: string;
  target_audience: string;
  narrative_arc: string;
  slides: OutlineSlide[];
}

export interface SlideContent {
  slide_number: number;
  title: string;
  text: string;
  notes: string;
  data_points: Array<{ label: string; value: string; unit: string }>;
  key_message: string;
}

export interface ThemeResult {
  theme_name: string;
  colors: {
    primary: string;
    primary_light: string;
    secondary: string;
    background: string;
    text_primary: string;
    text_secondary: string;
  };
  font_heading: string;
  font_body: string;
  css_variables: string;
}

export interface LayoutDecision {
  slide_number: number;
  layout_name: string;
  rationale: string;
}

// ═══════════════════════════════════════════════════════
// LLM HELPER
// ═══════════════════════════════════════════════════════

async function llmStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schema: Record<string, any>,
): Promise<T> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error(`LLM returned empty response for ${schemaName}`);
  const textContent = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(textContent) as T;
}

async function llmText(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) return "";
  return typeof content === 'string' ? content : JSON.stringify(content);
}

// ═══════════════════════════════════════════════════════
// AGENT FUNCTIONS
// ═══════════════════════════════════════════════════════

export async function runPlanner(prompt: string): Promise<PlannerResult> {
  return llmStructured<PlannerResult>(
    MASTER_PLANNER_SYSTEM,
    masterPlannerUser(prompt),
    "MasterPlannerOutput",
    {
      type: "object",
      properties: {
        source_type: { type: "string", description: "Source type" },
        language: { type: "string", description: "Language code" },
        presentation_title: { type: "string", description: "Presentation title" },
        branding: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            industry: { type: "string" },
            style_preference: { type: "string" },
            color_hint: { type: "string" },
          },
          required: ["company_name", "industry", "style_preference", "color_hint"],
          additionalProperties: false,
        },
      },
      required: ["source_type", "language", "presentation_title", "branding"],
      additionalProperties: false,
    },
  );
}

export async function runOutline(
  prompt: string,
  branding: PlannerResult["branding"],
  language: string,
): Promise<OutlineResult> {
  const system = outlineSystem(language);
  const brandingStr = JSON.stringify(branding);
  const user = outlineUser(prompt, brandingStr);

  return llmStructured<OutlineResult>(system, user, "OutlineOutput", {
    type: "object",
    properties: {
      presentation_title: { type: "string" },
      target_audience: { type: "string" },
      narrative_arc: { type: "string" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slide_number: { type: "integer" },
            title: { type: "string" },
            purpose: { type: "string" },
            key_points: { type: "array", items: { type: "string" } },
            speaker_notes_hint: { type: "string" },
          },
          required: ["slide_number", "title", "purpose", "key_points", "speaker_notes_hint"],
          additionalProperties: false,
        },
      },
    },
    required: ["presentation_title", "target_audience", "narrative_arc", "slides"],
    additionalProperties: false,
  });
}

export async function runWriterSingle(
  slideInfo: OutlineSlide,
  presentationTitle: string,
  allTitles: string,
  targetAudience: string,
  language: string,
  previousContext?: string,
): Promise<SlideContent> {
  const system = writerSystem(language, presentationTitle, allTitles, targetAudience);
  const user = writerUser(
    slideInfo.slide_number,
    slideInfo.title,
    slideInfo.purpose,
    slideInfo.key_points.join(", "),
    previousContext,
  );

  const result = await llmStructured<{ slide: SlideContent }>(system, user, "WriterOutput", {
    type: "object",
    properties: {
      slide: {
        type: "object",
        properties: {
          slide_number: { type: "integer" },
          title: { type: "string" },
          text: { type: "string" },
          notes: { type: "string" },
          data_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                unit: { type: "string" },
              },
              required: ["label", "value", "unit"],
              additionalProperties: false,
            },
          },
          key_message: { type: "string" },
        },
        required: ["slide_number", "title", "text", "notes", "data_points", "key_message"],
        additionalProperties: false,
      },
    },
    required: ["slide"],
    additionalProperties: false,
  });

  return result.slide;
}

/**
 * Build a concise context summary from previously written slides.
 * Keeps only key_message and title to avoid token bloat.
 */
function buildWriterContext(writtenSlides: SlideContent[]): string {
  if (writtenSlides.length === 0) return "";

  // Keep last 4 slides' context to avoid token bloat
  const recent = writtenSlides.slice(-4);
  return recent
    .map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`)
    .join("\n");
}

export async function runWriterParallel(
  outline: OutlineResult,
  language: string,
  onSlideWritten?: (slideNum: number, total: number) => void,
): Promise<SlideContent[]> {
  const allTitles = outline.slides.map((s) => s.title).join(", ");
  const results: SlideContent[] = [];

  // Semi-sequential: write in small batches of 2-3 slides,
  // passing context from previous batches for coherence.
  // This balances speed (some parallelism) with context awareness.
  const batchSize = 2;

  for (let i = 0; i < outline.slides.length; i += batchSize) {
    const batch = outline.slides.slice(i, i + batchSize);
    const previousContext = buildWriterContext(results);

    const batchResults = await Promise.all(
      batch.map((slide) =>
        runWriterSingle(
          slide,
          outline.presentation_title,
          allTitles,
          outline.target_audience,
          language,
          previousContext,
        ).catch(
          (err): SlideContent => {
            console.error(`[writer] Slide ${slide.slide_number} failed:`, err);
            return {
              slide_number: slide.slide_number,
              title: slide.title,
              text: slide.key_points.map((kp) => `• ${kp}`).join("\n"),
              notes: "",
              data_points: [],
              key_message: slide.purpose,
            };
          },
        ),
      ),
    );

    batchResults.sort((a, b) => a.slide_number - b.slide_number);
    results.push(...batchResults);

    // Report progress
    for (const r of batchResults) {
      onSlideWritten?.(r.slide_number, outline.slides.length);
    }
  }

  results.sort((a, b) => a.slide_number - b.slide_number);
  return results;
}

/**
 * Extract a CSS variable value from a :root block.
 */
function extractCssVar(css: string, varName: string): string | null {
  const regex = new RegExp(`${varName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*:\\s*([^;]+)`);
  const match = css.match(regex);
  return match ? match[1].trim().replace(/['"]*/g, '') : null;
}

export async function runTheme(
  presentationTitle: string,
  branding: PlannerResult["branding"],
  targetAudience: string,
  preset?: ThemePreset,
): Promise<ThemeResult> {
  // If we have a preset, use its CSS variables directly — no LLM call needed
  if (preset) {
    return {
      theme_name: preset.name,
      colors: {
        primary: extractCssVar(preset.cssVariables, "--primary-accent-color") || "#2563eb",
        primary_light: extractCssVar(preset.cssVariables, "--primary-accent-light") || "#93bbfd",
        secondary: extractCssVar(preset.cssVariables, "--secondary-accent-color") || "#0ea5e9",
        background: extractCssVar(preset.cssVariables, "--card-background-color") || "#ffffff",
        text_primary: extractCssVar(preset.cssVariables, "--text-heading-color") || "#0f172a",
        text_secondary: extractCssVar(preset.cssVariables, "--text-body-color") || "#475569",
      },
      font_heading: extractCssVar(preset.cssVariables, "--heading-font-family") || "Inter",
      font_body: extractCssVar(preset.cssVariables, "--body-font-family") || "Inter",
      css_variables: preset.cssVariables,
    };
  }

  // Fallback: ask LLM to generate theme from scratch
  const user = themeUser(presentationTitle, JSON.stringify(branding), targetAudience);

  return llmStructured<ThemeResult>(THEME_SYSTEM, user, "ThemeOutput", {
    type: "object",
    properties: {
      theme_name: { type: "string" },
      colors: {
        type: "object",
        properties: {
          primary: { type: "string" },
          primary_light: { type: "string" },
          secondary: { type: "string" },
          background: { type: "string" },
          text_primary: { type: "string" },
          text_secondary: { type: "string" },
        },
        required: ["primary", "primary_light", "secondary", "background", "text_primary", "text_secondary"],
        additionalProperties: false,
      },
      font_heading: { type: "string" },
      font_body: { type: "string" },
      css_variables: { type: "string" },
    },
    required: ["theme_name", "colors", "font_heading", "font_body", "css_variables"],
    additionalProperties: false,
  });
}

export async function runLayout(content: SlideContent[]): Promise<LayoutDecision[]> {
  const slidesSummary = content
    .map(
      (s) =>
        `Slide ${s.slide_number}: "${s.title}" — ${s.key_message || s.text.substring(0, 100)}${s.data_points.length > 0 ? " [HAS DATA]" : ""}`,
    )
    .join("\n");

  const result = await llmStructured<{ decisions: LayoutDecision[] }>(
    LAYOUT_SYSTEM,
    layoutUser(slidesSummary),
    "LayoutOutput",
    {
      type: "object",
      properties: {
        decisions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slide_number: { type: "integer" },
              layout_name: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["slide_number", "layout_name", "rationale"],
            additionalProperties: false,
          },
        },
      },
      required: ["decisions"],
      additionalProperties: false,
    },
  );

  return result.decisions;
}

export async function runHtmlComposer(
  slideContent: SlideContent,
  layoutName: string,
  themeCss: string,
): Promise<Record<string, any>> {
  const layoutTemplate = getLayoutTemplate(layoutName);
  const system = htmlComposerSystem();
  const user = htmlComposerUser(
    layoutName,
    layoutTemplate || `Layout: ${layoutName}`,
    slideContent.title,
    slideContent.text,
    slideContent.notes,
    slideContent.key_message,
    themeCss,
  );

  // The composer returns the data object for the template
  const rawResponse = await llmText(system, user);

  // Extract JSON from response (may be wrapped in ```json blocks)
  let jsonStr = rawResponse;
  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    // Fallback: create basic data from content
    return buildFallbackData(slideContent, layoutName);
  }
}

export function buildFallbackData(content: SlideContent, layoutName: string): Record<string, any> {
  const bullets = content.text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const cleaned = l.replace(/^[•\-\*]\s*/, "").trim();
      const colonIdx = cleaned.indexOf(":");
      if (colonIdx > 0 && colonIdx < 60) {
        return { title: cleaned.substring(0, colonIdx).trim(), description: cleaned.substring(colonIdx + 1).trim() };
      }
      return { title: cleaned, description: "" };
    });

  const data: Record<string, any> = { title: content.title };

  switch (layoutName) {
    case "title-slide":
      data.description = content.text.substring(0, 200);
      data.presenterName = "";
      data.initials = "";
      data.presentationDate = new Date().toLocaleDateString("ru-RU");
      break;
    case "section-header":
      data.subtitle = content.key_message || content.text.substring(0, 150);
      break;
    case "text-slide":
      data.bullets = bullets.slice(0, 5);
      break;
    case "two-column":
      const mid = Math.ceil(bullets.length / 2);
      data.leftColumn = { title: "Ключевые аспекты", bullets: bullets.slice(0, mid).map((b) => b.title) };
      data.rightColumn = { title: "Детали", bullets: bullets.slice(mid).map((b) => b.title) };
      break;
    case "icons-numbers":
      data.metrics = content.data_points.slice(0, 4).map((dp, i) => ({
        label: dp.label,
        value: dp.value + (dp.unit ? ` ${dp.unit}` : ""),
        description: "",
        icon: { name: "bar-chart", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/bar-chart.svg" },
      }));
      if (data.metrics.length === 0) {
        data.metrics = bullets.slice(0, 4).map((b, i) => ({
          label: b.title,
          value: "—",
          description: b.description,
          icon: { name: "target", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/target.svg" },
        }));
      }
      break;
    case "timeline":
      data.events = bullets.slice(0, 6).map((b, i) => ({
        date: `Этап ${i + 1}`,
        title: b.title,
        description: b.description,
      }));
      break;
    case "process-steps":
      data.steps = bullets.slice(0, 5).map((b, i) => ({
        number: i + 1,
        title: b.title,
        description: b.description,
      }));
      break;
    case "comparison":
      const halfBullets = Math.ceil(bullets.length / 2);
      data.optionA = { title: "Вариант A", points: bullets.slice(0, halfBullets).map((b) => b.title), color: "#22c55e" };
      data.optionB = { title: "Вариант B", points: bullets.slice(halfBullets).map((b) => b.title), color: "#ef4444" };
      break;
    case "table-slide":
      data.headers = ["Параметр", "Значение"];
      data.rows = content.data_points.length > 0
        ? content.data_points.map((dp) => [dp.label, `${dp.value} ${dp.unit}`])
        : bullets.slice(0, 6).map((b) => [b.title, b.description || "—"]);
      break;
    case "chart-slide":
      data.description = content.key_message;
      data.chartData = {
        type: "bar",
        labels: content.data_points.map((dp) => dp.label).slice(0, 6),
        datasets: [{ label: content.title, data: content.data_points.map((dp) => parseFloat(dp.value) || 0).slice(0, 6) }],
      };
      break;
    case "final-slide":
      data.subtitle = content.key_message || content.text.substring(0, 200);
      data.thankYouText = "Спасибо за внимание!";
      break;
    case "image-text":
    case "image-fullscreen":
      data.bullets = bullets.slice(0, 4);
      break;
    case "quote-slide":
      data.quote = content.key_message || content.text.substring(0, 200);
      data.author = "";
      break;
    case "agenda-table-of-contents":
      data.sections = bullets.slice(0, 8).map((b, i) => ({
        number: i + 1,
        title: b.title,
        description: b.description,
      }));
      break;
    default:
      data.bullets = bullets.slice(0, 5);
  }

  return data;
}

// ═══════════════════════════════════════════════════════
// HTML COMPOSER WITH QA VALIDATION + RETRY
// ═══════════════════════════════════════════════════════

/**
 * Run HTML Composer with QA validation, auto-fix, and optional retry.
 * Flow: Compose → Validate → Auto-fix → Re-validate → Retry with feedback (if still failing)
 */
export async function runHtmlComposerWithQA(
  slideContent: SlideContent,
  layoutName: string,
  themeCss: string,
  maxRetries: number = 1,
): Promise<Record<string, any>> {
  let data = await runHtmlComposer(slideContent, layoutName, themeCss);

  // Step 1: Validate
  let qa = validateSlideData(data, layoutName);

  if (qa.passed) return data;

  // Step 2: Auto-fix common issues
  const { data: fixedData, fixed } = autoFixSlideData(data, layoutName);
  if (fixed) {
    data = fixedData;
    qa = validateSlideData(data, layoutName);
    if (qa.passed) {
      console.log(`[QA] Slide ${slideContent.slide_number} "${layoutName}": auto-fixed`);
      return data;
    }
  }

  // Step 3: Retry with feedback (only for errors, max retries)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`[QA] Slide ${slideContent.slide_number} "${layoutName}": retry ${attempt + 1} — ${qa.feedbackForRetry}`);

    // Re-run HTML Composer with the QA feedback
    const layoutTemplate = getLayoutTemplate(layoutName);
    const system = htmlComposerSystem(qa.feedbackForRetry);
    const user = htmlComposerUser(
      layoutName,
      layoutTemplate || `Layout: ${layoutName}`,
      slideContent.title,
      slideContent.text,
      slideContent.notes,
      slideContent.key_message,
      themeCss,
    );

    const rawResponse = await llmText(system, user).catch(() => "");
    let jsonStr = rawResponse;
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    try {
      data = JSON.parse(jsonStr.trim());
    } catch {
      // If JSON parsing fails on retry, use fallback
      console.log(`[QA] Slide ${slideContent.slide_number}: retry JSON parse failed, using fallback`);
      data = buildFallbackData(slideContent, layoutName);
      break;
    }

    // Auto-fix the retry result too
    const retryFix = autoFixSlideData(data, layoutName);
    data = retryFix.data;

    qa = validateSlideData(data, layoutName);
    if (qa.passed) {
      console.log(`[QA] Slide ${slideContent.slide_number}: passed after retry ${attempt + 1}`);
      return data;
    }
  }

  // If still failing after retries, auto-fix what we can and use it
  console.warn(`[QA] Slide ${slideContent.slide_number} "${layoutName}": still has issues after retries, using best effort. Issues: ${qa.issues.map(i => i.message).join("; ")}`);
  return data;
}

// ═══════════════════════════════════════════════════════
// IMAGE GENERATION FOR BATCH MODE
// ═══════════════════════════════════════════════════════

/** Layouts that should NOT get auto-images */
const SKIP_IMAGE_LAYOUTS = new Set([
  "title-slide", "final-slide", "chart-slide", "table-slide",
  "icons-numbers", "image-text", "image-fullscreen", "agenda-table-of-contents",
]);

interface ImageSelection {
  slide_number: number;
  image_prompt: string;
}

/**
 * Ask LLM which slides would benefit from illustrations and generate prompts.
 * Returns up to maxImages selections.
 */
async function selectSlidesForImages(
  content: SlideContent[],
  layoutMap: Map<number, string>,
  maxImages: number = 3,
): Promise<ImageSelection[]> {
  // Filter to slides that are eligible for images
  const eligible = content.filter((s) => {
    const layout = layoutMap.get(s.slide_number) || "text-slide";
    return !SKIP_IMAGE_LAYOUTS.has(layout);
  });

  if (eligible.length === 0) return [];

  const slideSummaries = eligible.map((s) => (
    `Slide ${s.slide_number}: "${s.title}" — ${s.key_message || s.text.substring(0, 120)}`
  )).join("\n");

  const result = await llmStructured<{ selections: ImageSelection[] }>(
    `You are a world-class art director for corporate presentations. Select up to ${maxImages} slides that would benefit most from an illustration image. For each, write a detailed image generation prompt in English (60-100 words) that creates a stunning, professional visual.

<prompt_guidelines>
- Style: Modern, clean, professional. Think Dribbble/Behance quality.
- Prefer: Abstract 3D renders, isometric illustrations, gradient mesh backgrounds with floating geometric shapes, data visualization art, conceptual metaphors.
- Avoid: Stock photo cliches, clip art, cartoons, text in images, faces/people unless essential.
- Color: Mention specific colors that match a professional palette (blues, purples, teals, warm gradients).
- Composition: Describe depth, lighting, and spatial arrangement.
- Always start with the style (e.g., "3D isometric illustration of...", "Abstract gradient composition with...", "Minimalist vector art showing...").
</prompt_guidelines>

Do NOT select slides about agendas, tables, pure data, or closing slides.`,
    `Here are the eligible slides:\n${slideSummaries}\n\nSelect up to ${maxImages} slides and provide detailed, high-quality image prompts.`,
    "image_selections",
    {
      type: "object",
      properties: {
        selections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slide_number: { type: "integer", description: "The slide number" },
              image_prompt: { type: "string", description: "English prompt for image generation" },
            },
            required: ["slide_number", "image_prompt"],
            additionalProperties: false,
          },
        },
      },
      required: ["selections"],
      additionalProperties: false,
    },
  );

  // Validate selections — only keep eligible slide numbers
  const eligibleNumbers = new Set(eligible.map((s) => s.slide_number));
  return result.selections
    .filter((s) => eligibleNumbers.has(s.slide_number) && s.image_prompt.trim())
    .slice(0, maxImages);
}

/**
 * Generate images in parallel for selected slides.
 * Returns a map of slide_number → image URL.
 */
async function generateSlideImages(
  selections: ImageSelection[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<number, string>> {
  const imageMap = new Map<number, string>();
  if (selections.length === 0) return imageMap;

  // Generate images in parallel (max 3 concurrent)
  const concurrency = 3;
  for (let i = 0; i < selections.length; i += concurrency) {
    const batch = selections.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (sel) => {
        const result = await generateImage({ prompt: sel.image_prompt });
        return { slideNumber: sel.slide_number, url: result.url };
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value.url) {
        imageMap.set(r.value.slideNumber, r.value.url);
      }
    }

    onProgress?.(Math.min(i + batch.length, selections.length), selections.length);
  }

  return imageMap;
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════

export async function generatePresentation(
  prompt: string,
  config: GenerationConfig,
  onProgress: ProgressCallback,
): Promise<{
  title: string;
  language: string;
  themeCss: string;
  slides: Array<{ layoutId: string; data: Record<string, any>; html: string }>;
  fullHtml: string;
}> {
  const enableImages = config.enableImages !== false; // enabled by default

  // 1. PLANNER
  onProgress({ nodeName: "planner", currentStep: "planning", progressPercent: 5, message: "Анализ темы и планирование..." });
  const plannerResult = await runPlanner(prompt);
  const language = plannerResult.language || "ru";

  // 2. OUTLINE
  onProgress({ nodeName: "outline", currentStep: "outlining", progressPercent: 12, message: "Создание структуры презентации..." });
  const rawOutline = await runOutline(prompt, plannerResult.branding, language);

  // 2.5. OUTLINE CRITIC — validate and improve outline structure
  onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 18, message: "Проверка структуры презентации..." });
  let outline = rawOutline;
  try {
    const criticResult = await runOutlineCritic(rawOutline);
    outline = criticResult.outline;
    const { critique } = criticResult;
    if (critique.improved_outline) {
      console.log(`[Pipeline] Outline improved by critic (score: ${critique.score}/10, ${critique.issues.length} issues)`);
    } else {
      console.log(`[Pipeline] Outline passed critic (score: ${critique.score}/10)`);
    }
    onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 22, message: `Структура проверена (${critique.score}/10)` });
  } catch (err) {
    console.error("[Pipeline] Outline critic failed, using original outline:", err);
    onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 22, message: "Пропуск проверки (ошибка)" });
  }

  // 3. WRITER (parallel)
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 25, message: `Написание контента для ${outline.slides.length} слайдов...` });
  const rawContent = await runWriterParallel(outline, language);
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 38, message: "Контент готов" });

  // 3.5. STORYTELLING AGENT — transform titles to action titles + narrative coherence
  onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 40, message: "Улучшение нарратива и заголовков..." });
  let content = rawContent;
  try {
    const storytellingResult = await runStorytellingAgent(rawContent, outline);
    content = storytellingResult.enhancedContent;
    if (storytellingResult.narrativeThread) {
      console.log(`[Pipeline] Narrative thread: ${storytellingResult.narrativeThread}`);
    }
    onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 45, message: "Нарратив улучшен" });
  } catch (err) {
    console.error("[Pipeline] Storytelling agent failed, using original content:", err);
    onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 45, message: "Пропуск нарратива (ошибка)" });
  }

  // 4. THEME — use predefined preset when available
  onProgress({ nodeName: "theme", currentStep: "designing", progressPercent: 48, message: "Создание визуальной темы..." });
  const themePreset = getThemePreset(config.themePreset || "corporate_blue");
  const theme = await runTheme(
    plannerResult.presentation_title,
    plannerResult.branding,
    outline.target_audience,
    themePreset,
  );

  // 5. LAYOUT
  onProgress({ nodeName: "layout", currentStep: "layout_selection", progressPercent: 55, message: "Выбор макетов для слайдов..." });
  const layoutDecisions = await runLayout(content);

  // Map layout decisions to content
  const layoutMap = new Map(layoutDecisions.map((d) => [d.slide_number, d.layout_name]));

  // 5.5. IMAGE GENERATION (between layout and HTML composer)
  let imageMap = new Map<number, string>();
  if (enableImages) {
    onProgress({ nodeName: "image", currentStep: "images", progressPercent: 60, message: "Подбор слайдов для иллюстраций..." });

    try {
      const selections = await selectSlidesForImages(content, layoutMap, 5);

      if (selections.length > 0) {
        onProgress({ nodeName: "image", currentStep: "images", progressPercent: 63, message: `Генерация ${selections.length} иллюстраций...` });

        imageMap = await generateSlideImages(selections, (completed, total) => {
          const imgProgress = 63 + (completed / total) * 7;
          onProgress({
            nodeName: "image",
            currentStep: "images",
            progressPercent: Math.round(imgProgress),
            message: `Сгенерировано ${completed} из ${total} изображений`,
          });
        });

        // Override layouts for slides that got images
        Array.from(imageMap.keys()).forEach((slideNum) => {
          layoutMap.set(slideNum, "image-text");
        });

        onProgress({ nodeName: "image", currentStep: "images", progressPercent: 70, message: `Готово: ${imageMap.size} иллюстраций` });
      } else {
        onProgress({ nodeName: "image", currentStep: "images", progressPercent: 70, message: "Изображения не требуются" });
      }
    } catch (err) {
      console.error("[Pipeline] Image generation failed, continuing without images:", err);
      onProgress({ nodeName: "image", currentStep: "images", progressPercent: 70, message: "Пропуск изображений (ошибка)" });
    }
  } else {
    onProgress({ nodeName: "image", currentStep: "images", progressPercent: 70, message: "Изображения отключены" });
  }

  // 5.6. POST-IMAGE LAYOUT FIXUP: remap image-requiring layouts that have no image
  const IMAGE_REQUIRING_LAYOUTS = new Set(["image-text", "image-fullscreen", "quote-slide"]);
  const FALLBACK_LAYOUTS = ["text-slide", "two-column", "process-steps", "icons-numbers"];
  let fallbackIdx = 0;
  for (const [slideNum, layout] of Array.from(layoutMap.entries())) {
    if (IMAGE_REQUIRING_LAYOUTS.has(layout) && !imageMap.has(slideNum)) {
      const replacement = FALLBACK_LAYOUTS[fallbackIdx % FALLBACK_LAYOUTS.length];
      console.log(`[Pipeline] Layout fixup: slide ${slideNum} "${layout}" → "${replacement}" (no image available)`);
      layoutMap.set(slideNum, replacement);
      fallbackIdx++;
    }
  }
  // Also fix title-slide if it has no image — keep title-slide but it will use the placeholder gracefully
  // (title-slide always has the placeholder fallback, so no remap needed)

  // 5.7. SPEAKER COACH — generate professional speaker notes
  onProgress({ nodeName: "speaker_coach", currentStep: "speaker_notes", progressPercent: 71, message: "Генерация заметок спикера..." });
  try {
    const coachResult = await runSpeakerCoach(
      content,
      plannerResult.presentation_title,
      outline.target_audience || "Широкая аудитория",
      layoutMap,
    );
    // Apply speaker notes to content (enriches the notes field)
    const enrichedContent = applySpeakerNotes(content, coachResult);
    // Update content in-place for downstream HTML composition
    for (let i = 0; i < content.length; i++) {
      content[i] = enrichedContent[i];
    }
    console.log(`[Pipeline] Speaker notes generated (~${coachResult.total_estimated_minutes} min presentation)`);
    onProgress({ nodeName: "speaker_coach", currentStep: "speaker_notes", progressPercent: 72, message: `Заметки готовы (~${coachResult.total_estimated_minutes} мин)` });
  } catch (err) {
    console.error("[Pipeline] Speaker coach failed, continuing with basic notes:", err);
    onProgress({ nodeName: "speaker_coach", currentStep: "speaker_notes", progressPercent: 72, message: "Пропуск заметок (ошибка)" });
  }

  // 6. HTML COMPOSER (parallel per slide)
  onProgress({ nodeName: "composer", currentStep: "composing", progressPercent: 73, message: "Сборка HTML-слайдов..." });

  const slides: Array<{ layoutId: string; data: Record<string, any>; html: string }> = [];

  // Run composers in parallel (batches of 5 to avoid rate limits)
  const batchSize = 5;
  for (let i = 0; i < content.length; i += batchSize) {
    const batch = content.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (slideContent) => {
        const layoutName = layoutMap.get(slideContent.slide_number) || "text-slide";
        const data = await runHtmlComposerWithQA(slideContent, layoutName, theme.css_variables).catch(() =>
          buildFallbackData(slideContent, layoutName),
        );

        // Inject image if available
        const imgUrl = imageMap.get(slideContent.slide_number);
        if (imgUrl) {
          data.image = { url: imgUrl, alt: slideContent.title };
          data.backgroundImage = { url: imgUrl, alt: slideContent.title };
        }

        // Inject slide metadata for footer rendering
        data._slideNumber = slideContent.slide_number;
        data._totalSlides = content.length;
        data._presentationTitle = plannerResult.presentation_title;

        let html = renderSlide(layoutName, data);

        // Apply adaptive font sizing based on content density
        const analysis = analyzeContentDensity(data, layoutName);
        const adaptive = generateAdaptiveStyles(analysis);
        if (adaptive.hasOverrides) {
          html = `<style>${adaptive.cssOverrides}</style>${html}`;
        }

        return { layoutId: layoutName, data, html };
      }),
    );
    slides.push(...batchResults);

    const progress = 72 + ((i + batch.length) / content.length) * 20;
    onProgress({
      nodeName: "composer",
      currentStep: "composing",
      progressPercent: Math.round(progress),
      message: `Собрано ${Math.min(i + batchSize, content.length)} из ${content.length} слайдов`,
      slidePreview: batchResults[batchResults.length - 1]?.html,
    });
  }

  // 6.5. DESIGN CRITIC — validate visual quality and apply CSS fixes
  onProgress({ nodeName: "design_critic", currentStep: "design_review", progressPercent: 92, message: "Проверка визуального качества..." });
  try {
    const designSlides: SlideDesignData[] = slides.map((s, i) => ({
      slideNumber: i + 1,
      layoutId: s.layoutId,
      data: s.data,
      html: s.html,
    }));
    const critique = runDesignCritic(designSlides, theme.css_variables);

    // Apply CSS fixes to slides that have issues
    for (const [slideIdx, cssFix] of Array.from(critique.cssFixesPerSlide.entries())) {
      const idx = slideIdx - 1; // Convert 1-based to 0-based
      if (idx >= 0 && idx < slides.length && cssFix.trim()) {
        slides[idx].html = `<style>${cssFix}</style>${slides[idx].html}`;
      }
    }

    const errorCount = critique.issues.filter(i => i.severity === "error").length;
    const warnCount = critique.issues.filter(i => i.severity === "warning").length;
    console.log(`[Pipeline] Design critique: score ${critique.overallScore}/10, ${errorCount} errors, ${warnCount} warnings, ${critique.cssFixesPerSlide.size} fixes applied`);
    onProgress({
      nodeName: "design_critic",
      currentStep: "design_review",
      progressPercent: 94,
      message: `Дизайн: ${critique.overallScore}/10 (${critique.cssFixesPerSlide.size} исправлений)`,
    });
  } catch (err) {
    console.error("[Pipeline] Design critic failed, continuing:", err);
    onProgress({ nodeName: "design_critic", currentStep: "design_review", progressPercent: 94, message: "Пропуск проверки дизайна" });
  }

  // 7. ASSEMBLY
  onProgress({ nodeName: "assembler", currentStep: "assembling", progressPercent: 95, message: "Финальная сборка презентации..." });
  const fullHtml = renderPresentation(slides, theme.css_variables, plannerResult.presentation_title, language, themePreset?.fontsUrl);

  onProgress({ nodeName: "assembler", currentStep: "completed", progressPercent: 100, message: "Презентация готова!" });

  return {
    title: plannerResult.presentation_title,
    language,
    themeCss: theme.css_variables,
    slides,
    fullHtml,
  };
}
