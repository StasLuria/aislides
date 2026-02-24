# План разработки: Повышение качества AI-презентаций

> Основан на аудите PIPELINE_AUDIT_REPORT.md, исследованиях OpenAI, Anthropic, PPTAgent, PreGenie, LangChain Reflection и опыте сообщества.

---

## Обзор

| Параметр | Значение |
|----------|----------|
| **Текущий уровень качества** | ~4.5/10 |
| **Целевой уровень** | ~8.5/10 |
| **Фаз** | 4 |
| **Шагов** | 18 |
| **Ожидаемое время** | 4-5 недель |
| **Увеличение времени генерации** | 100 сек → 180 сек |
| **Увеличение LLM-вызовов** | 45 → 95 |

---

## Фаза 1: Quick Wins (3 дня, +50% качества)

Минимальные изменения кода с максимальным эффектом. Не меняют архитектуру. Только правки промптов и расширение существующих проверок.

---

### Шаг 1.1: Расширить LLM QA на ВСЕ слайды

**Проблема:** LLM-валидация (`validateCriticalSlideContent`) запускается только для `title-slide` и `final-slide` (2 из 45 layouts). Остальные 43 layout'а проверяются только программно.

**Что делаем:**
1. В `server/pipeline/qaAgent.ts` — добавить `QA_LEVELS` map с тремя уровнями строгости:
   - `full` — title-slide, final-slide, section-header (полная проверка: relevance + clarity + professionalism + completeness)
   - `content` — stats-chart, chart-text, icons-numbers, comparison-table, table-slide, highlight-stats, hero-stat, financial-formula, swot-analysis, kanban-board (проверка данных: accuracy + completeness + clarity)
   - `quick` — все остальные layouts (быстрая проверка: density + completeness)
2. В `server/pipeline/qaAgent.ts` — написать три промпта для каждого уровня QA
3. В `server/pipeline/generator.ts` — заменить `if (isCriticalLayout(layoutName))` на вызов QA для всех слайдов с соответствующим уровнем. Запускать параллельно для минимизации времени.

**Файлы:**
- `server/pipeline/qaAgent.ts` — новые функции `validateContentSlide()`, `validateQuickSlide()`, обновить `isCriticalLayout()` → `getQALevel()`
- `server/pipeline/generator.ts` — строки ~1721-1740, заменить условный вызов на универсальный

**Критерии приёмки:**
- [ ] Все слайды проходят LLM QA (не только title/final)
- [ ] Три уровня промптов: full (5 критериев), content (4 критерия), quick (2 критерия)
- [ ] QA запускается параллельно (не увеличивает время более чем на 10 сек)
- [ ] Тесты: проверка что getQALevel возвращает правильный уровень для каждого layout

---

### Шаг 1.2: Few-shot примеры для Writer (16 content_shapes)

**Проблема:** Writer получает абстрактные инструкции ("Write 3-4 stat cards") без конкретных примеров. OpenAI: "Providing examples is often more effective than describing the desired output in abstract terms."

**Что делаем:**
1. В `server/pipeline/prompts.ts` — добавить секцию `<few_shot_examples>` в `WRITER_SYSTEM` промпт
2. Для каждого из 16 content_shapes написать один эталонный пример:
   - `stat_cards` — пример с 3 метриками (label, value, description)
   - `bullet_points` — пример с 4 пунктами (title + description)
   - `comparison_two_sides` — пример с pro/con по 3 пункта
   - `table_data` — пример с 4 строками × 4 столбца
   - `process_steps` — пример с 4 шагами
   - `card_grid` — пример с 4 карточками (icon_hint, title, text)
   - `timeline_events` — пример с 4 событиями (date, title, description)
   - `financial_formula` — пример с формулой (A - B = C) + метрики
   - `analysis_with_verdict` — пример с 3 аналитическими пунктами + вердикт
   - `single_concept` — пример с центральной идеей + 3 подпункта
   - `chart_with_context` — пример с данными для графика + 2 stat cards
   - `quote_highlight` — пример с цитатой + атрибуция + контекст
   - `kanban_board` — пример с 3 колонками по 2-3 карточки
   - `checklist_items` — пример с 6 пунктами (done/not-done)
   - `swot_quadrants` — пример с 4 квадрантами по 3 пункта
   - `org_structure` — пример с root + 3 children

**Файлы:**
- `server/pipeline/prompts.ts` — вставить `<few_shot_examples>` секцию в `WRITER_SYSTEM` (после `</content_shape_instructions>`, перед закрывающим промптом)

**Критерии приёмки:**
- [ ] 16 few-shot примеров (по одному на каждый content_shape)
- [ ] Каждый пример содержит: input (slide_info) → output (JSON с structured_content)
- [ ] Примеры на русском языке (основной язык генерации)
- [ ] Примеры реалистичные (не "Lorem ipsum"), с конкретными цифрами и фактами

---

### Шаг 1.3: Few-shot примеры для HTML Composer (10 layouts)

**Проблема:** Composer получает layout template без примера заполнения. Модель угадывает формат data-полей.

**Что делаем:**
1. В `server/pipeline/prompts.ts` — добавить секцию `<composer_few_shot_examples>` в `HTML_COMPOSER_SYSTEM` промпт
2. Для 10 самых используемых layouts написать пример заполнения data-полей:
   - `icons-numbers` — пример с 4 карточками
   - `text-with-callout` — пример с текстом + callout
   - `comparison-table` — пример с 3 строками × 3 столбца
   - `stats-chart` — пример с данными для графика
   - `numbered-steps-v2` — пример с 4 шагами
   - `card-grid` — пример с 4 карточками
   - `highlight-stats` — пример с 3 метриками
   - `hero-stat` — пример с одной большой метрикой
   - `vertical-timeline` — пример с 4 событиями
   - `big-statement` — пример с заявлением + подтекст

**Файлы:**
- `server/pipeline/prompts.ts` — вставить `<composer_few_shot_examples>` в `HTML_COMPOSER_SYSTEM`

**Критерии приёмки:**
- [ ] 10 few-shot примеров для top-10 layouts
- [ ] Каждый пример: input (slide content + layout) → output (JSON data для templateEngine)
- [ ] Формат data-полей точно соответствует ожиданиям templateEngine.ts

---

### Шаг 1.4: Ужесточить правило 6×6 в промптах

**Проблема:** Writer иногда генерирует слайды с 8+ пунктами или длинными абзацами. Правило 6×6 (max 6 пунктов, max 6 слов на пункт) не жёстко enforce'ится.

**Что делаем:**
1. В `server/pipeline/prompts.ts` — добавить жёсткие ограничения в `WRITER_SYSTEM`:
   ```
   DENSITY RULES (MANDATORY — violations will be rejected):
   - Maximum 6 bullet points per slide
   - Maximum 10 words per bullet point title
   - Maximum 25 words per bullet point description
   - stat_cards: maximum 4 cards
   - process_steps: maximum 5 steps
   - card_grid: maximum 6 cards
   - table_data: maximum 6 rows, maximum 5 columns
   ```
2. В `server/pipeline/qaAgent.ts` — добавить программную валидацию density в `validateSlideData()`:
   - Проверять количество элементов в массивах (stat_cards, bullet_points, etc.)
   - Проверять длину текстов (title, description)
   - Автоматически обрезать при превышении

**Файлы:**
- `server/pipeline/prompts.ts` — добавить DENSITY RULES секцию в WRITER_SYSTEM
- `server/pipeline/qaAgent.ts` — добавить `validateDensity()` функцию

**Критерии приёмки:**
- [ ] Промпт содержит конкретные числовые лимиты для каждого content_shape
- [ ] QA Agent программно проверяет density и обрезает при превышении
- [ ] Тесты: проверка обрезки для каждого content_shape

---

### Шаг 1.5: Chain-of-Thought для Layout Agent

**Проблема:** Layout Agent выбирает layout без объяснения логики. Иногда выбор неоптимальный (например, text-slide для данных).

**Что делаем:**
1. В `server/pipeline/prompts.ts` — добавить CoT инструкцию в `LAYOUT_SYSTEM`:
   ```
   For each slide, think step by step:
   1. CONTENT TYPE: What type of information is this? (data/narrative/comparison/process/visual)
   2. SHAPE HINT: What content_shape was assigned? Check the [SHAPE: xxx] tag.
   3. VISUAL FIT: Which layout best visualizes this content type?
   4. DIVERSITY: Have I already used this layout? Check the used_layouts list.
   5. DECISION: Select the layout with rationale.
   ```
2. В `server/pipeline/generator.ts` — добавить `rationale` поле в `LayoutDecision` interface и парсить его из LLM ответа (для логирования и отладки)

**Файлы:**
- `server/pipeline/prompts.ts` — обновить `LAYOUT_SYSTEM`
- `server/pipeline/generator.ts` — обновить `LayoutDecision` interface, добавить `rationale?: string`

**Критерии приёмки:**
- [ ] Layout Agent использует step-by-step reasoning
- [ ] Каждое решение содержит rationale (логируется)
- [ ] Тесты: проверка что LayoutDecision содержит rationale

---

### Шаг 1.6: Storytelling transitions в контент

**Проблема:** Storytelling Agent генерирует `transition_phrases`, но они не используются в HTML Composer. Слайды выглядят как изолированные единицы.

**Что делаем:**
1. В `server/pipeline/generator.ts` — после Storytelling Agent, инжектировать `transition_phrase` в каждый `SlideContent`:
   ```typescript
   content[i].transition = storytellingResult.transitions[i];
   ```
2. В `server/pipeline/prompts.ts` — обновить `HTML_COMPOSER_SYSTEM` чтобы использовать transition:
   ```
   If the slide has a transition_phrase, include it as a subtle subtitle or opening line
   that connects this slide to the previous one. This creates narrative flow.
   ```
3. В `server/pipeline/generator.ts` — передать transition в `runHtmlComposer()` вызов

**Файлы:**
- `server/pipeline/generator.ts` — строки ~1467-1475, инжекция transitions в content
- `server/pipeline/prompts.ts` — обновить HTML_COMPOSER_SYSTEM и user prompt builder

**Критерии приёмки:**
- [ ] Transition phrases передаются в HTML Composer
- [ ] Composer использует transitions как subtitle/opening line
- [ ] Тесты: проверка что transitions инжектируются в SlideContent

---

## Фаза 2: Evaluator-Optimizer (3 дня, +55% кумулятивно)

Новые агенты и паттерны. Меняют поток данных. Основаны на Anthropic Evaluator-Optimizer pattern.

---

### Шаг 2.1: Content Evaluator Agent

**Проблема:** Нет обратной связи после Writer. Контент принимается как есть, даже если он слабый.

**Что делаем:**
1. Создать `server/pipeline/contentEvaluator.ts` — новый агент:
   - Принимает `SlideContent[]` + `OutlineResult`
   - Оценивает каждый слайд по rubric (4 критерия × 5 баллов):
     - **SPECIFICITY** (1-5): Конкретные цифры, имена, даты vs общие фразы
     - **DENSITY** (1-5): Оптимальная плотность информации для слайда
     - **NOVELTY** (1-5): Новая информация vs повтор предыдущих слайдов
     - **ACTIONABILITY** (1-5): Можно ли что-то сделать с этой информацией
   - Порог прохождения: средний балл ≥ 3.5
   - При провале: возвращает конкретные инструкции по исправлению
2. В `server/pipeline/generator.ts` — добавить Evaluator loop после Writer:
   ```
   Writer → Content Evaluator → [pass/fail]
     ↓ (if fail)                   ↓ (if pass)
   Writer (with feedback)      → continue
     ↓ (max 2 retries)
   Accept with warnings → continue
   ```
3. В `server/pipeline/prompts.ts` — добавить `CONTENT_EVALUATOR_SYSTEM` промпт

**Файлы:**
- `server/pipeline/contentEvaluator.ts` — новый файл (~200 строк)
- `server/pipeline/prompts.ts` — новый промпт `CONTENT_EVALUATOR_SYSTEM`
- `server/pipeline/generator.ts` — вставить evaluator loop после строки ~1461 (после runWriterParallel)

**Критерии приёмки:**
- [ ] Evaluator оценивает каждый слайд по 4 критериям (1-5)
- [ ] Слайды с score < 3.5 отправляются на переписывание (max 2 итерации)
- [ ] Feedback содержит конкретные инструкции (не "improve it", а "Replace 'significant growth' with actual percentage")
- [ ] Evaluator запускается параллельно для всех слайдов
- [ ] Тесты: проверка scoring, feedback generation, retry logic

---

### Шаг 2.2: Маршрутизация по типу презентации

**Проблема:** Один набор промптов для всех типов презентаций. Investor deck и educational presentation получают одинаковые инструкции.

**Что делаем:**
1. Создать `server/pipeline/presentationClassifier.ts` — классификатор на входе:
   - Принимает user prompt
   - Возвращает один из 5 типов: `business_strategy`, `product_pitch`, `educational`, `investor_deck`, `quarterly_review`
   - Для каждого типа определены:
     - `preferred_narrative_arcs` — какие narrative arcs лучше подходят
     - `preferred_layouts` — какие layouts приоритетны
     - `tone` — тон изложения
     - `content_rules` — специфические правила контента
     - `few_shot_override` — дополнительные few-shot примеры
2. В `server/pipeline/generator.ts` — вызвать классификатор после Planner:
   ```typescript
   const presentationType = await classifyPresentation(prompt);
   ```
3. В `server/pipeline/prompts.ts` — модифицировать промпты для инжекции type-specific правил:
   - Outline Agent получает `preferred_layouts` и `content_rules`
   - Writer получает `tone` и `content_rules`
   - Layout Agent получает `preferred_layouts` как подсказку

**Файлы:**
- `server/pipeline/presentationClassifier.ts` — новый файл (~150 строк)
- `server/pipeline/prompts.ts` — добавить type-specific секции в OUTLINE_SYSTEM, WRITER_SYSTEM, LAYOUT_SYSTEM
- `server/pipeline/generator.ts` — вызвать классификатор, передать тип в агенты

**Критерии приёмки:**
- [ ] Классификатор определяет тип с accuracy > 90% (на тестовых промптах)
- [ ] 5 типов с уникальными правилами (narrative arcs, layouts, tone, content rules)
- [ ] Type-specific правила инжектируются в промпты Outline, Writer, Layout
- [ ] Тесты: проверка классификации для 10+ тестовых промптов

---

### Шаг 2.3: Гибридный Writer (sequential + parallel)

**Проблема:** Writer работает параллельно в батчах по 2. Слайды в одном батче не видят контент друг друга. Нарушается нарративная связность.

**Что делаем:**
1. В `server/pipeline/generator.ts` — модифицировать `runWriterParallel()`:
   - Ключевые слайды (title, первые 2 контентных, conclusion, final) — последовательно
   - Остальные — параллельно, но с контекстом ключевых слайдов
   ```
   Слайд 1 (title) → последовательно
   Слайд 2-3 (context) → последовательно (видят контент слайда 1)
   Слайды 4-N-2 (core) → параллельно (видят контент слайдов 1-3)
   Слайд N-1, N (conclusion) → последовательно (видят контент всех предыдущих)
   ```
2. В `server/pipeline/prompts.ts` — обновить writer user prompt для включения предыдущего контента:
   ```
   <previous_slides_context>
   Slide 1: [title] — [key_message]
   Slide 2: [title] — [key_message]
   ...
   </previous_slides_context>
   ```

**Файлы:**
- `server/pipeline/generator.ts` — переписать `runWriterParallel()` (~строки 464-520)
- `server/pipeline/prompts.ts` — обновить `buildWriterUserPrompt()` для включения контекста

**Критерии приёмки:**
- [ ] Title и conclusion слайды генерируются последовательно
- [ ] Core слайды генерируются параллельно с контекстом ключевых
- [ ] Увеличение времени не более 10-15 секунд
- [ ] Тесты: проверка порядка генерации и передачи контекста

---

## Фаза 3: Visual Review (3 дня, +45% кумулятивно)

Визуальная проверка качества. Требует рендеринга слайдов и мультимодальной оценки.

---

### Шаг 3.1: Layout Voting (top-3 + scoring)

**Проблема:** Layout Agent выбирает один layout. Иногда выбор неоптимальный.

**Что делаем:**
1. В `server/pipeline/prompts.ts` — обновить `LAYOUT_SYSTEM` для возврата top-3:
   ```
   For each slide, return your TOP 3 layout choices with confidence scores:
   {
     "slide_1": {
       "choices": [
         {"layout": "stats-chart", "confidence": 0.9, "rationale": "..."},
         {"layout": "icons-numbers", "confidence": 0.7, "rationale": "..."},
         {"layout": "highlight-stats", "confidence": 0.5, "rationale": "..."}
       ]
     }
   }
   ```
2. В `server/pipeline/generator.ts` — добавить scoring logic:
   - Если confidence[0] > 0.8 — использовать первый выбор
   - Если confidence[0] < 0.8 — учитывать diversity penalty (уже использованные layouts)
   - Логировать все три варианта для аналитики

**Файлы:**
- `server/pipeline/prompts.ts` — обновить LAYOUT_SYSTEM для top-3
- `server/pipeline/generator.ts` — обновить `runLayout()` для scoring и diversity

**Критерии приёмки:**
- [ ] Layout Agent возвращает top-3 с confidence scores
- [ ] Scoring учитывает diversity (penalty за повторы)
- [ ] Все три варианта логируются
- [ ] Тесты: проверка scoring logic и diversity penalty

---

### Шаг 3.2: Visual Review Agent (screenshot → MLLM)

**Проблема:** Design Critic работает на уровне CSS/HTML кода. Не видит реальный рендеринг.

**Что делаем:**
1. Создать `server/pipeline/visualReviewer.ts` — новый агент:
   - Рендерит каждый слайд в PNG (через Puppeteer/Playwright)
   - Отправляет screenshot в Vision LLM (GPT-4o)
   - Оценивает по 4 критериям:
     - **Readability** (1-10): Читаемость текста (контраст, размер, overlap)
     - **Balance** (1-10): Визуальный баланс (whitespace, alignment)
     - **Density** (1-10): Заполненность слайда
     - **Professionalism** (1-10): Профессиональный вид
   - Если score < 6 — возвращает CSS fix suggestions
2. В `server/pipeline/generator.ts` — добавить Visual Review после Design Critic:
   ```
   Design Critic → Visual Reviewer → [pass/fail]
     ↓ (if fail)                       ↓ (if pass)
   Apply CSS fixes → Re-render       → Assembly
     ↓ (max 2 iterations)
   Accept → Assembly
   ```

**Файлы:**
- `server/pipeline/visualReviewer.ts` — новый файл (~300 строк)
- `server/pipeline/prompts.ts` — добавить `VISUAL_REVIEWER_SYSTEM` промпт
- `server/pipeline/generator.ts` — вставить visual review после design critic (~строка 1839)

**Зависимости:**
- `puppeteer` или `playwright` для рендеринга HTML → PNG
- Vision API через `invokeLLM` с image content

**Критерии приёмки:**
- [ ] Каждый слайд рендерится в PNG (1920×1080)
- [ ] Vision LLM оценивает по 4 критериям
- [ ] Слайды с score < 6 получают CSS fixes и re-render (max 2 итерации)
- [ ] Увеличение времени не более 30 секунд (параллельный рендеринг)
- [ ] Тесты: проверка рендеринга, scoring, CSS fix application

---

### Шаг 3.3: LLM-based Design Critic

**Проблема:** Текущий Design Critic — чисто программный. Не понимает эстетику.

**Что делаем:**
1. В `server/pipeline/designCriticAgent.ts` — добавить LLM-based critique:
   - После программных проверок, отправить HTML слайда в LLM
   - LLM оценивает: цветовая гармония, типографическая иерархия, визуальный ритм
   - Возвращает CSS-патчи для улучшения
2. В `server/pipeline/prompts.ts` — добавить `DESIGN_CRITIC_LLM_SYSTEM` промпт:
   ```
   You are a Design Critic reviewing HTML slides. Evaluate:
   1. COLOR HARMONY: Do the colors work together? Is contrast sufficient?
   2. TYPOGRAPHY: Is there clear hierarchy (h1 > h2 > body)?
   3. SPACING: Is whitespace used effectively?
   4. ALIGNMENT: Are elements properly aligned?
   Return CSS patches to fix issues.
   ```

**Файлы:**
- `server/pipeline/designCriticAgent.ts` — добавить `runLLMDesignCritic()` функцию
- `server/pipeline/prompts.ts` — добавить `DESIGN_CRITIC_LLM_SYSTEM`
- `server/pipeline/generator.ts` — вызвать LLM critic после программного

**Критерии приёмки:**
- [ ] LLM Design Critic оценивает 4 аспекта дизайна
- [ ] Возвращает конкретные CSS patches
- [ ] Patches применяются к HTML слайдов
- [ ] Тесты: проверка что patches валидный CSS

---

## Фаза 4: Advanced (2 недели, +50% кумулятивно)

Фундаментальные изменения. Требуют новой инфраструктуры.

---

### Шаг 4.1: Web Search для Research Agent

**Проблема:** Research Agent использует только LLM knowledge. Данные могут быть устаревшими или галлюцинированными.

**Что делаем:**
1. В `server/pipeline/researchAgent.ts` — интегрировать web search:
   - Использовать Data API (встроенный в Manus) или Tavily/Serper
   - Для каждого слайда генерировать 2-3 поисковых запроса
   - Извлекать факты из результатов поиска
   - Верифицировать факты через LLM (cross-check)
   - Добавлять source citations
2. В `server/pipeline/prompts.ts` — обновить Research Agent промпт для работы с web data

**Файлы:**
- `server/pipeline/researchAgent.ts` — добавить `webSearch()`, `extractFacts()`, `verifyFacts()`
- `server/pipeline/prompts.ts` — обновить RESEARCH_SYSTEM
- `server/_core/dataApi.ts` — использовать для web search (если доступен)

**Критерии приёмки:**
- [ ] Research Agent делает 2-3 web search запроса на слайд
- [ ] Факты верифицируются через LLM cross-check
- [ ] Source citations добавляются к фактам
- [ ] Fallback на LLM-only если web search недоступен
- [ ] Тесты: проверка search, extraction, verification

---

### Шаг 4.2: Reference-based Generation

**Проблема:** Генерация "с нуля" без референсов. Нет понимания что такое "хорошая презентация".

**Что делаем:**
1. Создать библиотеку референсных презентаций (10-20 эталонных примеров)
2. Для каждого типа презентации — 2-3 референса
3. При генерации — находить ближайший референс и использовать его структуру как template
4. Это реализация PPTAgent подхода: "analyze existing presentations → extract patterns → apply to new content"

**Файлы:**
- `server/pipeline/referenceLibrary.ts` — новый файл
- `server/pipeline/references/` — директория с JSON-описаниями эталонных презентаций
- `server/pipeline/generator.ts` — интеграция reference matching

**Критерии приёмки:**
- [ ] 10+ референсных презентаций в библиотеке
- [ ] Matching по типу + теме
- [ ] Структура референса используется как template для outline
- [ ] Тесты: проверка matching и template application

---

### Шаг 4.3: Мультимодальный финальный ревью

**Проблема:** Нет финальной проверки всей презентации как целого.

**Что делаем:**
1. После сборки — рендерить ВСЮ презентацию (все слайды)
2. Отправить все screenshots в Vision LLM одним запросом
3. Оценить:
   - Визуальная консистентность между слайдами
   - Нарративная связность (по заголовкам и контенту)
   - Общее впечатление (professional, engaging, clear)
4. Если score < 7 — предложить конкретные улучшения

**Файлы:**
- `server/pipeline/finalReviewer.ts` — новый файл
- `server/pipeline/generator.ts` — вызвать после assembly

**Критерии приёмки:**
- [ ] Все слайды рендерятся и отправляются в Vision LLM
- [ ] Оценка консистентности, связности, общего впечатления
- [ ] Конкретные рекомендации по улучшению
- [ ] Тесты: проверка full-presentation evaluation

---

## Сводная таблица

| Шаг | Название | Фаза | Файлы | Новые LLM-вызовы | Время |
|-----|----------|------|-------|-------------------|-------|
| 1.1 | LLM QA для всех слайдов | 1 | qaAgent.ts, generator.ts | +5-10 | +5 сек |
| 1.2 | Few-shot Writer (16 shapes) | 1 | prompts.ts | 0 | 0 |
| 1.3 | Few-shot Composer (10 layouts) | 1 | prompts.ts | 0 | 0 |
| 1.4 | Правило 6×6 | 1 | prompts.ts, qaAgent.ts | 0 | 0 |
| 1.5 | CoT для Layout Agent | 1 | prompts.ts, generator.ts | 0 | 0 |
| 1.6 | Storytelling transitions | 1 | generator.ts, prompts.ts | 0 | +2 сек |
| 2.1 | Content Evaluator | 2 | contentEvaluator.ts, generator.ts, prompts.ts | +10-20 | +15 сек |
| 2.2 | Маршрутизация по типу | 2 | presentationClassifier.ts, prompts.ts, generator.ts | +1 | +2 сек |
| 2.3 | Гибридный Writer | 2 | generator.ts, prompts.ts | 0 | +10 сек |
| 3.1 | Layout Voting | 3 | prompts.ts, generator.ts | 0 | 0 |
| 3.2 | Visual Review | 3 | visualReviewer.ts, generator.ts, prompts.ts | +10-15 | +30 сек |
| 3.3 | LLM Design Critic | 3 | designCriticAgent.ts, prompts.ts, generator.ts | +5-10 | +10 сек |
| 4.1 | Web Search | 4 | researchAgent.ts, prompts.ts | +5-10 | +15 сек |
| 4.2 | Reference-based | 4 | referenceLibrary.ts, generator.ts | +1-2 | +5 сек |
| 4.3 | Мультимодальный ревью | 4 | finalReviewer.ts, generator.ts | +1 | +10 сек |

**Итого:** +37-68 LLM-вызовов, +94 секунды максимум (100 → 194 сек)

---

## Порядок выполнения

```
Фаза 1 (Quick Wins):
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
  [checkpoint + тесты]

Фаза 2 (Evaluator-Optimizer):
  2.1 → 2.2 → 2.3
  [checkpoint + тесты]

Фаза 3 (Visual Review):
  3.1 → 3.2 → 3.3
  [checkpoint + тесты]

Фаза 4 (Advanced):
  4.1 → 4.2 → 4.3
  [checkpoint + тесты]
```

Каждая фаза заканчивается чекпоинтом и полным прогоном тестов. Можно остановиться после любой фазы — каждая даёт самостоятельный прирост качества.


---

## Примечание: Инфраструктурная задача (24.02.2026)

Перед началом работы над Фазой 1 была выполнена внеплановая инфраструктурная задача по интеграции Frontend и Backend. Эта работа не является частью roadmap по улучшению качества, но была необходима для обеспечения работоспособности приложения.

**Что было сделано:**
- **Интеграция UI компонентов:** `ChatInput`, `WebSocket`, `StatusCard`, `ArtifactPanel` были подключены в `App.tsx`.
- **Исправление критических багов:** Устранены 7 багов, блокировавших полный цикл генерации (ошибки парсинга в `ExecutionPlanSchema`, отсутствующая регистрация `S1-S5` узлов, некорректный маппинг статусов в `StatusCard`, отсутствие `ARTIFACT_CREATED` событий).

Эта задача была необходима для создания базовой работоспособности, на которой будут строиться дальнейшие улучшения из этого roadmap.
