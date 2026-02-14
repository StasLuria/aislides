/**
 * OpenAPI 3.0 Specification for the Presentation Generator API.
 * Auto-serves Swagger UI at /api/docs and JSON spec at /api/docs/spec.json
 */
import { Express } from "express";
import swaggerUi from "swagger-ui-express";

const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Presentation Generator API",
    version: "2.0.0",
    description:
      "REST API для AI-генератора презентаций. 15-этапный мультиагентный пайплайн создаёт HTML-презентации из текстового промпта. Поддерживает автоматический и интерактивный режимы, чат-интерфейс, редактирование слайдов, экспорт в PPTX/PDF и пользовательские шаблоны.",
    contact: { name: "Presentation Generator Team" },
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Health", description: "Проверка состояния сервиса" },
    { name: "Presentations", description: "Создание, просмотр и управление презентациями" },
    { name: "Sharing", description: "Публичный доступ к презентациям по токену" },
    { name: "Export", description: "Экспорт презентаций в PPTX и PDF" },
    { name: "Slide Editing", description: "Редактирование отдельных слайдов" },
    { name: "Slide Versions", description: "История версий слайдов" },
    { name: "Interactive Mode", description: "Интерактивный режим создания с утверждением структуры" },
    { name: "Chat", description: "Чат-интерфейс для создания презентаций" },
    { name: "Templates", description: "Пользовательские HTML-шаблоны" },
  ],
  paths: {
    // ─── Health ───────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "healthCheck",
        responses: {
          200: {
            description: "Сервис работает",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "healthy" },
                    service: { type: "string", example: "presentation-generator" },
                    version: { type: "string", example: "2.0.0" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Presentations ────────────────────────────────────────
    "/api/v1/presentations": {
      post: {
        tags: ["Presentations"],
        summary: "Создать презентацию (SSE-стриминг прогресса)",
        operationId: "createPresentation",
        description:
          "Запускает генерацию презентации. Возвращает SSE-поток с прогрессом пайплайна. Финальное событие содержит presentation_id.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePresentationRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "SSE-поток прогресса генерации",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          400: { description: "Невалидный запрос" },
        },
      },
      get: {
        tags: ["Presentations"],
        summary: "Список презентаций",
        operationId: "listPresentations",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: {
            description: "Список презентаций",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    presentations: { type: "array", items: { $ref: "#/components/schemas/PresentationSummary" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/presentations/{id}": {
      get: {
        tags: ["Presentations"],
        summary: "Получить презентацию по ID",
        operationId: "getPresentation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Данные презентации", content: { "application/json": { schema: { $ref: "#/components/schemas/Presentation" } } } },
          404: { description: "Презентация не найдена" },
        },
      },
      delete: {
        tags: ["Presentations"],
        summary: "Удалить презентацию",
        operationId: "deletePresentation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Удалено" },
          404: { description: "Презентация не найдена" },
        },
      },
    },
    "/api/v1/presentations/{id}/html": {
      get: {
        tags: ["Presentations"],
        summary: "Получить полный HTML презентации",
        operationId: "getPresentationHtml",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "HTML-код презентации", content: { "text/html": { schema: { type: "string" } } } },
          404: { description: "Презентация не найдена" },
        },
      },
    },
    "/api/v1/presentations/{id}/retry": {
      post: {
        tags: ["Presentations"],
        summary: "Повторить генерацию неудачной презентации",
        operationId: "retryPresentation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "SSE-поток прогресса повторной генерации", content: { "text/event-stream": { schema: { type: "string" } } } },
          404: { description: "Презентация не найдена" },
        },
      },
    },

    // ─── Sharing ──────────────────────────────────────────────
    "/api/v1/presentations/{id}/share": {
      post: {
        tags: ["Sharing"],
        summary: "Включить/выключить публичный доступ",
        operationId: "toggleShare",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { enabled: { type: "boolean" } } } } },
        },
        responses: {
          200: { description: "Статус шаринга обновлён", content: { "application/json": { schema: { type: "object", properties: { share_token: { type: "string", nullable: true }, share_enabled: { type: "boolean" } } } } } },
        },
      },
      get: {
        tags: ["Sharing"],
        summary: "Получить статус шаринга",
        operationId: "getShareStatus",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Статус шаринга" },
        },
      },
    },
    "/api/v1/shared/{token}": {
      get: {
        tags: ["Sharing"],
        summary: "Получить презентацию по share-токену",
        operationId: "getSharedPresentation",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Данные презентации" },
          404: { description: "Токен не найден" },
        },
      },
    },
    "/api/v1/shared/{token}/slides": {
      get: {
        tags: ["Sharing"],
        summary: "Получить слайды по share-токену",
        operationId: "getSharedSlides",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Массив слайдов" }, 404: { description: "Не найдено" } },
      },
    },
    "/api/v1/shared/{token}/html": {
      get: {
        tags: ["Sharing"],
        summary: "Получить HTML по share-токену",
        operationId: "getSharedHtml",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "HTML-код" }, 404: { description: "Не найдено" } },
      },
    },

    // ─── Export ───────────────────────────────────────────────
    "/api/v1/presentations/{id}/export/pptx": {
      get: {
        tags: ["Export"],
        summary: "Экспорт в PPTX",
        operationId: "exportPptx",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "PPTX-файл", content: { "application/vnd.openxmlformats-officedocument.presentationml.presentation": { schema: { type: "string", format: "binary" } } } },
          404: { description: "Не найдено" },
        },
      },
    },
    "/api/v1/presentations/{id}/export/pdf": {
      get: {
        tags: ["Export"],
        summary: "Экспорт в PDF",
        operationId: "exportPdf",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "PDF-файл", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          404: { description: "Не найдено" },
        },
      },
    },
    "/api/v1/shared/{token}/export/pptx": {
      get: {
        tags: ["Export"],
        summary: "Экспорт shared-презентации в PPTX",
        operationId: "exportSharedPptx",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "PPTX-файл" }, 404: { description: "Не найдено" } },
      },
    },
    "/api/v1/shared/{token}/export/pdf": {
      get: {
        tags: ["Export"],
        summary: "Экспорт shared-презентации в PDF",
        operationId: "exportSharedPdf",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "PDF-файл" }, 404: { description: "Не найдено" } },
      },
    },

    // ─── Slide Editing ───────────────────────────────────────
    "/api/v1/presentations/{id}/slides": {
      get: {
        tags: ["Slide Editing"],
        summary: "Получить все слайды презентации",
        operationId: "getSlides",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Массив слайдов с данными и HTML" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}": {
      get: {
        tags: ["Slide Editing"],
        summary: "Получить конкретный слайд",
        operationId: "getSlide",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Данные слайда" }, 404: { description: "Не найдено" } },
      },
      put: {
        tags: ["Slide Editing"],
        summary: "Полное обновление слайда (данные + перерендер HTML)",
        operationId: "updateSlide",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/SlideUpdateRequest" } } },
        },
        responses: { 200: { description: "Обновлённый слайд" } },
      },
      patch: {
        tags: ["Slide Editing"],
        summary: "AI-редактирование слайда по текстовой инструкции",
        operationId: "aiEditSlide",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { instruction: { type: "string", description: "Текстовая инструкция для AI-редактирования" } }, required: ["instruction"] } } },
        },
        responses: { 200: { description: "Обновлённый слайд" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}/image": {
      post: {
        tags: ["Slide Editing"],
        summary: "Загрузить изображение на слайд",
        operationId: "uploadSlideImage",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" } } } } },
        },
        responses: { 200: { description: "Изображение загружено" } },
      },
      delete: {
        tags: ["Slide Editing"],
        summary: "Удалить изображение со слайда",
        operationId: "deleteSlideImage",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Изображение удалено" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}/editable": {
      get: {
        tags: ["Slide Editing"],
        summary: "Получить редактируемые поля слайда",
        operationId: "getEditableFields",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Список редактируемых полей" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}/layout": {
      post: {
        tags: ["Slide Editing"],
        summary: "Сменить макет слайда",
        operationId: "changeSlideLayout",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { layout: { type: "string" } }, required: ["layout"] } } },
        },
        responses: { 200: { description: "Макет изменён" } },
      },
    },
    "/api/v1/presentations/{id}/reassemble": {
      post: {
        tags: ["Slide Editing"],
        summary: "Пересобрать HTML всей презентации",
        operationId: "reassemblePresentation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "HTML пересобран" } },
      },
    },
    "/api/v1/presentations/{id}/reorder": {
      post: {
        tags: ["Slide Editing"],
        summary: "Изменить порядок слайдов",
        operationId: "reorderSlides",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { order: { type: "array", items: { type: "integer" }, description: "Новый порядок индексов слайдов" } }, required: ["order"] } } },
        },
        responses: { 200: { description: "Порядок изменён" } },
      },
    },

    // ─── Slide Versions ──────────────────────────────────────
    "/api/v1/presentations/{id}/slides/{index}/versions": {
      get: {
        tags: ["Slide Versions"],
        summary: "Получить историю версий слайда",
        operationId: "getSlideVersions",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Список версий" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}/versions/{versionId}": {
      get: {
        tags: ["Slide Versions"],
        summary: "Получить конкретную версию слайда",
        operationId: "getSlideVersion",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
          { name: "versionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Данные версии" }, 404: { description: "Не найдено" } },
      },
    },
    "/api/v1/presentations/{id}/slides/{index}/versions/{versionId}/restore": {
      post: {
        tags: ["Slide Versions"],
        summary: "Восстановить слайд из версии",
        operationId: "restoreSlideVersion",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
          { name: "versionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Слайд восстановлен" } },
      },
    },

    // ─── Interactive Mode ────────────────────────────────────
    "/api/v1/interactive/start": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Начать интерактивную генерацию (SSE)",
        operationId: "startInteractive",
        description: "Запускает пайплайн до этапа outline и возвращает структуру для утверждения. SSE-стриминг прогресса.",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreatePresentationRequest" } } },
        },
        responses: { 200: { description: "SSE-поток с outline" } },
      },
    },
    "/api/v1/interactive/{id}/approve-outline": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Утвердить/изменить структуру и продолжить генерацию (SSE)",
        operationId: "approveOutline",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { outline: { type: "object", description: "Изменённая структура (опционально)" } } } } },
        },
        responses: { 200: { description: "SSE-поток генерации контента" } },
      },
    },
    "/api/v1/interactive/{id}/content": {
      get: {
        tags: ["Interactive Mode"],
        summary: "Получить текущий контент интерактивной сессии",
        operationId: "getInteractiveContent",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Контент слайдов" } },
      },
    },
    "/api/v1/interactive/{id}/update-slide": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Обновить слайд в интерактивном режиме",
        operationId: "updateInteractiveSlide",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" }, data: { type: "object" } }, required: ["slide_index", "data"] } } },
        },
        responses: { 200: { description: "Слайд обновлён" } },
      },
    },
    "/api/v1/interactive/{id}/regenerate-slide": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Перегенерировать слайд с AI",
        operationId: "regenerateInteractiveSlide",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" }, instruction: { type: "string" } }, required: ["slide_index"] } } },
        },
        responses: { 200: { description: "Перегенерированный слайд" } },
      },
    },
    "/api/v1/interactive/{id}/generate-image": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Сгенерировать AI-изображение для слайда",
        operationId: "generateInteractiveImage",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" }, prompt: { type: "string" } }, required: ["slide_index", "prompt"] } } },
        },
        responses: { 200: { description: "URL сгенерированного изображения" } },
      },
    },
    "/api/v1/interactive/{id}/suggest-image-prompt": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Предложить промпт для изображения",
        operationId: "suggestImagePrompt",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" } }, required: ["slide_index"] } } },
        },
        responses: { 200: { description: "Предложенный промпт" } },
      },
    },
    "/api/v1/interactive/{id}/remove-image": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Удалить изображение со слайда",
        operationId: "removeInteractiveImage",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" } }, required: ["slide_index"] } } },
        },
        responses: { 200: { description: "Изображение удалено" } },
      },
    },
    "/api/v1/interactive/{id}/upload-image": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Загрузить изображение для слайда",
        operationId: "uploadInteractiveImage",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" }, slide_index: { type: "string" } } } } },
        },
        responses: { 200: { description: "Изображение загружено" } },
      },
    },
    "/api/v1/interactive/{id}/assemble": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Собрать финальную презентацию (SSE)",
        operationId: "assembleInteractive",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "SSE-поток сборки" } },
      },
    },
    "/api/v1/interactive/{id}/preview-slide": {
      post: {
        tags: ["Interactive Mode"],
        summary: "Предпросмотр HTML одного слайда",
        operationId: "previewInteractiveSlide",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { slide_index: { type: "integer" } }, required: ["slide_index"] } } },
        },
        responses: { 200: { description: "HTML-превью слайда" } },
      },
    },

    // ─── Chat ────────────────────────────────────────────────
    "/api/v1/chat/sessions": {
      post: {
        tags: ["Chat"],
        summary: "Создать чат-сессию",
        operationId: "createChatSession",
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" } } } } },
        },
        responses: { 201: { description: "Сессия создана" } },
      },
      get: {
        tags: ["Chat"],
        summary: "Список чат-сессий",
        operationId: "listChatSessions",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Список сессий" } },
      },
    },
    "/api/v1/chat/sessions/{id}": {
      get: {
        tags: ["Chat"],
        summary: "Получить чат-сессию с историей сообщений",
        operationId: "getChatSession",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Сессия с сообщениями" }, 404: { description: "Не найдено" } },
      },
      delete: {
        tags: ["Chat"],
        summary: "Удалить чат-сессию",
        operationId: "deleteChatSession",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Удалено" } },
      },
    },
    "/api/v1/chat/sessions/{id}/title": {
      patch: {
        tags: ["Chat"],
        summary: "Обновить заголовок сессии",
        operationId: "updateChatSessionTitle",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } } },
        },
        responses: { 200: { description: "Заголовок обновлён" } },
      },
    },
    "/api/v1/chat/sessions/{id}/metadata": {
      patch: {
        tags: ["Chat"],
        summary: "Обновить метаданные сессии",
        operationId: "updateChatSessionMetadata",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { metadata: { type: "object" } }, required: ["metadata"] } } },
        },
        responses: { 200: { description: "Метаданные обновлены" } },
      },
    },
    "/api/v1/chat/sessions/{id}/message": {
      post: {
        tags: ["Chat"],
        summary: "Отправить сообщение (SSE-стриминг ответа)",
        operationId: "sendChatMessage",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, file_ids: { type: "array", items: { type: "string" } } }, required: ["message"] } } },
        },
        responses: { 200: { description: "SSE-поток ответа AI" } },
      },
    },
    "/api/v1/chat/sessions/{id}/action": {
      post: {
        tags: ["Chat"],
        summary: "Выполнить действие (кнопка) в чате (SSE)",
        operationId: "chatAction",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { action: { type: "string" }, payload: { type: "object" } }, required: ["action"] } } },
        },
        responses: { 200: { description: "SSE-поток действия" } },
      },
    },
    "/api/v1/chat/sessions/{id}/upload": {
      post: {
        tags: ["Chat"],
        summary: "Загрузить файлы в чат-сессию",
        operationId: "uploadChatFiles",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { files: { type: "array", items: { type: "string", format: "binary" } } } } } },
        },
        responses: { 200: { description: "Файлы загружены" } },
      },
    },
    "/api/v1/chat/sessions/{id}/files": {
      get: {
        tags: ["Chat"],
        summary: "Получить файлы чат-сессии",
        operationId: "getChatFiles",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Список файлов" } },
      },
    },

    // ─── Templates ───────────────────────────────────────────
    "/api/v1/templates/upload": {
      post: {
        tags: ["Templates"],
        summary: "Загрузить пользовательский HTML-шаблон",
        operationId: "uploadTemplate",
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, name: { type: "string" }, description: { type: "string" } } } } },
        },
        responses: { 201: { description: "Шаблон загружен" } },
      },
    },
    "/api/v1/templates": {
      get: {
        tags: ["Templates"],
        summary: "Список пользовательских шаблонов",
        operationId: "listTemplates",
        responses: { 200: { description: "Список шаблонов" } },
      },
    },
    "/api/v1/templates/{id}": {
      get: {
        tags: ["Templates"],
        summary: "Получить шаблон по ID",
        operationId: "getTemplate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Данные шаблона" }, 404: { description: "Не найдено" } },
      },
      delete: {
        tags: ["Templates"],
        summary: "Удалить шаблон",
        operationId: "deleteTemplate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Удалено" } },
      },
    },
  },

  components: {
    schemas: {
      CreatePresentationRequest: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: { type: "string", description: "Тема презентации", example: "Стратегия развития компании на 2026 год" },
          mode: { type: "string", enum: ["batch", "interactive"], default: "batch", description: "Режим генерации" },
          config: {
            type: "object",
            properties: {
              slide_count: { type: "integer", minimum: 5, maximum: 20, default: 10 },
              theme_preset: { type: "string", description: "ID темы оформления", example: "corporate_blue" },
              custom_template_id: { type: "string", description: "ID пользовательского шаблона (опционально)" },
            },
          },
        },
      },
      PresentationSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          prompt: { type: "string" },
          status: { type: "string", enum: ["generating", "completed", "failed"] },
          slide_count: { type: "integer" },
          theme_preset: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Presentation: {
        type: "object",
        properties: {
          id: { type: "string" },
          prompt: { type: "string" },
          status: { type: "string" },
          slide_count: { type: "integer" },
          theme_preset: { type: "string" },
          html_url: { type: "string", nullable: true },
          slides: { type: "array", items: { $ref: "#/components/schemas/Slide" } },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Slide: {
        type: "object",
        properties: {
          index: { type: "integer" },
          layout: { type: "string" },
          title: { type: "string" },
          content_shape: { type: "string" },
          data: { type: "object" },
          html: { type: "string" },
          image_url: { type: "string", nullable: true },
        },
      },
      SlideUpdateRequest: {
        type: "object",
        properties: {
          data: { type: "object", description: "Новые данные слайда" },
          layout: { type: "string", description: "Новый макет (опционально)" },
        },
      },
    },
  },
};

export function registerSwaggerDocs(app: Express) {
  // Serve OpenAPI JSON spec
  app.get("/api/docs/spec.json", (_req, res) => {
    res.json(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Presentation Generator API Docs",
    })
  );
}
