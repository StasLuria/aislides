/**
 * Chat Orchestrator — LLM-powered agent that manages the conversation flow
 * for the unified chat-based presentation creator.
 *
 * State machine:
 *   greeting → topic_received → mode_selection → (quick | stepbystep)
 *   quick: generating_quick → completed
 *   stepbystep: structure_review → slide_content → slide_design → (loop) → completed
 */
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import {
  getChatSession,
  updateChatSession,
  type ChatMessage,
  type ChatWorkingState,
} from "./chatDb";
import { generatePresentation, type PipelineProgress } from "./pipeline/generator";
import {
  createPresentation,
  updatePresentationProgress,
} from "./presentationDb";
import { renderSlide, renderPresentation } from "./pipeline/templateEngine";
import { wsManager } from "./wsManager";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ChatResponse {
  messages: ChatMessage[];
  phase: string;
  presentationId?: string;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function makeMsg(
  role: "assistant" | "system",
  content: string,
  data?: ChatMessage["data"],
): ChatMessage {
  return { id: nanoid(8), role, content, data, timestamp: Date.now() };
}

function makeUserMsg(content: string): ChatMessage {
  return { id: nanoid(8), role: "user", content, timestamp: Date.now() };
}

// ═══════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════

export async function processUserMessage(
  sessionId: string,
  userText: string,
): Promise<ChatResponse> {
  const session = await getChatSession(sessionId);
  if (!session) throw new Error("Chat session not found");

  const messages: ChatMessage[] = (session.messages as ChatMessage[]) || [];
  const workingState: ChatWorkingState = (session.workingState as ChatWorkingState) || {};

  // Add user message
  messages.push(makeUserMsg(userText));

  const phase = session.phase;
  let newMessages: ChatMessage[] = [];
  let newPhase = phase;
  let presentationId = session.presentationId || undefined;

  try {
    switch (phase) {
      case "greeting":
      case "topic_received": {
        // User sent a topic — ask for mode selection
        const topic = userText.trim();
        workingState.config = workingState.config || {};

        // Use LLM to understand intent and extract topic
        const intentResult = await classifyIntent(topic, messages);

        if (intentResult.type === "topic") {
          newMessages.push(
            makeMsg("assistant", `Отлично! Тема: **${intentResult.topic}**\n\nКак будем работать?`, {
              type: "mode_selection",
              buttons: [
                { label: "⚡ Быстро (~60 сек)", action: "quick", variant: "default" },
                { label: "🔄 Пошагово", action: "stepbystep", variant: "outline" },
              ],
            }),
          );
          workingState.title = intentResult.topic;
          newPhase = "mode_selection";
        } else if (intentResult.type === "clarification") {
          newMessages.push(makeMsg("assistant", intentResult.response));
          newPhase = "greeting";
        } else {
          newMessages.push(
            makeMsg("assistant", "Опишите тему презентации, и я помогу её создать. Например: \"Стратегия развития компании на 2026 год\" или \"Кибербезопасность в финансовом секторе\"."),
          );
          newPhase = "greeting";
        }
        break;
      }

      case "mode_selection": {
        const lower = userText.toLowerCase().trim();
        const isQuick = lower === "quick" || lower.includes("быстр") || lower.includes("сразу") || lower.includes("автомат");
        const isStep = lower === "stepbystep" || lower.includes("пошаг") || lower.includes("по шаг") || lower.includes("вместе");

        if (isQuick) {
          newPhase = "generating_quick";
          newMessages.push(
            makeMsg("assistant", "Запускаю быструю генерацию! Это займёт около 60 секунд. Вы увидите прогресс прямо здесь.", {
              type: "progress",
              progress: 0,
            }),
          );

          // Create presentation record and start generation in background
          const topic = workingState.title || "Презентация";
          const pres = await createPresentation({
            prompt: topic,
            mode: "batch",
            config: workingState.config || {},
          });
          presentationId = pres.presentationId;

          // Start async generation
          startQuickGeneration(sessionId, presentationId, topic, workingState.config || {});
        } else if (isStep) {
          newPhase = "structure_review";
          newMessages.push(
            makeMsg("assistant", "Отлично, работаем пошагово! Сейчас создам структуру презентации..."),
          );

          // Generate structure via LLM
          const topic = workingState.title || "Презентация";
          const structure = await generateStructure(topic);
          workingState.outline = structure;

          const structureText = structure
            .map((s, i) => `**${i + 1}. ${s.title}**\n_${s.description}_`)
            .join("\n\n");

          newMessages.push(
            makeMsg(
              "assistant",
              `Вот предложенная структура (${structure.length} слайдов):\n\n${structureText}\n\nМожете изменить, добавить или удалить слайды. Когда всё устроит — напишите **"готово"**.`,
              {
                type: "structure",
                structure: structure.map((s, i) => ({
                  slideNumber: i + 1,
                  title: s.title,
                  layoutHint: s.layoutHint,
                })),
                buttons: [
                  { label: "✅ Готово, начинаем", action: "approve_structure", variant: "default" },
                ],
              },
            ),
          );
        } else {
          // Try to understand what user wants
          newMessages.push(
            makeMsg("assistant", "Выберите режим работы:", {
              type: "mode_selection",
              buttons: [
                { label: "⚡ Быстро (~60 сек)", action: "quick", variant: "default" },
                { label: "🔄 Пошагово", action: "stepbystep", variant: "outline" },
              ],
            }),
          );
        }
        break;
      }

      case "structure_review": {
        const lower = userText.toLowerCase().trim();
        const isApprove = lower === "approve_structure" || lower === "готово" || lower.includes("начинаем") || lower.includes("утвержда") || lower.includes("ок") || lower.includes("давай");

        if (isApprove && workingState.outline && workingState.outline.length > 0) {
          // Move to first slide content
          workingState.currentSlideIndex = 0;
          workingState.slides = [];
          newPhase = "slide_content";

          const slide = workingState.outline[0];
          newMessages.push(
            makeMsg(
              "assistant",
              `Структура утверждена! Переходим к слайду **1/${workingState.outline.length}**: **${slide.title}**\n\nСейчас сгенерирую контент для этого слайда...`,
            ),
          );

          // Generate content for slide 1
          const slideContent = await generateSlideContent(
            workingState.title || "",
            slide,
            workingState.outline,
            0,
          );

          const contentPreview = formatSlideContentPreview(slideContent);
          newMessages.push(
            makeMsg(
              "assistant",
              `Контент для слайда 1:\n\n${contentPreview}\n\nМожете отредактировать или написать **"готово"** для перехода к дизайну.`,
              {
                type: "slide_preview",
                slideIndex: 0,
                buttons: [
                  { label: "✅ Готово", action: "approve_content", variant: "default" },
                  { label: "🔄 Перегенерировать", action: "regenerate_content", variant: "outline" },
                ],
              },
            ),
          );

          // Store slide content in working state
          if (!workingState.slides) workingState.slides = [];
          workingState.slides[0] = { layoutId: slideContent.layoutId, data: slideContent.data, html: "" };
        } else {
          // User wants to modify structure — use LLM to understand the change
          const modifiedStructure = await modifyStructure(
            workingState.outline || [],
            userText,
            workingState.title || "",
          );
          workingState.outline = modifiedStructure;

          const structureText = modifiedStructure
            .map((s, i) => `**${i + 1}. ${s.title}**\n_${s.description}_`)
            .join("\n\n");

          newMessages.push(
            makeMsg(
              "assistant",
              `Обновлённая структура (${modifiedStructure.length} слайдов):\n\n${structureText}\n\nВсё устроит? Напишите **"готово"** или продолжайте вносить изменения.`,
              {
                type: "structure",
                structure: modifiedStructure.map((s, i) => ({
                  slideNumber: i + 1,
                  title: s.title,
                  layoutHint: s.layoutHint,
                })),
                buttons: [
                  { label: "✅ Готово, начинаем", action: "approve_structure", variant: "default" },
                ],
              },
            ),
          );
        }
        break;
      }

      case "slide_content": {
        const lower = userText.toLowerCase().trim();
        const idx = workingState.currentSlideIndex || 0;
        const isApprove = lower === "approve_content" || lower === "готово" || lower.includes("дальше") || lower.includes("ок");
        const isRegenerate = lower === "regenerate_content" || lower.includes("перегенер") || lower.includes("заново");

        if (isRegenerate) {
          const slide = workingState.outline?.[idx];
          if (slide) {
            newMessages.push(makeMsg("assistant", "Перегенерирую контент..."));
            const slideContent = await generateSlideContent(
              workingState.title || "",
              slide,
              workingState.outline || [],
              idx,
            );
            const contentPreview = formatSlideContentPreview(slideContent);
            if (workingState.slides) {
              workingState.slides[idx] = { layoutId: slideContent.layoutId, data: slideContent.data, html: "" };
            }
            newMessages.push(
              makeMsg(
                "assistant",
                `Новый контент для слайда ${idx + 1}:\n\n${contentPreview}\n\nНапишите **"готово"** или внесите правки.`,
                {
                  type: "slide_preview",
                  slideIndex: idx,
                  buttons: [
                    { label: "✅ Готово", action: "approve_content", variant: "default" },
                    { label: "🔄 Перегенерировать", action: "regenerate_content", variant: "outline" },
                  ],
                },
              ),
            );
          }
        } else if (isApprove) {
          // Move to slide design phase
          newPhase = "slide_design";
          newMessages.push(makeMsg("assistant", `Контент утверждён! Генерирую дизайн слайда ${idx + 1}...`));

          // Render the slide HTML
          const slideData = workingState.slides?.[idx];
          if (slideData) {
            const html = renderSlide(slideData.layoutId, {
              ...slideData.data,
              _slideNumber: idx + 1,
              _totalSlides: workingState.outline?.length || 0,
              _presentationTitle: workingState.title || "",
            });
            slideData.html = html;

            newMessages.push(
              makeMsg(
                "assistant",
                `Вот превью слайда ${idx + 1}. Напишите **"готово"** для перехода к следующему слайду, или опишите изменения.`,
                {
                  type: "slide_preview",
                  slideHtml: html,
                  slideIndex: idx,
                  buttons: [
                    { label: "✅ Готово", action: "approve_design", variant: "default" },
                    { label: "🔄 Другой макет", action: "change_layout", variant: "outline" },
                  ],
                },
              ),
            );
          }
        } else {
          // User wants to edit content — apply changes via LLM
          const slide = workingState.outline?.[idx];
          const currentData = workingState.slides?.[idx];
          if (slide && currentData) {
            const updatedContent = await applyContentEdit(
              currentData.data,
              currentData.layoutId,
              userText,
              slide,
            );
            workingState.slides![idx] = { layoutId: updatedContent.layoutId, data: updatedContent.data, html: "" };
            const contentPreview = formatSlideContentPreview(updatedContent);
            newMessages.push(
              makeMsg(
                "assistant",
                `Обновлённый контент:\n\n${contentPreview}\n\nНапишите **"готово"** или продолжайте вносить правки.`,
                {
                  type: "slide_preview",
                  slideIndex: idx,
                  buttons: [
                    { label: "✅ Готово", action: "approve_content", variant: "default" },
                  ],
                },
              ),
            );
          }
        }
        break;
      }

      case "slide_design": {
        const lower = userText.toLowerCase().trim();
        const idx = workingState.currentSlideIndex || 0;
        const totalSlides = workingState.outline?.length || 0;
        const isApprove = lower === "approve_design" || lower === "готово" || lower.includes("дальше") || lower.includes("ок");

        if (isApprove) {
          // Move to next slide or finish
          const nextIdx = idx + 1;
          if (nextIdx < totalSlides) {
            workingState.currentSlideIndex = nextIdx;
            newPhase = "slide_content";

            const nextSlide = workingState.outline![nextIdx];
            newMessages.push(
              makeMsg(
                "assistant",
                `Слайд ${idx + 1} готов! ✓\n\nПереходим к слайду **${nextIdx + 1}/${totalSlides}**: **${nextSlide.title}**\n\nГенерирую контент...`,
              ),
            );

            // Generate content for next slide
            const slideContent = await generateSlideContent(
              workingState.title || "",
              nextSlide,
              workingState.outline || [],
              nextIdx,
            );
            const contentPreview = formatSlideContentPreview(slideContent);
            if (!workingState.slides) workingState.slides = [];
            workingState.slides[nextIdx] = { layoutId: slideContent.layoutId, data: slideContent.data, html: "" };

            newMessages.push(
              makeMsg(
                "assistant",
                `Контент для слайда ${nextIdx + 1}:\n\n${contentPreview}\n\nНапишите **"готово"** или внесите правки.`,
                {
                  type: "slide_preview",
                  slideIndex: nextIdx,
                  buttons: [
                    { label: "✅ Готово", action: "approve_content", variant: "default" },
                    { label: "🔄 Перегенерировать", action: "regenerate_content", variant: "outline" },
                  ],
                },
              ),
            );
          } else {
            // All slides done — assemble presentation
            newPhase = "completed";
            newMessages.push(makeMsg("assistant", "Все слайды готовы! Собираю финальную презентацию..."));

            // Create presentation record
            const pres = await createPresentation({
              prompt: workingState.title || "Презентация",
              mode: "interactive",
              config: workingState.config || {},
            });
            presentationId = pres.presentationId;

            // Assemble
            const slides = workingState.slides || [];
            const themeCss = workingState.themeCss || getDefaultThemeCss();
            const fullHtml = renderPresentation(
              slides,
              themeCss,
              workingState.title || "Презентация",
              workingState.language || "ru",
              workingState.fontsUrl,
            );

            await updatePresentationProgress(presentationId, {
              status: "completed",
              currentStep: "completed",
              progressPercent: 100,
              title: workingState.title || "Презентация",
              themeCss,
              finalHtmlSlides: slides as any,
              pipelineState: { outline: workingState.outline } as any,
              slideCount: slides.length,
            });

            newMessages.push(
              makeMsg(
                "assistant",
                `Презентация **"${workingState.title}"** готова! ${slides.length} слайдов.\n\nМожете открыть её для просмотра и редактирования.`,
                {
                  type: "final_result",
                  presentationId,
                  buttons: [
                    { label: "📊 Открыть презентацию", action: `open_presentation:${presentationId}`, variant: "default" },
                  ],
                },
              ),
            );
          }
        } else {
          // User wants to change design
          newMessages.push(
            makeMsg("assistant", "Изменение дизайна пока в разработке. Напишите **\"готово\"** для перехода к следующему слайду.", {
              buttons: [
                { label: "✅ Готово", action: "approve_design", variant: "default" },
              ],
            }),
          );
        }
        break;
      }

      case "generating_quick": {
        // User sent a message while quick generation is in progress
        newMessages.push(
          makeMsg("assistant", "Генерация идёт! Пожалуйста, подождите завершения. Вы увидите результат прямо здесь."),
        );
        break;
      }

      case "completed": {
        // User wants to do something after completion
        const lower = userText.toLowerCase().trim();
        if (lower.includes("нов") || lower.includes("ещё") || lower.includes("друг")) {
          // Start new presentation
          newPhase = "greeting";
          workingState.outline = undefined;
          workingState.slides = undefined;
          workingState.currentSlideIndex = undefined;
          workingState.title = undefined;
          presentationId = undefined;
          newMessages.push(
            makeMsg("assistant", "Начинаем новую презентацию! Опишите тему."),
          );
        } else {
          newMessages.push(
            makeMsg("assistant", "Презентация готова! Вы можете открыть её для просмотра, или напишите новую тему для создания ещё одной презентации.", {
              buttons: presentationId ? [
                { label: "📊 Открыть презентацию", action: `open_presentation:${presentationId}`, variant: "default" },
                { label: "➕ Новая презентация", action: "new_presentation", variant: "outline" },
              ] : [
                { label: "➕ Новая презентация", action: "new_presentation", variant: "outline" },
              ],
            }),
          );
        }
        break;
      }

      default: {
        newMessages.push(
          makeMsg("assistant", "Произошла ошибка. Начнём сначала — опишите тему презентации."),
        );
        newPhase = "greeting";
      }
    }
  } catch (err) {
    console.error("[ChatOrchestrator] Error:", err);
    newMessages.push(
      makeMsg("assistant", "Произошла ошибка при обработке. Попробуйте ещё раз.", {
        type: "error",
      }),
    );
  }

  // Persist
  messages.push(...newMessages);
  await updateChatSession(sessionId, {
    phase: newPhase as any,
    messages,
    workingState,
    presentationId,
    topic: workingState.title,
    mode: newPhase === "generating_quick" ? "quick" : (newPhase === "structure_review" || newPhase === "slide_content" || newPhase === "slide_design") ? "stepbystep" : session.mode as any,
  });

  return {
    messages: newMessages,
    phase: newPhase,
    presentationId,
  };
}

// ═══════════════════════════════════════════════════════
// LLM HELPERS
// ═══════════════════════════════════════════════════════

async function classifyIntent(
  text: string,
  history: ChatMessage[],
): Promise<{ type: "topic" | "clarification" | "other"; topic: string; response: string }> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a presentation creation assistant. Classify the user's message:
- If it's a presentation topic/request, extract the topic and return type "topic"
- If it's a question or needs clarification, return type "clarification" with a helpful response
- Otherwise return type "other"

Respond in JSON: { "type": "topic"|"clarification"|"other", "topic": "extracted topic", "response": "response text in Russian" }`,
      },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intent_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["topic", "clarification", "other"] },
            topic: { type: "string" },
            response: { type: "string" },
          },
          required: ["type", "topic", "response"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    return JSON.parse(result.choices[0].message.content as string);
  } catch {
    return { type: "topic", topic: text, response: "" };
  }
}

async function generateStructure(
  topic: string,
): Promise<Array<{ slideNumber: number; title: string; description: string; layoutHint: string; speakerNotes?: string }>> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a presentation structure expert. Create a presentation outline for the given topic.
Return 8-12 slides with clear titles and descriptions. Include a title slide first and a conclusion/CTA slide last.
For layoutHint, suggest one of: title-slide, text-slide, two-column, checklist, comparison, stats-chart, chart-text, image-text, process-steps, timeline-horizontal, quote-slide, final-slide.

Respond in JSON: { "slides": [{ "slideNumber": 1, "title": "...", "description": "...", "layoutHint": "..." }] }
Write all content in Russian.`,
      },
      { role: "user", content: `Тема: ${topic}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "presentation_structure",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slideNumber: { type: "integer" },
                  title: { type: "string" },
                  description: { type: "string" },
                  layoutHint: { type: "string" },
                },
                required: ["slideNumber", "title", "description", "layoutHint"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const parsed = JSON.parse(result.choices[0].message.content as string);
    return parsed.slides;
  } catch {
    return [
      { slideNumber: 1, title: topic, description: "Титульный слайд", layoutHint: "title-slide" },
      { slideNumber: 2, title: "Введение", description: "Обзор темы", layoutHint: "text-slide" },
      { slideNumber: 3, title: "Заключение", description: "Итоги и выводы", layoutHint: "final-slide" },
    ];
  }
}

async function modifyStructure(
  currentOutline: Array<{ slideNumber: number; title: string; description: string; layoutHint: string }>,
  userRequest: string,
  topic: string,
): Promise<Array<{ slideNumber: number; title: string; description: string; layoutHint: string }>> {
  const currentStructure = currentOutline.map(s => `${s.slideNumber}. ${s.title}: ${s.description}`).join("\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a presentation structure expert. The user wants to modify the current presentation structure.
Apply their requested changes and return the updated structure.
Keep the same JSON format. Write all content in Russian.

Current structure:
${currentStructure}

Respond in JSON: { "slides": [{ "slideNumber": 1, "title": "...", "description": "...", "layoutHint": "..." }] }`,
      },
      { role: "user", content: userRequest },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "modified_structure",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slideNumber: { type: "integer" },
                  title: { type: "string" },
                  description: { type: "string" },
                  layoutHint: { type: "string" },
                },
                required: ["slideNumber", "title", "description", "layoutHint"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const parsed = JSON.parse(result.choices[0].message.content as string);
    return parsed.slides;
  } catch {
    return currentOutline;
  }
}

async function generateSlideContent(
  presentationTitle: string,
  slide: { slideNumber: number; title: string; description: string; layoutHint: string },
  outline: Array<{ slideNumber: number; title: string; description: string; layoutHint: string }>,
  slideIndex: number,
): Promise<{ layoutId: string; data: Record<string, any> }> {
  const outlineContext = outline.map(s => `${s.slideNumber}. ${s.title}`).join(", ");
  const layoutId = slide.layoutHint || "text-slide";

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a presentation content writer. Generate content for a single slide.
Presentation: "${presentationTitle}"
Full outline: ${outlineContext}
Current slide: #${slide.slideNumber} "${slide.title}" — ${slide.description}
Target layout: ${layoutId}

Generate appropriate data for the layout. Common fields:
- title: slide title (string)
- description: subtitle or intro text (string)
- bullets: array of { title, text } for list items
- items: array of objects for checklist/comparison layouts
- stats: array of { value, label } for statistics

Return JSON with "layoutId" and "data" fields. Write all text in Russian.`,
      },
      { role: "user", content: `Создай контент для слайда "${slide.title}": ${slide.description}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "slide_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            layoutId: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["layoutId", "data"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const parsed = JSON.parse(result.choices[0].message.content as string);
    return { layoutId: parsed.layoutId || layoutId, data: parsed.data || { title: slide.title } };
  } catch {
    return {
      layoutId,
      data: {
        title: slide.title,
        description: slide.description,
        bullets: [{ title: "Пункт 1", text: "Описание пункта" }],
      },
    };
  }
}

async function applyContentEdit(
  currentData: Record<string, any>,
  layoutId: string,
  userRequest: string,
  slide: { title: string; description: string },
): Promise<{ layoutId: string; data: Record<string, any> }> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a presentation content editor. The user wants to modify the current slide content.
Current layout: ${layoutId}
Current data: ${JSON.stringify(currentData)}

Apply the user's requested changes and return the updated content.
Return JSON with "layoutId" and "data" fields. Write all text in Russian.`,
      },
      { role: "user", content: userRequest },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "edited_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            layoutId: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["layoutId", "data"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const parsed = JSON.parse(result.choices[0].message.content as string);
    return { layoutId: parsed.layoutId || layoutId, data: parsed.data || currentData };
  } catch {
    return { layoutId, data: currentData };
  }
}

function formatSlideContentPreview(slide: { layoutId: string; data: Record<string, any> }): string {
  const d = slide.data;
  let preview = `**Макет:** ${slide.layoutId}\n`;
  if (d.title) preview += `**Заголовок:** ${d.title}\n`;
  if (d.description) preview += `**Описание:** ${d.description}\n`;
  if (d.bullets && Array.isArray(d.bullets)) {
    preview += `**Пункты:**\n`;
    d.bullets.forEach((b: any, i: number) => {
      const title = typeof b === "string" ? b : b.title || b.text || "";
      const text = typeof b === "string" ? "" : b.text || "";
      preview += `  ${i + 1}. ${title}${text ? ` — ${text}` : ""}\n`;
    });
  }
  if (d.items && Array.isArray(d.items)) {
    preview += `**Элементы:**\n`;
    d.items.forEach((item: any, i: number) => {
      preview += `  ${i + 1}. ${item.title || item.label || item.name || JSON.stringify(item)}\n`;
    });
  }
  if (d.stats && Array.isArray(d.stats)) {
    preview += `**Статистика:**\n`;
    d.stats.forEach((s: any) => {
      preview += `  • ${s.value} — ${s.label}\n`;
    });
  }
  return preview;
}

function getDefaultThemeCss(): string {
  return `:root {
  --primary-accent-color: #6366f1;
  --secondary-accent-color: #8b5cf6;
  --text-heading-color: #111827;
  --text-body-color: #4b5563;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-card: #ffffff;
  --border-color: #e5e7eb;
}`;
}

// ═══════════════════════════════════════════════════════
// QUICK GENERATION (async background)
// ═══════════════════════════════════════════════════════

async function startQuickGeneration(
  sessionId: string,
  presentationId: string,
  topic: string,
  config: Record<string, any>,
): Promise<void> {
  // Run in background — don't await
  (async () => {
    try {
      await updatePresentationProgress(presentationId, {
        status: "processing",
        currentStep: "planning",
        progressPercent: 5,
      });

      const result = await generatePresentation(
        topic,
        {
          themePreset: config.theme_preset || "auto",
          enableImages: config.enable_images !== false,
          sourceContent: config.source_content,
        },
        (progress: PipelineProgress) => {
          // Send progress via WebSocket
          wsManager.sendProgress(presentationId, {
            node_name: progress.nodeName,
            current_step: progress.currentStep,
            progress_percentage: progress.progressPercent,
            message: progress.message,
            html_content: progress.slidePreview,
          });

          // Also update chat session messages with progress
          updateChatProgressMessage(sessionId, progress).catch(console.error);
        },
      );

      // Save result
      await updatePresentationProgress(presentationId, {
        status: "completed",
        currentStep: "completed",
        progressPercent: 100,
        title: result.title,
        language: result.language,
        themeCss: result.themeCss,
        finalHtmlSlides: result.slides as any,
        slideCount: result.slides.length,
      });

      // Update chat with completion message
      const session = await getChatSession(sessionId);
      if (session) {
        const messages = (session.messages as ChatMessage[]) || [];
        messages.push(
          makeMsg(
            "assistant",
            `Презентация **"${result.title}"** готова! ${result.slides.length} слайдов.\n\nМожете открыть для просмотра и редактирования.`,
            {
              type: "final_result",
              presentationId,
              buttons: [
                { label: "📊 Открыть презентацию", action: `open_presentation:${presentationId}`, variant: "default" },
                { label: "➕ Новая презентация", action: "new_presentation", variant: "outline" },
              ],
            },
          ),
        );
        await updateChatSession(sessionId, {
          phase: "completed",
          messages,
          presentationId,
        });
      }

      wsManager.sendCompleted(presentationId, {
        result_urls: {},
        slide_count: result.slides.length,
        title: result.title,
      });
    } catch (err: any) {
      console.error("[ChatOrchestrator] Quick generation failed:", err);

      await updatePresentationProgress(presentationId, {
        status: "failed",
        errorInfo: { message: err.message } as any,
      });

      // Update chat with error
      const session = await getChatSession(sessionId);
      if (session) {
        const messages = (session.messages as ChatMessage[]) || [];
        messages.push(
          makeMsg("assistant", `Ошибка генерации: ${err.message}\n\nПопробуйте ещё раз или выберите пошаговый режим.`, {
            type: "error",
            buttons: [
              { label: "🔄 Попробовать снова", action: "retry_quick", variant: "default" },
            ],
          }),
        );
        await updateChatSession(sessionId, { phase: "error", messages });
      }

      wsManager.sendError(presentationId, {
        error_message: err.message,
        error_type: "generation_error",
      });
    }
  })();
}

async function updateChatProgressMessage(sessionId: string, progress: PipelineProgress): Promise<void> {
  // Throttle updates — only update every 10%
  if (progress.progressPercent % 10 !== 0 && progress.progressPercent !== 100) return;

  const session = await getChatSession(sessionId);
  if (!session) return;

  const messages = (session.messages as ChatMessage[]) || [];

  // Find and update the last progress message, or add new one
  const lastProgressIdx = messages.findLastIndex(
    (m) => m.role === "assistant" && m.data?.type === "progress",
  );

  const progressMsg = makeMsg(
    "assistant",
    `${progress.message || "Генерация..."} (${progress.progressPercent}%)`,
    { type: "progress", progress: progress.progressPercent },
  );

  if (lastProgressIdx >= 0) {
    messages[lastProgressIdx] = progressMsg;
  } else {
    messages.push(progressMsg);
  }

  await updateChatSession(sessionId, { messages });
}
