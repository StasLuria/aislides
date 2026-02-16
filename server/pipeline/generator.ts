/**
 * Presentation Generator Pipeline — orchestrates LLM agents to create presentations.
 * Pipeline: Research → Analysis → Planner → Type → Outline → Critic → Writer → Storytelling → Theme → Layout → HTML Composer → Assembly
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
import { validateSlideData, fixSlideStructure, validateSlideContentLLM, getQALevel, getQARetryBudget } from "./qaAgent";
import { analyzeContentDensity, generateAdaptiveStyles } from "./adaptiveSizing";
import { enforceAllSlidesDensity } from "./contentDensityValidator";
import { classifyPresentation, type TypeProfile } from "./presentationTypeClassifier";
import { matchReference, formatReferenceHint } from "./referenceLibrary";
import { runStorytellingAgent } from "./storytellingAgent";
import { evaluateSlides, runEvaluatorLoop, type SlideForEval } from "./contentEvaluator";
import { runOutlineCritic } from "./outlineCritic";
import { runSpeakerCoach, applySpeakerNotes } from "./speakerCoachAgent";
import { runDesignCritic, runLlmDesignCritique, fixSlideDensity, type SlideDesignData } from "./designCriticAgent";
import { runResearchAgent, runResearchByTopic, formatResearchForWriter, type ResearchContext } from "./researchAgent";
import { runAnalysisAgent, formatAnalysisForDownstream, formatAnalysisForWriter, type AnalysisResult, type AnalysisAgentResult } from "./analysisAgent";
import { runDataVizAgent, injectChartIntoSlideData } from "./dataVizAgent";
import { autoSelectTheme, type ThemeSelectionResult } from "./themeSelector";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface GenerationConfig {
  themePreset?: string;
  enableImages?: boolean;
  /** Target number of slides requested by user (includes title + final). If not set, LLM decides. */
  slideCount?: number;
  /** Custom template CSS variables (overrides theme preset when provided) */
  customCssVariables?: string;
  /** Custom template fonts URL */
  customFontsUrl?: string;
  /** Custom template ID for reference */
  customTemplateId?: string;
  /** Pre-built outline from uploaded file (skips runOutline + runOutlineCritic when provided) */
  preBuiltOutline?: OutlineResult;
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
  content_shape?: string;
  slide_category?: string;
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
  structured_content?: StructuredContent;
  content_shape?: string;
  slide_category?: string;
}

/** Structured content produced by the Writer based on content_shape */
export interface StructuredContent {
  /** For stat_cards: array of {label, value, description} */
  stat_cards?: Array<{ label: string; value: string; description: string }>;
  /** For comparison_two_sides: {left_title, left_items, right_title, right_items} */
  comparison?: { left_title: string; left_items: Array<{ text: string; icon_hint?: string }>; right_title: string; right_items: Array<{ text: string; icon_hint?: string }> };
  /** For table_data: {columns, rows} */
  table?: { columns: string[]; rows: Array<Record<string, string>> };
  /** For process_steps: array of {step_number, title, description} */
  steps?: Array<{ step_number: number; title: string; description: string }>;
  /** For card_grid: array of {icon_hint, title, text, badge?} */
  cards?: Array<{ icon_hint: string; title: string; text: string; badge?: string }>;
  /** For timeline_events: array of {date, title, description} */
  timeline?: Array<{ date: string; title: string; description: string }>;
  /** For financial_formula: {formula_parts, supporting_metrics} */
  formula?: { parts: Array<{ label: string; value: string; description: string; operator?: string }>; bottom_line?: string };
  /** For analysis_with_verdict: {items, verdict} */
  analysis?: { items: Array<{ title: string; description: string; code?: string; severity?: string }>; verdict_title: string; verdict_text: string; indicators?: Array<{ label: string; value: string; color?: string }> };
  /** For quote_highlight: {quote, attribution, context} */
  quote?: { text: string; attribution: string; context: string; source?: string };
  /** For kanban_board: columns with task cards */
  columns?: Array<{ title: string; color?: string; cards: Array<{ title: string; description?: string; priority?: string; tags?: string[]; assignee?: string }> }>;
  /** For checklist_items: items with done status */
  checklist?: Array<{ title: string; description: string; done: boolean }>;
  /** For swot_quadrants: four quadrants */
  swot?: { strengths: { title: string; items: string[] }; weaknesses: { title: string; items: string[] }; opportunities: { title: string; items: string[] }; threats: { title: string; items: string[] } };
  /** Catch-all for any other structured data from Writer */
  [key: string]: unknown;
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

export async function runPlanner(prompt: string, analysisContext?: string): Promise<PlannerResult> {
  return llmStructured<PlannerResult>(
    MASTER_PLANNER_SYSTEM,
    masterPlannerUser(prompt, analysisContext),
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
  typeHint?: string,
  analysisContext?: string,
  slideCount?: number,
): Promise<OutlineResult> {
  const system = outlineSystem(language, slideCount);
  const brandingStr = JSON.stringify(branding);
  const user = outlineUser(prompt, brandingStr, typeHint, analysisContext, slideCount);

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
            content_shape: { type: "string" },
            slide_category: { type: "string" },
          },
          required: ["slide_number", "title", "purpose", "key_points", "speaker_notes_hint", "content_shape", "slide_category"],
          additionalProperties: false,
        },
      },
    },
    required: ["presentation_title", "target_audience", "narrative_arc", "slides"],
    additionalProperties: false,
  });
}

/**
 * Post-process outline to force specialized content_shapes based on user keywords.
 * The LLM often defaults to generic shapes (bullet_points, card_grid) even when
 * the user explicitly mentions SWOT, org chart, checklist, kanban, etc.
 * This function scans the user prompt AND slide titles/purposes for keyword matches
 * and upgrades generic shapes to specialized ones.
 */
function postProcessOutlineShapes(outline: OutlineResult, userPrompt: string): OutlineResult {
  const promptLower = userPrompt.toLowerCase();
  console.log(`[OutlinePostProcess] Processing prompt (${promptLower.length} chars): "${promptLower.substring(0, 100)}..."`);
  console.log(`[OutlinePostProcess] Slides: ${outline.slides.map(s => `${s.slide_number}:${s.content_shape}`).join(', ')}`);
  
  // All generic shapes that can be overridden by specialized ones
  const ALL_GENERIC_SHAPES = [
    "bullet_points", "card_grid", "process_steps", "single_concept",
    "action_plan", "product_features", "stat_cards", "comparison_two_sides",
    "analysis_with_verdict", "comparison_matrix", "table_data",
    "chart_with_context", "timeline_events", "financial_formula",
  ];

  // Keyword → shape mapping with priority (higher = more specific)
  const KEYWORD_SHAPE_RULES: Array<{
    keywords: string[];
    shape: string;
    /** Only override these generic shapes */
    overrideShapes: string[];
    /** Max number of slides to upgrade (-1 = unlimited) */
    maxSlides: number;
  }> = [
    {
      keywords: ["swot", "swot-анализ", "swot анализ", "свот", "свот-анализ"],
      shape: "swot_quadrants",
      overrideShapes: ALL_GENERIC_SHAPES,
      maxSlides: 1,
    },
    {
      keywords: ["организационная структура", "структура команды", "структура организации", "org chart", "org structure", "иерархия команды", "иерархия управления", "оргструктура", "структура компании"],
      shape: "org_structure",
      overrideShapes: ALL_GENERIC_SHAPES,
      maxSlides: 1,
    },
    {
      keywords: ["чеклист", "чек-лист", "checklist", "готовность к", "критерии готовности", "готовность"],
      shape: "checklist_items",
      overrideShapes: ALL_GENERIC_SHAPES,
      maxSlides: 1,
    },
    {
      keywords: ["kanban", "канбан", "доска задач", "статусы задач", "task board"],
      shape: "kanban_board",
      overrideShapes: ALL_GENERIC_SHAPES,
      maxSlides: 1,
    },
    {
      keywords: ["цитата", "quote", "высказывание"],
      shape: "quote_highlight",
      overrideShapes: ["bullet_points", "single_concept", "card_grid"],
      maxSlides: 1,
    },
  ];

  let modified = false;
  const usedShapes = new Set<string>();

  for (const rule of KEYWORD_SHAPE_RULES) {
    // Check if any keyword appears in the user prompt
    const promptMatch = rule.keywords.some(kw => promptLower.includes(kw));
    if (!promptMatch) continue;

    let assignedCount = 0;

    for (const slide of outline.slides) {
      if (rule.maxSlides >= 0 && assignedCount >= rule.maxSlides) break;
      if (slide.content_shape === rule.shape) {
        // Already correctly assigned
        assignedCount++;
        console.log(`[OutlinePostProcess] Slide ${slide.slide_number} "${slide.title}": already has correct shape ${rule.shape}`);
        continue;
      }

      // Check if this slide's shape is generic enough to override
      if (!rule.overrideShapes.includes(slide.content_shape || "")) {
        console.log(`[OutlinePostProcess] Slide ${slide.slide_number} "${slide.title}": shape "${slide.content_shape}" not in overrideShapes, skipping`);
        continue;
      }

      // Check if slide title/purpose matches any keyword (stronger signal)
      const slideLower = `${slide.title} ${slide.purpose}`.toLowerCase();
      const slideMatch = rule.keywords.some(kw => slideLower.includes(kw));

      // For prompt-only matches, prefer slides with related titles
      // For slide-level matches, always upgrade
      if (slideMatch || (promptMatch && !usedShapes.has(rule.shape))) {
        const oldShape = slide.content_shape;
        slide.content_shape = rule.shape;
        usedShapes.add(rule.shape);
        assignedCount++;
        modified = true;
        console.log(`[OutlinePostProcess] Slide ${slide.slide_number} "${slide.title}": ${oldShape} → ${rule.shape} (keyword match)`);
        if (!slideMatch) break; // For prompt-only match, only upgrade first suitable slide
      }
    }
  }

  if (modified) {
    console.log(`[OutlinePostProcess] Shapes upgraded based on user keywords`);
  }

  return outline;
}
export async function runWriterSingle(
  slideInfo: OutlineResult["slides"][0],
  presentationTitle: string,
  allTitles: string,
  targetAudience: string,
  language: string,
  previousContext?: string,
  researchContext?: string,
  writerTypeHint?: string,
  analysisHighlights?: string,
): Promise<SlideContent> {
  const system = writerSystem(language, presentationTitle, allTitles, targetAudience, writerTypeHint);
  const user = writerUser(
    slideInfo.slide_number,
    slideInfo.title,
    slideInfo.purpose,
    slideInfo.key_points.join(", "),
    previousContext,
    researchContext,
    slideInfo.content_shape,
    slideInfo.slide_category,
    analysisHighlights,
  );

  // Use llmText instead of llmStructured because structured_content is free-form
  // (strict JSON schema mode returns {} for untyped objects)
  const rawResponse = await llmText(system, user);
  
  // Extract JSON from response (may be wrapped in ```json blocks)
  let jsonStr = rawResponse;
  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  let result: { slide: SlideContent };
  try {
    result = JSON.parse(jsonStr.trim());
  } catch {
    // Fallback: try to extract just the slide object
    try {
      const slideObj = JSON.parse(jsonStr.trim());
      result = slideObj.slide ? slideObj : { slide: slideObj };
    } catch {
      // Last resort: create minimal slide from outline
      result = {
        slide: {
          slide_number: slideInfo.slide_number,
          title: slideInfo.title,
          text: slideInfo.key_points.join("\n"),
          notes: "",
          data_points: [],
          key_message: slideInfo.purpose,
        } as SlideContent,
      };
    }
  }

  // Carry over content_shape and slide_category from outline
  const slide = result.slide;
  // Use outline's content_shape as fallback if writer didn't return one
  if (!slide.content_shape || slide.content_shape === "bullet_points") {
    slide.content_shape = slideInfo.content_shape || "bullet_points";
  }
  slide.slide_category = slideInfo.slide_category;
  
  // Ensure structured_content exists
  if (!slide.structured_content || typeof slide.structured_content !== 'object' || Object.keys(slide.structured_content).length === 0) {
    slide.structured_content = undefined;
  }
  
  // Log structured content for debugging
  const structKeys = slide.structured_content ? Object.keys(slide.structured_content) : [];
  console.log(`[Writer] Slide ${slide.slide_number}: shape=${slide.content_shape}, structured_keys=[${structKeys.join(',')}], text_len=${slide.text?.length || 0}`);
  
  return slide;
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
  researchContextFormatter?: (slideNumber: number) => string,
  writerTypeHint?: string,
  analysisHighlights?: string,
): Promise<SlideContent[]> {
  const allTitles = outline.slides.map((s) => s.title).join(", ");
  const results: SlideContent[] = [];
  const total = outline.slides.length;

  // Hybrid Writer: key slides sequential, core slides parallel with full context.
  // Key slides: title (1st), first 2 content slides, last 2 (conclusion + final)
  // This ensures narrative anchors are written first, then core slides can reference them.

  const keyIndices = new Set<number>();
  // Always include first slide (title)
  if (total > 0) keyIndices.add(0);
  // First 2 content slides (indices 1, 2)
  if (total > 1) keyIndices.add(1);
  if (total > 2) keyIndices.add(2);
  // Last 2 slides (conclusion + final)
  if (total > 3) keyIndices.add(total - 2);
  if (total > 1) keyIndices.add(total - 1);

  const keySlides = outline.slides.filter((_, i) => keyIndices.has(i));
  const coreSlides = outline.slides.filter((_, i) => !keyIndices.has(i));

  const writeSingle = (slide: OutlineResult["slides"][0], context: string) =>
    runWriterSingle(
      slide,
      outline.presentation_title,
      allTitles,
      outline.target_audience,
      language,
      context,
      researchContextFormatter?.(slide.slide_number),
      writerTypeHint,
      analysisHighlights,
    ).catch((err): SlideContent => {
      console.error(`[writer] Slide ${slide.slide_number} failed:`, err);
      return {
        slide_number: slide.slide_number,
        title: slide.title,
        text: slide.key_points.map((kp) => `• ${kp}`).join("\n"),
        notes: "",
        data_points: [],
        key_message: slide.purpose,
      };
    });

  // Phase 1: Write key slides sequentially (narrative anchors)
  console.log(`[Writer] Hybrid mode: ${keySlides.length} key slides sequential, ${coreSlides.length} core slides parallel`);
  for (const slide of keySlides) {
    const previousContext = buildWriterContext(results);
    const result = await writeSingle(slide, previousContext);
    results.push(result);
    onSlideWritten?.(result.slide_number, total);
  }

  // Phase 2: Write core slides in parallel batches (with full key context)
  if (coreSlides.length > 0) {
    // Build rich context from all key slides
    const keyContext = results
      .map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`)
      .join("\n");

    const batchSize = 3;
    for (let i = 0; i < coreSlides.length; i += batchSize) {
      const batch = coreSlides.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((slide) => writeSingle(slide, keyContext)),
      );
      batchResults.sort((a, b) => a.slide_number - b.slide_number);
      results.push(...batchResults);
      for (const r of batchResults) {
        onSlideWritten?.(r.slide_number, total);
      }
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

export async function runLayout(content: SlideContent[], layoutTypeHint?: string): Promise<LayoutDecision[]> {
  const slidesSummary = content
    .map(
      (s) => {
        const shapeHint = s.content_shape ? ` [SHAPE: ${s.content_shape}]` : "";
        const dataHint = s.data_points.length > 0 ? " [HAS DATA]" : "";
        const structuredHint = s.structured_content
          ? ` [HAS STRUCTURED: ${Object.keys(s.structured_content).join(", ")}]`
          : "";
        return `Slide ${s.slide_number}: "${s.title}" — ${s.key_message || s.text.substring(0, 100)}${dataHint}${shapeHint}${structuredHint}`;
      },
    )
    .join("\n");

  // Try top-3 voting schema first
  try {
    const votingResult = await llmStructured<{ votes: import('./layoutVoting').LayoutVote[] }>(
      LAYOUT_SYSTEM,
      layoutUser(slidesSummary, layoutTypeHint),
      "LayoutVotingOutput",
      {
        type: "object",
        properties: {
          votes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slide_number: { type: "integer" },
                candidates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      layout_name: { type: "string" },
                      confidence: { type: "number" },
                      rationale: { type: "string" },
                    },
                    required: ["layout_name", "confidence", "rationale"],
                    additionalProperties: false,
                  },
                },
                rationale: { type: "string" },
              },
              required: ["slide_number", "candidates", "rationale"],
              additionalProperties: false,
            },
          },
        },
        required: ["votes"],
        additionalProperties: false,
      },
    );

    // Build content_shape map for mandatory overrides
    const shapeMap = new Map<number, string>();
    for (const s of content) {
      if (s.content_shape) {
        shapeMap.set(s.slide_number, s.content_shape);
      }
    }

    // Apply diversity-aware voting
    const { applyLayoutVoting } = await import('./layoutVoting');
    const votingResults = applyLayoutVoting(votingResult.votes, shapeMap);

    const rerankedCount = votingResults.filter(r => r.was_reranked).length;
    if (rerankedCount > 0) {
      console.log(`[Layout Voting] ${rerankedCount}/${votingResults.length} slides reranked for diversity`);
    }

    return votingResults.map(r => ({
      slide_number: r.slide_number,
      layout_name: r.layout_name,
      rationale: r.rationale,
    }));
  } catch (err) {
    // Fallback to legacy single-choice schema
    console.log(`[Layout Voting] Voting schema failed, falling back to legacy: ${(err as Error).message}`);
    const result = await llmStructured<{ decisions: LayoutDecision[] }>(
      LAYOUT_SYSTEM,
      layoutUser(slidesSummary, layoutTypeHint),
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
    slideContent.structured_content,
    slideContent.content_shape,
    slideContent.slide_category,
    (slideContent as any).transition_phrase,
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
    const parsed = JSON.parse(jsonStr.trim());
    const keys = Object.keys(parsed);
    console.log(`[Composer] Slide ${slideContent.slide_number} "${layoutName}": LLM returned keys=[${keys.join(',')}]`);
    return parsed;
  } catch {
    // Fallback: create basic data from content
    console.log(`[Composer] Slide ${slideContent.slide_number} "${layoutName}": JSON parse failed, using fallback`);
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
    case "stats-chart":
      data.stats = content.data_points.slice(0, 4).map((dp) => ({
        value: dp.value + (dp.unit ? ` ${dp.unit}` : ""),
        label: dp.label,
        description: "",
      }));
      if (data.stats.length === 0) {
        data.stats = bullets.slice(0, 4).map((b) => ({
          value: "—",
          label: b.title,
          description: b.description,
        }));
      }
      data.chartData = {
        type: "bar",
        labels: content.data_points.map((dp) => dp.label).slice(0, 6),
        datasets: [{ label: content.title, data: content.data_points.map((dp) => parseFloat(dp.value) || 0).slice(0, 6) }],
      };
      break;
    case "chart-text":
      data.description = content.key_message;
      data.bullets = bullets.slice(0, 4);
      data.chartData = {
        type: "bar",
        labels: content.data_points.map((dp) => dp.label).slice(0, 6),
        datasets: [{ label: content.title, data: content.data_points.map((dp) => parseFloat(dp.value) || 0).slice(0, 6) }],
      };
      break;
    case "hero-stat":
      if (content.data_points.length > 0) {
        const mainDp = content.data_points[0];
        data.mainStat = { value: mainDp.value + (mainDp.unit ? ` ${mainDp.unit}` : ""), label: mainDp.label, description: "" };
        data.supportingStats = content.data_points.slice(1, 4).map((dp) => ({
          value: dp.value + (dp.unit ? ` ${dp.unit}` : ""),
          label: dp.label,
          description: "",
        }));
      } else {
        data.mainStat = { value: "—", label: content.title, description: "" };
        data.supportingStats = bullets.slice(0, 3).map((b) => ({ value: "—", label: b.title, description: b.description }));
      }
      break;
    case "scenario-cards":
      const scenarioColors = ["#16a34a", "#2563eb", "#dc2626"];
      const scenarioLabels = ["Оптимистичный", "Базовый", "Пессимистичный"];
      data.scenarios = bullets.slice(0, 3).map((b, i) => ({
        label: scenarioLabels[i] || `Сценарий ${i + 1}`,
        title: b.title,
        points: [b.description || ""],
        color: scenarioColors[i] || "#6366f1",
      }));
      break;
    case "numbered-steps-v2":
      data.steps = bullets.slice(0, 5).map((b, i) => ({
        number: i + 1,
        title: b.title,
        description: b.description,
      }));
      break;
    case "timeline-horizontal":
      data.events = bullets.slice(0, 6).map((b, i) => ({
        date: `Этап ${i + 1}`,
        title: b.title,
        description: b.description,
      }));
      break;
    case "text-with-callout":
      data.bullets = bullets.slice(0, 5);
      data.callout = content.key_message || "";
      break;
    case "dual-chart":
      data.leftChart = {
        title: bullets[0]?.title || "Показатель 1",
        subtitle: bullets[0]?.description || "",
        placeholder: "Данные для графика",
      };
      data.rightChart = {
        title: bullets[1]?.title || "Показатель 2",
        subtitle: bullets[1]?.description || "",
        placeholder: "Данные для графика",
      };
      data.chartData = {
        left: { type: "bar", labels: ["Q1", "Q2", "Q3", "Q4"], datasets: [{ label: "Данные", data: [10, 20, 30, 40] }] },
        right: { type: "bar", labels: ["Q1", "Q2", "Q3", "Q4"], datasets: [{ label: "Данные", data: [15, 25, 35, 45] }] },
      };
      break;
    case "risk-matrix":
      data.matrixColumns = ["Низкое", "Среднее", "Высокое"];
      data.matrixRows = [
        { label: "Высокий", cells: [
          { label: "Средний", color: "#fef9c3", textColor: "#854d0e" },
          { label: "Высокий", color: "#fed7aa", textColor: "#9a3412" },
          { label: "Критичный", color: "#fecaca", textColor: "#991b1b" },
        ]},
        { label: "Средний", cells: [
          { label: "Низкий", color: "#dcfce7", textColor: "#166534" },
          { label: "Средний", color: "#fef9c3", textColor: "#854d0e" },
          { label: "Высокий", color: "#fed7aa", textColor: "#9a3412" },
        ]},
        { label: "Низкий", cells: [
          { label: "Низкий", color: "#dcfce7", textColor: "#166534" },
          { label: "Низкий", color: "#dcfce7", textColor: "#166534" },
          { label: "Средний", color: "#fef9c3", textColor: "#854d0e" },
        ]},
      ];
      data.matrixLegend = [
        { label: "Низкий", color: "#dcfce7" },
        { label: "Средний", color: "#fef9c3" },
        { label: "Высокий", color: "#fed7aa" },
        { label: "Критичный", color: "#fecaca" },
      ];
      data.mitigations = bullets.slice(0, 4).map((b, i) => ({
        title: b.title || `Мера ${i + 1}`,
        description: b.description || "",
        color: ["#dc2626", "#ea580c", "#ca8a04", "#16a34a"][i] || "#6366f1",
        priority: ["Критичный", "Высокий", "Средний", "Низкий"][i] || "",
      }));
      break;
    case "card-grid": {
      const sc = content.structured_content as any;
      if (sc?.cards && Array.isArray(sc.cards)) {
        const defaultIcons = ["layers", "zap", "shield", "target", "globe", "star"];
        data.cards = sc.cards.slice(0, 6).map((c: any, i: number) => {
          // Use icon_hint from Writer if available, otherwise fall back to defaults
          const iconName = c.icon_hint || c.icon?.name || defaultIcons[i] || "box";
          return {
            title: c.title || `Элемент ${i + 1}`,
            description: c.description || c.text || "",
            badge: c.badge || "",
            value: c.value || "",
            icon: { name: iconName, url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg` },
          };
        });
      } else {
        data.cards = bullets.slice(0, 6).map((b, i) => ({
          title: b.title,
          description: b.description || "",
          icon: { name: "box", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/box.svg" },
        }));
      }
      break;
    }
    case "financial-formula": {
      const sc2 = content.structured_content as any;
      // Writer may use "parts" or "formula_parts" — check both
      const rawParts = sc2?.formula_parts || sc2?.parts || sc2?.formulaParts;
      if (rawParts && Array.isArray(rawParts)) {
        // Transform Writer's parts format into template's formulaParts format
        const formulaParts: any[] = [];
        for (let i = 0; i < rawParts.length; i++) {
          const p = rawParts[i];
          // If the part has an operator field, insert an operator part before the value
          if (i > 0 && rawParts[i - 1]?.operator) {
            formulaParts.push({ type: "operator", symbol: rawParts[i - 1].operator });
          } else if (p.type === "operator") {
            formulaParts.push({ type: "operator", symbol: p.symbol || p.value || "+" });
            continue;
          } else if (p.type === "equals") {
            formulaParts.push({ type: "equals" });
            continue;
          }
          // Check if this is the last value part (result) — look for "=" operator
          const isResult = p.operator === "=" || (i === rawParts.length - 1 && !p.type);
          if (isResult && !formulaParts.some((fp: any) => fp.type === "equals")) {
            formulaParts.push({ type: "equals" });
          }
          formulaParts.push({
            type: p.type || "value",
            value: p.value || "?",
            label: p.label || "",
            highlight: p.highlight || isResult || false,
          });
        }
        data.formulaParts = formulaParts;
      } else {
        data.formulaParts = [
          { type: "value", value: "A", label: bullets[0]?.title || "Показатель 1" },
          { type: "operator", symbol: "+" },
          { type: "value", value: "B", label: bullets[1]?.title || "Показатель 2" },
          { type: "equals" },
          { type: "value", value: "C", label: bullets[2]?.title || "Результат", highlight: true },
        ];
      }
      if (sc2?.components && Array.isArray(sc2.components)) {
        data.components = sc2.components;
      }
      data.footnote = sc2?.bottom_line || sc2?.footnote || "";
      break;
    }
    case "big-statement": {
      const sc3 = content.structured_content as any;
      data.subtitle = sc3?.subtitle || content.key_message || "";
      data.bigNumber = sc3?.big_number || sc3?.bigNumber || "";
      data.label = sc3?.label || "";
      data.source = sc3?.source || "";
      break;
    }
    case "verdict-analysis": {
      const sc4 = content.structured_content as any;
      // Writer may use "items" (analysis_with_verdict shape) or "criteria" (direct)
      const rawCriteria = sc4?.criteria || sc4?.items;
      if (rawCriteria && Array.isArray(rawCriteria)) {
        data.criteria = rawCriteria.map((c: any) => ({
          label: c.label || c.title || c.name || "",
          value: c.value || c.severity || c.score || "",
          detail: c.detail || c.description || c.comment || "",
        }));
      } else {
        data.criteria = bullets.slice(0, 4).map((b) => ({
          label: b.title,
          value: "—",
          detail: b.description,
        }));
      }
      data.verdictTitle = sc4?.verdict_title || sc4?.verdictTitle || content.key_message || "Вердикт";
      data.verdictText = sc4?.verdict_text || sc4?.verdictText || content.text.substring(0, 200);
      // Map severity to color: LOW=green, MEDIUM=amber, HIGH=red
      const severityColorMap: Record<string, string> = { LOW: "#16a34a", MEDIUM: "#f59e0b", HIGH: "#dc2626" };
      const rawColor = sc4?.verdict_color || sc4?.verdictColor;
      data.verdictColor = rawColor?.startsWith("#") ? rawColor : (severityColorMap[rawColor?.toUpperCase?.()] || "#16a34a");
      // Map indicators to verdictDetails strings
      if (sc4?.indicators && Array.isArray(sc4.indicators)) {
        data.verdictDetails = sc4.indicators.map((ind: any) => `${ind.label}: ${ind.value}`);
      } else {
        data.verdictDetails = sc4?.verdict_details || sc4?.verdictDetails || [];
      }
      data.verdictIcon = sc4?.verdict_icon || sc4?.verdictIcon || "";
      break;
    }
    case "vertical-timeline": {
      const sc5 = content.structured_content as any;
      const rawEvents = sc5?.events || sc5?.items;
      if (rawEvents && Array.isArray(rawEvents)) {
        data.events = rawEvents.slice(0, 7).map((e: any, i: number) => {
          const iconName = e.icon_hint || e.icon?.name || "";
          return {
            date: e.date || e.period || "",
            title: e.title || e.name || `Этап ${i + 1}`,
            description: e.description || e.text || "",
            badge: e.badge || e.status || "",
            highlight: e.highlight || e.current || false,
            icon: iconName ? { name: iconName, url: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg` } : undefined,
          };
        });
      } else {
        // Ensure at least 3 events for validation
        const eventBullets = bullets.length >= 3 ? bullets.slice(0, 6) : [
          ...bullets,
          ...Array.from({ length: 3 - bullets.length }, (_, i) => ({
            title: `Этап ${bullets.length + i + 1}`,
            description: "",
          })),
        ];
        data.events = eventBullets.map((b, i) => ({
          date: `Этап ${i + 1}`,
          title: b.title,
          description: b.description || "",
        }));
      }
      break;
    }
    case "comparison-table": {
      const sc6 = content.structured_content as any;
      if (sc6?.columns && Array.isArray(sc6.columns) && sc6?.features && Array.isArray(sc6.features)) {
        data.columns = sc6.columns.map((c: any) => ({
          name: c.name || c.title || "",
          highlight: c.highlight || false,
        }));
        data.features = sc6.features.map((f: any) => ({
          name: f.name || f.feature || f.label || "",
          values: f.values || [],
        }));
        data.featureLabel = sc6.featureLabel || sc6.feature_label || "Параметр";
        data.footnote = sc6.footnote || "";
      } else {
        // Fallback: create 2-column comparison from bullets, ensure at least 2 features
        data.columns = [{ name: "Вариант A", highlight: false }, { name: "Вариант B", highlight: true }];
        const featureBullets = bullets.length >= 2 ? bullets.slice(0, 5) : [
          ...bullets,
          ...Array.from({ length: 2 - bullets.length }, (_, i) => ({
            title: `Параметр ${bullets.length + i + 1}`,
            description: "",
          })),
        ];
        data.features = featureBullets.map((b) => ({
          name: b.title,
          values: ["✓", "✓"],
        }));
      }
      break;
    }
    case "quote-highlight": {
      const sc7 = content.structured_content as any;
      data.quote = sc7?.quote || sc7?.text || content.key_message || content.text.substring(0, 300);
      data.author = sc7?.author || sc7?.attribution || "Эксперт";
      data.role = sc7?.role || sc7?.context || sc7?.position || "";
      data.source = sc7?.source || "";
      data.context = "";
      if (sc7?.accentPanel) {
        data.accentPanel = {
          bigNumber: sc7.accentPanel.bigNumber || sc7.accentPanel.big_number || "",
          label: sc7.accentPanel.label || "",
          description: sc7.accentPanel.description || "",
        };
      }
      break;
    }
    case "checklist": {
      const sc8 = content.structured_content as any;
      const rawItems = sc8?.checklist || sc8?.items;
      if (rawItems && Array.isArray(rawItems)) {
        data.items = rawItems.map((item: any) => ({
          title: item.title || item.name || "",
          description: item.description || item.text || "",
          done: item.done ?? item.completed ?? false,
          status: item.done ? "Готово" : "В процессе",
          statusColor: item.done ? "#dcfce7" : "#fef9c3",
          statusTextColor: item.done ? "#166534" : "#854d0e",
        }));
      } else {
        data.items = bullets.slice(0, 8).map((b, i) => ({
          title: b.title,
          description: b.description,
          done: i < Math.ceil(bullets.length / 2),
          status: i < Math.ceil(bullets.length / 2) ? "Готово" : "В процессе",
          statusColor: i < Math.ceil(bullets.length / 2) ? "#dcfce7" : "#fef9c3",
          statusTextColor: i < Math.ceil(bullets.length / 2) ? "#166534" : "#854d0e",
        }));
      }
      break;
    }
    case "swot-analysis": {
      const sc9 = content.structured_content as any;
      // Check for both direct SWOT fields and nested swot object from Writer
      const swotData = sc9?.swot || sc9;
      if (swotData?.strengths && swotData?.weaknesses && swotData?.opportunities && swotData?.threats) {
        data.strengths = { title: swotData.strengths.title || "Сильные стороны", items: swotData.strengths.items || [] };
        data.weaknesses = { title: swotData.weaknesses.title || "Слабые стороны", items: swotData.weaknesses.items || [] };
        data.opportunities = { title: swotData.opportunities.title || "Возможности", items: swotData.opportunities.items || [] };
        data.threats = { title: swotData.threats.title || "Угрозы", items: swotData.threats.items || [] };
      } else {
        // Text-only fallback: split bullets into 4 quadrants
        const allBullets = bullets.map(b => b.title);
        const quarter = Math.max(1, Math.ceil(allBullets.length / 4));
        data.strengths = { title: "Сильные стороны", items: allBullets.slice(0, quarter) };
        data.weaknesses = { title: "Слабые стороны", items: allBullets.slice(quarter, quarter * 2) };
        data.opportunities = { title: "Возможности", items: allBullets.slice(quarter * 2, quarter * 3) };
        data.threats = { title: "Угрозы", items: allBullets.slice(quarter * 3) };
      }
      break;
    }
    case "kanban-board": {
      const sc10 = content.structured_content as any;
      // Writer may return columns directly or nested in kanban/board field
      const kanbanCols = sc10?.columns || sc10?.kanban?.columns;
      if (kanbanCols && Array.isArray(kanbanCols)) {
        data.columns = kanbanCols.map((col: any) => ({
          title: col.title || "Column",
          color: col.color || "",
          cards: (col.cards || []).map((card: any) => ({
            title: card.title || "",
            description: card.description || "",
            priority: card.priority || "",
            tags: card.tags || [],
            assignee: card.assignee || "",
          })),
        }));
      } else {
        // Text-only fallback: create 3 columns from bullets
        const allBullets = bullets.map(b => b.title);
        const third = Math.max(1, Math.ceil(allBullets.length / 3));
        const statusColors = ["#f59e0b", "#3b82f6", "#22c55e"];
        const statusNames = ["\u0412 \u043e\u0447\u0435\u0440\u0435\u0434\u0438", "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435", "\u0413\u043e\u0442\u043e\u0432\u043e"];
        data.columns = statusNames.map((name, i) => ({
          title: name,
          color: statusColors[i],
          cards: allBullets.slice(i * third, (i + 1) * third).map(text => ({
            title: text,
            description: "",
            priority: i === 0 ? "high" : i === 1 ? "medium" : "low",
            tags: [],
            assignee: "",
          })),
        }));
      }
      break;
    }
    case "org-chart": {
      const sc11 = content.structured_content as any;
      const orgRoot = sc11?.root;
      const orgChildren = sc11?.children;
      if (orgRoot && orgChildren && Array.isArray(orgChildren)) {
        data.root = {
          name: orgRoot.name || content.title,
          role: orgRoot.role || "",
        };
        data.children = orgChildren.slice(0, 6).map((child: any) => ({
          name: child.name || "",
          role: child.role || "",
          avatar: child.avatar || "",
          detail: child.detail || "",
          members: (child.members || []).slice(0, 3).map((m: any) => ({
            name: m.name || "",
            role: m.role || "",
          })),
        }));
      } else {
        // Text-only fallback: create org chart from bullets
        data.root = { name: content.title, role: "" };
        data.children = bullets.slice(0, 5).map((b, i) => ({
          name: b.title,
          role: b.description ? b.description.slice(0, 40) : "",
          avatar: ["\ud83d\udc68\u200d\ud83d\udcbb", "\ud83d\udcca", "\ud83d\udee0\ufe0f", "\ud83c\udf10", "\ud83d\udcb0"][i % 5],
          detail: "",
          members: [],
        }));
      }
      break;
    }
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
  const { data: fixedData, fixed } = fixSlideStructure(data, layoutName);
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
      slideContent.structured_content,
      slideContent.content_shape,
      slideContent.slide_category,
      (slideContent as any).transition_phrase,
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
    const retryFix = fixSlideStructure(data, layoutName);
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

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value.url) {
        imageMap.set(r.value.slideNumber, r.value.url);
      } else if (r.status === "rejected") {
        console.warn(`[Pipeline] Image generation failed for slide ${batch[j]?.slide_number}: ${r.reason?.message || r.reason}`);
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

  // ═══════════════════════════════════════════════════════
  // PHASE 1: RESEARCH — gather facts BEFORE any planning
  // ═══════════════════════════════════════════════════════
  onProgress({ nodeName: "research", currentStep: "researching", progressPercent: 3, message: "Исследование фактов и статистики..." });
  let researchContext: ResearchContext | null = null;
  try {
    // Use topic-first research — no outline dependency
    const researchResult = await runResearchByTopic(prompt, "ru", (msg) => {
      onProgress({ nodeName: "research", currentStep: "researching", progressPercent: 5, message: msg });
    });
    researchContext = researchResult.context;
    console.log(`[Pipeline] Research (topic-first): ${researchResult.totalFacts} facts for ${researchResult.slidesResearched} categories`);
    onProgress({ nodeName: "research", currentStep: "researching", progressPercent: 10, message: `Найдено ${researchResult.totalFacts} фактов` });
  } catch (err) {
    console.error("[Pipeline] Research agent failed, proceeding without research:", err);
    onProgress({ nodeName: "research", currentStep: "researching", progressPercent: 10, message: "Пропуск исследования (ошибка)" });
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 2: ANALYSIS — rank insights and build narrative arc
  // ═══════════════════════════════════════════════════════
  let analysisResult: AnalysisResult | null = null;
  let analysisContextStr = "";
  let analysisHighlightsStr = "";
  if (researchContext && researchContext.total_facts_found > 0) {
    onProgress({ nodeName: "analysis", currentStep: "analyzing", progressPercent: 12, message: "Анализ и ранжирование инсайтов..." });
    try {
      const analysisAgentResult = await runAnalysisAgent(prompt, researchContext, "ru", (msg) => {
        onProgress({ nodeName: "analysis", currentStep: "analyzing", progressPercent: 14, message: msg });
      });
      analysisResult = analysisAgentResult.analysis;
      analysisContextStr = formatAnalysisForDownstream(analysisResult);
      analysisHighlightsStr = formatAnalysisForWriter(analysisResult);
      console.log(`[Pipeline] Analysis: ${analysisAgentResult.clusterCount} clusters, ${analysisAgentResult.anchorCount} anchors, arc: ${analysisResult.narrative_arc}`);
      onProgress({ nodeName: "analysis", currentStep: "analyzing", progressPercent: 16, message: `${analysisAgentResult.clusterCount} кластеров, ${analysisAgentResult.anchorCount} якорных инсайтов` });
    } catch (err) {
      console.error("[Pipeline] Analysis agent failed, proceeding without analysis:", err);
      onProgress({ nodeName: "analysis", currentStep: "analyzing", progressPercent: 16, message: "Пропуск анализа (ошибка)" });
    }
  } else {
    console.log("[Pipeline] Skipping analysis — no research data available");
    onProgress({ nodeName: "analysis", currentStep: "skipped", progressPercent: 16, message: "Анализ пропущен (нет данных)" });
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 3: PLANNER — now informed by research + analysis
  // ═══════════════════════════════════════════════════════
  onProgress({ nodeName: "planner", currentStep: "planning", progressPercent: 18, message: "Анализ темы и планирование..." });
  const plannerResult = await runPlanner(prompt, analysisContextStr || undefined);
  const language = plannerResult.language || "ru";

  // 3.5. PRESENTATION TYPE CLASSIFICATION
  const typeProfile = classifyPresentation(prompt);
  console.log(`[Pipeline] Presentation type: ${typeProfile.type} (${typeProfile.label})`);

  // 3.6. REFERENCE MATCHING — find best exemplar structure for this type
  const reference = matchReference(prompt, typeProfile.type);
  let referenceHint = "";
  if (reference) {
    referenceHint = formatReferenceHint(reference);
    console.log(`[Pipeline] Matched reference: ${reference.id} (${reference.name}, ${reference.slide_count} slides)`);
  } else {
    console.log(`[Pipeline] No reference matched for type: ${typeProfile.type}`);
  }

  // Combine type hint with reference hint for the Outline Agent
  const combinedOutlineHint = [typeProfile.outlineHint, referenceHint].filter(Boolean).join("\n\n");

  // ═══════════════════════════════════════════════════════
  // PHASE 4: OUTLINE — grounded in research data
  // ═══════════════════════════════════════════════════════
  let outline: OutlineResult;
  if (config.preBuiltOutline) {
    // Use pre-built outline from uploaded file (skip LLM generation)
    outline = config.preBuiltOutline;
    console.log(`[Pipeline] Using pre-built outline: ${outline.slides.length} slides, title: "${outline.presentation_title}"`);
    onProgress({ nodeName: "outline", currentStep: "outlining", progressPercent: 22, message: `Структура из файла: ${outline.slides.length} слайдов` });
    onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 28, message: "Пропуск (структура из файла)" });
  } else {
    onProgress({ nodeName: "outline", currentStep: "outlining", progressPercent: 22, message: "Создание структуры презентации..." });
    const rawOutline = await runOutline(prompt, plannerResult.branding, language, combinedOutlineHint, analysisContextStr || undefined, config.slideCount);

    // 4.5. OUTLINE CRITIC — validate and improve outline structure (now with research coverage)
    // SKIP critic when user explicitly requested a specific slide count — critic tends to add slides
    outline = rawOutline;
    if (config.slideCount) {
      console.log(`[Pipeline] Skipping outline critic — user requested exactly ${config.slideCount} slides (got ${rawOutline.slides.length})`);
      onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 28, message: `Пропуск (${rawOutline.slides.length} слайдов по запросу)` });
    } else {
      onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 26, message: "Проверка структуры презентации..." });
      try {
        const criticResult = await runOutlineCritic(rawOutline, analysisResult || undefined, analysisContextStr || undefined);
        outline = criticResult.outline;
        const { critique } = criticResult;
        if (critique.improved_outline) {
          console.log(`[Pipeline] Outline improved by critic (score: ${critique.score}/10, ${critique.issues.length} issues)`);
        } else {
          console.log(`[Pipeline] Outline passed critic (score: ${critique.score}/10)`);
        }
        onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 28, message: `Структура проверена (${critique.score}/10)` });
      } catch (err) {
        console.error("[Pipeline] Outline critic failed, using original outline:", err);
        onProgress({ nodeName: "outline_critic", currentStep: "critique", progressPercent: 28, message: "Пропуск проверки (ошибка)" });
      }
    }
  }

  // 4.6. OUTLINE SHAPE POST-PROCESSING — force specialized shapes based on user keywords
  outline = postProcessOutlineShapes(outline, prompt);

  // 4.7. HARD SLIDE COUNT ENFORCEMENT — if user requested N slides, truncate to N
  if (config.slideCount && outline.slides.length > config.slideCount) {
    console.log(`[Pipeline] Enforcing slide count: truncating ${outline.slides.length} → ${config.slideCount} slides`);
    outline = {
      ...outline,
      slides: outline.slides.slice(0, config.slideCount).map((s, i) => ({
        ...s,
        slide_number: i + 1,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 5: WRITER — enriched with research + analysis context
  // ═══════════════════════════════════════════════════════
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 30, message: `Написание контента для ${outline.slides.length} слайдов...` });
  const researchFormatter = researchContext
    ? (slideNumber: number) => formatResearchForWriter(slideNumber, researchContext!)
    : undefined;
  const rawContent = await runWriterParallel(
    outline,
    language,
    undefined,
    researchFormatter,
    typeProfile.writerHint,
    analysisHighlightsStr || undefined,
  );
  onProgress({ nodeName: "writer", currentStep: "writing", progressPercent: 40, message: "Контент готов" });

  // 5.5. STORYTELLING AGENT — transform titles to action titles + narrative coherence
  onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 40, message: "Улучшение нарратива и заголовков..." });
  let content = rawContent;
  try {
    const storytellingResult = await runStorytellingAgent(rawContent, outline, analysisResult || undefined);
    content = storytellingResult.enhancedContent;
    if (storytellingResult.narrativeThread) {
      console.log(`[Pipeline] Narrative thread: ${storytellingResult.narrativeThread}`);
    }
    onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 45, message: "Нарратив улучшен" });
  } catch (err) {
    console.error("[Pipeline] Storytelling agent failed, using original content:", err);
    onProgress({ nodeName: "storytelling", currentStep: "storytelling", progressPercent: 45, message: "Пропуск нарратива (ошибка)" });
  }

  // 3.6. CONTENT EVALUATOR — Evaluator-Optimizer pattern
  onProgress({ nodeName: "evaluator", currentStep: "evaluating", progressPercent: 43, message: "Оценка качества контента..." });
  try {
    const slidesForEval: SlideForEval[] = content.map((s) => ({
      slide_number: s.slide_number,
      title: s.title,
      text: s.text,
      key_message: s.key_message,
      content_shape: s.content_shape,
      structured_content: s.structured_content as Record<string, unknown> | undefined,
    }));

    const evalResult = await runEvaluatorLoop(
      slidesForEval,
      async (slideNum, feedback) => {
        // Rewrite the slide with evaluator feedback
        const slideInfo = outline.slides.find((s) => s.slide_number === slideNum);
        if (!slideInfo) throw new Error(`Slide ${slideNum} not found in outline`);

        const previousContext = content
          .filter((s) => s.slide_number < slideNum)
          .slice(-3)
          .map((s) => `Slide ${s.slide_number} "${s.title}": ${s.key_message}`)
          .join("\n");

        // Add evaluator feedback to key_points for the rewrite
        const enhancedSlideInfo = {
          ...slideInfo,
          key_points: [...slideInfo.key_points, `[EVALUATOR FEEDBACK: ${feedback}]`],
        };

        const rewritten = await runWriterSingle(
          enhancedSlideInfo,
          outline.presentation_title,
          outline.slides.map((s) => s.title).join(", "),
          outline.target_audience,
          language,
          previousContext,
          researchFormatter?.(slideNum),
          typeProfile.writerHint,
        );

        return {
          slide_number: rewritten.slide_number,
          title: rewritten.title,
          text: rewritten.text,
          key_message: rewritten.key_message,
          content_shape: rewritten.content_shape,
          structured_content: rewritten.structured_content as Record<string, unknown> | undefined,
        };
      },
      (iteration, failedCount) => {
        onProgress({
          nodeName: "evaluator",
          currentStep: "evaluating",
          progressPercent: 43 + iteration,
          message: `Оценка (итерация ${iteration + 1}): ${failedCount} слайдов на доработку`,
        });
      },
    );

    // Apply rewritten content back
    for (const evalSlide of evalResult.finalSlides) {
      const idx = content.findIndex((s) => s.slide_number === evalSlide.slide_number);
      if (idx >= 0) {
        content[idx] = {
          ...content[idx],
          title: evalSlide.title,
          text: evalSlide.text,
          key_message: evalSlide.key_message,
          content_shape: evalSlide.content_shape,
          structured_content: evalSlide.structured_content as any,
        };
      }
    }

    console.log(
      `[Pipeline] Content Evaluator: overall=${evalResult.evaluations.overallScore}, ` +
      `iterations=${evalResult.iterations}, failed=${evalResult.evaluations.failedSlides.length}`,
    );
    onProgress({ nodeName: "evaluator", currentStep: "evaluating", progressPercent: 46, message: `Оценка: ${evalResult.evaluations.overallScore}/5` });
  } catch (err) {
    console.error("[Pipeline] Content Evaluator failed, continuing:", err);
    onProgress({ nodeName: "evaluator", currentStep: "evaluating", progressPercent: 46, message: "Пропуск оценки (ошибка)" });
  }

  // 3.7. CONTENT DENSITY ENFORCEMENT — 6×6 rule
  {
    const densityResult = enforceAllSlidesDensity(content);
    if (densityResult.totalTrimmed > 0 || densityResult.totalSplit > 0) {
      content = densityResult.content;
      console.log(`[Pipeline] Density: ${densityResult.totalTrimmed} trimmed, ${densityResult.totalSplit} split`);
    }
  }

  // 4. THEME — auto-select, use predefined preset, or apply custom template
  onProgress({ nodeName: "theme", currentStep: "designing", progressPercent: 48, message: "Подбор визуальной темы..." });
  let themePreset: ThemePreset;
  let themeSelectionInfo: ThemeSelectionResult | null = null;

  if (config.customCssVariables) {
    // Use custom template CSS
    themePreset = {
      id: config.customTemplateId ? `custom_${config.customTemplateId}` : "custom",
      name: "Custom Template",
      nameRu: "Пользовательский шаблон",
      color: "#6366f1",
      gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      dark: false,
      category: "creative" as const,
      descRu: "Пользовательский шаблон",
      previewColor: "#6366f1",
      previewGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      cssVariables: config.customCssVariables,
      fontsUrl: config.customFontsUrl || "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      mood: "Custom user template",
    };
    console.log(`[Pipeline] Using custom template: ${config.customTemplateId || 'inline'}`);
    onProgress({ nodeName: "theme", currentStep: "designing", progressPercent: 49, message: "Тема: Пользовательский шаблон" });
  } else if (config.themePreset === "auto" || !config.themePreset) {
    // Default: always use BSPB corporate theme (100% default)
    themePreset = getThemePreset("bspb_corporate");
    console.log(`[Pipeline] Using default theme: bspb_corporate`);
    onProgress({ nodeName: "theme", currentStep: "designing", progressPercent: 49, message: `Тема: ${themePreset.nameRu}` });
  } else {
    themePreset = getThemePreset(config.themePreset);
  }
  const theme = await runTheme(
    plannerResult.presentation_title,
    plannerResult.branding,
    outline.target_audience,
    themePreset,
  );

  // 5. LAYOUT
  onProgress({ nodeName: "layout", currentStep: "layout_selection", progressPercent: 55, message: "Выбор макетов для слайдов..." });
  const layoutDecisions = await runLayout(content, typeProfile.layoutHint);

  // Map layout decisions to content
  const layoutMap = new Map(layoutDecisions.map((d) => [d.slide_number, d.layout_name]));
  console.log(`[Pipeline] Layout assignments: ${layoutDecisions.map(d => `${d.slide_number}:${d.layout_name}`).join(', ')}`);

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
        // BUT protect rich content layouts that shouldn't be replaced
const IMAGE_PROTECTED_LAYOUTS = new Set([
           "card-grid", "financial-formula", "big-statement", "verdict-analysis",
           "icons-numbers", "highlight-stats", "pros-cons", "risk-matrix",
           "numbered-steps-v2", "process-steps", "scenario-cards", "kanban-board",
           "timeline-horizontal", "vertical-timeline", "roadmap", "chart-slide", "stats-chart",
           "dual-chart", "table-slide", "agenda-table-of-contents",
           "comparison-table", "quote-highlight", "org-chart",
          "title-slide", "final-slide", "section-header",
        ]);
        Array.from(imageMap.keys()).forEach((slideNum) => {
          const currentLayout = layoutMap.get(slideNum) || "text-slide";
          if (!IMAGE_PROTECTED_LAYOUTS.has(currentLayout)) {
            layoutMap.set(slideNum, "image-text");
          } else {
            console.log(`[Pipeline] Image override skipped: slide ${slideNum} "${currentLayout}" is a rich layout`);
          }
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

  // 5.8. DATA VISUALIZATION — generate SVG charts for data-rich slides
  onProgress({ nodeName: "data_viz", currentStep: "analyzing", progressPercent: 72, message: "Анализ данных для визуализации..." });
  let chartMap = new Map<number, string>();
  try {
    const dataVizResult = await runDataVizAgent(
      content,
      layoutMap,
      6,
      (msg) => onProgress({ nodeName: "data_viz", currentStep: "generating", progressPercent: 73, message: msg }),
    );
    chartMap = dataVizResult.svgCharts;
    console.log(`[Pipeline] Data Viz: ${dataVizResult.totalChartsGenerated} SVG charts generated`);
    onProgress({ nodeName: "data_viz", currentStep: "done", progressPercent: 74, message: `${dataVizResult.totalChartsGenerated} графиков создано` });
  } catch (err) {
    console.error("[Pipeline] Data Viz failed, continuing without charts:", err);
    onProgress({ nodeName: "data_viz", currentStep: "done", progressPercent: 74, message: "Пропуск визуализации (ошибка)" });
  }

  // 5.9. POST-CHART LAYOUT FIXUP: ensure chart-bearing slides use chart-capable layouts
  // BUT preserve rich content layouts that shouldn't be overridden by charts
  const CHART_CAPABLE_LAYOUTS = new Set(["chart-slide", "stats-chart", "chart-text", "dual-chart"]);
  const STATS_LIKE_LAYOUTS = new Set(["highlight-stats", "icons-numbers"]);
  // These layouts have rich structured content that should NOT be replaced by chart layouts
const CHART_PROTECTED_LAYOUTS = new Set([
     "card-grid", "financial-formula", "big-statement", "verdict-analysis",
     "timeline-horizontal", "vertical-timeline", "process-steps",
      "comparison-table", "quote-highlight", "kanban-board", "org-chart", "risk-matrix", "section-header", "title-slide", "final-slide",
     "roadmap", "numbered-steps-v2", "pros-cons", "text-with-callout",
     "highlight-stats", "icons-numbers", "table-slide", "scenario-cards",
  ]);
  for (const [slideNum, svgChart] of Array.from(chartMap.entries())) {
    const currentLayout = layoutMap.get(slideNum) || "text-slide";
    if (CHART_CAPABLE_LAYOUTS.has(currentLayout)) {
      continue; // Already chart-capable, no change needed
    }
    if (CHART_PROTECTED_LAYOUTS.has(currentLayout)) {
      // Don't override rich layouts — discard the chart for this slide
      console.log(`[Pipeline] Chart skipped: slide ${slideNum} "${currentLayout}" is a protected layout (chart discarded)`);
      chartMap.delete(slideNum);
      continue;
    }
    // Only override simple text/bullet/image layouts
    let newLayout: string;
    if (STATS_LIKE_LAYOUTS.has(currentLayout)) {
      newLayout = "stats-chart"; // stats + chart hybrid
    } else if (currentLayout === "image-text" || currentLayout === "two-column" || currentLayout === "text-slide") {
      newLayout = "chart-text"; // text/bullets + chart
    } else {
      newLayout = "chart-slide"; // generic full chart
    }
    console.log(`[Pipeline] Chart layout fixup: slide ${slideNum} "${currentLayout}" → "${newLayout}" (chart available)`);
    layoutMap.set(slideNum, newLayout);
  }

  // 6. HTML COMPOSER (parallel per slide)
  onProgress({ nodeName: "composer", currentStep: "composing", progressPercent: 75, message: "Сборка HTML-слайдов..." });

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

        // Post-process: truncate text to prevent overflow
        if (data.title && typeof data.title === "string" && data.title.length > 50) {
          // Hard truncate title at word boundary
          const t = data.title.substring(0, 50);
          const ls = t.lastIndexOf(" ");
          data.title = ls > 30 ? t.substring(0, ls) : t;
        }
        if ((layoutName === "title-slide" || layoutName === "final-slide") && data.description && data.description.length > 200) {
          data.description = data.description.substring(0, 200);
        }
        if ((layoutName === "section-header" || layoutName === "final-slide") && data.subtitle && data.subtitle.length > 120) {
          const sub = data.subtitle.substring(0, 120);
          const ls = sub.lastIndexOf(" ");
          data.subtitle = (ls > 80 ? sub.substring(0, ls) : sub);
        }

        // Inject image if available
        const imgUrl = imageMap.get(slideContent.slide_number);
        if (imgUrl) {
          data.image = { url: imgUrl, alt: slideContent.title };
          data.backgroundImage = { url: imgUrl, alt: slideContent.title };
        }

        // Inject SVG chart if available
        const svgChart = chartMap.get(slideContent.slide_number);
        if (svgChart) {
          injectChartIntoSlideData(data, svgChart, layoutName);
        }

        // Inject slide metadata for footer rendering
        data._slideNumber = slideContent.slide_number;
        data._totalSlides = content.length;
        data._presentationTitle = plannerResult.presentation_title;

        // 3-tier LLM content quality check for ALL slides
        const qaLevel = getQALevel(layoutName);
        const retryBudget = getQARetryBudget(qaLevel);
        try {
          const llmQA = await validateSlideContentLLM(data, layoutName, prompt, invokeLLM);
          if (!llmQA.passed) {
            console.warn(`[LLM-QA-${qaLevel}] Slide ${slideContent.slide_number} "${layoutName}": score ${llmQA.score}/10. Issues: ${llmQA.issues.join("; ")}`);
            if (retryBudget > 0 && llmQA.score <= 5 && llmQA.suggestions.length > 0) {
              const feedbackStr = `Content quality issues:\n${llmQA.issues.map(i => `- ${i}`).join("\n")}\n\nSuggestions:\n${llmQA.suggestions.map(s => `- ${s}`).join("\n")}`;
              const layoutTemplate = getLayoutTemplate(layoutName);
              const retrySystem = htmlComposerSystem(feedbackStr);
              const retryUser = htmlComposerUser(
                layoutName,
                layoutTemplate || `Layout: ${layoutName}`,
                slideContent.title,
                slideContent.text,
                slideContent.notes,
                slideContent.key_message,
                theme.css_variables,
                slideContent.structured_content,
                slideContent.content_shape,
                slideContent.slide_category,
                (slideContent as any).transition_phrase,
              );
              try {
                const rawResponse = await llmText(retrySystem, retryUser);
                let jsonStr = rawResponse;
                const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) jsonStr = jsonMatch[1];
                const retryData = JSON.parse(jsonStr.trim());
                Object.assign(data, retryData);
                console.log(`[LLM-QA-${qaLevel}] Slide ${slideContent.slide_number}: re-composed after feedback`);
              } catch {
                console.warn(`[LLM-QA-${qaLevel}] Slide ${slideContent.slide_number}: retry failed, keeping original`);
              }
            }
          } else {
            console.log(`[LLM-QA-${qaLevel}] Slide ${slideContent.slide_number} "${layoutName}": passed (${llmQA.score}/10)`);
          }
        } catch (e) {
          console.warn(`[LLM-QA-${qaLevel}] Slide ${slideContent.slide_number}: validation error, skipping`, e);
        }

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
    // Pre-fix: auto-fix slide data to prevent overflow before critique
    let totalDataFixes = 0;
    for (const slide of slides) {
      const dataFixes = fixSlideDensity(slide.data, slide.layoutId);
      if (dataFixes.length > 0) {
        totalDataFixes += dataFixes.length;
        console.log(`[Pipeline] Data auto-fix slide ${slide.layoutId}: ${dataFixes.join(', ')}`);
        // Re-render the slide with fixed data
        slide.html = renderSlide(slide.layoutId, slide.data);
      }
    }
    if (totalDataFixes > 0) {
      console.log(`[Pipeline] Applied ${totalDataFixes} data-level auto-fixes across all slides`);
    }

    const designSlides2 = slides.map((s, i) => ({
      slideNumber: i + 1,
      layoutId: s.layoutId,
      data: s.data,
      html: s.html,
    }));
    const critique = runDesignCritic(designSlides2, theme.css_variables);

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

    // LLM Design Critic — holistic analysis for additional CSS improvements
    try {
      const llmCritique = await runLlmDesignCritique(designSlides2, theme.css_variables, critique);
      if (llmCritique.suggestions.length > 0) {
        console.log(`[Pipeline] LLM Design Critic: revised score ${llmCritique.revisedScore}/10, ${llmCritique.suggestions.length} suggestions`);
      }
      onProgress({
        nodeName: "design_critic",
        currentStep: "design_review",
        progressPercent: 94,
        message: `Дизайн: ${llmCritique.revisedScore}/10 (${critique.cssFixesPerSlide.size} исправлений, ${llmCritique.suggestions.length} рекомендаций)`,
      });
    } catch (llmErr) {
      console.log(`[Pipeline] LLM Design Critic skipped: ${(llmErr as Error).message}`);
      onProgress({
        nodeName: "design_critic",
        currentStep: "design_review",
        progressPercent: 94,
        message: `Дизайн: ${critique.overallScore}/10 (${critique.cssFixesPerSlide.size} исправлений)`,
      });
    }
  } catch (err) {
    console.error("[Pipeline] Design critic failed, continuing:", err);
    onProgress({ nodeName: "design_critic", currentStep: "design_review", progressPercent: 94, message: "Пропуск проверки дизайна" });
  }

  // 6.5 VISUAL REVIEW (screenshot → Vision LLM)
  try {
    const { runVisualReview } = await import("./visualReviewer");
    onProgress({ nodeName: "visual_reviewer", currentStep: "rendering", progressPercent: 95, message: "Визуальная проверка слайдов..." });

    const visualSlides = slides.map((s, i) => ({
      slideNumber: i + 1,
      layoutId: s.layoutId,
      title: s.data?.title || `Slide ${i + 1}`,
      html: s.html,
    }));

    const visualReview = await runVisualReview(visualSlides, theme.css_variables);

    // Apply CSS patches from visual review
    for (const [slideNum, cssPatch] of Array.from(visualReview.cssPatches.entries())) {
      const idx = slideNum - 1;
      if (idx >= 0 && idx < slides.length && cssPatch.trim()) {
        slides[idx].html = `<style>${cssPatch}</style>${slides[idx].html}`;
      }
    }

    console.log(`[Pipeline] Visual review: avg ${visualReview.averageScore.toFixed(1)}/10, ${visualReview.cssPatches.size} patches applied`);
    onProgress({ nodeName: "visual_reviewer", currentStep: "completed", progressPercent: 97, message: `Визуальная оценка: ${visualReview.averageScore.toFixed(1)}/10` });
  } catch (err) {
    console.log(`[Pipeline] Visual review skipped: ${(err as Error).message}`);
    onProgress({ nodeName: "visual_reviewer", currentStep: "skipped", progressPercent: 97, message: "Визуальная проверка пропущена" });
  }

  // 6.8. FINAL REVIEW — holistic quality assessment + fact-checking
  try {
    onProgress({ nodeName: "final_review", currentStep: "reviewing", progressPercent: 97, message: "Финальная оценка презентации..." });
    const { runFinalReview } = await import("./finalReview");
    const { runFactCheck } = await import("./factChecker");
    const reviewSlides = slides.map((s, i) => ({
      slideNumber: i + 1,
      layoutId: s.layoutId,
      title: s.data?.title || `Slide ${i + 1}`,
      keyPoints: s.data?.key_points || s.data?.bullets || [],
    }));
    const finalReview = await runFinalReview(plannerResult.presentation_title, reviewSlides);

    // Fact-checking: extract all text from slides and compare with user prompt
    const factCheckSlides = slides.map((s, i) => {
      const parts: string[] = [s.data?.title || ""];
      if (s.data?.subtitle) parts.push(s.data.subtitle);
      if (s.data?.description) parts.push(s.data.description);
      if (Array.isArray(s.data?.key_points)) {
        for (const kp of s.data.key_points) {
          parts.push(typeof kp === "string" ? kp : (kp?.title || "") + " " + (kp?.description || ""));
        }
      }
      if (Array.isArray(s.data?.bullets)) {
        for (const b of s.data.bullets) {
          parts.push(typeof b === "string" ? b : (b?.title || "") + " " + (b?.description || ""));
        }
      }
      if (Array.isArray(s.data?.stats)) {
        for (const st of s.data.stats) {
          parts.push((st?.value || "") + " " + (st?.label || "") + " " + (st?.description || ""));
        }
      }
      if (Array.isArray(s.data?.metrics)) {
        for (const m of s.data.metrics) {
          parts.push((m?.value || "") + " " + (m?.label || "") + " " + (m?.description || ""));
        }
      }
      if (s.data?.mainStat) {
        parts.push((s.data.mainStat.value || "") + " " + (s.data.mainStat.label || ""));
      }
      return {
        slideNumber: i + 1,
        title: s.data?.title || `Slide ${i + 1}`,
        textContent: parts.filter(Boolean).join(" "),
      };
    });

    const factCheck = runFactCheck(prompt, factCheckSlides);
    console.log(`[Pipeline] Fact-check: ${factCheck.summary}`);
    if (factCheck.violations.length > 0) {
      for (const v of factCheck.violations) {
        console.log(`[Pipeline] Fact violation [${v.severity}] slide ${v.slideNumber}: ${v.description}`);
      }
    }

    // Apply fact-check penalty to overall score
    const adjustedScore = Math.max(1, finalReview.overallScore - factCheck.penalty);
    if (factCheck.penalty > 0) {
      console.log(`[Pipeline] Final review score adjusted: ${finalReview.overallScore.toFixed(1)} → ${adjustedScore.toFixed(1)} (fact-check penalty: -${factCheck.penalty.toFixed(1)})`);
    }

    console.log(`[Pipeline] Final review: ${adjustedScore.toFixed(1)}/10 | Strengths: ${finalReview.strengths.join(", ")}`);
    onProgress({ nodeName: "final_review", currentStep: "completed", progressPercent: 98, message: `Итоговая оценка: ${adjustedScore.toFixed(1)}/10` });
  } catch (err) {
    console.log(`[Pipeline] Final review skipped: ${(err as Error).message}`);
    onProgress({ nodeName: "final_review", currentStep: "skipped", progressPercent: 98, message: "Финальная оценка пропущена" });
  }

  // 7. ASSEMBLY
  onProgress({ nodeName: "assembler", currentStep: "assembling", progressPercent: 99, message: "Финальная сборка презентации..." });
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
