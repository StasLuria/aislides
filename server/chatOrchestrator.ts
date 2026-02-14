/**
 * Chat Orchestrator — LLM-driven state machine for chat-based presentation creation.
 * Supports SSE streaming for real-time token delivery.
 *
 * Phases:
 *   idle → topic_received → mode_selection → generating/step_structure → ... → completed
 *
 * Two modes:
 *   1. Quick (batch): runs full pipeline, streams progress updates
 *   2. Step-by-step: structure → content per slide → design → final assembly
 */
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import type { ChatMessage, ChatAction } from "../drizzle/schema";
import { getChatSession, updateChatSession, appendMessage, getSessionFiles } from "./chatDb";
import {
  generatePresentation,
  runPlanner,
  runOutline,
  runWriterSingle,
  runTheme,
  runLayout,
  runHtmlComposer,
  runHtmlComposerWithQA,
  buildFallbackData,
  type PipelineProgress,
  type GenerationConfig,
  type OutlineResult,
  type OutlineSlide,
  type SlideContent,
  type PlannerResult,
  type ThemeResult,
  type LayoutDecision,
} from "./pipeline/generator";
import {
  createPresentation,
  updatePresentationProgress,
} from "./presentationDb";
import { renderPresentation, renderSlide, BASE_CSS, getLayoutTemplate } from "./pipeline/templateEngine";
import { getThemePreset, type ThemePreset } from "./pipeline/themes";
import { autoSelectTheme } from "./pipeline/themeSelector";
import { classifyPresentation } from "./pipeline/presentationTypeClassifier";
import { analyzeContentDensity, generateAdaptiveStyles } from "./pipeline/adaptiveSizing";
import { pickLayoutForPreview } from "./interactiveRoutes";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// ═══════════════════════════════════════════════════════
// OUTLINE PARSING FROM FILES
// ═══════════════════════════════════════════════════════

/**
 * Parse a pre-built presentation outline from uploaded file content.
 * Recognizes the [PRESENTATION_OUTLINE] marker from Vision LLM extraction.
 * Returns null if no outline structure is detected.
 */
function parseOutlineFromFiles(
  readyFiles: Array<{ fileId: string; filename: string; mimeType: string; extractedText: string | null }>,
): OutlineResult | null {
  for (const f of readyFiles) {
    const text = f.extractedText || "";
    if (!text.includes("[PRESENTATION_OUTLINE]")) continue;

    try {
      // Parse the structured outline format
      const slides: OutlineResult["slides"] = [];
      const slideBlocks = text.split(/---/).filter(Boolean);

      for (const block of slideBlocks) {
        const slideMatch = block.match(/SLIDE\s+(\d+):\s*(.+)/i);
        const purposeMatch = block.match(/PURPOSE:\s*(.+)/i);

        if (slideMatch) {
          const slideNum = parseInt(slideMatch[1]);
          const title = slideMatch[2].trim();
          const purpose = purposeMatch ? purposeMatch[1].trim() : title;

          slides.push({
            slide_number: slideNum,
            title,
            purpose,
            key_points: [purpose],
            speaker_notes_hint: `Слайд ${slideNum}: ${title}`,
            content_shape: slideNum === 1 ? undefined : (slideNum === slides.length + 1 ? undefined : "bullet_points"),
            slide_category: slideNum === 1 ? "TITLE" : "CONTENT",
          });
        }
      }

      if (slides.length < 2) continue; // Need at least 2 slides for a valid outline

      // Extract presentation title from first slide
      const presentationTitle = slides[0]?.title || "Презентация";

      // Assign proper categories
      if (slides.length > 0) {
        slides[0].slide_category = "TITLE";
        slides[0].content_shape = undefined; // TitleSlide
      }
      if (slides.length > 1) {
        slides[slides.length - 1].slide_category = "FINAL";
        slides[slides.length - 1].content_shape = undefined; // FinalSlide
      }

      console.log(`[parseOutlineFromFiles] Parsed ${slides.length} slides from file: ${f.filename}`);

      return {
        presentation_title: presentationTitle,
        target_audience: "Широкая аудитория",
        narrative_arc: "FRAMEWORK",
        slides,
      };
    } catch (err) {
      console.error(`[parseOutlineFromFiles] Failed to parse outline from ${f.filename}:`, err);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// SSE EVENT TYPES
// ═══════════════════════════════════════════════════════

export interface SSEEvent {
  type: "token" | "actions" | "slide_preview" | "progress" | "done" | "error" | "presentation_link" | "title_update" | "slide_progress";
  data: any;
}

export type SSEWriter = (event: SSEEvent) => void;

// ═══════════════════════════════════════════════════════
// STREAMING LLM CALL
// ═══════════════════════════════════════════════════════

const resolveForgeApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

/**
 * Stream an LLM response token-by-token via SSE.
 * Returns the full accumulated text.
 */
async function streamLLMResponse(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  writer: SSEWriter,
): Promise<string> {
  const apiUrl = resolveForgeApiUrl();
  const apiKey = ENV.forgeApiKey || ENV.openaiApiKey;
  if (!apiKey) throw new Error("No LLM API key configured");

  const model = ENV.forgeApiKey ? "gemini-2.5-flash" : "gpt-4o";

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    max_tokens: 2048,
    ...(model !== "gpt-4o" ? { thinking: { budget_tokens: 128 } } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM streaming failed: ${response.status} — ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader");

    const decoder = new TextDecoder();
    let accumulated = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            writer({ type: "token", data: delta });
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return accumulated;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Non-streaming LLM call for structured responses.
 */
async function llmStructuredChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as any, content: m.content })),
    ],
  });
  const content = result.choices?.[0]?.message?.content;
  if (!content) return "";
  return typeof content === "string" ? content : JSON.stringify(content);
}

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════

const CHAT_SYSTEM_PROMPT = `Ты — AI-ассистент для создания презентаций. Твоя задача — помочь пользователю создать профессиональную презентацию.
Пользователь может прикрепить файлы (PDF, DOCX, TXT, PPTX, изображения) к сообщению. Если прикреплены файлы, используй их содержимое как основу для презентации.

ПРАВИЛА:
1. Всегда отвечай на русском языке
2. Будь дружелюбным и профессиональным
3. Давай краткие, но информативные ответы (2-4 предложения)
4. Не используй markdown-заголовки (# ## ###) — пиши обычным текстом
5. Используй эмодзи умеренно для дружелюбности

КОНТЕКСТ ДИАЛОГА:
- Когда пользователь впервые пишет тему, подтверди её и предложи выбрать режим
- Быстрый режим: полная генерация за ~60 секунд без остановок
- Пошаговый режим: утверждение структуры, контента каждого слайда и дизайна

Если пользователь пишет что-то не связанное с презентациями, вежливо направь его обратно к теме.`;

const MODE_SELECTION_PROMPT = `Пользователь указал тему для презентации. Предложи выбрать режим создания:

1. ⚡ Быстрый режим — полная генерация за ~60 секунд. AI создаст всё автоматически.
2. 🎯 Пошаговый режим — ты утверждаешь структуру, контент и дизайн каждого слайда.

Спроси, какой режим предпочитает пользователь. Будь кратким (2-3 предложения).`;

// ═══════════════════════════════════════════════════════
// TITLE GENERATION
// ═══════════════════════════════════════════════════════

/**
 * Generate a short, meaningful title for a chat session based on the user's topic.
 * Uses LLM to create a concise title (3-6 words) and sends it via SSE.
 */
async function generateSessionTitle(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
): Promise<void> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Ты генерируешь короткие заголовки для чат-сессий по созданию презентаций.
ПРАВИЛА:
- Заголовок должен быть на том же языке, что и тема пользователя
- Максимум 5-7 слов
- Без кавычек, без точки в конце
- Отражай суть темы презентации
- Не добавляй слова "презентация" — это и так понятно из контекста

Примеры:
- "Качество воды в мире" → "Качество воды в мире"
- "Расскажи про искусственный интеллект в медицине" → "AI в медицине"
- "Стратегия развития компании на 2026" → "Стратегия развития 2026"
- "How AI transforms education" → "AI in Education"`,
        },
        {
          role: "user",
          content: `Сгенерируй короткий заголовок для чат-сессии. Тема пользователя: "${userMessage}"`,
        },
      ],
    });

    const rawContent = result.choices?.[0]?.message?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : "";
    const title = contentStr.trim().replace(/^["']|["']$/g, "");
    if (title && title.length > 0 && title.length < 100) {
      // Save title in metadata, NOT in topic (topic keeps the original user prompt for the pipeline)
      const currentSession = await getChatSession(sessionId);
      const currentMeta = (currentSession?.metadata as Record<string, any>) || {};
      await updateChatSession(sessionId, {
        metadata: { ...currentMeta, displayTitle: title },
      });
      writer({ type: "title_update", data: title });
      console.log(`[ChatOrchestrator] Generated title for ${sessionId}: "${title}" (topic preserved as original prompt)`);
    }
  } catch (err: any) {
    console.error("[ChatOrchestrator] Title generation error:", err.message);
    // Non-critical — keep the original topic as fallback
  }
}

// ═══════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════

/**
 * Process a user message and stream the AI response via SSE.
 */
export async function processMessage(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) {
    writer({ type: "error", data: "Сессия не найдена" });
    writer({ type: "done", data: null });
    return;
  }

  // Check for uploaded files to attach to the message
  const sessionFiles = await getSessionFiles(sessionId);
  const pendingFiles = sessionFiles.filter(f => f.status === "ready");
  const fileRefs = pendingFiles.length > 0 ? pendingFiles.map(f => ({
    fileId: f.fileId,
    filename: f.filename,
    mimeType: f.mimeType,
    fileSize: f.fileSize,
    s3Url: f.s3Url,
  })) : undefined;

  // Save user message
  const userMsg: ChatMessage = {
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
    ...(fileRefs ? { files: fileRefs } : {}),
  };
  await appendMessage(sessionId, userMsg);

  const phase = session.phase || "idle";
  const messages = [...(session.messages || []), userMsg];

  try {
    switch (phase) {
      case "idle":
        await handleTopicInput(sessionId, userMessage, messages, writer);
        break;
      case "mode_selection":
        await handleModeSelection(sessionId, userMessage, messages, writer);
        break;
      case "generating":
        // Pipeline is running, inform user
        writer({ type: "token", data: "Генерация уже идёт, пожалуйста подождите... ⏳" });
        writer({ type: "done", data: null });
        break;
      case "completed":
        await handlePostCompletion(sessionId, userMessage, messages, writer);
        break;
      case "step_slide_content":
        await handleSlideContentFeedback(sessionId, userMessage, writer);
        break;
      case "step_slide_design":
        await handleSlideDesignFeedback(sessionId, userMessage, writer);
        break;
      default:
        await handleGenericMessage(sessionId, messages, writer);
        break;
    }
  } catch (err: any) {
    console.error(`[ChatOrchestrator] Error in session ${sessionId}:`, err);
    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `Произошла ошибка: ${err.message}. Попробуйте ещё раз.`,
      timestamp: Date.now(),
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "token", data: errorMsg.content });
    writer({ type: "done", data: null });
  }
}

/**
 * Handle initial topic input — recognize topic and offer mode selection.
 */
async function handleTopicInput(
  sessionId: string,
  userMessage: string,
  messages: ChatMessage[],
  writer: SSEWriter,
): Promise<void> {
  // Check for attached files
  const sessionFiles = await getSessionFiles(sessionId);
  const readyFiles = sessionFiles.filter(f => f.status === "ready" && f.extractedText);
  
  let fileContext = "";
  if (readyFiles.length > 0) {
    fileContext = `\n\nПОЛЬЗОВАТЕЛЬ ПРИКРЕПИЛ ${readyFiles.length} ФАЙЛ(ОВ):\n`;
    for (const f of readyFiles) {
      fileContext += `\n─── Файл: ${f.filename} (${f.mimeType}) ───\n${(f.extractedText || "").slice(0, 8000)}\n`;
    }
    fileContext += `\nИспользуй содержимое этих файлов как основу для презентации. Упомяни, что файлы получены и будут использованы.`;
  }

  // Stream AI response acknowledging the topic
  const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));

  const systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${MODE_SELECTION_PROMPT}\n\nТема пользователя: "${userMessage}"${fileContext}`;

  const fullResponse = await streamLLMResponse(
    systemPrompt,
    chatMessages.slice(-6), // Keep context manageable
    writer,
  );

  // Save assistant message with action buttons
  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: fullResponse,
    timestamp: Date.now(),
    actions: [
      { id: "mode_quick", label: "⚡ Быстрый режим", variant: "default" },
      { id: "mode_step", label: "🎯 Пошаговый режим", variant: "outline" },
    ],
  };
  await appendMessage(sessionId, assistantMsg);

  // Send action buttons
  writer({
    type: "actions",
    data: assistantMsg.actions,
  });

  // Update phase
  await updateChatSession(sessionId, {
    topic: userMessage,
    phase: "mode_selection",
  });

  // Auto-generate a short title from the user's topic
  // Must complete before done event so the client receives the title_update
  await generateSessionTitle(sessionId, userMessage, writer);

  writer({ type: "done", data: null });
}

/**
 * Handle mode selection — start generation in chosen mode.
 */
async function handleModeSelection(
  sessionId: string,
  userMessage: string,
  messages: ChatMessage[],
  writer: SSEWriter,
): Promise<void> {
  const lowerMsg = userMessage.toLowerCase();
  const isQuick =
    lowerMsg.includes("быстр") ||
    lowerMsg.includes("mode_quick") ||
    lowerMsg.includes("авто") ||
    lowerMsg.includes("1") ||
    lowerMsg.includes("⚡");
  const isStep =
    lowerMsg.includes("пошаг") ||
    lowerMsg.includes("mode_step") ||
    lowerMsg.includes("шаг") ||
    lowerMsg.includes("2") ||
    lowerMsg.includes("🎯");

  if (!isQuick && !isStep) {
    // Unclear selection — ask again
    const response = await streamLLMResponse(
      CHAT_SYSTEM_PROMPT,
      [
        ...messages.map(m => ({ role: m.role, content: m.content })).slice(-6),
        { role: "user", content: "Пожалуйста, выберите режим: быстрый или пошаговый" },
      ],
      writer,
    );

    const msg: ChatMessage = {
      role: "assistant",
      content: response,
      timestamp: Date.now(),
      actions: [
        { id: "mode_quick", label: "⚡ Быстрый режим", variant: "default" },
        { id: "mode_step", label: "🎯 Пошаговый режим", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, msg);
    writer({ type: "actions", data: msg.actions });
    writer({ type: "done", data: null });
    return;
  }

  const mode = isQuick ? "quick" : "step_by_step";
  await updateChatSession(sessionId, { mode });

  if (mode === "quick") {
    await startQuickGeneration(sessionId, writer);
  } else {
    await startStepByStepGeneration(sessionId, writer);
  }
}

/**
 * Quick mode — run the full pipeline with progress streaming.
 */
async function startQuickGeneration(
  sessionId: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const topic = session.topic || "";

  // Gather file context for the pipeline prompt
  const sessionFiles = await getSessionFiles(sessionId);
  const readyFiles = sessionFiles.filter(f => f.status === "ready" && f.extractedText);
  let fileContextForPipeline = "";
  if (readyFiles.length > 0) {
    fileContextForPipeline = "\n\nМАТЕРИАЛЫ ИЗ ПРИКРЕПЛЁННЫХ ФАЙЛОВ:\n";
    for (const f of readyFiles) {
      fileContextForPipeline += `\n─── ${f.filename} ───\n${(f.extractedText || "").slice(0, 12000)}\n`;
    }
    fileContextForPipeline += "\nИспользуй данные из этих файлов как основу для содержимого презентации. Структурируй информацию по слайдам.";
  }
  const enrichedTopic = topic + fileContextForPipeline;

  // Check if files contain a pre-built outline (from image extraction)
  const preBuiltOutline = parseOutlineFromFiles(readyFiles);

  // Send starting message
  const fileNote = readyFiles.length > 0 ? ` Использую данные из ${readyFiles.length} файл(ов). 📄` : "";
  const outlineNote = preBuiltOutline ? " 📎 Структура из файла будет использована." : "";
  writer({ type: "token", data: `🚀 Запускаю быструю генерацию!${fileNote}${outlineNote} Это займёт около 60 секунд.\n\n` });

  // Create presentation record
  const presentation = await createPresentation({
    prompt: enrichedTopic,
    mode: "batch",
    config: { theme_preset: "auto" },
  });

  await updateChatSession(sessionId, {
    phase: "generating",
    presentationId: presentation.presentationId,
  });

  // Save the "starting" assistant message
  const startMsg: ChatMessage = {
    role: "assistant",
    content: "🚀 Запускаю быструю генерацию! Это займёт около 60 секунд.",
    timestamp: Date.now(),
    progress: { percent: 0, message: "Запуск..." },
  };
  await appendMessage(sessionId, startMsg);

  try {
    // Build generation config — check for custom template in session metadata
    const sessionMeta = (session.metadata as Record<string, any>) || {};
    const genConfig: GenerationConfig = {
      themePreset: sessionMeta.customTemplateId ? undefined : "auto",
      enableImages: true,
      customCssVariables: sessionMeta.customCssVariables || undefined,
      customFontsUrl: sessionMeta.customFontsUrl || undefined,
      customTemplateId: sessionMeta.customTemplateId || undefined,
      preBuiltOutline: preBuiltOutline || undefined,
    };

    // Run the pipeline with progress streaming + slide previews
    const result = await generatePresentation(
      enrichedTopic,
      genConfig,
      (progress: PipelineProgress) => {
        writer({
          type: "progress",
          data: {
            percent: progress.progressPercent,
            message: progress.message || progress.currentStep,
          },
        });
        // Send slide preview when composer produces a slide
        if (progress.slidePreview && progress.currentStep === "composing") {
          const slideMatch = progress.message?.match(/(\d+)\s+из\s+(\d+)/);
          const slideNum = slideMatch ? parseInt(slideMatch[1]) : 0;
          console.log(`[ChatOrchestrator] Sending slide_preview for slide ${slideNum}`);
          writer({
            type: "slide_preview",
            data: {
              slideNumber: slideNum,
              title: `Слайд ${slideNum}`,
              html: progress.slidePreview,
            },
          });
        }
      },
    );

    // Upload full HTML to S3
    let htmlUrl: string | undefined;
    try {
      const config = (session.metadata as Record<string, any>) || {};
      const themePreset = getThemePreset(config.theme_preset || "auto");
      const renderedSlides = result.slides.map(s => ({
        layoutId: s.layoutId,
        data: s.data,
        html: s.html || renderSlide(s.layoutId, s.data),
      }));
      const fullHtml = renderPresentation(
        renderedSlides,
        result.themeCss || themePreset.cssVariables,
        result.title || "Presentation",
        result.language || "ru",
        themePreset.fontsUrl,
      );
      const fileKey = `presentations/${presentation.presentationId}/presentation-${nanoid(8)}.html`;
      const uploaded = await storagePut(fileKey, fullHtml, "text/html");
      htmlUrl = uploaded.url;
      console.log(`[ChatOrchestrator] Uploaded HTML to S3: ${htmlUrl}`);
    } catch (uploadErr: any) {
      console.error(`[ChatOrchestrator] Failed to upload HTML to S3:`, uploadErr);
    }

    // Save to DB
    await updatePresentationProgress(presentation.presentationId, {
      status: "completed",
      currentStep: "completed",
      progressPercent: 100,
      title: result.title,
      language: result.language,
      themeCss: result.themeCss,
      finalHtmlSlides: result.slides.map(s => ({
        layoutId: s.layoutId,
        data: s.data,
        html: s.html,
      })),
      slideCount: result.slides.length,
      ...(htmlUrl ? { resultUrls: { html_preview: htmlUrl } } : {}),
    });

    // Send all slide previews at completion (ensures user sees them)
    for (let si = 0; si < result.slides.length; si++) {
      if (result.slides[si].html) {
        writer({
          type: "slide_preview",
          data: {
            slideNumber: si + 1,
            title: `Слайд ${si + 1}`,
            html: result.slides[si].html,
          },
        });
      }
    }

    // Send completion message
    writer({ type: "token", data: `\n\n✅ Презентация «${result.title}» готова! ${result.slides.length} слайдов создано.` });

    // Send presentation link
    writer({
      type: "presentation_link",
      data: {
        presentationId: presentation.presentationId,
        title: result.title,
        slideCount: result.slides.length,
      },
    });

    // Save completion message
    const doneMsg: ChatMessage = {
      role: "assistant",
      content: `✅ Презентация «${result.title}» готова! ${result.slides.length} слайдов создано.`,
      timestamp: Date.now(),
      presentationLink: `/view/${presentation.presentationId}`,
      actions: [
        { id: "view_presentation", label: "👁 Открыть презентацию", variant: "default" },
        { id: "new_presentation", label: "➕ Создать новую", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, doneMsg);

    writer({ type: "actions", data: doneMsg.actions });

    await updateChatSession(sessionId, { phase: "completed" });
  } catch (err: any) {
    console.error(`[ChatOrchestrator] Quick generation failed:`, err);

    await updatePresentationProgress(presentation.presentationId, {
      status: "failed",
      errorInfo: { message: err.message },
    });

    writer({ type: "token", data: `\n\n❌ Ошибка при генерации: ${err.message}. Попробуйте ещё раз.` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `❌ Ошибка при генерации: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "retry_quick", label: "🔄 Попробовать снова", variant: "default" },
        { id: "new_presentation", label: "➕ Новая тема", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });

    await updateChatSession(sessionId, { phase: "mode_selection" });
  }

  writer({ type: "done", data: null });
}

/**
 * Step-by-step mode — start with structure generation.
 */
async function startStepByStepGeneration(
  sessionId: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  writer({ type: "token", data: "🎯 Отлично! Начинаем пошаговое создание.\n\nСначала я создам структуру презентации, а вы её утвердите или предложите изменения.\n\nПодождите немного..." });

  await updateChatSession(sessionId, { phase: "generating" });

  // Gather file context for the pipeline prompt (same as quick mode)
  const sessionFiles = await getSessionFiles(sessionId);
  const readyFiles = sessionFiles.filter(f => f.status === "ready" && f.extractedText);
  let fileContextForPipeline = "";
  if (readyFiles.length > 0) {
    fileContextForPipeline = "\n\nМАТЕРИАЛЫ ИЗ ПРИКРЕПЛЁННЫХ ФАЙЛОВ:\n";
    for (const f of readyFiles) {
      fileContextForPipeline += `\n─── ${f.filename} ───\n${(f.extractedText || "").slice(0, 12000)}\n`;
    }
    fileContextForPipeline += "\nИспользуй данные из этих файлов как основу для содержимого и структуры презентации. Если файл содержит структуру презентации (список слайдов) — используй её ТОЧНО как основу для outline, сохраняя заголовки и описания.";
  }
  const topic = session.topic || "";
  const enrichedTopic = topic + fileContextForPipeline;

  // Check if files contain a pre-built outline (from image extraction)
  const preBuiltOutline = parseOutlineFromFiles(readyFiles);

  // Create presentation record
  const presentation = await createPresentation({
    prompt: enrichedTopic,
    mode: "interactive",
    config: { theme_preset: "auto" },
  });

  await updateChatSession(sessionId, {
    presentationId: presentation.presentationId,
  });

  try {
    // Import pipeline functions
    const { runPlanner, runOutline } = await import("./pipeline/generator");

    writer({ type: "progress", data: { percent: 10, message: "Анализ темы..." } });
    const plannerResult = await runPlanner(enrichedTopic);

    writer({ type: "progress", data: { percent: 30, message: "Создание структуры..." } });

    let outline;
    if (preBuiltOutline) {
      // Use the pre-built outline from the uploaded image/file
      console.log(`[ChatOrchestrator] Using pre-built outline from file: ${preBuiltOutline.slides.length} slides`);
      outline = preBuiltOutline;
      writer({ type: "token", data: "\n\n📎 Использую структуру из загруженного файла.\n" });
    } else {
      outline = await runOutline(enrichedTopic, plannerResult.branding, plannerResult.language || "ru");
    }

    // Format outline for display
    const outlineText = outline.slides
      .map((s, i) => `**${i + 1}. ${s.title}**\n   ${s.purpose}`)
      .join("\n\n");

    const structureMsg = `\n\n📋 **Структура презентации: «${outline.presentation_title}»**\n\n${outlineText}\n\nВсего слайдов: ${outline.slides.length}`;

    writer({ type: "token", data: structureMsg });

    // Save outline in metadata
    await updateChatSession(sessionId, {
      phase: "step_structure",
      metadata: {
        ...(session.metadata as any || {}),
        plannerResult,
        outline,
      },
    });

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: `🎯 Начинаем пошаговое создание.\n\n${structureMsg}`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_structure", label: "✅ Утвердить структуру", variant: "default" },
        { id: "regenerate_structure", label: "🔄 Пересоздать", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, assistantMsg);

    writer({ type: "actions", data: assistantMsg.actions });
  } catch (err: any) {
    console.error("[ChatOrchestrator] Step-by-step structure failed:", err);
    writer({ type: "token", data: `\n\n❌ Ошибка: ${err.message}` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `❌ Ошибка при создании структуры: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "retry_step", label: "🔄 Попробовать снова", variant: "default" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });

    await updateChatSession(sessionId, { phase: "mode_selection" });
  }

  writer({ type: "done", data: null });
}

/**
 * Handle messages after structure is shown (approve/regenerate).
 * IMPORTANT: Only the explicit "approve_structure" action button triggers generation.
 * Any text message is treated as a request to modify the structure.
 */
async function handleStructureApproval(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
  isExplicitApproval: boolean = false,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  if (isExplicitApproval) {
    // ── SLIDE-BY-SLIDE WORKFLOW ──
    // Instead of running the full pipeline, we prepare the theme and start
    // proposing content for each slide one at a time.
    writer({ type: "token", data: "✅ Структура утверждена! Подготавливаю тему оформления...\n\n" });

    const metadata = (session.metadata as Record<string, any>) || {};
    const topic = session.topic || "";
    const outline: OutlineResult = metadata.outline;
    const plannerResult: PlannerResult = metadata.plannerResult;

    if (!outline || !plannerResult) {
      writer({ type: "token", data: "❌ Не найдена структура. Попробуйте пересоздать." });
      writer({ type: "done", data: null });
      return;
    }

    try {
      // 1. Resolve theme once
      writer({ type: "progress", data: { percent: 10, message: "Подбор визуальной темы..." } });

      let themePreset: ThemePreset;
      if (metadata.customCssVariables) {
        themePreset = {
          id: metadata.customTemplateId ? `custom_${metadata.customTemplateId}` : "custom",
          name: "Custom Template",
          nameRu: "Пользовательский шаблон",
          color: "#6366f1",
          gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          dark: false,
          category: "creative" as const,
          descRu: "Пользовательский шаблон",
          previewColor: "#6366f1",
          previewGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          cssVariables: metadata.customCssVariables,
          fontsUrl: metadata.customFontsUrl || "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
          mood: "Custom user template",
        } as any;
      } else {
        const themeSelection = await autoSelectTheme(topic);
        themePreset = getThemePreset(themeSelection.themeId);
      }

      const themeResult = await runTheme(
        outline.presentation_title,
        plannerResult.branding,
        outline.target_audience,
        themePreset,
      );

      // Classify presentation type for layout hints
      const typeProfile = classifyPresentation(topic);

      // Gather file context
      const approvalSessionFiles = await getSessionFiles(sessionId);
      const approvalReadyFiles = approvalSessionFiles.filter(f => f.status === "ready" && f.extractedText);
      let fileContext = "";
      if (approvalReadyFiles.length > 0) {
        fileContext = "\n\nМАТЕРИАЛЫ ИЗ ПРИКРЕПЛЁННЫХ ФАЙЛОВ:\n";
        for (const f of approvalReadyFiles) {
          fileContext += `\n─── ${f.filename} ───\n${(f.extractedText || "").slice(0, 12000)}\n`;
        }
      }

      // Check if we're resuming after adding a new slide (pendingSlideIndex set)
      const resumeIndex = metadata.pendingSlideIndex ?? 0;
      const keepExisting = resumeIndex > 0;

      // Save theme + type profile + set slide index
      await updateChatSession(sessionId, {
        phase: "step_slide_content",
        metadata: {
          ...metadata,
          themeResult,
          themeCss: themeResult.css_variables,
          themePresetId: themePreset.id,
          typeProfile: { type: typeProfile.type, writerHint: typeProfile.writerHint, layoutHint: typeProfile.layoutHint },
          currentSlideIndex: resumeIndex,
          writtenSlides: keepExisting ? (metadata.writtenSlides || []) : [],
          approvedSlides: keepExisting ? (metadata.approvedSlides || []) : [],
          fileContext,
          pendingSlideIndex: undefined, // Clear the pending flag
        },
      });

      writer({ type: "progress", data: { percent: 15, message: `Тема: ${themePreset.nameRu || themePreset.name}` } });

      // Propose content for the target slide
      await proposeSlideContent(sessionId, resumeIndex, writer);
    } catch (err: any) {
      console.error("[ChatOrchestrator] Step-by-slide theme init failed:", err);
      writer({ type: "token", data: `\n\n❌ Ошибка: ${err.message}` });
      await updateChatSession(sessionId, { phase: "step_structure" });
    }
  } else {
    // User sent text feedback — use LLM to modify the existing structure
    await handleStructureEditRequest(sessionId, userMessage, writer);
  }

  writer({ type: "done", data: null });
}

/**
 * Handle user's text feedback on the structure — use LLM to modify it.
 */
async function handleStructureEditRequest(
  sessionId: string,
  userFeedback: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = session.metadata as any || {};
  const currentOutline = metadata.outline;

  if (!currentOutline) {
    // No outline to modify — regenerate from scratch
    writer({ type: "token", data: "🔄 Пересоздаю структуру с учётом ваших пожеланий...\n\n" });
    await updateChatSession(sessionId, { phase: "generating" });
    await startStepByStepGeneration(sessionId, writer);
    return;
  }

  writer({ type: "token", data: "✏️ Вношу изменения в структуру...\n\n" });

  // Format current outline for LLM context
  const currentOutlineText = currentOutline.slides
    .map((s: any, i: number) => `${i + 1}. ${s.title} — ${s.purpose}`)
    .join("\n");

  const editPrompt = `Ты — AI-ассистент для создания презентаций. У тебя есть текущая структура презентации, и пользователь просит внести изменения.

Текущая структура презентации «${currentOutline.presentation_title}»:
${currentOutlineText}

Запрос пользователя: "${userFeedback}"

Внеси ТОЧНО те изменения, которые просит пользователь. Не меняй ничего другого.
Ответь СТРОГО в JSON формате (без markdown-обёртки):
{
  "presentation_title": "...",
  "slides": [
    { "title": "...", "purpose": "..." }
  ]
}`;

  try {
    // Use structured JSON response format for reliable parsing
    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: "You are an AI assistant that modifies presentation outlines. Always respond with valid JSON." },
        { role: "user", content: editPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "modified_outline",
          strict: true,
          schema: {
            type: "object",
            properties: {
              presentation_title: { type: "string", description: "Title of the presentation" },
              slides: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Slide title" },
                    purpose: { type: "string", description: "Slide purpose/description" },
                  },
                  required: ["title", "purpose"],
                  additionalProperties: false,
                },
              },
            },
            required: ["presentation_title", "slides"],
            additionalProperties: false,
          },
        },
      },
    });

    const llmContent = llmResult.choices?.[0]?.message?.content || "";
    let modifiedOutline;
    try {
      modifiedOutline = JSON.parse(typeof llmContent === "string" ? llmContent : JSON.stringify(llmContent));
    } catch {
      // Fallback: try to extract JSON from text
      const jsonStart = (typeof llmContent === "string" ? llmContent : "").indexOf("{");
      const jsonEnd = (typeof llmContent === "string" ? llmContent : "").lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        modifiedOutline = JSON.parse((llmContent as string).slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Не удалось разобрать ответ AI");
      }
    }

    // Update the outline in metadata
    const updatedOutline = {
      ...currentOutline,
      presentation_title: modifiedOutline.presentation_title || currentOutline.presentation_title,
      slides: modifiedOutline.slides || currentOutline.slides,
    };

    await updateChatSession(sessionId, {
      metadata: {
        ...metadata,
        outline: updatedOutline,
      },
    });

    // Format and display the updated outline
    const outlineText = updatedOutline.slides
      .map((s: any, i: number) => `**${i + 1}. ${s.title}**\n   ${s.purpose}`)
      .join("\n\n");

    const structureMsg = `📋 **Обновлённая структура: «${updatedOutline.presentation_title}»**\n\n${outlineText}\n\nВсего слайдов: ${updatedOutline.slides.length}\n\nЕсли всё устраивает — нажмите «Утвердить структуру». Или напишите, что ещё нужно изменить.`;

    writer({ type: "token", data: structureMsg });

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: structureMsg,
      timestamp: Date.now(),
      actions: [
        { id: "approve_structure", label: "✅ Утвердить структуру", variant: "default" },
        { id: "regenerate_structure", label: "🔄 Пересоздать с нуля", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, assistantMsg);
    writer({ type: "actions", data: assistantMsg.actions });

  } catch (err: any) {
    console.error("[ChatOrchestrator] Structure edit failed:", err);
    writer({ type: "token", data: `\n\nНе удалось обработать изменения: ${err.message}. Попробуйте сформулировать иначе.` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `Не удалось обработать изменения: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_structure", label: "✅ Утвердить как есть", variant: "default" },
        { id: "regenerate_structure", label: "🔄 Пересоздать с нуля", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });
  }
}

/**
 * Handle messages after presentation is completed.
 */
async function handlePostCompletion(
  sessionId: string,
  userMessage: string,
  messages: ChatMessage[],
  writer: SSEWriter,
): Promise<void> {
  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.includes("new_presentation") || lowerMsg.includes("нов") || lowerMsg.includes("другую") || lowerMsg.includes("➕")) {
    // Reset session for new presentation
    await updateChatSession(sessionId, {
      phase: "idle",
      topic: "",
      presentationId: undefined,
      metadata: {},
    });

    writer({ type: "token", data: "Отлично! Введите тему для новой презентации 📝" });

    const msg: ChatMessage = {
      role: "assistant",
      content: "Отлично! Введите тему для новой презентации 📝",
      timestamp: Date.now(),
    };
    await appendMessage(sessionId, msg);
    writer({ type: "done", data: null });
    return;
  }

  if (lowerMsg.includes("view_presentation") || lowerMsg.includes("открыть") || lowerMsg.includes("👁")) {
    const session = await getChatSession(sessionId);
    if (session?.presentationId) {
      writer({
        type: "presentation_link",
        data: { presentationId: session.presentationId },
      });
    }
    writer({ type: "done", data: null });
    return;
  }

  // Generic post-completion chat
  const response = await streamLLMResponse(
    `${CHAT_SYSTEM_PROMPT}\n\nПрезентация уже создана. Пользователь может попросить создать новую или задать вопрос.`,
    messages.map(m => ({ role: m.role, content: m.content })).slice(-6),
    writer,
  );

  const msg: ChatMessage = {
    role: "assistant",
    content: response,
    timestamp: Date.now(),
    actions: [
      { id: "new_presentation", label: "➕ Создать новую", variant: "outline" },
    ],
  };
  await appendMessage(sessionId, msg);
  writer({ type: "actions", data: msg.actions });
  writer({ type: "done", data: null });
}

/**
 * Handle generic messages (fallback).
 */
async function handleGenericMessage(
  sessionId: string,
  messages: ChatMessage[],
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  // Check if we're in step_structure phase — text messages are edit requests, NOT approval
  if (session.phase === "step_structure") {
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    await handleStructureApproval(sessionId, lastUserMsg, writer, false);
    return;
  }

  const response = await streamLLMResponse(
    CHAT_SYSTEM_PROMPT,
    messages.map(m => ({ role: m.role, content: m.content })).slice(-6),
    writer,
  );

  const msg: ChatMessage = {
    role: "assistant",
    content: response,
    timestamp: Date.now(),
  };
  await appendMessage(sessionId, msg);
  writer({ type: "done", data: null });
}

/**
 * Handle action button clicks (special message format).
 */
export async function processAction(
  sessionId: string,
  actionId: string,
  writer: SSEWriter,
): Promise<void> {
  switch (actionId) {
    case "mode_quick":
      return processMessage(sessionId, "⚡ Быстрый режим", writer);
    case "mode_step":
      return processMessage(sessionId, "🎯 Пошаговый режим", writer);
    case "approve_structure": {
      // Explicit approval via button — pass isExplicitApproval=true
      const approveUserMsg: ChatMessage = {
        role: "user",
        content: "✅ Утвердить структуру",
        timestamp: Date.now(),
      };
      await appendMessage(sessionId, approveUserMsg);
      return handleStructureApproval(sessionId, "✅ Утвердить структуру", writer, true);
    }
    case "regenerate_structure": {
      // Regenerate from scratch
      const regenUserMsg: ChatMessage = {
        role: "user",
        content: "🔄 Пересоздать структуру",
        timestamp: Date.now(),
      };
      await appendMessage(sessionId, regenUserMsg);
      await updateChatSession(sessionId, { phase: "generating" });
      return startStepByStepGeneration(sessionId, writer);
    }
    case "approve_slide_content": {
      const contentApproveMsg: ChatMessage = {
        role: "user",
        content: "✅ Контент утверждён",
        timestamp: Date.now(),
      };
      await appendMessage(sessionId, contentApproveMsg);
      return handleSlideContentApproval(sessionId, writer);
    }
    case "approve_slide_design": {
      const designApproveMsg: ChatMessage = {
        role: "user",
        content: "✅ Дизайн утверждён",
        timestamp: Date.now(),
      };
      await appendMessage(sessionId, designApproveMsg);
      return handleSlideDesignApproval(sessionId, writer);
    }
    case "retry_quick":
    case "retry_step":
      // Reset to mode selection and retry
      await updateChatSession(sessionId, { phase: "mode_selection" });
      const session = await getChatSession(sessionId);
      const mode = actionId === "retry_quick" ? "⚡ Быстрый режим" : "🎯 Пошаговый режим";
      return processMessage(sessionId, mode, writer);
    case "view_presentation":
      return processMessage(sessionId, "👁 Открыть презентацию", writer);
    case "new_presentation":
      return processMessage(sessionId, "➕ Создать новую презентацию", writer);
    default:
      return processMessage(sessionId, actionId, writer);
  }
}

// ═══════════════════════════════════════════════════════
// SLIDE-BY-SLIDE WORKFLOW FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Propose content for a specific slide (by index).
 * Calls runWriterSingle and presents the result to the user for approval.
 */
async function proposeSlideContent(
  sessionId: string,
  slideIndex: number,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const plannerResult: PlannerResult = metadata.plannerResult;
  const fileContext: string = metadata.fileContext || "";

  if (!outline || slideIndex >= outline.slides.length) {
    writer({ type: "token", data: "❌ Ошибка: слайд не найден в структуре." });
    writer({ type: "done", data: null });
    return;
  }

  const slideInfo = outline.slides[slideIndex];
  const totalSlides = outline.slides.length;

  // Emit slide progress event
  writer({ type: "slide_progress", data: {
    currentSlide: slideIndex + 1,
    totalSlides,
    phase: "content",
    slideTitle: slideInfo.title,
  } });

  writer({ type: "token", data: `\n\n📝 **Слайд ${slideIndex + 1} из ${totalSlides}: «${slideInfo.title}»**\n\nГенерирую контент...` });
  writer({ type: "progress", data: { percent: 15 + Math.round((slideIndex / totalSlides) * 70), message: `Контент слайда ${slideIndex + 1}/${totalSlides}` } });

  try {
    const allTitles = outline.slides.map(s => s.title).join(", ");
    const previousContext = (metadata.writtenSlides || [])
      .map((s: SlideContent) => `[Slide ${s.slide_number}] ${s.title}: ${s.key_message}`)
      .join("\n");

    const enrichedTopic = (session.topic || "") + fileContext;

    const content = await runWriterSingle(
      slideInfo,
      outline.presentation_title,
      allTitles,
      outline.target_audience,
      plannerResult.language || "ru",
      previousContext || undefined,
      fileContext || undefined,
      metadata.typeProfile?.writerHint,
    );

    // Save the proposed content in metadata
    await updateChatSession(sessionId, {
      phase: "step_slide_content",
      metadata: {
        ...metadata,
        currentSlideIndex: slideIndex,
        proposedContent: content,
      },
    });

    // Format content for display
    const contentDisplay = formatSlideContentForDisplay(content, slideIndex + 1, totalSlides);
    writer({ type: "token", data: contentDisplay });

    const msg: ChatMessage = {
      role: "assistant",
      content: contentDisplay,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_content", label: "✅ Готово — создать дизайн", variant: "default" },
      ],
    };
    await appendMessage(sessionId, msg);
    writer({ type: "actions", data: msg.actions });
  } catch (err: any) {
    console.error(`[ChatOrchestrator] Slide content generation failed for slide ${slideIndex + 1}:`, err);
    writer({ type: "token", data: `\n\n❌ Ошибка генерации контента: ${err.message}` });
  }

  writer({ type: "done", data: null });
}

/**
 * Format slide content for user-friendly display.
 */
function formatSlideContentForDisplay(content: SlideContent, slideNum: number, totalSlides: number): string {
  let display = `\n\n📋 **Контент слайда ${slideNum}/${totalSlides}: «${content.title}»**\n\n`;
  display += `**Ключевое сообщение:** ${content.key_message}\n\n`;
  display += `**Текст:**\n${content.text}\n\n`;

  if (content.data_points && content.data_points.length > 0) {
    display += `**Данные:**\n`;
    for (const dp of content.data_points) {
      display += `  • ${dp.label}: ${dp.value} ${dp.unit}\n`;
    }
    display += "\n";
  }

  if (content.structured_content) {
    const sc = content.structured_content;
    if (sc.stat_cards && sc.stat_cards.length > 0) {
      display += `**Карточки статистики:**\n`;
      for (const card of sc.stat_cards) {
        display += `  • ${card.label}: ${card.value} — ${card.description}\n`;
      }
      display += "\n";
    }
    if (sc.steps && sc.steps.length > 0) {
      display += `**Шаги процесса:**\n`;
      for (const step of sc.steps) {
        display += `  ${step.step_number}. ${step.title}: ${step.description}\n`;
      }
      display += "\n";
    }
    if (sc.cards && sc.cards.length > 0) {
      display += `**Карточки:**\n`;
      for (const card of sc.cards) {
        display += `  • ${card.title}: ${card.text}\n`;
      }
      display += "\n";
    }
  }

  if (content.notes) {
    display += `**Заметки спикера:** ${content.notes}\n\n`;
  }

  display += `Если всё устраивает — нажмите «Готово». Или напишите, что нужно изменить.`;
  return display;
}

/**
 * Handle user text feedback on slide content (edit request).
 */
async function handleSlideContentFeedback(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const proposedContent: SlideContent | undefined = metadata.proposedContent;
  const outline: OutlineResult = metadata.outline;
  const slideIndex: number = metadata.currentSlideIndex ?? 0;

  if (!proposedContent || !outline) {
    writer({ type: "token", data: "❌ Нет предложенного контента для редактирования." });
    writer({ type: "done", data: null });
    return;
  }

  writer({ type: "token", data: "✏️ Вношу изменения в контент слайда...\n\n" });

  try {
    const editPrompt = `Ты — AI-ассистент для создания презентаций. У тебя есть текущий контент слайда, и пользователь просит внести изменения.

Слайд ${slideIndex + 1}: «${proposedContent.title}»
Текущий контент:
- Ключевое сообщение: ${proposedContent.key_message}
- Текст: ${proposedContent.text}
- Заметки: ${proposedContent.notes}

Запрос пользователя: "${userMessage}"

Внеси ТОЧНО те изменения, которые просит пользователь. Не меняй ничего другого.
Ответь СТРОГО в JSON формате:
{
  "title": "...",
  "text": "...",
  "key_message": "...",
  "notes": "...",
  "data_points": [{"label": "...", "value": "...", "unit": "..."}]
}`;

    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: "You are an AI assistant that modifies presentation slide content. Always respond with valid JSON." },
        { role: "user", content: editPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "modified_slide_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              text: { type: "string" },
              key_message: { type: "string" },
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
            },
            required: ["title", "text", "key_message", "notes", "data_points"],
            additionalProperties: false,
          },
        },
      },
    });

    const llmContent = llmResult.choices?.[0]?.message?.content || "";
    const modified = JSON.parse(typeof llmContent === "string" ? llmContent : JSON.stringify(llmContent));

    const updatedContent: SlideContent = {
      ...proposedContent,
      title: modified.title || proposedContent.title,
      text: modified.text || proposedContent.text,
      key_message: modified.key_message || proposedContent.key_message,
      notes: modified.notes || proposedContent.notes,
      data_points: modified.data_points || proposedContent.data_points,
    };

    await updateChatSession(sessionId, {
      metadata: {
        ...metadata,
        proposedContent: updatedContent,
      },
    });

    const totalSlides = outline.slides.length;
    const contentDisplay = formatSlideContentForDisplay(updatedContent, slideIndex + 1, totalSlides);
    writer({ type: "token", data: contentDisplay });

    const msg: ChatMessage = {
      role: "assistant",
      content: contentDisplay,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_content", label: "✅ Готово — создать дизайн", variant: "default" },
      ],
    };
    await appendMessage(sessionId, msg);
    writer({ type: "actions", data: msg.actions });
  } catch (err: any) {
    console.error("[ChatOrchestrator] Slide content edit failed:", err);
    writer({ type: "token", data: `\n\nНе удалось обработать изменения: ${err.message}. Попробуйте сформулировать иначе.` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `Не удалось обработать изменения: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_content", label: "✅ Утвердить как есть", variant: "default" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });
  }

  writer({ type: "done", data: null });
}

/**
 * Handle content approval — generate design for the current slide.
 */
async function handleSlideContentApproval(
  sessionId: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const proposedContent: SlideContent | undefined = metadata.proposedContent;
  const outline: OutlineResult = metadata.outline;
  const slideIndex: number = metadata.currentSlideIndex ?? 0;

  if (!proposedContent || !outline) {
    writer({ type: "token", data: "❌ Нет контента для утверждения." });
    writer({ type: "done", data: null });
    return;
  }

  // Save approved content to writtenSlides
  const writtenSlides: SlideContent[] = [...(metadata.writtenSlides || [])];
  // Replace if already exists for this index, otherwise push
  const existingIdx = writtenSlides.findIndex(s => s.slide_number === proposedContent.slide_number);
  if (existingIdx >= 0) {
    writtenSlides[existingIdx] = proposedContent;
  } else {
    writtenSlides.push(proposedContent);
  }

  await updateChatSession(sessionId, {
    phase: "step_slide_design",
    metadata: {
      ...metadata,
      writtenSlides,
    },
  });

  writer({ type: "token", data: `\n\n✅ Контент слайда ${slideIndex + 1} утверждён! Создаю дизайн...\n\n` });

  // Generate design for this slide
  await generateSlideDesign(sessionId, slideIndex, writer);
}

/**
 * Generate design (layout + HTML) for a single slide.
 */
async function generateSlideDesign(
  sessionId: string,
  slideIndex: number,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const writtenSlides: SlideContent[] = metadata.writtenSlides || [];
  const themeResult: ThemeResult = metadata.themeResult;
  const themeCss: string = metadata.themeCss || "";
  const themePresetId: string = metadata.themePresetId || "corporate_blue";

  const content = writtenSlides.find(s => s.slide_number === outline.slides[slideIndex]?.slide_number);
  if (!content) {
    writer({ type: "token", data: "❌ Контент слайда не найден." });
    writer({ type: "done", data: null });
    return;
  }

  const totalSlides = outline.slides.length;

  // Emit slide progress event
  writer({ type: "slide_progress", data: {
    currentSlide: slideIndex + 1,
    totalSlides,
    phase: "design",
    slideTitle: content.title,
  } });

  writer({ type: "progress", data: { percent: 15 + Math.round(((slideIndex + 0.5) / totalSlides) * 70), message: `Дизайн слайда ${slideIndex + 1}/${totalSlides}` } });

  try {
    // 1. Select layout for this single slide
    const layoutDecisions = await runLayout([content], metadata.typeProfile?.layoutHint);
    const layoutName = layoutDecisions[0]?.layout_name || "text-slide";

    // 2. Compose HTML data
    let slideData: Record<string, any>;
    try {
      slideData = await runHtmlComposerWithQA(content, layoutName, themeCss);
    } catch {
      slideData = buildFallbackData(content, layoutName);
    }

    // 3. Render HTML
    const slideHtml = renderSlide(layoutName, slideData);

    // Build a full preview HTML with theme CSS
    const themePreset = getThemePreset(themePresetId);
    const previewHtml = renderPresentation(
      [{ layoutId: layoutName, data: slideData, html: slideHtml }],
      themeCss || themePreset.cssVariables,
      outline.presentation_title,
      metadata.plannerResult?.language || "ru",
      themePreset.fontsUrl,
    );

    // Save the design result
    await updateChatSession(sessionId, {
      phase: "step_slide_design",
      metadata: {
        ...metadata,
        currentSlideDesign: {
          layoutName,
          slideData,
          slideHtml,
        },
      },
    });

    // Send slide preview
    writer({
      type: "slide_preview",
      data: {
        slideNumber: slideIndex + 1,
        title: `Слайд ${slideIndex + 1}: ${content.title}`,
        html: slideHtml,
      },
    });

    writer({ type: "token", data: `\n\n🎨 **Дизайн слайда ${slideIndex + 1}/${totalSlides}: «${content.title}»**\n\nМакет: **${layoutName}**\n\nПосмотрите превью выше. Если всё устраивает — нажмите «Готово». Или напишите, что нужно изменить в дизайне.` });

    const msg: ChatMessage = {
      role: "assistant",
      content: `🎨 Дизайн слайда ${slideIndex + 1}/${totalSlides}: «${content.title}» (макет: ${layoutName})`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_design", label: "✅ Готово", variant: "default" },
      ],
    };
    await appendMessage(sessionId, msg);
    writer({ type: "actions", data: msg.actions });
  } catch (err: any) {
    console.error(`[ChatOrchestrator] Slide design generation failed for slide ${slideIndex + 1}:`, err);
    writer({ type: "token", data: `\n\n❌ Ошибка генерации дизайна: ${err.message}` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `❌ Ошибка генерации дизайна: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_design", label: "⏭ Пропустить и продолжить", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });
  }

  writer({ type: "done", data: null });
}

/**
 * Handle user text feedback on slide design (edit request).
 */
async function handleSlideDesignFeedback(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const slideIndex: number = metadata.currentSlideIndex ?? 0;
  const currentDesign = metadata.currentSlideDesign;
  const writtenSlides: SlideContent[] = metadata.writtenSlides || [];
  const themeCss: string = metadata.themeCss || "";
  const themePresetId: string = metadata.themePresetId || "corporate_blue";

  if (!currentDesign || !outline) {
    writer({ type: "token", data: "❌ Нет дизайна для редактирования." });
    writer({ type: "done", data: null });
    return;
  }

  // Check if user wants to add a new slide: "готово + ещё слайд + описание"
  const lowerMsg = userMessage.toLowerCase();
  const addSlideMatch = lowerMsg.match(/готово.*(?:ещё|еще)\s*слайд[:\s]*(.*)/i) || lowerMsg.match(/done.*(?:add|new)\s*slide[:\s]*(.*)/i);
  if (addSlideMatch) {
    const newSlideDesc = addSlideMatch[1]?.trim() || "Дополнительный слайд";
    await handleAddNewSlide(sessionId, newSlideDesc, writer);
    return;
  }

  writer({ type: "token", data: "✏️ Перегенерирую дизайн с учётом ваших пожеланий...\n\n" });

  const content = writtenSlides.find(s => s.slide_number === outline.slides[slideIndex]?.slide_number);
  if (!content) {
    writer({ type: "token", data: "❌ Контент слайда не найден." });
    writer({ type: "done", data: null });
    return;
  }

  try {
    // Use LLM to decide on a different layout or adjust data based on feedback
    const feedbackPrompt = `Пользователь хочет изменить дизайн слайда.
Текущий макет: ${currentDesign.layoutName}
Контент слайда: "${content.title}" — ${content.key_message}
Запрос пользователя: "${userMessage}"

Если пользователь просит другой макет, предложи подходящий из списка доступных.
Если просит изменить элементы — опиши, что нужно поменять.
Ответь в JSON: { "new_layout": "layout_name_or_null", "adjustments": "описание изменений" }`;

    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: "You are a presentation design assistant. Respond with valid JSON." },
        { role: "user", content: feedbackPrompt },
      ],
    });

    const rawContent = llmResult.choices?.[0]?.message?.content || "";
    const rawStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    // Try to parse the layout suggestion
    let newLayoutName = currentDesign.layoutName;
    try {
      const jsonStart = rawStr.indexOf("{");
      const jsonEnd = rawStr.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(rawStr.slice(jsonStart, jsonEnd + 1));
        if (parsed.new_layout && parsed.new_layout !== "null" && parsed.new_layout !== "none") {
          newLayoutName = parsed.new_layout;
        }
      }
    } catch {
      // Keep current layout
    }

    // Re-compose with potentially new layout
    let slideData: Record<string, any>;
    try {
      slideData = await runHtmlComposerWithQA(content, newLayoutName, themeCss);
    } catch {
      slideData = buildFallbackData(content, newLayoutName);
    }

    const slideHtml = renderSlide(newLayoutName, slideData);

    const themePreset = getThemePreset(themePresetId);
    const previewHtml = renderPresentation(
      [{ layoutId: newLayoutName, data: slideData, html: slideHtml }],
      themeCss || themePreset.cssVariables,
      outline.presentation_title,
      metadata.plannerResult?.language || "ru",
      themePreset.fontsUrl,
    );

    await updateChatSession(sessionId, {
      metadata: {
        ...metadata,
        currentSlideDesign: {
          layoutName: newLayoutName,
          slideData,
          slideHtml,
        },
      },
    });

    writer({
      type: "slide_preview",
      data: {
        slideNumber: slideIndex + 1,
        title: `Слайд ${slideIndex + 1}: ${content.title}`,
        html: slideHtml,
      },
    });

    writer({ type: "token", data: `\n\n🎨 **Обновлённый дизайн слайда ${slideIndex + 1}: «${content.title}»**\n\nМакет: **${newLayoutName}**\n\nПосмотрите превью. Если устраивает — нажмите «Готово».` });

    const msg: ChatMessage = {
      role: "assistant",
      content: `🎨 Обновлённый дизайн слайда ${slideIndex + 1}: «${content.title}» (макет: ${newLayoutName})`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_design", label: "✅ Готово", variant: "default" },
      ],
    };
    await appendMessage(sessionId, msg);
    writer({ type: "actions", data: msg.actions });
  } catch (err: any) {
    console.error("[ChatOrchestrator] Slide design edit failed:", err);
    writer({ type: "token", data: `\n\nНе удалось обработать изменения: ${err.message}` });

    const errorMsg: ChatMessage = {
      role: "assistant",
      content: `Не удалось обработать изменения: ${err.message}`,
      timestamp: Date.now(),
      actions: [
        { id: "approve_slide_design", label: "✅ Утвердить как есть", variant: "default" },
      ],
    };
    await appendMessage(sessionId, errorMsg);
    writer({ type: "actions", data: errorMsg.actions });
  }

  writer({ type: "done", data: null });
}

/**
 * Handle design approval — save the slide and move to the next one or finalize.
 */
async function handleSlideDesignApproval(
  sessionId: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const slideIndex: number = metadata.currentSlideIndex ?? 0;
  const currentDesign = metadata.currentSlideDesign;
  const writtenSlides: SlideContent[] = metadata.writtenSlides || [];

  if (!currentDesign || !outline) {
    writer({ type: "token", data: "❌ Нет дизайна для утверждения." });
    writer({ type: "done", data: null });
    return;
  }

  // Save the approved slide to approvedSlides
  const approvedSlides: Array<{ slideNumber: number; layoutId: string; data: Record<string, any>; html: string }> = [...(metadata.approvedSlides || [])];
  const slideNum = slideIndex + 1;

  // Replace if already exists, otherwise push
  const existingIdx = approvedSlides.findIndex(s => s.slideNumber === slideNum);
  const approvedSlide = {
    slideNumber: slideNum,
    layoutId: currentDesign.layoutName,
    data: currentDesign.slideData,
    html: currentDesign.slideHtml,
  };
  if (existingIdx >= 0) {
    approvedSlides[existingIdx] = approvedSlide;
  } else {
    approvedSlides.push(approvedSlide);
  }

  const nextSlideIndex = slideIndex + 1;
  const totalSlides = outline.slides.length;

  if (nextSlideIndex >= totalSlides) {
    // All slides done — finalize presentation
    await updateChatSession(sessionId, {
      metadata: {
        ...metadata,
        approvedSlides,
        currentSlideDesign: undefined,
        proposedContent: undefined,
      },
    });

    writer({ type: "token", data: `\n\n✅ Слайд ${slideNum} утверждён! Все ${totalSlides} слайдов готовы.\n\nСобираю финальную презентацию...` });

    await finalizeStepPresentation(sessionId, writer);
  } else {
    // Move to next slide
    await updateChatSession(sessionId, {
      phase: "step_slide_content",
      metadata: {
        ...metadata,
        approvedSlides,
        currentSlideIndex: nextSlideIndex,
        currentSlideDesign: undefined,
        proposedContent: undefined,
      },
    });

    writer({ type: "token", data: `\n\n✅ Слайд ${slideNum} утверждён! Переходим к слайду ${nextSlideIndex + 1} из ${totalSlides}.\n` });

    // Propose content for next slide
    await proposeSlideContent(sessionId, nextSlideIndex, writer);
  }
}

/**
 * Handle adding a new slide during the design approval phase.
 */
async function handleAddNewSlide(
  sessionId: string,
  slideDescription: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const slideIndex: number = metadata.currentSlideIndex ?? 0;
  const currentDesign = metadata.currentSlideDesign;

  if (!outline) {
    writer({ type: "token", data: "❌ Структура не найдена." });
    writer({ type: "done", data: null });
    return;
  }

  // First, approve the current slide design
  if (currentDesign) {
    const approvedSlides: Array<{ slideNumber: number; layoutId: string; data: Record<string, any>; html: string }> = [...(metadata.approvedSlides || [])];
    const slideNum = slideIndex + 1;
    const existingIdx = approvedSlides.findIndex(s => s.slideNumber === slideNum);
    const approvedSlide = {
      slideNumber: slideNum,
      layoutId: currentDesign.layoutName,
      data: currentDesign.slideData,
      html: currentDesign.slideHtml,
    };
    if (existingIdx >= 0) {
      approvedSlides[existingIdx] = approvedSlide;
    } else {
      approvedSlides.push(approvedSlide);
    }
    metadata.approvedSlides = approvedSlides;
  }

  // Add new slide to outline
  const newSlideNumber = outline.slides.length + 1;
  const newSlide: OutlineSlide = {
    slide_number: newSlideNumber,
    title: slideDescription,
    purpose: slideDescription,
    key_points: [slideDescription],
    speaker_notes_hint: "",
  };

  const updatedOutline: OutlineResult = {
    ...outline,
    slides: [...outline.slides, newSlide],
  };

  // Show updated structure
  const outlineText = updatedOutline.slides
    .map((s, i) => `**${i + 1}. ${s.title}**\n   ${s.purpose}`)
    .join("\n\n");

  writer({ type: "token", data: `\n\n✅ Текущий слайд утверждён!\n\n📋 **Обновлённая структура: «${updatedOutline.presentation_title}»**\n\n${outlineText}\n\nВсего слайдов: ${updatedOutline.slides.length}\n\nПодтвердите структуру, чтобы продолжить работу с новым слайдом.` });

  await updateChatSession(sessionId, {
    phase: "step_structure",
    metadata: {
      ...metadata,
      outline: updatedOutline,
      currentSlideDesign: undefined,
      proposedContent: undefined,
      // Keep currentSlideIndex pointing to the next slide to process after structure approval
      pendingSlideIndex: slideIndex + 1,
    },
  });

  const msg: ChatMessage = {
    role: "assistant",
    content: `📋 Обновлённая структура с новым слайдом «${slideDescription}»`,
    timestamp: Date.now(),
    actions: [
      { id: "approve_structure", label: "✅ Утвердить структуру", variant: "default" },
      { id: "regenerate_structure", label: "🔄 Пересоздать", variant: "outline" },
    ],
  };
  await appendMessage(sessionId, msg);
  writer({ type: "actions", data: msg.actions });
  writer({ type: "done", data: null });
}

/**
 * Finalize the step-by-step presentation — assemble all approved slides and upload.
 */
async function finalizeStepPresentation(
  sessionId: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const metadata = (session.metadata as Record<string, any>) || {};
  const outline: OutlineResult = metadata.outline;
  const approvedSlides: Array<{ slideNumber: number; layoutId: string; data: Record<string, any>; html: string }> = metadata.approvedSlides || [];
  const themeCss: string = metadata.themeCss || "";
  const themePresetId: string = metadata.themePresetId || "corporate_blue";
  const presentationId = session.presentationId || "";

  // Clear slide progress — all slides are done
  writer({ type: "slide_progress", data: null });

  if (approvedSlides.length === 0) {
    writer({ type: "token", data: "❌ Нет утверждённых слайдов." });
    writer({ type: "done", data: null });
    return;
  }

  writer({ type: "progress", data: { percent: 90, message: "Сборка финальной презентации..." } });

  try {
    // Sort slides by slideNumber
    const sortedSlides = [...approvedSlides].sort((a, b) => a.slideNumber - b.slideNumber);

    // Upload full HTML to S3
    const themePreset = getThemePreset(themePresetId);
    const fullHtml = renderPresentation(
      sortedSlides.map(s => ({
        layoutId: s.layoutId,
        data: s.data,
        html: s.html,
      })),
      themeCss || themePreset.cssVariables,
      outline?.presentation_title || "Presentation",
      metadata.plannerResult?.language || "ru",
      themePreset.fontsUrl,
    );

    let htmlUrl: string | undefined;
    try {
      const fileKey = `presentations/${presentationId}/presentation-${nanoid(8)}.html`;
      const uploaded = await storagePut(fileKey, fullHtml, "text/html");
      htmlUrl = uploaded.url;
      console.log(`[ChatOrchestrator] Step-by-slide: Uploaded HTML to S3: ${htmlUrl}`);
    } catch (uploadErr: any) {
      console.error(`[ChatOrchestrator] Step-by-slide: Failed to upload HTML to S3:`, uploadErr);
    }

    // Update presentation in DB
    await updatePresentationProgress(presentationId, {
      status: "completed",
      currentStep: "completed",
      progressPercent: 100,
      title: outline?.presentation_title || "Presentation",
      language: metadata.plannerResult?.language || "ru",
      themeCss,
      finalHtmlSlides: sortedSlides.map(s => ({
        layoutId: s.layoutId,
        data: s.data,
        html: s.html,
      })),
      slideCount: sortedSlides.length,
      ...(htmlUrl ? { resultUrls: { html_preview: htmlUrl } } : {}),
    });

    // Send all slide previews
    for (const slide of sortedSlides) {
      writer({
        type: "slide_preview",
        data: {
          slideNumber: slide.slideNumber,
          title: `Слайд ${slide.slideNumber}`,
          html: slide.html,
        },
      });
    }

    writer({ type: "token", data: `\n\n✅ Презентация «${outline?.presentation_title}» готова! ${sortedSlides.length} слайдов.` });

    writer({
      type: "presentation_link",
      data: {
        presentationId,
        title: outline?.presentation_title,
        slideCount: sortedSlides.length,
      },
    });

    const doneMsg: ChatMessage = {
      role: "assistant",
      content: `✅ Презентация «${outline?.presentation_title}» готова! ${sortedSlides.length} слайдов создано.`,
      timestamp: Date.now(),
      presentationLink: `/view/${presentationId}`,
      actions: [
        { id: "view_presentation", label: "👁 Открыть презентацию", variant: "default" },
        { id: "new_presentation", label: "➕ Создать новую", variant: "outline" },
      ],
    };
    await appendMessage(sessionId, doneMsg);
    writer({ type: "actions", data: doneMsg.actions });

    await updateChatSession(sessionId, { phase: "completed" });
  } catch (err: any) {
    console.error("[ChatOrchestrator] Step-by-slide finalization failed:", err);
    writer({ type: "token", data: `\n\n❌ Ошибка при сборке презентации: ${err.message}` });
  }

  writer({ type: "done", data: null });
}
