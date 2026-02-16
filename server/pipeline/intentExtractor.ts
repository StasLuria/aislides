/**
 * Intent Extractor — LLM-based extraction of user requirements from natural language.
 * Parses user messages into structured presentation requirements.
 */
import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface UserRequirements {
  /** The core topic/subject for the presentation */
  topic: string;
  /** Desired number of slides (null = let AI decide) */
  slideCount: number | null;
  /** Whether to include AI-generated images (null = default behavior) */
  enableImages: boolean | null;
  /** User wants to add images manually later */
  userWillAddImages: boolean;
  /** Style/design preferences (e.g., "минималистичный", "яркий", "строгий") */
  styleHints: string[];
  /** Specific structure requests (e.g., "начни с проблемы", "добавь SWOT") */
  structureHints: string[];
  /** Target audience (e.g., "инвесторы", "студенты", "руководство") */
  audience: string | null;
  /** Presentation purpose (e.g., "продать идею", "обучить", "отчитаться") */
  purpose: string | null;
  /** Language preference (null = auto-detect from topic) */
  language: string | null;
  /** Any other specific instructions the user gave */
  customInstructions: string[];
  /** Whether the topic is clear enough to proceed */
  topicIsClear: boolean;
  /** If topic is unclear, suggested clarifying question */
  clarifyingQuestion: string | null;
  /** Confidence level of extraction (0-1) */
  confidence: number;
}

/** Default requirements when nothing specific is requested */
export function defaultRequirements(topic: string): UserRequirements {
  return {
    topic,
    slideCount: null,
    enableImages: null,
    userWillAddImages: false,
    styleHints: [],
    structureHints: [],
    audience: null,
    purpose: null,
    language: null,
    customInstructions: [],
    topicIsClear: true,
    clarifyingQuestion: null,
    confidence: 0.5,
  };
}

// ═══════════════════════════════════════════════════════
// INTENT EXTRACTION PROMPT
// ═══════════════════════════════════════════════════════

const INTENT_EXTRACTION_SYSTEM = `Ты — анализатор намерений пользователя для системы создания презентаций.

Твоя задача: извлечь из сообщения пользователя ВСЕ требования к презентации и вернуть их в формате JSON.

ВАЖНО:
- Извлекай ТОЛЬКО то, что пользователь ЯВНО указал или что ОДНОЗНАЧНО следует из контекста
- Если пользователь НЕ упомянул что-то — ставь null (не додумывай)
- Будь внимателен к неявным указаниям: "без картинок" = enableImages: false, "я сам добавлю фото" = userWillAddImages: true
- Если тема слишком размытая (одно слово без контекста, например просто "бизнес"), отметь topicIsClear: false

ПРИМЕРЫ:

Сообщение: "Сделай презентацию про AI в медицине на 5 слайдов без картинок"
→ slideCount: 5, enableImages: false, topic: "AI в медицине"

Сообщение: "Презентация для инвесторов о нашем стартапе, минималистичный стиль, 10 слайдов"
→ slideCount: 10, audience: "инвесторы", styleHints: ["минималистичный"], topic: "стартап (питч для инвесторов)"

Сообщение: "Макароны"
→ topicIsClear: false, clarifyingQuestion: "Уточните, пожалуйста: какой аспект макарон вас интересует? Например: рынок макаронных изделий, рецепты, история, производство?"

Сообщение: "Сделай презу про рынок макарон из 3 слайдов, картинки я сам добавлю"
→ slideCount: 3, userWillAddImages: true, enableImages: false, topic: "рынок макаронных изделий"

Сообщение: "Отчёт о продажах за Q4, строгий корпоративный стиль, начни с ключевых метрик"
→ styleHints: ["строгий", "корпоративный"], structureHints: ["начать с ключевых метрик"], purpose: "отчёт", topic: "отчёт о продажах за Q4"

Сообщение: "Презентация про экологию для школьников, яркая и с картинками"
→ audience: "школьники", styleHints: ["яркая"], enableImages: true, topic: "экология"

Верни ТОЛЬКО валидный JSON без markdown-обёрток.`;

const INTENT_EXTRACTION_USER = (message: string, hasFiles: boolean) => `Сообщение пользователя: "${message}"
${hasFiles ? "\nПользователь также прикрепил файлы к сообщению." : ""}

Извлеки требования и верни JSON:
{
  "topic": "очищенная тема презентации",
  "slideCount": число или null,
  "enableImages": true/false или null,
  "userWillAddImages": true/false,
  "styleHints": ["стиль1", "стиль2"],
  "structureHints": ["указание1"],
  "audience": "аудитория" или null,
  "purpose": "цель" или null,
  "language": "ru"/"en" или null,
  "customInstructions": ["инструкция1"],
  "topicIsClear": true/false,
  "clarifyingQuestion": "вопрос" или null,
  "confidence": 0.0-1.0
}`;

// ═══════════════════════════════════════════════════════
// EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Extract user requirements from a natural language message using LLM.
 * Falls back to regex-based extraction if LLM fails.
 */
export async function extractUserRequirements(
  userMessage: string,
  hasFiles: boolean = false,
): Promise<UserRequirements> {
  const defaults = defaultRequirements(userMessage);

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: INTENT_EXTRACTION_SYSTEM },
        { role: "user", content: INTENT_EXTRACTION_USER(userMessage, hasFiles) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "user_requirements",
          strict: true,
          schema: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Clean presentation topic" },
              slideCount: { type: ["integer", "null"], description: "Number of slides or null" },
              enableImages: { type: ["boolean", "null"], description: "Whether to generate images" },
              userWillAddImages: { type: "boolean", description: "User will add images manually" },
              styleHints: { type: "array", items: { type: "string" }, description: "Style preferences" },
              structureHints: { type: "array", items: { type: "string" }, description: "Structure preferences" },
              audience: { type: ["string", "null"], description: "Target audience" },
              purpose: { type: ["string", "null"], description: "Presentation purpose" },
              language: { type: ["string", "null"], description: "Language preference" },
              customInstructions: { type: "array", items: { type: "string" }, description: "Other instructions" },
              topicIsClear: { type: "boolean", description: "Whether topic is clear enough" },
              clarifyingQuestion: { type: ["string", "null"], description: "Question to ask if unclear" },
              confidence: { type: "number", description: "Extraction confidence 0-1" },
            },
            required: [
              "topic", "slideCount", "enableImages", "userWillAddImages",
              "styleHints", "structureHints", "audience", "purpose",
              "language", "customInstructions", "topicIsClear",
              "clarifyingQuestion", "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return defaults;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content) as UserRequirements;

    // Validate and sanitize
    return {
      topic: parsed.topic || userMessage,
      slideCount: typeof parsed.slideCount === "number" && parsed.slideCount >= 1 && parsed.slideCount <= 50
        ? parsed.slideCount : null,
      enableImages: typeof parsed.enableImages === "boolean" ? parsed.enableImages : null,
      userWillAddImages: !!parsed.userWillAddImages,
      styleHints: Array.isArray(parsed.styleHints) ? parsed.styleHints.slice(0, 5) : [],
      structureHints: Array.isArray(parsed.structureHints) ? parsed.structureHints.slice(0, 5) : [],
      audience: typeof parsed.audience === "string" ? parsed.audience : null,
      purpose: typeof parsed.purpose === "string" ? parsed.purpose : null,
      language: typeof parsed.language === "string" ? parsed.language : null,
      customInstructions: Array.isArray(parsed.customInstructions) ? parsed.customInstructions.slice(0, 5) : [],
      topicIsClear: typeof parsed.topicIsClear === "boolean" ? parsed.topicIsClear : true,
      clarifyingQuestion: typeof parsed.clarifyingQuestion === "string" ? parsed.clarifyingQuestion : null,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    };
  } catch (error) {
    console.error("[IntentExtractor] LLM extraction failed, using regex fallback:", error);
    return regexFallbackExtraction(userMessage);
  }
}

/**
 * Regex-based fallback extraction when LLM is unavailable.
 */
function regexFallbackExtraction(message: string): UserRequirements {
  const req = defaultRequirements(message);

  // Slide count
  const slideMatch = message.match(/(?:из|на|ровно|exactly)?\s*(\d+)\s*(?:слайд|slide|стр)/i);
  if (slideMatch) {
    req.slideCount = parseInt(slideMatch[1], 10);
  }

  // Images
  if (/без\s+(?:картин|изображ|фото|иллюстрац)/i.test(message)) {
    req.enableImages = false;
  }
  if (/(?:сам|сама|сами)\s+(?:добавл|загруж|вставл)/i.test(message) && /(?:картин|фото|изображ)/i.test(message)) {
    req.userWillAddImages = true;
    req.enableImages = false;
  }
  if (/(?:с\s+картин|с\s+фото|с\s+иллюстрац|добавь\s+картин)/i.test(message)) {
    req.enableImages = true;
  }

  // Style hints
  if (/минимал/i.test(message)) req.styleHints.push("минималистичный");
  if (/ярк/i.test(message)) req.styleHints.push("яркий");
  if (/строг/i.test(message)) req.styleHints.push("строгий");
  if (/корпоратив/i.test(message)) req.styleHints.push("корпоративный");
  if (/креатив/i.test(message)) req.styleHints.push("креативный");

  // Audience
  const audienceMatch = message.match(/(?:для|аудитория[:\s]+)\s*(инвестор\w*|студент\w*|руководств\w*|школьник\w*|клиент\w*|коллег\w*)/i);
  if (audienceMatch) req.audience = audienceMatch[1];

  // Language
  if (/(?:на\s+)?англ/i.test(message)) req.language = "en";
  if (/(?:на\s+)?русск/i.test(message)) req.language = "ru";

  req.confidence = 0.3;
  return req;
}

/**
 * Format extracted requirements into a human-readable summary for the AI response.
 */
export function formatRequirementsSummary(req: UserRequirements): string {
  const parts: string[] = [];

  if (req.slideCount) parts.push(`📊 ${req.slideCount} слайдов`);
  if (req.enableImages === false) parts.push("🚫 Без AI-картинок");
  if (req.enableImages === true) parts.push("🖼 С иллюстрациями");
  if (req.userWillAddImages) parts.push("📎 Вы добавите изображения сами");
  if (req.audience) parts.push(`👥 Для: ${req.audience}`);
  if (req.purpose) parts.push(`🎯 Цель: ${req.purpose}`);
  if (req.styleHints.length > 0) parts.push(`🎨 Стиль: ${req.styleHints.join(", ")}`);
  if (req.structureHints.length > 0) parts.push(`📋 Структура: ${req.structureHints.join(", ")}`);
  if (req.language === "en") parts.push("🌐 На английском");
  if (req.customInstructions.length > 0) {
    parts.push(`💡 ${req.customInstructions.join("; ")}`);
  }

  if (parts.length === 0) return "";
  return "\n\nВаши пожелания учтены:\n" + parts.join("\n");
}

/**
 * Build a context string from requirements for the pipeline prompts.
 * This is injected into the outline/writer/etc. prompts.
 */
export function buildPipelineContext(req: UserRequirements): string {
  const lines: string[] = [];

  if (req.audience) lines.push(`Целевая аудитория: ${req.audience}`);
  if (req.purpose) lines.push(`Цель презентации: ${req.purpose}`);
  if (req.styleHints.length > 0) lines.push(`Стиль: ${req.styleHints.join(", ")}`);
  if (req.structureHints.length > 0) lines.push(`Требования к структуре: ${req.structureHints.join("; ")}`);
  if (req.customInstructions.length > 0) lines.push(`Дополнительные указания: ${req.customInstructions.join("; ")}`);

  if (lines.length === 0) return "";
  return "\n\nТРЕБОВАНИЯ ПОЛЬЗОВАТЕЛЯ:\n" + lines.join("\n");
}
