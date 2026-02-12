/**
 * Image Prompt Engine — generates high-quality, context-aware image prompts
 * for presentation slides using full slide content, theme, and content analysis.
 */

import { invokeLLM } from "../_core/llm";
import type { SlideContent } from "./generator";
import type { ContentAnalysis, ContentType } from "./contentAnalyzer";
import type { ThemePreset } from "./themes";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ImagePromptContext {
  /** Overall presentation topic */
  presentationTitle: string;
  /** Detected language of the presentation */
  language: string;
  /** Theme mood description */
  themeMood: string;
  /** Primary accent color from theme */
  primaryColor: string;
  /** Secondary accent color from theme */
  secondaryColor: string;
  /** Content analysis for the slide */
  contentAnalysis?: ContentAnalysis;
}

export interface EnrichedSlideInfo {
  slideNumber: number;
  title: string;
  fullText: string;
  keyMessage: string;
  dataPoints: Array<{ label: string; value: string; unit: string }>;
  layout: string;
  contentType?: ContentType;
  confidence?: number;
}

// ═══════════════════════════════════════════════════════
// TOPIC-AWARE STYLE MAPPING
// ═══════════════════════════════════════════════════════

interface StyleGuide {
  stylePrefix: string;
  preferredElements: string[];
  avoidElements: string[];
  colorGuidance: string;
}

const TOPIC_STYLE_MAP: Record<string, StyleGuide> = {
  technology: {
    stylePrefix: "Futuristic 3D render",
    preferredElements: [
      "glowing circuit patterns", "holographic interfaces", "floating data streams",
      "neural network visualizations", "abstract digital landscapes", "geometric wireframes",
    ],
    avoidElements: ["old computers", "floppy disks", "generic office scenes"],
    colorGuidance: "electric blues, neon cyans, deep purples with luminous accents",
  },
  finance: {
    stylePrefix: "Clean minimalist illustration",
    preferredElements: [
      "abstract growth curves", "geometric bar compositions", "golden ratio spirals",
      "ascending arrow formations", "crystal-clear data visualizations", "balanced scales",
    ],
    avoidElements: ["money piles", "piggy banks", "generic coins"],
    colorGuidance: "deep navy, emerald green, gold accents on clean white",
  },
  healthcare: {
    stylePrefix: "Modern medical illustration",
    preferredElements: [
      "molecular structures", "DNA helixes", "abstract cellular patterns",
      "clean laboratory environments", "medical technology interfaces", "organic flowing forms",
    ],
    avoidElements: ["scary medical instruments", "blood", "sick patients"],
    colorGuidance: "calming blues, fresh greens, clean whites with subtle teal accents",
  },
  education: {
    stylePrefix: "Warm isometric illustration",
    preferredElements: [
      "open books with floating knowledge", "interconnected concept maps",
      "light bulb metaphors", "growing trees of knowledge", "collaborative learning spaces",
    ],
    avoidElements: ["boring classrooms", "chalkboards", "generic school supplies"],
    colorGuidance: "warm oranges, friendly yellows, inviting blues with natural greens",
  },
  energy: {
    stylePrefix: "Dynamic environmental illustration",
    preferredElements: [
      "wind turbines in dramatic landscapes", "solar panel arrays reflecting sunlight",
      "flowing energy streams", "sustainable city concepts", "nature-technology fusion",
    ],
    avoidElements: ["pollution", "oil rigs", "dark factories"],
    colorGuidance: "vibrant greens, sky blues, solar golds with earth tones",
  },
  marketing: {
    stylePrefix: "Bold creative composition",
    preferredElements: [
      "abstract target/bullseye compositions", "dynamic funnel visualizations",
      "connected network graphs", "megaphone/amplification metaphors", "growth trajectories",
    ],
    avoidElements: ["generic handshakes", "thumbs up", "stock photo people"],
    colorGuidance: "bold primary colors, gradient transitions, high contrast accents",
  },
  management: {
    stylePrefix: "Professional abstract illustration",
    preferredElements: [
      "interconnected gear systems", "organizational hierarchy visualizations",
      "strategic chess pieces", "compass/navigation metaphors", "team collaboration abstracts",
    ],
    avoidElements: ["generic office photos", "boring meeting rooms", "clipart people"],
    colorGuidance: "authoritative navy, trustworthy blues, accent golds on neutral backgrounds",
  },
  default: {
    stylePrefix: "Modern professional illustration",
    preferredElements: [
      "abstract geometric compositions", "gradient mesh backgrounds",
      "floating 3D shapes", "clean data visualization art", "conceptual metaphors",
    ],
    avoidElements: ["stock photo cliches", "clip art", "cartoons", "text in images"],
    colorGuidance: "professional blues, clean whites, subtle accent colors",
  },
};

// ═══════════════════════════════════════════════════════
// CONTENT-TYPE TO VISUAL METAPHOR MAPPING
// ═══════════════════════════════════════════════════════

const CONTENT_TYPE_VISUALS: Partial<Record<ContentType, string[]>> = {
  process: [
    "flowing pathway with sequential stages",
    "interconnected nodes forming a pipeline",
    "ascending staircase with milestone markers",
  ],
  comparison: [
    "two contrasting abstract forms side by side",
    "balanced scales with different elements",
    "split composition showing duality",
  ],
  timeline: [
    "winding road stretching into the horizon",
    "sequential milestone markers along a path",
    "calendar-like grid with highlighted moments",
  ],
  risk: [
    "shield protecting against abstract threats",
    "storm clouds with protective umbrella",
    "radar/detection system scanning for dangers",
  ],
  scenario: [
    "branching paths leading to different futures",
    "crystal ball with multiple reflections",
    "diverging arrows from a central point",
  ],
  metrics: [
    "floating dashboard with key indicators",
    "abstract speedometer/gauge composition",
    "rising bar chart as architectural elements",
  ],
  single_metric: [
    "giant glowing number as centerpiece",
    "spotlight on a single powerful data point",
    "magnifying glass revealing a key insight",
  ],
  narrative: [
    "abstract concept visualization",
    "flowing organic shapes representing ideas",
    "interconnected elements forming a story",
  ],
};

// ═══════════════════════════════════════════════════════
// TOPIC DETECTION
// ═══════════════════════════════════════════════════════

const TOPIC_KEYWORDS: Record<string, RegExp> = {
  technology: /(технолог|digital|цифров|AI|ИИ|machine learning|программ|software|IT|облачн|cloud|автоматизац|робот|кибер|cyber|блокчейн|blockchain|данн|data|нейросет|neural|deep learning)/i,
  finance: /(финанс|инвестиц|бюджет|revenue|profit|ROI|капитал|банк|кредит|акци|фонд|биржа|валют|экономик|рентабельн|доходн|выручк|прибыл|затрат|расход)/i,
  healthcare: /(медицин|здоровь|фарма|лекарств|пациент|диагност|лечени|клиник|больниц|врач|хирург|терапи|вакцин|генетик|биотехнолог|healthcare|medical)/i,
  education: /(образован|обучен|курс|студент|университ|школ|преподав|учебн|тренинг|навык|компетенц|знани|education|learning|training|skill)/i,
  energy: /(энерг|возобновляем|солнечн|ветров|электр|углерод|экологи|устойчив|зелен|renewable|solar|wind|carbon|sustainable|climate|климат)/i,
  marketing: /(маркетинг|реклам|бренд|продвижен|конверси|лид|аудитори|контент|SEO|SMM|таргет|воронк|CRM|клиент|продаж|marketing|brand|sales)/i,
  management: /(управлен|менеджмент|проект|agile|scrum|waterfall|команд|лидерств|стратеги|KPI|OKR|процесс|оптимизац|эффективн|management|leadership)/i,
};

/**
 * Detect the primary topic of the presentation from its title and content.
 */
export function detectPresentationTopic(title: string, slideTitles: string[]): string {
  const fullText = [title, ...slideTitles].join(" ").toLowerCase();

  const scores: Record<string, number> = {};
  for (const [topic, regex] of Object.entries(TOPIC_KEYWORDS)) {
    const matches = fullText.match(new RegExp(regex, "gi"));
    scores[topic] = matches ? matches.length : 0;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0] && sorted[0][1] > 0 ? sorted[0][0] : "default";
}

/**
 * Get the style guide for a detected topic.
 */
export function getStyleGuide(topic: string): StyleGuide {
  return TOPIC_STYLE_MAP[topic] || TOPIC_STYLE_MAP.default;
}

// ═══════════════════════════════════════════════════════
// ENRICHED SLIDE SUMMARY BUILDER
// ═══════════════════════════════════════════════════════

/**
 * Build a rich, detailed summary of a slide for image prompt generation.
 * Includes all available content: title, text, data points, key message, content type.
 */
export function buildEnrichedSlideSummary(slide: EnrichedSlideInfo): string {
  const parts: string[] = [];

  parts.push(`Slide ${slide.slideNumber}: "${slide.title}"`);

  if (slide.keyMessage) {
    parts.push(`  Key message: ${slide.keyMessage}`);
  }

  // Include full text (truncated to 300 chars for LLM context efficiency)
  if (slide.fullText) {
    const truncated = slide.fullText.length > 300
      ? slide.fullText.substring(0, 300) + "..."
      : slide.fullText;
    parts.push(`  Content: ${truncated}`);
  }

  // Include data points with actual values
  if (slide.dataPoints && slide.dataPoints.length > 0) {
    const dpSummary = slide.dataPoints
      .map(dp => `${dp.label}: ${dp.value}${dp.unit ? " " + dp.unit : ""}`)
      .join(", ");
    parts.push(`  Key data: ${dpSummary}`);
  }

  // Include content type analysis
  if (slide.contentType) {
    parts.push(`  Content type: ${slide.contentType} (confidence: ${(slide.confidence || 0).toFixed(1)})`);
  }

  parts.push(`  Layout: ${slide.layout}`);

  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════
// MAIN IMAGE PROMPT GENERATION
// ═══════════════════════════════════════════════════════

/**
 * Generate high-quality, context-aware image prompts for selected slides.
 * Uses full slide content, presentation context, theme, and content analysis.
 */
export async function generateImagePrompts(
  slides: EnrichedSlideInfo[],
  context: ImagePromptContext,
  maxImages: number = 5,
): Promise<Array<{ slide_number: number; image_prompt: string }>> {
  if (slides.length === 0) return [];

  // Detect topic and get style guide
  const topic = detectPresentationTopic(
    context.presentationTitle,
    slides.map(s => s.title),
  );
  const styleGuide = getStyleGuide(topic);

  // Build enriched summaries
  const slideSummaries = slides.map(s => buildEnrichedSlideSummary(s)).join("\n\n");

  // Build visual metaphor hints per content type
  const contentTypeHints = slides
    .filter(s => s.contentType && CONTENT_TYPE_VISUALS[s.contentType])
    .map(s => {
      const visuals = CONTENT_TYPE_VISUALS[s.contentType!]!;
      const randomVisual = visuals[Math.floor(Math.random() * visuals.length)];
      return `Slide ${s.slideNumber} (${s.contentType}): consider "${randomVisual}"`;
    })
    .join("\n");

  const systemPrompt = `You are a world-class art director creating illustrations for a professional presentation.

<presentation_context>
Title: "${context.presentationTitle}"
Topic domain: ${topic}
Theme mood: ${context.themeMood}
Primary color: ${context.primaryColor}
Secondary color: ${context.secondaryColor}
</presentation_context>

<style_direction>
Base style: ${styleGuide.stylePrefix}
Preferred visual elements: ${styleGuide.preferredElements.join(", ")}
Color palette guidance: ${styleGuide.colorGuidance}
AVOID: ${styleGuide.avoidElements.join(", ")}
</style_direction>

<rules>
1. Select up to ${maxImages} slides that would benefit MOST from an illustration.
2. For each selected slide, write a detailed image generation prompt in English (80-120 words).
3. Each prompt MUST be SPECIFIC to the slide's actual content — reference the real topic, data, and key message.
4. Each prompt MUST start with the visual style (e.g., "${styleGuide.stylePrefix} of...").
5. Include color references that harmonize with the theme: use ${context.primaryColor} and ${context.secondaryColor} tones.
6. NEVER include text, labels, numbers, or words IN the image — the image is purely visual.
7. Each image should tell a visual story that reinforces the slide's message.
8. Vary the composition across slides — mix close-ups, wide shots, abstract, and concrete.
9. Reference SPECIFIC elements from the slide content (e.g., if slide mentions "AI diagnostics", show neural network analyzing medical scans, not generic tech).
10. Do NOT select slides about agendas, tables, pure data charts, or closing/thank-you slides.
</rules>`;

  const userPrompt = `Here are the eligible slides with full content details:

${slideSummaries}

${contentTypeHints ? `\nVisual metaphor suggestions:\n${contentTypeHints}\n` : ""}
Select up to ${maxImages} slides and generate detailed, content-specific image prompts. Each prompt should directly reference the slide's actual topic and data.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_selections",
          strict: true,
          schema: {
            type: "object",
            properties: {
              selections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    slide_number: { type: "integer", description: "The slide number" },
                    image_prompt: { type: "string", description: "Detailed English image generation prompt (80-120 words)" },
                    visual_rationale: { type: "string", description: "Brief explanation of why this visual supports the slide content" },
                  },
                  required: ["slide_number", "image_prompt", "visual_rationale"],
                  additionalProperties: false,
                },
              },
            },
            required: ["selections"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : '{"selections":[]}';
    const parsed = JSON.parse(contentStr);
    const eligibleNumbers = new Set(slides.map(s => s.slideNumber));

    return (parsed.selections || [])
      .filter((s: any) => eligibleNumbers.has(s.slide_number) && s.image_prompt?.trim())
      .slice(0, maxImages)
      .map((s: any) => ({
        slide_number: s.slide_number,
        image_prompt: s.image_prompt.trim(),
      }));
  } catch (error) {
    console.error("[ImagePromptEngine] Failed to generate prompts:", error);
    return [];
  }
}

/**
 * Generate an image prompt for a single slide (used in interactive mode).
 * Provides the same quality as batch mode but for one slide at a time.
 */
export async function generateSingleSlidePrompt(
  slide: EnrichedSlideInfo,
  context: ImagePromptContext,
): Promise<string> {
  const topic = detectPresentationTopic(
    context.presentationTitle,
    [slide.title],
  );
  const styleGuide = getStyleGuide(topic);

  // Build content-type visual hint
  let visualHint = "";
  if (slide.contentType && CONTENT_TYPE_VISUALS[slide.contentType]) {
    const visuals = CONTENT_TYPE_VISUALS[slide.contentType]!;
    visualHint = `\nVisual metaphor suggestion: "${visuals[Math.floor(Math.random() * visuals.length)]}"`;
  }

  // Build data context
  let dataContext = "";
  if (slide.dataPoints && slide.dataPoints.length > 0) {
    dataContext = `\nKey data points: ${slide.dataPoints.map(dp => `${dp.label}: ${dp.value}${dp.unit ? " " + dp.unit : ""}`).join(", ")}`;
  }

  const systemPrompt = `You are a world-class art director. Create ONE detailed image generation prompt for a presentation slide illustration.

<context>
Presentation: "${context.presentationTitle}"
Topic domain: ${topic}
Theme mood: ${context.themeMood}
Theme colors: ${context.primaryColor}, ${context.secondaryColor}
</context>

<style>
Base style: ${styleGuide.stylePrefix}
Preferred elements: ${styleGuide.preferredElements.slice(0, 3).join(", ")}
Color guidance: ${styleGuide.colorGuidance}
AVOID: ${styleGuide.avoidElements.join(", ")}
</style>

<rules>
- Write a detailed English prompt (80-120 words)
- Start with the visual style prefix
- Reference SPECIFIC content from the slide (topic, data, key message)
- Include color references matching the theme
- NEVER include text, labels, or numbers IN the image
- Output ONLY the prompt text, nothing else
</rules>`;

  const userPrompt = `Slide title: "${slide.title}"
Content: ${slide.fullText.substring(0, 400)}
Key message: ${slide.keyMessage || "N/A"}${dataContext}${visualHint}
Content type: ${slide.contentType || "narrative"}

Generate a detailed, content-specific image prompt:`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const prompt = typeof rawContent === "string" ? rawContent.trim() : "";

    return prompt || `${styleGuide.stylePrefix} representing ${slide.title}, professional business illustration with ${context.primaryColor} and ${context.secondaryColor} color accents, clean modern design`;
  } catch (error) {
    console.error("[ImagePromptEngine] Single prompt generation failed:", error);
    return `${styleGuide.stylePrefix} representing ${slide.title}, professional business illustration with ${context.primaryColor} and ${context.secondaryColor} color accents, clean modern design`;
  }
}
