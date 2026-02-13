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
import { getChatSession, updateChatSession, appendMessage } from "./chatDb";
import { generatePresentation, type PipelineProgress } from "./pipeline/generator";
import {
  createPresentation,
  updatePresentationProgress,
} from "./presentationDb";
import { renderPresentation, renderSlide, BASE_CSS } from "./pipeline/templateEngine";
import { getThemePreset } from "./pipeline/themes";
import { pickLayoutForPreview, buildPreviewData } from "./interactiveRoutes";

// ═══════════════════════════════════════════════════════
// SSE EVENT TYPES
// ═══════════════════════════════════════════════════════

export interface SSEEvent {
  type: "token" | "actions" | "slide_preview" | "progress" | "done" | "error" | "presentation_link";
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

  // Save user message
  const userMsg: ChatMessage = {
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
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
  // Stream AI response acknowledging the topic
  const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));

  const systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${MODE_SELECTION_PROMPT}\n\nТема пользователя: "${userMessage}"`;

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

  // Send starting message
  writer({ type: "token", data: "🚀 Запускаю быструю генерацию! Это займёт около 60 секунд.\n\n" });

  // Create presentation record
  const presentation = await createPresentation({
    prompt: topic,
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
    // Run the pipeline with progress streaming + slide previews
    const result = await generatePresentation(
      topic,
      { themePreset: "auto", enableImages: true },
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

    // Save to DB
    await updatePresentationProgress(presentation.presentationId, {
      status: "completed",
      currentStep: "completed",
      progressPercent: 100,
      title: result.title,
      language: result.language,
      themeCss: result.themeCss,
      finalHtmlSlides: result.slides.map(s => ({
        layout_id: s.layoutId,
        data: s.data,
        html: s.html,
      })),
      slideCount: result.slides.length,
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

  // Create presentation record
  const presentation = await createPresentation({
    prompt: session.topic || "",
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
    const plannerResult = await runPlanner(session.topic || "");

    writer({ type: "progress", data: { percent: 30, message: "Создание структуры..." } });
    const outline = await runOutline(session.topic || "", plannerResult.branding, plannerResult.language || "ru");

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
 */
async function handleStructureApproval(
  sessionId: string,
  userMessage: string,
  writer: SSEWriter,
): Promise<void> {
  const session = await getChatSession(sessionId);
  if (!session) return;

  const lowerMsg = userMessage.toLowerCase();
  const isApprove =
    lowerMsg.includes("утверд") ||
    lowerMsg.includes("approve") ||
    lowerMsg.includes("да") ||
    lowerMsg.includes("ок") ||
    lowerMsg.includes("approve_structure") ||
    lowerMsg.includes("✅") ||
    lowerMsg.includes("хорошо") ||
    lowerMsg.includes("отлично");

  if (isApprove) {
    // Proceed to full generation with approved structure
    writer({ type: "token", data: "✅ Структура утверждена! Запускаю генерацию контента и дизайна...\n\n" });

    await updateChatSession(sessionId, { phase: "generating" });

    const metadata = session.metadata as any || {};
    const topic = session.topic || "";

    try {
      const result = await generatePresentation(
        topic,
        { themePreset: "auto", enableImages: true },
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
          console.log(`[ChatOrchestrator] Sending slide_preview for slide ${slideNum} (step mode)`);
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

      const presentationId = session.presentationId || "";

      await updatePresentationProgress(presentationId, {
        status: "completed",
        currentStep: "completed",
        progressPercent: 100,
        title: result.title,
        language: result.language,
        themeCss: result.themeCss,
        finalHtmlSlides: result.slides.map(s => ({
          layout_id: s.layoutId,
          data: s.data,
          html: s.html,
        })),
        slideCount: result.slides.length,
      });

      // Send all slide previews at completion (step-by-step mode)
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

      writer({ type: "token", data: `\n\n✅ Презентация «${result.title}» готова! ${result.slides.length} слайдов.` });

      writer({
        type: "presentation_link",
        data: {
          presentationId,
          title: result.title,
          slideCount: result.slides.length,
        },
      });

      const doneMsg: ChatMessage = {
        role: "assistant",
        content: `✅ Презентация «${result.title}» готова! ${result.slides.length} слайдов создано.`,
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
      writer({ type: "token", data: `\n\n❌ Ошибка: ${err.message}` });
      await updateChatSession(sessionId, { phase: "step_structure" });
    }
  } else {
    // User wants changes — regenerate or modify
    writer({ type: "token", data: "🔄 Пересоздаю структуру с учётом ваших пожеланий...\n\n" });
    await updateChatSession(sessionId, { phase: "generating" });
    await startStepByStepGeneration(sessionId, writer);
  }

  writer({ type: "done", data: null });
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

  // Check if we're in step_structure phase
  if (session.phase === "step_structure") {
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    await handleStructureApproval(sessionId, lastUserMsg, writer);
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
    case "approve_structure":
      return processMessage(sessionId, "✅ Утвердить структуру", writer);
    case "regenerate_structure":
      return processMessage(sessionId, "🔄 Пересоздать структуру", writer);
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
