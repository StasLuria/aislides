# Аудит пайплайна AI-агентов: Стратегия повышения качества презентаций

**Дата:** 14 февраля 2026  
**Версия:** 1.0  
**Статус:** Готов к реализации

---

## Содержание

1. [Резюме](#1-резюме)
2. [Текущая архитектура](#2-текущая-архитектура)
3. [Источники исследования](#3-источники-исследования)
4. [Диагностика: 12 критических проблем](#4-диагностика-12-критических-проблем)
5. [Стратегия улучшений: 3 уровня](#5-стратегия-улучшений-3-уровня)
6. [Детальные рекомендации](#6-детальные-рекомендации)
7. [Приоритизированный план реализации](#7-приоритизированный-план-реализации)
8. [Ожидаемый эффект](#8-ожидаемый-эффект)

---

## 1. Резюме

Текущий пайплайн из 15 агентов генерирует презентации за ~100 секунд с 83.7% успешностью. Однако **качество вывода** существенно ниже потенциала системы. Аудит выявил **12 критических проблем**, устранение которых может повысить качество в 2-3 раза.

**Главный вывод:** Пайплайн работает как **линейная цепочка** (Prompt Chain), где каждый агент выполняется один раз без обратной связи. Исследования OpenAI, Anthropic, PPTAgent и PreGenie единогласно показывают, что **итеративная рефлексия** (Evaluator-Optimizer loop) — ключевой фактор качества для генеративных задач.

> "Reflection takes time! All approaches trade off extra compute for better output quality. While not appropriate for low-latency applications, it IS worthwhile for knowledge intensive tasks where response QUALITY is more important than speed." — LangChain Reflection Agents

---

## 2. Текущая архитектура

### 2.1 Поток данных (15 шагов)

```
Пользователь → [Prompt]
  ↓
1. Master Planner → presentation_title, target_audience, narrative_arc
  ↓
2. Outline Agent → slides[] (title, purpose, key_points, content_shape, slide_category)
  ↓
3. Outline Critic → approve / rewrite (1 итерация максимум)
  ↓
4. Research Agent → facts[], statistics[], industry_context (параллельно по слайдам)
  ↓
5. Writer Agent → text, structured_content, speaker_notes, data_points (параллельно, батчи по 2)
  ↓
6. Storytelling Agent → narrative transitions, emotional arc
  ↓
7. Theme Selector → CSS variables, color palette
  ↓
8. Layout Agent → layout_name per slide (1 вызов на все слайды)
  ↓
9. Image Agent → image selection + generation (параллельно)
  ↓
10. Speaker Coach → refined speaker notes
  ↓
11. Data Viz Agent → SVG charts (параллельно по слайдам с data_points)
  ↓
12. HTML Composer → JSON data per layout template (параллельно, батчи по 3)
  ↓
13. QA Agent → structural validation + fix (inline)
  ↓
14. Design Critic → CSS fixes (local, no LLM)
  ↓
15. Assembly → final HTML
```

### 2.2 LLM-вызовы на 10-слайдовую презентацию

| Этап | Вызовов | Параллельность |
|------|---------|----------------|
| Planner | 1 | — |
| Outline | 1 | — |
| Outline Critic | 1-2 | — |
| Research | ~10 | Параллельно |
| Writer | 10 | Батчи по 2 |
| Storytelling | 1 | — |
| Theme | 0-1 | — |
| Layout | 1 | — |
| Image selection | 1 | — |
| Image generation | 3-5 | Параллельно |
| Speaker Coach | 1 | — |
| Data Viz | 2-3 | Параллельно |
| HTML Composer | 10 + retries | Батчи по 3 |
| LLM QA | 2 | — |
| **Итого** | **~44-48** | |

---

## 3. Источники исследования

| Источник | Тип | Ключевой вклад |
|----------|-----|-----------------|
| [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | Гайдлайн | Evaluator-Optimizer pattern, Parallelization (voting) |
| [OpenAI: Practical Guide to Building Agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) | Гайдлайн | Guardrails, structured outputs, tool documentation |
| [PPTAgent (arXiv 2501.03936)](https://arxiv.org/html/2501.03936v1) | Академия | Schema-driven generation, PPTEval metrics, reference-based approach |
| [PreGenie (arXiv 2505.21660)](https://arxiv.org/html/2505.21660v1) | Академия | Visual review loop, two-level review (code + rendered) |
| [LangChain: Reflection Agents](https://www.blog.langchain.com/reflection-agents/) | Практика | Basic Reflection, Reflexion, LATS patterns |
| [OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering/) | Гайдлайн | Few-shot examples, chain-of-thought, structured output |
| Reddit r/powerpoint | Сообщество | User pain points, quality differentiators |
| Forbes AI Presentation Prompts | Практика | Framework-first approach, Chain of Density |

---

## 4. Диагностика: 12 критических проблем

### Проблема 1: Отсутствие итеративной рефлексии (CRITICAL)

**Текущее состояние:** Каждый агент выполняется ровно один раз. Outline Critic может запросить одну переработку, но это единственная точка обратной связи.

**Почему это плохо:** Anthropic прямо рекомендует Evaluator-Optimizer pattern для контента, который можно итеративно улучшать. PreGenie показала, что итеративный визуальный ревью — ключевой фактор качества.

> "Evaluator-Optimizer is specifically recommended for content that can be iteratively improved (like writing)" — Anthropic

**Влияние:** Ошибки первого прохода (слабый заголовок, неудачная структура, пустые слайды) остаются в финальном результате.

---

### Проблема 2: QA только для 2 слайдов из N (CRITICAL)

**Текущее состояние:** LLM-based QA (`validateCriticalSlideContent`) проверяет только `title-slide` и `final-slide`. Остальные 8-18 слайдов получают только структурную валидацию (проверка наличия полей).

**Почему это плохо:** Самые важные слайды — контентные (данные, аргументы, сравнения). Именно они определяют ценность презентации, но не проходят проверку качества контента.

**Влияние:** Контентные слайды могут содержать generic текст, неточные данные, нерелевантные примеры — и это не будет обнаружено.

---

### Проблема 3: Research Agent без реального поиска (HIGH)

**Текущее состояние:** Research Agent использует только знания LLM (training data). Нет web search, нет доступа к актуальным данным.

```typescript
// Текущая архитектура:
// "The agent uses LLM's training data as the knowledge base"
```

**Почему это плохо:** Факты из training data могут быть устаревшими, неточными или выдуманными (hallucination). Пользователи ожидают актуальных данных в бизнес-презентациях.

**Влияние:** Статистика типа "рынок AI достигнет $X млрд к 2025" может быть неверной. Это подрывает доверие к инструменту.

---

### Проблема 4: Writer без контекста соседних слайдов (HIGH)

**Текущее состояние:** Writer Agent получает контекст через `buildWriterContext`, который включает заголовки всех слайдов и контекст предыдущих слайдов. Однако слайды пишутся параллельно в батчах по 2, что означает, что слайды в одном батче не видят контент друг друга.

**Почему это плохо:** Параллельная генерация создаёт риск повторения одних и тех же фактов, примеров или формулировок на разных слайдах.

**Влияние:** Повторяющийся контент, нарушение нарративной прогрессии, ощущение "copy-paste" между слайдами.

---

### Проблема 5: Layout Agent — один вариант без альтернатив (HIGH)

**Текущее состояние:** Layout Agent выбирает один layout на слайд за один LLM-вызов. Нет генерации альтернатив, нет скоринга.

**Почему это плохо:** Сообщество отмечает, что лучшие инструменты (Alai) дают 4 варианта layout на слайд. Один вариант = высокий риск неоптимального выбора.

> "Alai gives you 4 layout options per slide instead of one take-it-or-leave-it output" — Reddit

**Влияние:** Неоптимальные layouts (текстовый layout для числовых данных, chart layout для текстового контента).

---

### Проблема 6: Нет визуальной проверки рендеринга (HIGH)

**Текущее состояние:** Design Critic Agent работает на уровне кода (CSS/HTML), не видит отрендеренный результат. Нет screenshot → MLLM evaluation.

**Почему это плохо:** PreGenie показала, что "some issues cannot be easily identified through code alone — images might overlap, text-image layout might appear too crowded."

**Влияние:** Визуальные артефакты (перекрытие элементов, обрезанный текст, пустые области) не обнаруживаются.

---

### Проблема 7: Нарушение правила 6x6 (MEDIUM)

**Текущее состояние:** Writer Agent может генерировать 8-12 bullet points. HTML Composer запрашивает "EXACTLY 4-5 bullets" но не всегда получает это.

**Почему это плохо:** Правило 6x6 (max 6 bullets, max 6 words per line) — базовый стандарт качества презентаций. Перегруженные слайды = плохое восприятие.

**Влияние:** Слайды выглядят как документы, а не презентации. Аудитория не может быстро считать информацию.

---

### Проблема 8: Storytelling Agent не влияет на контент (MEDIUM)

**Текущее состояние:** Storytelling Agent генерирует transitions и emotional arc, но эти данные добавляются в speaker notes, а не в контент слайдов.

**Почему это плохо:** Нарративная связность — один из трёх ключевых метрик качества (PPTEval: Content, Design, Coherence). Если transitions только в заметках, слайды остаются разрозненными.

**Влияние:** Презентация ощущается как набор отдельных слайдов, а не связная история.

---

### Проблема 9: HTML Composer — слишком сложный промпт (MEDIUM)

**Текущее состояние:** HTML Composer получает layout template (HTML), slide content, structured_content, theme CSS — и должен произвести JSON data. Промпт содержит 42 layout описания + правила маппинга.

**Почему это плохо:** OpenAI рекомендует "split complex tasks into simpler subtasks" и "provide examples". Наш промпт перегружен инструкциями без few-shot примеров для каждого layout.

**Влияние:** LLM часто генерирует неправильную структуру данных, что требует fallback и снижает качество.

---

### Проблема 10: Отсутствие few-shot примеров в ключевых промптах (MEDIUM)

**Текущее состояние:** Planner имеет 3 few-shot примера, но Writer, HTML Composer, Layout Agent — не имеют конкретных примеров вход→выход.

**Почему это плохо:** OpenAI Prompt Engineering Guide: "Providing a few examples is often more effective than describing the desired output in abstract terms."

**Влияние:** Модель "угадывает" формат вместо следования конкретному шаблону.

---

### Проблема 11: Нет маршрутизации по типу презентации (MEDIUM)

**Текущее состояние:** Один и тот же набор промптов используется для бизнес-стратегии, технического обзора, образовательного курса, маркетингового питча.

**Почему это плохо:** Anthropic рекомендует Routing pattern — классификация входа и направление к специализированным промптам.

**Влияние:** Образовательная презентация получает бизнес-структуру. Маркетинговый питч получает академический тон.

---

### Проблема 12: Design Critic без LLM (LOW → HIGH при масштабировании)

**Текущее состояние:** Design Critic Agent работает чисто программно — проверяет CSS, плотность контента, размеры шрифтов. Не использует LLM для оценки визуального качества.

**Почему это плохо:** Программные проверки ловят только структурные проблемы. Эстетические проблемы (плохая цветовая комбинация, неудачная типографика, визуальный дисбаланс) остаются.

**Влияние:** Технически корректные, но визуально непривлекательные слайды.

---

## 5. Стратегия улучшений: 3 уровня

### Уровень 1: Quick Wins (1-3 дня, +30-50% качества)

Минимальные изменения кода с максимальным эффектом. Не меняют архитектуру.

| # | Улучшение | Проблема | Усилия | Эффект |
|---|-----------|----------|--------|--------|
| 1.1 | Расширить LLM QA на ВСЕ слайды | #2 | 2 часа | Высокий |
| 1.2 | Добавить few-shot примеры в Writer и Composer | #10 | 4 часа | Высокий |
| 1.3 | Ужесточить правило 6x6 в промптах | #7 | 1 час | Средний |
| 1.4 | Внедрить Storytelling transitions в контент | #8 | 3 часа | Средний |
| 1.5 | Добавить Chain-of-Thought в Layout Agent | #5 | 2 часа | Средний |

### Уровень 2: Архитектурные улучшения (1-2 недели, +100-150% качества)

Новые агенты и паттерны. Меняют поток данных.

| # | Улучшение | Проблема | Усилия | Эффект |
|---|-----------|----------|--------|--------|
| 2.1 | Evaluator-Optimizer loop для контента | #1 | 3 дня | Критический |
| 2.2 | Маршрутизация по типу презентации | #11 | 2 дня | Высокий |
| 2.3 | Визуальный ревью (screenshot → MLLM) | #6 | 3 дня | Высокий |
| 2.4 | Layout Voting (3 варианта → скоринг → лучший) | #5 | 2 дня | Высокий |
| 2.5 | Последовательная генерация Writer с контекстом | #4 | 1 день | Средний |

### Уровень 3: Продвинутые техники (2-4 недели, +200-300% качества)

Фундаментальные изменения. Требуют новой инфраструктуры.

| # | Улучшение | Проблема | Усилия | Эффект |
|---|-----------|----------|--------|--------|
| 3.1 | Web Search интеграция в Research Agent | #3 | 1 неделя | Критический |
| 3.2 | Reference-based generation (анализ лучших презентаций) | Новое | 2 недели | Высокий |
| 3.3 | LATS для Layout (tree search с backpropagation) | #5 | 1 неделя | Средний |
| 3.4 | Мультимодальный Design Critic (LLM + Vision) | #12 | 1 неделя | Высокий |

---

## 6. Детальные рекомендации

### 6.1 Расширить LLM QA на все слайды (Quick Win)

**Текущее:** `CRITICAL_LAYOUTS = new Set(["title-slide", "final-slide"])`

**Предложение:** Расширить до всех слайдов, но с разными уровнями строгости:

```typescript
const QA_LEVELS = {
  // Полная проверка: relevance + clarity + professionalism + completeness
  full: new Set(["title-slide", "final-slide", "section-header"]),
  // Проверка контента: relevance + completeness + data accuracy
  content: new Set(["stats-chart", "chart-text", "icons-numbers", "comparison-table", 
                     "table-slide", "highlight-stats", "hero-stat"]),
  // Быстрая проверка: completeness + density
  quick: "all_other_layouts"
};
```

**Промпт для content-level QA:**
```
Evaluate this data-focused slide:
1. Data Accuracy (1-10): Are the numbers realistic and internally consistent?
2. Completeness (1-10): Does the slide have enough data points to support its claim?
3. Clarity (1-10): Can the audience understand the data at a glance?
4. Relevance (1-10): Does the data directly support the presentation's argument?
```

**Ожидаемый эффект:** +20% качества контентных слайдов. Стоимость: +2-8 LLM-вызовов (можно параллельно).

---

### 6.2 Few-shot примеры для Writer и Composer (Quick Win)

**Текущее:** Writer получает абстрактные инструкции ("Write 3-4 stat cards"). Composer получает layout template без примера заполнения.

**Предложение:** Добавить 2-3 конкретных few-shot примера для каждого content_shape:

```
<few_shot_examples>
Example: content_shape = "stat_cards", topic = "E-commerce Growth"

Input slide:
- title: "Рост электронной коммерции"
- purpose: "Показать ключевые метрики роста"
- key_points: ["GMV вырос на 47%", "Средний чек увеличился", "Новые категории"]

Output:
{
  "text": "Ключевые показатели роста e-commerce платформы за 2025 год",
  "structured_content": {
    "stat_cards": [
      {"label": "GMV", "value": "₽12.4 млрд", "description": "Рост на 47% год к году, превышая прогноз аналитиков на 12 п.п."},
      {"label": "СРЕДНИЙ ЧЕК", "value": "₽4,200", "description": "Увеличение на 23% благодаря расширению премиум-ассортимента"},
      {"label": "НОВЫЕ КАТЕГОРИИ", "value": "18", "description": "Запуск категорий фарма и DIY обеспечил 31% прироста GMV"}
    ]
  },
  "data_points": [
    {"label": "GMV", "value": "12.4", "unit": "млрд ₽"},
    {"label": "Средний чек", "value": "4200", "unit": "₽"},
    {"label": "Новые категории", "value": "18", "unit": "шт"}
  ],
  "key_message": "E-commerce платформа показала рекордный рост 47% GMV, превысив прогнозы рынка",
  "speaker_notes": "Обратите внимание на три ключевых драйвера роста..."
}
</few_shot_examples>
```

**Ожидаемый эффект:** +25% качества структурированного контента. OpenAI: "Providing examples is often more effective than describing the desired output in abstract terms."

---

### 6.3 Evaluator-Optimizer Loop (Архитектурное)

**Текущее:** Линейная цепочка без обратной связи.

**Предложение:** Добавить Evaluator после Writer и после Composer:

```
Writer Agent → Content Evaluator → [pass/fail]
  ↓ (if fail)                         ↓ (if pass)
Writer Agent (with feedback)     → continue pipeline
  ↓
Content Evaluator → [pass/fail]
  ↓ (if fail after 2 tries)
Accept with warnings → continue
```

**Промпт для Content Evaluator:**
```
You are a Presentation Content Evaluator. Score this slide content on a rubric:

RUBRIC:
1. SPECIFICITY (1-5): Does the content use specific numbers, names, dates? 
   (1 = all generic, 5 = every claim has a specific data point)
2. DENSITY (1-5): Is the content appropriately dense for a slide?
   (1 = wall of text or too sparse, 3 = balanced, 5 = perfect information density)
3. NOVELTY (1-5): Does this slide add NEW information vs previous slides?
   (1 = repeats earlier content, 5 = entirely new perspective)
4. ACTIONABILITY (1-5): Can the audience DO something with this information?
   (1 = purely abstract, 5 = clear next steps or decisions)

PASS threshold: average >= 3.5
If FAIL, provide SPECIFIC rewrite instructions (not vague "improve it").

Example feedback: "SPECIFICITY: 2/5. Replace 'significant growth' with actual percentage. 
Replace 'many companies' with '73% of Fortune 500'. Add year to all statistics."
```

**Ожидаемый эффект:** +40-60% качества контента. Стоимость: +10-20 LLM-вызовов (только для failed slides). Время: +15-30 секунд.

---

### 6.4 Маршрутизация по типу презентации (Архитектурное)

**Текущее:** Один набор промптов для всех типов.

**Предложение:** Классификатор на входе + специализированные промпты:

```typescript
const PRESENTATION_TYPES = {
  "business_strategy": {
    narrative_arcs: ["PROBLEM-SOLUTION", "VISION"],
    preferred_layouts: ["stats-chart", "roadmap", "comparison-table"],
    tone: "authoritative, data-driven",
    content_rules: "Every claim must have a metric. Include competitive analysis.",
    few_shot: "..."
  },
  "product_pitch": {
    narrative_arcs: ["JOURNEY", "PROBLEM-SOLUTION"],
    preferred_layouts: ["hero-stat", "process-steps", "comparison"],
    tone: "enthusiastic but credible",
    content_rules: "Lead with pain point. Demo before features. Social proof required.",
    few_shot: "..."
  },
  "educational": {
    narrative_arcs: ["FRAMEWORK", "DATA-DRIVEN"],
    preferred_layouts: ["numbered-steps-v2", "text-with-callout", "card-grid"],
    tone: "clear, progressive, encouraging",
    content_rules: "Build from simple to complex. Include practice examples.",
    few_shot: "..."
  },
  "investor_deck": {
    narrative_arcs: ["DATA-DRIVEN", "VISION"],
    preferred_layouts: ["highlight-stats", "chart-text", "financial-formula", "roadmap"],
    tone: "confident, metrics-focused",
    content_rules: "TAM/SAM/SOM required. Unit economics. Traction metrics.",
    few_shot: "..."
  },
  "quarterly_review": {
    narrative_arcs: ["DATA-DRIVEN"],
    preferred_layouts: ["stats-chart", "dual-chart", "waterfall-chart", "table-slide"],
    tone: "factual, analytical",
    content_rules: "Compare to previous period. Highlight variances. Action items.",
    few_shot: "..."
  }
};
```

**Ожидаемый эффект:** +30% релевантности контента. Каждый тип получает оптимизированные промпты.

---

### 6.5 Визуальный ревью (Архитектурное)

**Текущее:** Design Critic работает на уровне CSS/HTML кода.

**Предложение:** Рендерить каждый слайд → screenshot → MLLM evaluation:

```
HTML Slide → Puppeteer/Playwright render → PNG screenshot
  ↓
Vision LLM (GPT-4o / Claude 3.5):
"Evaluate this rendered slide on:
1. Readability: Can all text be read easily? (contrast, size, overlap)
2. Balance: Is the layout visually balanced? (whitespace, alignment)
3. Density: Is the slide appropriately filled? (not too sparse, not too crowded)
4. Professionalism: Does it look like a professional presentation?
Score 1-10 for each. If any score < 6, provide CSS fix suggestions."
  ↓
If score < 6 → Apply CSS fixes → Re-render → Re-evaluate (max 2 iterations)
```

**Ожидаемый эффект:** +50% визуального качества. Это единственный способ поймать проблемы, невидимые в коде (PreGenie подтверждает).

**Стоимость:** +10-15 LLM-вызовов с vision. Время: +20-40 секунд.

---

### 6.6 Layout Voting (Архитектурное)

**Текущее:** Один layout на слайд.

**Предложение:** Генерировать 3 варианта layout → скоринг → лучший:

```typescript
// Вариант A: Один LLM-вызов с top-3
const layoutPrompt = `For each slide, suggest your TOP 3 layout choices with confidence scores:
{
  "slide_1": [
    {"layout": "stats-chart", "confidence": 0.9, "rationale": "..."},
    {"layout": "icons-numbers", "confidence": 0.7, "rationale": "..."},
    {"layout": "highlight-stats", "confidence": 0.5, "rationale": "..."}
  ]
}`;

// Вариант B: Три независимых LLM-вызова → majority voting
// (дороже, но надёжнее — Anthropic Parallelization pattern)
```

**Ожидаемый эффект:** +20% оптимальности layout выбора. Минимальная стоимость при варианте A.

---

### 6.7 Последовательный Writer с контекстом (Архитектурное)

**Текущее:** Writer работает параллельно в батчах по 2. Слайды в одном батче не видят контент друг друга.

**Предложение:** Гибридный подход — ключевые слайды последовательно, остальные параллельно:

```
Слайд 1 (title) → последовательно
Слайд 2-3 (context) → последовательно (видят контент слайда 1)
Слайды 4-8 (core) → параллельно (видят контент слайдов 1-3)
Слайд 9-10 (conclusion) → последовательно (видят контент всех предыдущих)
```

**Ожидаемый эффект:** +15% нарративной связности. Минимальное увеличение времени (~10 секунд).

---

### 6.8 Web Search для Research Agent (Продвинутое)

**Текущее:** Research Agent использует только LLM knowledge.

**Предложение:** Интегрировать web search API (Tavily, Serper, или встроенный Data API):

```typescript
async function enrichWithWebSearch(query: string): Promise<SearchResult[]> {
  // 1. Generate search queries from slide topic
  const queries = await generateSearchQueries(slideTopic);
  
  // 2. Execute web search
  const results = await Promise.all(
    queries.map(q => webSearch(q))
  );
  
  // 3. Extract and verify facts
  const facts = await extractVerifiedFacts(results);
  
  // 4. Add source citations
  return facts.map(f => ({
    ...f,
    source: f.url,
    verified: true,
    retrieval_date: new Date().toISOString()
  }));
}
```

**Ожидаемый эффект:** +50% достоверности данных. Устраняет hallucination для фактических утверждений.

---

## 7. Приоритизированный план реализации

### Фаза 1: Quick Wins (Неделя 1)

| День | Задача | Файлы | Эффект |
|------|--------|-------|--------|
| 1 | 1.1 Расширить LLM QA на все слайды | qaAgent.ts, generator.ts | +20% |
| 1-2 | 1.2 Few-shot примеры для Writer (все 16 content_shapes) | prompts.ts | +15% |
| 2-3 | 1.2 Few-shot примеры для Composer (top-10 layouts) | prompts.ts | +10% |
| 3 | 1.3 Ужесточить 6x6 правило | prompts.ts, qaAgent.ts | +5% |
| 3 | 1.4 Storytelling transitions в контент | generator.ts, prompts.ts | +5% |
| 3 | 1.5 Chain-of-Thought в Layout Agent | prompts.ts | +5% |

**Итого Фаза 1: ~+50% качества, 0 новых файлов, ~3 дня**

### Фаза 2: Evaluator-Optimizer (Неделя 2)

| День | Задача | Файлы | Эффект |
|------|--------|-------|--------|
| 1-2 | 2.1 Content Evaluator agent | contentEvaluator.ts, generator.ts | +30% |
| 2-3 | 2.2 Маршрутизация по типу | presentationRouter.ts, prompts.ts | +15% |
| 3 | 2.5 Гибридный Writer (sequential + parallel) | generator.ts | +10% |

**Итого Фаза 2: ~+55% качества (кумулятивно ~+105%), 2 новых файла, ~3 дня**

### Фаза 3: Visual Review (Неделя 3)

| День | Задача | Файлы | Эффект |
|------|--------|-------|--------|
| 1-2 | 2.3 Visual Review agent (screenshot → MLLM) | visualReviewer.ts, generator.ts | +25% |
| 2-3 | 2.4 Layout Voting (top-3 + scoring) | prompts.ts, generator.ts | +10% |
| 3 | 3.4 LLM-based Design Critic | designCriticAgent.ts | +10% |

**Итого Фаза 3: ~+45% качества (кумулятивно ~+150%), 1 новый файл, ~3 дня**

### Фаза 4: Advanced (Недели 4-5)

| Неделя | Задача | Эффект |
|--------|--------|--------|
| 4 | 3.1 Web Search интеграция | +30% достоверности |
| 5 | 3.2 Reference-based generation | +20% дизайна |

**Итого Фаза 4: ~+50% качества (кумулятивно ~+200%)**

---

## 8. Ожидаемый эффект

### Метрики качества (PPTEval framework)

| Метрика | Сейчас (оценка) | После Quick Wins | После всех фаз |
|---------|-----------------|------------------|-----------------|
| Content Quality | 5/10 | 7/10 | 9/10 |
| Design Quality | 6/10 | 7/10 | 8.5/10 |
| Coherence | 4/10 | 6/10 | 8/10 |
| Data Accuracy | 3/10 | 4/10 | 8/10 |
| **Общий балл** | **4.5/10** | **6/10** | **8.4/10** |

### Влияние на время генерации

| Фаза | Текущее время | Добавленное время | Итого |
|------|---------------|-------------------|-------|
| Quick Wins | ~100 сек | +5-10 сек | ~110 сек |
| Evaluator-Optimizer | ~110 сек | +15-30 сек | ~130 сек |
| Visual Review | ~130 сек | +20-40 сек | ~160 сек |
| Web Search | ~160 сек | +10-20 сек | ~180 сек |

**Компромисс:** Время увеличивается на ~80% (100→180 сек), но качество растёт на ~200%. Для бизнес-презентаций 3 минуты — приемлемое время.

### Влияние на стоимость (LLM-вызовы)

| Фаза | Вызовов сейчас | Дополнительно | Итого |
|------|----------------|---------------|-------|
| Quick Wins | ~45 | +5-10 | ~55 |
| Evaluator-Optimizer | ~55 | +10-20 | ~70 |
| Visual Review | ~70 | +10-15 | ~85 |
| Web Search | ~85 | +5-10 | ~95 |

**Итого: ~95 LLM-вызовов vs ~45 сейчас (+111%). При текущих ценах API это ~$0.15-0.25 за презентацию.**

---

## Приложение A: Чеклист реализации Quick Wins

- [ ] Расширить `CRITICAL_LAYOUTS` до всех layout типов с тремя уровнями QA
- [ ] Добавить `QA_LEVELS` map: full / content / quick
- [ ] Написать промпт для content-level QA (data accuracy + completeness)
- [ ] Написать промпт для quick QA (density + completeness)
- [ ] Добавить 16 few-shot примеров в Writer (по одному на content_shape)
- [ ] Добавить 10 few-shot примеров в HTML Composer (top-10 layouts)
- [ ] Добавить max_bullets: 6, max_words_per_bullet: 10 в Writer промпт
- [ ] Добавить валидацию 6x6 в QA Agent
- [ ] Модифицировать Storytelling Agent для генерации transition phrases
- [ ] Внедрить transitions в HTML Composer (subtitle или transition_text поле)
- [ ] Добавить Chain-of-Thought в Layout Agent: "Think step by step: 1) What type of content is this? 2) What visual representation best conveys this? 3) Which layout matches?"
- [ ] Написать тесты для всех изменений

## Приложение B: Архитектурная диаграмма (после всех улучшений)

```
User Prompt
  ↓
[Classifier] → presentation_type (business/product/education/investor/review)
  ↓
[Master Planner] → (specialized prompts per type)
  ↓
[Outline Agent] → slides[]
  ↓
[Outline Critic] → approve / rewrite (max 2 iterations)
  ↓
[Research Agent + Web Search] → verified facts with sources
  ↓
[Writer Agent] → hybrid sequential/parallel
  ↓
[Content Evaluator] → score rubric → rewrite if < 3.5 (max 2 iterations)
  ↓
[Storytelling Agent] → transitions + emotional arc → inject into content
  ↓
[Theme Selector] → CSS variables
  ↓
[Layout Agent + Voting] → top-3 layouts → score → best
  ↓
[Image Agent] → selection + generation
  ↓
[Speaker Coach] → refined notes
  ↓
[Data Viz Agent] → SVG charts
  ↓
[HTML Composer] → JSON data (with few-shot examples)
  ↓
[QA Agent] → 3-level validation (full/content/quick) for ALL slides
  ↓
[Visual Reviewer] → screenshot → MLLM → CSS fixes (max 2 iterations)
  ↓
[Design Critic + LLM] → final visual polish
  ↓
Assembly → Final HTML
```
