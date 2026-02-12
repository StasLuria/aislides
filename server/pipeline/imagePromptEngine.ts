/**
 * Image Prompt Engine — generates high-quality, context-aware image prompts
 * for presentation slides using full slide content, theme, and content analysis.
 * 
 * Key improvement: Each slide gets a UNIQUE visual style from a diverse pool,
 * preventing repetitive "futuristic" or "same-style" images across the presentation.
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
// DIVERSE VISUAL STYLE POOL
// ═══════════════════════════════════════════════════════

/**
 * A pool of diverse visual styles that can be applied to ANY topic.
 * Each style produces a visually distinct image.
 */
const VISUAL_STYLE_POOL = [
  "Clean flat vector illustration with bold geometric shapes",
  "Soft watercolor-style digital painting with organic textures",
  "Isometric 3D illustration with clean lines and soft shadows",
  "Minimalist line art with selective color accents",
  "Photorealistic conceptual still life with dramatic lighting",
  "Abstract gradient mesh composition with flowing forms",
  "Paper cut-out layered illustration with depth and shadows",
  "Blueprint-style technical drawing with modern color overlay",
  "Low-poly 3D render with faceted surfaces and warm lighting",
  "Aerial/bird's-eye view illustration with miniature details",
  "Duotone photography-style composition with high contrast",
  "Hand-drawn sketch style with digital color enhancement",
  "Glassmorphism-inspired composition with translucent layers",
  "Retro-modern illustration combining vintage elements with contemporary design",
  "Macro photography style showing intricate details and textures",
];

// ═══════════════════════════════════════════════════════
// TOPIC-AWARE STYLE MAPPING
// ═══════════════════════════════════════════════════════

interface StyleGuide {
  /** Multiple style prefixes — one is chosen per slide for diversity */
  stylePrefixes: string[];
  preferredElements: string[];
  avoidElements: string[];
  colorGuidance: string;
}

const TOPIC_STYLE_MAP: Record<string, StyleGuide> = {
  technology: {
    stylePrefixes: [
      "Clean flat vector illustration of",
      "Isometric 3D illustration showing",
      "Abstract gradient composition representing",
      "Minimalist line art depicting",
      "Low-poly 3D render of",
      "Blueprint-style technical visualization of",
      "Glassmorphism-inspired composition showing",
    ],
    preferredElements: [
      "circuit patterns", "digital interfaces", "data streams",
      "neural network visualizations", "abstract digital landscapes", "geometric wireframes",
      "connected nodes", "flowing data particles", "modular components",
    ],
    avoidElements: ["old computers", "floppy disks", "generic office scenes", "cliche robot faces"],
    colorGuidance: "electric blues, neon cyans, deep purples with luminous accents",
  },
  finance: {
    stylePrefixes: [
      "Clean minimalist illustration of",
      "Isometric 3D visualization of",
      "Photorealistic conceptual still life showing",
      "Abstract gradient mesh representing",
      "Flat vector infographic-style illustration of",
      "Paper cut-out layered illustration of",
    ],
    preferredElements: [
      "abstract growth curves", "geometric bar compositions", "golden ratio spirals",
      "ascending arrow formations", "crystal-clear data visualizations", "balanced scales",
      "stacked coins as architecture", "financial dashboard elements",
    ],
    avoidElements: ["money piles", "piggy banks", "generic coins", "dollar signs"],
    colorGuidance: "deep navy, emerald green, gold accents on clean white",
  },
  healthcare: {
    stylePrefixes: [
      "Soft watercolor-style digital painting of",
      "Clean flat vector illustration of",
      "Isometric 3D medical illustration of",
      "Minimalist line art with color accents showing",
      "Macro photography style revealing",
      "Abstract organic composition representing",
    ],
    preferredElements: [
      "molecular structures", "DNA helixes", "abstract cellular patterns",
      "clean laboratory environments", "medical technology interfaces", "organic flowing forms",
      "heartbeat rhythms", "protective shields",
    ],
    avoidElements: ["scary medical instruments", "blood", "sick patients", "needles"],
    colorGuidance: "calming blues, fresh greens, clean whites with subtle teal accents",
  },
  education: {
    stylePrefixes: [
      "Warm isometric illustration of",
      "Hand-drawn sketch style with digital colors showing",
      "Paper cut-out layered illustration of",
      "Flat vector illustration with friendly colors depicting",
      "Soft watercolor-style painting of",
      "Retro-modern illustration of",
    ],
    preferredElements: [
      "open books with floating knowledge", "interconnected concept maps",
      "light bulb metaphors", "growing trees of knowledge", "collaborative learning spaces",
      "puzzle pieces coming together", "pathways of discovery",
    ],
    avoidElements: ["boring classrooms", "chalkboards", "generic school supplies"],
    colorGuidance: "warm oranges, friendly yellows, inviting blues with natural greens",
  },
  energy: {
    stylePrefixes: [
      "Dynamic environmental illustration of",
      "Aerial bird's-eye view illustration of",
      "Clean flat vector illustration of",
      "Photorealistic conceptual composition of",
      "Isometric 3D landscape showing",
      "Abstract gradient composition representing",
    ],
    preferredElements: [
      "wind turbines in dramatic landscapes", "solar panel arrays reflecting sunlight",
      "flowing energy streams", "sustainable city concepts", "nature-technology fusion",
      "green infrastructure", "renewable energy grids",
    ],
    avoidElements: ["pollution", "oil rigs", "dark factories", "smoke stacks"],
    colorGuidance: "vibrant greens, sky blues, solar golds with earth tones",
  },
  marketing: {
    stylePrefixes: [
      "Bold creative composition showing",
      "Flat vector illustration with dynamic colors of",
      "Isometric 3D illustration of",
      "Abstract gradient mesh representing",
      "Duotone high-contrast composition of",
      "Paper cut-out layered illustration of",
    ],
    preferredElements: [
      "abstract target/bullseye compositions", "dynamic funnel visualizations",
      "connected network graphs", "megaphone/amplification metaphors", "growth trajectories",
      "audience engagement visuals", "conversion pathway elements",
    ],
    avoidElements: ["generic handshakes", "thumbs up", "stock photo people", "like buttons"],
    colorGuidance: "bold primary colors, gradient transitions, high contrast accents",
  },
  management: {
    stylePrefixes: [
      "Professional abstract illustration of",
      "Clean isometric 3D visualization of",
      "Minimalist line art with selective color showing",
      "Flat vector illustration of",
      "Blueprint-style diagram of",
      "Low-poly 3D render of",
    ],
    preferredElements: [
      "interconnected gear systems", "organizational hierarchy visualizations",
      "strategic chess pieces", "compass/navigation metaphors", "team collaboration abstracts",
      "roadmap visualizations", "milestone markers",
    ],
    avoidElements: ["generic office photos", "boring meeting rooms", "clipart people"],
    colorGuidance: "authoritative navy, trustworthy blues, accent golds on neutral backgrounds",
  },
  default: {
    stylePrefixes: [
      "Modern professional illustration of",
      "Clean flat vector illustration of",
      "Isometric 3D illustration of",
      "Abstract gradient composition representing",
      "Minimalist line art depicting",
      "Soft watercolor-style digital painting of",
      "Paper cut-out layered illustration of",
    ],
    preferredElements: [
      "abstract geometric compositions", "gradient mesh backgrounds",
      "floating 3D shapes", "clean data visualization art", "conceptual metaphors",
      "interconnected elements", "flowing organic forms",
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

/**
 * Select a unique style prefix for each slide index, ensuring diversity.
 * Uses round-robin through topic-specific styles + global pool.
 */
function selectDiverseStylePrefix(styleGuide: StyleGuide, slideIndex: number, totalSlides: number): string {
  const allStyles = [...styleGuide.stylePrefixes];
  
  // If we have more slides than topic-specific styles, add from global pool
  if (totalSlides > allStyles.length) {
    for (const globalStyle of VISUAL_STYLE_POOL) {
      // Don't add duplicates
      if (!allStyles.some(s => s.toLowerCase().includes(globalStyle.toLowerCase().split(" ")[0]))) {
        allStyles.push(globalStyle + " of");
      }
    }
  }
  
  // Round-robin through available styles
  return allStyles[slideIndex % allStyles.length];
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
 * 
 * KEY: Each slide gets a UNIQUE visual style to prevent repetitive images.
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

  // Pre-assign a unique style to each slide for the LLM to use
  const slideStyleAssignments = slides
    .slice(0, maxImages)
    .map((s, i) => {
      const style = selectDiverseStylePrefix(styleGuide, i, slides.length);
      return `Slide ${s.slideNumber}: MUST use style "${style}"`;
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
Available visual elements: ${styleGuide.preferredElements.join(", ")}
Color palette guidance: ${styleGuide.colorGuidance}
AVOID: ${styleGuide.avoidElements.join(", ")}
</style_direction>

<CRITICAL_STYLE_DIVERSITY_RULES>
EVERY image MUST use a DIFFERENT visual style. The assigned styles below are MANDATORY:
${slideStyleAssignments}

DO NOT make all images look similar. Each image must be visually distinct:
- Different rendering techniques (flat vector vs 3D vs watercolor vs line art vs photo-realistic)
- Different compositions (close-up vs wide shot vs aerial vs abstract)
- Different color treatments (warm vs cool vs duotone vs gradient)
</CRITICAL_STYLE_DIVERSITY_RULES>

<rules>
1. Select up to ${maxImages} slides that would benefit MOST from an illustration.
2. For each selected slide, write a detailed image generation prompt in English (80-120 words).
3. Each prompt MUST be SPECIFIC to the slide's actual content — reference the real topic, data, and key message.
4. Each prompt MUST START with the ASSIGNED visual style prefix for that slide (see above).
5. Include color references that harmonize with the theme: use ${context.primaryColor} and ${context.secondaryColor} tones.
6. NEVER include text, labels, numbers, or words IN the image — the image is purely visual.
7. Each image should tell a visual story that reinforces the slide's message.
8. Reference SPECIFIC elements from the slide content (e.g., if slide mentions "AI diagnostics", show neural network analyzing medical scans, not generic tech).
9. Do NOT select slides about agendas, tables, pure data charts, or closing/thank-you slides.
</rules>`;

  const userPrompt = `Here are the eligible slides with full content details:

${slideSummaries}

${contentTypeHints ? `\nVisual metaphor suggestions:\n${contentTypeHints}\n` : ""}
Select up to ${maxImages} slides and generate detailed, content-specific image prompts. 
REMINDER: Each prompt MUST start with its assigned style prefix and produce a visually UNIQUE image.`;

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

  // Pick a random style from the pool for variety
  const randomIndex = Math.floor(Math.random() * styleGuide.stylePrefixes.length);
  const selectedStyle = styleGuide.stylePrefixes[randomIndex];

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
MANDATORY style for this image: ${selectedStyle}
Preferred elements: ${styleGuide.preferredElements.slice(0, 3).join(", ")}
Color guidance: ${styleGuide.colorGuidance}
AVOID: ${styleGuide.avoidElements.join(", ")}
</style>

<rules>
- Write a detailed English prompt (80-120 words)
- Start with the MANDATORY style prefix: "${selectedStyle}"
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

    return prompt || `${selectedStyle} representing ${slide.title}, professional business illustration with ${context.primaryColor} and ${context.secondaryColor} color accents, clean modern design`;
  } catch (error) {
    console.error("[ImagePromptEngine] Single prompt generation failed:", error);
    return `${selectedStyle} representing ${slide.title}, professional business illustration with ${context.primaryColor} and ${context.secondaryColor} color accents, clean modern design`;
  }
}
