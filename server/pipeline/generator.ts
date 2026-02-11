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

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface GenerationConfig {
  themePreset?: string;
}

export interface PipelineProgress {
  nodeName: string;
  currentStep: string;
  progressPercent: number;
  slidePreview?: string;
  message?: string;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

interface PlannerResult {
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

interface OutlineSlide {
  slide_number: number;
  title: string;
  purpose: string;
  key_points: string[];
  speaker_notes_hint: string;
}

interface OutlineResult {
  presentation_title: string;
  target_audience: string;
  narrative_arc: string;
  slides: OutlineSlide[];
}

interface SlideContent {
  slide_number: number;
  title: string;
  text: string;
  notes: string;
  data_points: Array<{ label: string; value: string; unit: string }>;
  key_message: string;
}

interface ThemeResult {
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

interface LayoutDecision {
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

async function runPlanner(prompt: string): Promise<PlannerResult> {
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

async function runOutline(
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

async function runWriterSingle(
  slideInfo: OutlineSlide,
  presentationTitle: string,
  allTitles: string,
  targetAudience: string,
  language: string,
): Promise<SlideContent> {
  const system = writerSystem(language, presentationTitle, allTitles, targetAudience);
  const user = writerUser(
    slideInfo.slide_number,
    slideInfo.title,
    slideInfo.purpose,
    slideInfo.key_points.join(", "),
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

async function runWriterParallel(
  outline: OutlineResult,
  language: string,
  onSlideWritten?: (slideNum: number, total: number) => void,
): Promise<SlideContent[]> {
  const allTitles = outline.slides.map((s) => s.title).join(", ");

  // Run all slides in parallel
  const promises = outline.slides.map((slide) =>
    runWriterSingle(slide, outline.presentation_title, allTitles, outline.target_audience, language).catch(
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
  );

  const results = await Promise.all(promises);
  results.sort((a, b) => a.slide_number - b.slide_number);
  return results;
}

async function runTheme(
  presentationTitle: string,
  branding: PlannerResult["branding"],
  targetAudience: string,
): Promise<ThemeResult> {
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

async function runLayout(content: SlideContent[]): Promise<LayoutDecision[]> {
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

async function runHtmlComposer(
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

function buildFallbackData(content: SlideContent, layoutName: string): Record<string, any> {
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
      data.metrics = content.data_points.slice(0, 4).map((dp) => ({
        label: dp.label,
        value: dp.value + (dp.unit ? ` ${dp.unit}` : ""),
        description: "",
        icon: "📊",
      }));
      if (data.metrics.length === 0) {
        data.metrics = bullets.slice(0, 4).map((b) => ({
          label: b.title,
          value: "—",
          description: b.description,
          icon: "📌",
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
  // 1. PLANNER
  onProgress({ nodeName: "planner", currentStep: "planning", progressPercent: 5, message: "Анализ темы и планирование..." });
  const plannerResult = await runPlanner(prompt);
  const language = plannerResult.language || "ru";

  // 2. OUTLINE
  onProgress({ nodeName: "outline", currentStep: "outlining", progressPercent: 15, message: "Создание структуры презентации..." });
  const outline = await runOutline(prompt, plannerResult.branding, language);

  // 3. WRITER (parallel)
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 25, message: `Написание контента для ${outline.slides.length} слайдов...` });
  const content = await runWriterParallel(outline, language);
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 45, message: "Контент готов" });

  // 4. THEME
  onProgress({ nodeName: "theme", currentStep: "designing", progressPercent: 55, message: "Создание визуальной темы..." });
  const theme = await runTheme(plannerResult.presentation_title, plannerResult.branding, outline.target_audience);

  // 5. LAYOUT
  onProgress({ nodeName: "layout", currentStep: "layout_selection", progressPercent: 65, message: "Выбор макетов для слайдов..." });
  const layoutDecisions = await runLayout(content);

  // 6. HTML COMPOSER (parallel per slide)
  onProgress({ nodeName: "composer", currentStep: "composing", progressPercent: 70, message: "Сборка HTML-слайдов..." });

  const slides: Array<{ layoutId: string; data: Record<string, any>; html: string }> = [];

  // Map layout decisions to content
  const layoutMap = new Map(layoutDecisions.map((d) => [d.slide_number, d.layout_name]));

  // Run composers in parallel (batches of 5 to avoid rate limits)
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
    onProgress({
      nodeName: "composer",
      currentStep: "composing",
      progressPercent: Math.round(progress),
      message: `Собрано ${Math.min(i + batchSize, content.length)} из ${content.length} слайдов`,
      slidePreview: batchResults[batchResults.length - 1]?.html,
    });
  }

  // 7. ASSEMBLY
  onProgress({ nodeName: "assembler", currentStep: "assembling", progressPercent: 95, message: "Финальная сборка презентации..." });
  const fullHtml = renderPresentation(slides, theme.css_variables, plannerResult.presentation_title, language);

  onProgress({ nodeName: "assembler", currentStep: "completed", progressPercent: 100, message: "Презентация готова!" });

  return {
    title: plannerResult.presentation_title,
    language,
    themeCss: theme.css_variables,
    slides,
    fullHtml,
  };
}
