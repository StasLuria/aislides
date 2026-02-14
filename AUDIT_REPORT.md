# Аудит кодовой базы: presentation-frontend

**Дата:** 14 февраля 2026  
**Автор:** Manus AI  
**Версия проекта:** ce773e70 (Round 8)

---

## 1. Обзор проекта

Проект **presentation-frontend** представляет собой AI-генератор презентаций с полным циклом: от ввода темы до готового HTML/PPTX/PDF. Архитектура включает Express-сервер с tRPC, React-клиент, и многоагентный пайплайн генерации (10 AI-агентов).

| Категория | Файлов | Строк кода |
|---|---|---|
| Server pipeline (core logic) | 14 | 13 493 |
| Server routes | 5 | 3 408 |
| Server tests | 40 | 14 319 |
| Client pages | 8 | 6 874 |
| Client components (custom) | 8 | 2 665 |
| Client UI (shadcn) | 35+ | 6 189 |
| **Итого** | **~110** | **~46 948** |

---

## 2. Критические проблемы

### 2.1. Дублирование `autoFixSlideData` (ВЫСОКИЙ приоритет)

Функция `autoFixSlideData` определена **дважды** в разных модулях с **разной логикой**:

| Модуль | Строка | Размер | Назначение |
|---|---|---|---|
| `qaAgent.ts` | 656 | 239 строк | Структурные фиксы: конвертация bullets, иконки metrics, org-chart, SWOT, timeline |
| `designCriticAgent.ts` | 1021 | 161 строка | Визуальные фиксы: smart truncation, лимиты элементов, rebalancing |

Обе функции вызываются в `generator.ts` последовательно (строки 1217 и 1795), но с разными сигнатурами: QA-версия возвращает `{ data, fixed }`, Design-версия возвращает `string[]` (список фиксов). Это создаёт путаницу и потенциальные конфликты — оба модуля могут обрезать bullets или ограничивать количество элементов, но с разными порогами.

**Рекомендация:** Объединить в единую функцию `autoFixSlideData` в отдельном модуле `server/pipeline/autoFix.ts`, разделив на фазы: (1) structural fixes, (2) content truncation, (3) visual limits. Вызывать один раз в пайплайне.

### 2.2. Дублирование `buildPreviewData` и `buildFallbackData` (ВЫСОКИЙ приоритет)

Две функции выполняют **одну и ту же задачу** — преобразование `SlideContent` в `Record<string, any>` для рендеринга шаблона:

| Функция | Модуль | Строк | Покрытие layouts |
|---|---|---|---|
| `buildFallbackData` | `generator.ts` | 526 | 28+ layouts (полное) |
| `buildPreviewData` | `interactiveRoutes.ts` | 111 | 10 layouts (частичное) |

`buildPreviewData` — это устаревшая, неполная версия `buildFallbackData`, используемая только в interactive mode. Она не поддерживает новые layouts (risk-matrix, card-grid, financial-formula, dual-chart и др.), что приводит к пустым превью в интерактивном режиме для этих шаблонов.

**Рекомендация:** Удалить `buildPreviewData`, заменить все вызовы на `buildFallbackData` из `generator.ts`.

### 2.3. Дублирование `THEME_PRESETS` (СРЕДНИЙ приоритет)

Список тем дизайна определён **дважды**:

| Модуль | Строка | Формат |
|---|---|---|
| `server/pipeline/themes.ts` | 23 | Полный (с CSS-переменными, шрифтами, градиентами) |
| `client/src/lib/constants.ts` | 114 | Упрощённый (id, name, color, gradient, category) |

При добавлении новой темы нужно обновлять оба файла. Рассинхронизация приведёт к тому, что клиент покажет тему, которой нет на сервере, или наоборот.

**Рекомендация:** Перенести базовый список тем (id, name, nameRu, color, gradient, dark, category, descRu) в `shared/themes.ts`. Серверный модуль расширяет его CSS-переменными. Клиент импортирует напрямую.

### 2.4. Дублирование CSS-парсинга тем (СРЕДНИЙ приоритет)

Парсинг CSS-переменных темы реализован дважды:

| Функция | Модуль | Подход |
|---|---|---|
| `parseThemeVariables` | `designCriticAgent.ts` | Regex с `exec` в цикле, возвращает `Record<string, string>` |
| `parseThemeColors` | `pptxExport.ts` | Regex с `match` по каждой переменной, возвращает типизированный объект |

**Рекомендация:** Вынести в `server/pipeline/themeUtils.ts` единую функцию парсинга.

---

## 3. Мёртвый код

### 3.1. `server/backendProxy.ts` — ПОЛНОСТЬЮ МЁРТВЫЙ

Файл на 65 строк, который проксировал запросы к старому Python/FastAPI бэкенду. **Не импортируется нигде** — ни в `server/_core/index.ts`, ни в каком-либо другом модуле. Ссылается на несуществующий `BACKEND_URL` env var.

**Рекомендация:** Удалить файл.

### 3.2. `server/index.ts` — МЁРТВЫЙ ENTRY POINT

Старая точка входа (28 строк) — простой Express-сервер, который только раздаёт статику. Реальная точка входа — `server/_core/index.ts`. Файл `server/index.ts` не используется ни в `package.json` scripts, ни где-либо ещё.

**Рекомендация:** Удалить файл.

### 3.3. `client/src/pages/ComponentShowcase.tsx` — НЕ ПОДКЛЮЧЁН (1437 строк)

Демо-страница shadcn-компонентов, которая **не зарегистрирована ни в одном роуте** в `App.tsx` и не импортируется нигде. Занимает 1437 строк — это третий по размеру файл в клиенте.

**Рекомендация:** Удалить файл (или оставить только для dev-режима).

### 3.4. Неиспользуемые клиентские компоненты

| Компонент | Строк | Статус |
|---|---|---|
| `ConnectionStatus.tsx` | ~50 | Не импортируется нигде |
| `DashboardLayout.tsx` | 264 | Не импортируется (шаблонный, не нужен для публичного приложения) |
| `DashboardLayoutSkeleton.tsx` | ~30 | Не импортируется |
| `ManusDialog.tsx` | ~60 | Не импортируется |
| `Map.tsx` | ~80 | Не импортируется |

**Рекомендация:** Удалить `ConnectionStatus`, `ManusDialog`, `Map`. `DashboardLayout` и `DashboardLayoutSkeleton` — шаблонные компоненты, можно оставить на случай будущего использования.

### 3.5. Неиспользуемые shadcn UI компоненты (1482 строки)

| Компонент | Строк | Импортируется? |
|---|---|---|
| `alert-dialog` | 155 | Нет |
| `button-group` | 83 | Нет |
| `chart` | 355 | Нет |
| `empty` | 104 | Нет |
| `field` | 242 | Нет |
| `form` | 168 | Нет |
| `input-group` | 168 | Нет |
| `item` | 193 | Нет |
| `kbd` | 28 | Нет |
| `navigation-menu` | 168 | Нет |
| `spinner` | 16 | Нет |

**Рекомендация:** Удалить все 11 компонентов. При необходимости shadcn позволяет добавить их обратно одной командой.

---

## 4. Архитектурные проблемы

### 4.1. Двойная API-система: `api.ts` + `fetch` + `tRPC`

Клиент использует **три разных способа** общения с сервером:

| Паттерн | Где используется | Файлов |
|---|---|---|
| `api.ts` (централизованный) | Viewer, Generate, Interactive, History, ChatPage, SlideEditor, SharedViewer | 10 |
| Прямой `fetch()` | ChatSidebar, useSSEChat, InlineEditableSlide | 3 |
| tRPC hooks | useAuth (auth.me, auth.logout) | 1 |

Причина: проект начинался как чистый REST API, затем добавился tRPC при upgrade на web-db-user шаблон. tRPC используется **только для аутентификации**, все бизнес-операции идут через `api.ts`.

**Рекомендация:** Это не критично, но в долгосрочной перспективе стоит мигрировать REST-эндпоинты на tRPC-процедуры для type-safety и единообразия. Как минимум, перенести прямые `fetch()` вызовы из ChatSidebar и useSSEChat в `api.ts`.

### 4.2. Viewer vs SharedViewer — дублирование рендеринга (СРЕДНИЙ приоритет)

`Viewer.tsx` (1546 строк) и `SharedViewer.tsx` (379 строк) содержат дублированную логику рендеринга слайдов через `<iframe srcDoc>`, навигации клавишами, fullscreen-режима и экспорта. SharedViewer — это упрощённая версия Viewer без редактирования.

**Рекомендация:** Вынести общую логику (SlideFrame, keyboard navigation, fullscreen, export buttons) в shared-компоненты. SharedViewer должен использовать те же компоненты, что и Viewer, но без editing-функционала.

### 4.3. Тестовые файлы: "round-based" naming (НИЗКИЙ приоритет)

Тестовые файлы названы по раундам разработки (`round7.test.ts`, `round8.test.ts`, `testGeneration.test.ts`, `newTemplatesQA.test.ts`, `newLayouts.test.ts`), а не по тестируемой функциональности. Это затрудняет поиск тестов для конкретной фичи.

| Текущее имя | Что тестирует | Предлагаемое имя |
|---|---|---|
| `round7.test.ts` | kanban-board, LLM validation | `kanban-and-validation.test.ts` |
| `round8.test.ts` | DataViz, design critique, org-chart | `dataviz-and-orgchart.test.ts` |
| `testGeneration.test.ts` | buildFallbackData для всех layouts | `fallback-data.test.ts` |
| `newTemplatesQA.test.ts` | QA для новых шаблонов | Объединить с `templateEngine.test.ts` |
| `newLayouts.test.ts` | Новые layouts | Объединить с `manusLayouts.test.ts` |

**Рекомендация:** Переименовать при следующем рефакторинге. Не срочно.

---

## 5. Потенциальные конфликты

### 5.1. `extractFromPptx` — два разных назначения

| Модуль | Назначение | Возвращает |
|---|---|---|
| `fileExtractor.ts` | Извлечение текста из загруженного PPTX | `ExtractionResult` (text + metadata) |
| `templateParser.ts` | Извлечение темы/стиля из PPTX | `ExtractedThemeInfo` (colors, fonts) |

Это **не дублирование** — функции делают разное. Но одинаковое имя может вызвать путаницу. Рекомендуется переименовать в `templateParser.ts` → `extractThemeFromPptx`.

### 5.2. `SlideContent` — определён в `generator.ts`, но тесты импортируют из `./types`

Некоторые тестовые файлы (`testGeneration.test.ts`, `round7.test.ts`) импортируют `SlideContent` из `./types`, который не существует как отдельный файл. Это работает только потому, что TypeScript resolves re-exports. Потенциально хрупко.

**Рекомендация:** Создать `server/pipeline/types.ts` с общими типами (`SlideContent`, `OutlineSlide`, `OutlineResult`, `SlideDesignData`).

---

## 6. Сводка рекомендаций по приоритету

| # | Приоритет | Действие | Экономия строк | Риск |
|---|---|---|---|---|
| 1 | **ВЫСОКИЙ** | Объединить `autoFixSlideData` в один модуль | ~100 | Средний |
| 2 | **ВЫСОКИЙ** | Заменить `buildPreviewData` на `buildFallbackData` | ~111 | Низкий |
| 3 | **ВЫСОКИЙ** | Удалить `backendProxy.ts` (мёртвый код) | 65 | Нулевой |
| 4 | **ВЫСОКИЙ** | Удалить `server/index.ts` (мёртвый entry point) | 28 | Нулевой |
| 5 | **СРЕДНИЙ** | Удалить `ComponentShowcase.tsx` | 1 437 | Нулевой |
| 6 | **СРЕДНИЙ** | Удалить неиспользуемые компоненты | ~460 | Нулевой |
| 7 | **СРЕДНИЙ** | Удалить неиспользуемые shadcn UI | 1 482 | Нулевой |
| 8 | **СРЕДНИЙ** | Вынести `THEME_PRESETS` в shared | ~50 | Низкий |
| 9 | **СРЕДНИЙ** | Вынести CSS-парсинг тем в shared утилиту | ~30 | Низкий |
| 10 | **СРЕДНИЙ** | Вынести общую логику Viewer/SharedViewer | ~200 | Средний |
| 11 | **НИЗКИЙ** | Перенести прямые fetch() в api.ts | ~50 | Низкий |
| 12 | **НИЗКИЙ** | Переименовать round-based тесты | 0 | Нулевой |
| 13 | **НИЗКИЙ** | Создать `pipeline/types.ts` | 0 | Нулевой |

**Потенциальная экономия:** ~4 013 строк мёртвого/дублированного кода (~8.5% от общего объёма).

---

## 7. Что НЕ является проблемой

Для полноты картины отмечу, что следующие элементы были проверены и **не являются дублированием**:

- **`extractFromPptx`** в `fileExtractor.ts` vs `templateParser.ts` — разные задачи (текст vs тема)
- **`renderSlide`** используется единообразно из `templateEngine.ts` во всех модулях
- **`invokeLLM`** импортируется из единого источника `_core/llm.ts`
- **`generateImage`** импортируется из единого источника `_core/imageGeneration.ts`
- **`autoSave`** — не дублирован, используется только в Viewer
- **`versionDb`** — используется в slideEditRoutes для версионирования слайдов
- **Тестовые файлы** — хотя названия неоптимальны, тесты не дублируют друг друга по содержанию
