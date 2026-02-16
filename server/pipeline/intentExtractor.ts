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

КОГДА ТЕМА ЯСНА (topicIsClear: true):
- Если тема конкретная: "AI в медицине", "космос", "экология", "история России", "маркетинг" — это ЯСНЫЕ темы
- Если пользователь указал количество слайдов или другие параметры — тема тем более ясна
- "Сделай 5 слайдов про космос" — тема ЯСНА (topicIsClear: true), не нужно уточнять
- "Презентация про маркетинг" — тема ЯСНА, можно создавать

КОГДА ТЕМА НЕ ЯСНА (topicIsClear: false):
- ТОЛЬКО если сообщение — это одно абстрактное слово без контекста: "привет", "ывавыв", "тест"
- Или если сообщение вообще не содержит темы для презентации
- НЕ задавай уточняющих вопросов для нормальных тем — пользователь хочет быстро получить результат

ПРИМЕРЫ:

Сообщение: "Сделай презентацию про AI в медицине на 5 слайдов без картинок"
→ slideCount: 5, enableImages: false, topic: "AI в медицине"

Сообщение: "Презентация для инвесторов о нашем стартапе, минималистичный стиль, 10 слайдов"
→ slideCount: 10, audience: "инвесторы", styleHints: ["минималистичный"], topic: "стартап (питч для инвесторов)"

Сообщение: "Макароны"
→ topicIsClear: true, topic: "макароны", confidence: 0.7

Сообщение: "ывавыв"
→ topicIsClear: false, clarifyingQuestion: "Не совсем понял тему. Уточните, о чём будет презентация?"

Сообщение: "Сделай 5 слайдов про космос"
→ topicIsClear: true, slideCount: 5, topic: "космос", confidence: 0.9

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

// ═══════════════════════════════════════════════════════
// REQUIREMENT CHANGE DETECTION
// ═══════════════════════════════════════════════════════

/** Result of detecting whether a user message contains requirement changes */
export interface RequirementChangeResult {
  /** Whether the message contains a requirement change (vs. content feedback) */
  isRequirementChange: boolean;
  /** Which fields changed */
  changedFields: string[];
  /** The partial requirements update (only changed fields have non-null values) */
  changes: Partial<UserRequirements>;
  /** Human-readable summary of what changed */
  changeSummary: string;
  /** Confidence that this is a requirement change (0-1) */
  confidence: number;
}

const CHANGE_DETECTION_SYSTEM = `Ты — анализатор сообщений пользователя в контексте создания презентации.
Презентация уже в процессе создания. Пользователь может:
1. Менять ПАРАМЕТРЫ презентации (количество слайдов, картинки, стиль, аудитория и т.д.)
2. Давать ОБРАТНУЮ СВЯЗЬ по контенту или дизайну конкретного слайда

Твоя задача: определить, является ли сообщение ИЗМЕНЕНИЕМ ПАРАМЕТРОВ или ОБРАТНОЙ СВЯЗЬЮ по контенту.

ПРИМЕРЫ ИЗМЕНЕНИЯ ПАРАМЕТРОВ:
- "Добавь ещё 2 слайда" → isRequirementChange: true, slideCount: +2
- "Всё-таки добавь картинки" → isRequirementChange: true, enableImages: true
- "Без картинок" → isRequirementChange: true, enableImages: false
- "Сделай 7 слайдов вместо 5" → isRequirementChange: true, slideCount: 7
- "Стиль поменяй на минималистичный" → isRequirementChange: true, styleHints: ["минималистичный"]
- "Это для студентов, не для руководства" → isRequirementChange: true, audience: "студенты"
- "Картинки я сам добавлю" → isRequirementChange: true, userWillAddImages: true, enableImages: false
- "Сделай на английском" → isRequirementChange: true, language: "en"

ПРИМЕРЫ ОБРАТНОЙ СВЯЗИ (НЕ изменение параметров):
- "Поменяй заголовок на 'Итоги года'" → isRequirementChange: false
- "Добавь больше данных на этот слайд" → isRequirementChange: false
- "Сделай текст короче" → isRequirementChange: false
- "Поменяй макет" → isRequirementChange: false
- "Убери этот пункт" → isRequirementChange: false
- "Готово" → isRequirementChange: false

Верни ТОЛЬКО валидный JSON.`;

const CHANGE_DETECTION_USER = (message: string, currentPhase: string, currentReqs: UserRequirements) => {
  const currentSummary = formatRequirementsSummary(currentReqs);
  return `Текущая фаза: ${currentPhase}
Текущие параметры:${currentSummary || " (по умолчанию)"}

Сообщение пользователя: "${message}"

Определи, является ли это изменением параметров презентации.
Верни JSON:
{
  "isRequirementChange": true/false,
  "changedFields": ["slideCount", "enableImages", ...],
  "changes": {
    "slideCount": число или null (если не менялось),
    "enableImages": true/false или null,
    "userWillAddImages": true/false или null,
    "styleHints": ["стиль"] или null,
    "audience": "аудитория" или null,
    "purpose": "цель" или null,
    "language": "ru"/"en" или null,
    "customInstructions": ["инструкция"] или null
  },
  "changeSummary": "краткое описание изменений на русском",
  "confidence": 0.0-1.0
}`;
};

/**
 * Detect if a user message contains a requirement change.
 * Uses LLM to distinguish between parameter changes and content feedback.
 * Falls back to regex-based detection if LLM fails.
 */
export async function detectRequirementChange(
  userMessage: string,
  currentPhase: string,
  currentRequirements: UserRequirements,
): Promise<RequirementChangeResult> {
  const noChange: RequirementChangeResult = {
    isRequirementChange: false,
    changedFields: [],
    changes: {},
    changeSummary: "",
    confidence: 1.0,
  };

  // Quick regex pre-check: skip LLM if message is clearly content feedback
  const lowerMsg = userMessage.toLowerCase();
  const isLikelyContentFeedback =
    /^(готово|утверд|ок|хорошо|отлично|да|нет|поменяй заголовок|убери|добавь текст|сделай текст)/i.test(lowerMsg) &&
    !/слайд.*\d|\d.*слайд|картин|изображ|фото|стиль|аудитор|язык|англ/i.test(lowerMsg);
  if (isLikelyContentFeedback) return noChange;

  // Quick regex pre-check: detect obvious requirement changes without LLM
  const quickResult = regexDetectChange(userMessage, currentRequirements);
  if (quickResult.confidence >= 0.8) return quickResult;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: CHANGE_DETECTION_SYSTEM },
        { role: "user", content: CHANGE_DETECTION_USER(userMessage, currentPhase, currentRequirements) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "requirement_change_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isRequirementChange: { type: "boolean" },
              changedFields: { type: "array", items: { type: "string" } },
              changes: {
                type: "object",
                properties: {
                  slideCount: { type: ["integer", "null"] },
                  enableImages: { type: ["boolean", "null"] },
                  userWillAddImages: { type: ["boolean", "null"] },
                  styleHints: { type: ["array", "null"], items: { type: "string" } },
                  audience: { type: ["string", "null"] },
                  purpose: { type: ["string", "null"] },
                  language: { type: ["string", "null"] },
                  customInstructions: { type: ["array", "null"], items: { type: "string" } },
                },
                required: ["slideCount", "enableImages", "userWillAddImages", "styleHints", "audience", "purpose", "language", "customInstructions"],
                additionalProperties: false,
              },
              changeSummary: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["isRequirementChange", "changedFields", "changes", "changeSummary", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return noChange;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(content);

    return {
      isRequirementChange: !!parsed.isRequirementChange,
      changedFields: Array.isArray(parsed.changedFields) ? parsed.changedFields : [],
      changes: parsed.changes || {},
      changeSummary: typeof parsed.changeSummary === "string" ? parsed.changeSummary : "",
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    };
  } catch (error) {
    console.error("[IntentExtractor] Change detection LLM failed, using regex fallback:", error);
    return quickResult.isRequirementChange ? quickResult : noChange;
  }
}

/**
 * Regex-based quick detection of requirement changes.
 */
function regexDetectChange(message: string, current: UserRequirements): RequirementChangeResult {
  const result: RequirementChangeResult = {
    isRequirementChange: false,
    changedFields: [],
    changes: {},
    changeSummary: "",
    confidence: 0.3,
  };

  const lowerMsg = message.toLowerCase();

  // Slide count changes
  const addSlidesMatch = lowerMsg.match(/(?:добав|ещё|еще)\s*(\d+)\s*слайд/i);
  const setSlidesMatch = lowerMsg.match(/(?:сделай|поставь|установи|хочу|нужно)\s*(\d+)\s*слайд/i);
  const replaceSlidesMatch = lowerMsg.match(/(\d+)\s*слайд.*(?:вместо|а\s+не)/i);
  if (addSlidesMatch) {
    const addCount = parseInt(addSlidesMatch[1], 10);
    const newCount = (current.slideCount || 10) + addCount;
    result.isRequirementChange = true;
    result.changedFields.push("slideCount");
    result.changes.slideCount = newCount;
    result.changeSummary = `Добавлено ${addCount} слайдов (всего: ${newCount})`;
    result.confidence = 0.9;
  } else if (setSlidesMatch) {
    const newCount = parseInt(setSlidesMatch[1], 10);
    result.isRequirementChange = true;
    result.changedFields.push("slideCount");
    result.changes.slideCount = newCount;
    result.changeSummary = `Количество слайдов: ${newCount}`;
    result.confidence = 0.9;
  } else if (replaceSlidesMatch) {
    const newCount = parseInt(replaceSlidesMatch[1], 10);
    result.isRequirementChange = true;
    result.changedFields.push("slideCount");
    result.changes.slideCount = newCount;
    result.changeSummary = `Количество слайдов изменено на ${newCount}`;
    result.confidence = 0.9;
  }

  // Image changes
  if (/(?:всё-?таки|теперь|давай)\s*(?:добав|включ|с)\s*(?:картинк|изображ|фото|иллюстрац)/i.test(lowerMsg) ||
      /(?:включи|добавь)\s*(?:картинк|изображ|фото)/i.test(lowerMsg)) {
    result.isRequirementChange = true;
    result.changedFields.push("enableImages");
    result.changes.enableImages = true;
    result.changeSummary += (result.changeSummary ? "; " : "") + "Включены картинки";
    result.confidence = Math.max(result.confidence, 0.85);
  } else if (/(?:без|убери|отключи|не\s*надо|не\s*нужн)\s*(?:картин|изображ|фото|иллюстрац)/i.test(lowerMsg)) {
    result.isRequirementChange = true;
    result.changedFields.push("enableImages");
    result.changes.enableImages = false;
    result.changeSummary += (result.changeSummary ? "; " : "") + "Картинки отключены";
    result.confidence = Math.max(result.confidence, 0.85);
  }

  // User will add images
  if (/(?:сам|сама|сами)\s*(?:добавл|загруж|вставл).*(?:картин|фото|изображ)/i.test(lowerMsg) ||
      /(?:картин|фото|изображ).*(?:сам|сама|сами)\s*(?:добавл|загруж|вставл)/i.test(lowerMsg)) {
    result.isRequirementChange = true;
    result.changedFields.push("userWillAddImages", "enableImages");
    result.changes.userWillAddImages = true;
    result.changes.enableImages = false;
    result.changeSummary += (result.changeSummary ? "; " : "") + "Пользователь добавит картинки сам";
    result.confidence = Math.max(result.confidence, 0.85);
  }

  // Style changes
  const stylePatterns: [RegExp, string][] = [
    [/минимал/i, "минималистичный"],
    [/ярк/i, "яркий"],
    [/строг/i, "строгий"],
    [/корпоратив/i, "корпоративный"],
    [/креатив/i, "креативный"],
    [/тёмн|темн/i, "тёмный"],
    [/светл/i, "светлый"],
  ];
  if (/(?:стиль|оформлен|дизайн).*(?:поменяй|смени|измени|сделай)/i.test(lowerMsg) ||
      /(?:поменяй|смени|измени|сделай).*(?:стиль|оформлен|дизайн)/i.test(lowerMsg)) {
    const newStyles: string[] = [];
    for (const [pattern, name] of stylePatterns) {
      if (pattern.test(lowerMsg)) newStyles.push(name);
    }
    if (newStyles.length > 0) {
      result.isRequirementChange = true;
      result.changedFields.push("styleHints");
      result.changes.styleHints = newStyles;
      result.changeSummary += (result.changeSummary ? "; " : "") + `Стиль: ${newStyles.join(", ")}`;
      result.confidence = Math.max(result.confidence, 0.8);
    }
  }

  // Language changes
  if (/(?:на\s+)?англ(?:ийск)?/i.test(lowerMsg) && /(?:сделай|переведи|переключ|поменяй|язык)/i.test(lowerMsg)) {
    result.isRequirementChange = true;
    result.changedFields.push("language");
    result.changes.language = "en";
    result.changeSummary += (result.changeSummary ? "; " : "") + "Язык: английский";
    result.confidence = Math.max(result.confidence, 0.85);
  } else if (/(?:на\s+)?русск/i.test(lowerMsg) && /(?:сделай|переведи|переключ|поменяй|язык)/i.test(lowerMsg)) {
    result.isRequirementChange = true;
    result.changedFields.push("language");
    result.changes.language = "ru";
    result.changeSummary += (result.changeSummary ? "; " : "") + "Язык: русский";
    result.confidence = Math.max(result.confidence, 0.85);
  }

  return result;
}

/**
 * Merge requirement changes into existing requirements.
 * Only overwrites fields that are explicitly changed (non-null in changes).
 */
export function mergeRequirements(
  current: UserRequirements,
  changes: Partial<UserRequirements>,
): UserRequirements {
  const merged = { ...current };

  if (changes.slideCount !== undefined && changes.slideCount !== null) {
    merged.slideCount = changes.slideCount;
  }
  if (changes.enableImages !== undefined && changes.enableImages !== null) {
    merged.enableImages = changes.enableImages;
  }
  if (changes.userWillAddImages !== undefined && changes.userWillAddImages !== null) {
    merged.userWillAddImages = changes.userWillAddImages;
  }
  if (changes.styleHints && Array.isArray(changes.styleHints) && changes.styleHints.length > 0) {
    // Replace style hints entirely (user is changing the style)
    merged.styleHints = changes.styleHints;
  }
  if (changes.structureHints && Array.isArray(changes.structureHints) && changes.structureHints.length > 0) {
    // Append structure hints
    merged.structureHints = [...merged.structureHints, ...changes.structureHints];
  }
  if (changes.audience !== undefined && changes.audience !== null) {
    merged.audience = changes.audience;
  }
  if (changes.purpose !== undefined && changes.purpose !== null) {
    merged.purpose = changes.purpose;
  }
  if (changes.language !== undefined && changes.language !== null) {
    merged.language = changes.language;
  }
  if (changes.customInstructions && Array.isArray(changes.customInstructions) && changes.customInstructions.length > 0) {
    // Append custom instructions
    merged.customInstructions = [...merged.customInstructions, ...changes.customInstructions];
  }

  return merged;
}

/**
 * Format a change confirmation message for the user.
 */
export function formatChangeConfirmation(changeResult: RequirementChangeResult, updatedReqs: UserRequirements): string {
  let msg = `✅ Понял, обновил параметры`;
  if (changeResult.changeSummary) {
    msg += `: ${changeResult.changeSummary}`;
  }
  msg += ".";

  // Show updated summary
  const summary = formatRequirementsSummary(updatedReqs);
  if (summary) {
    msg += `\n\nАктуальные параметры:${summary}`;
  }

  return msg;
}

// ═══════════════════════════════════════════════════════
// PIPELINE CONTEXT
// ═══════════════════════════════════════════════════════

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
