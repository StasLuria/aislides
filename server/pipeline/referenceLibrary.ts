/**
 * Reference Library — exemplar presentation structures for each type.
 * The Outline Agent receives the best-matching reference as a structural template,
 * dramatically improving outline quality by providing a proven "skeleton".
 *
 * Each reference includes:
 * - Slide sequence with content_shapes and categories
 * - Narrative arc type
 * - Topic keywords for matching
 */

import type { PresentationType } from "./presentationTypeClassifier";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ReferenceSlide {
  /** Role of the slide in the presentation */
  role: string;
  /** Example title pattern (with {placeholders}) */
  title_pattern: string;
  /** Recommended content_shape */
  content_shape: string;
  /** Slide category tag */
  slide_category: string;
  /** What this slide should accomplish */
  purpose: string;
}

export interface ReferencePresentation {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Presentation type */
  type: PresentationType;
  /** Best narrative arc for this structure */
  narrative_arc: string;
  /** Topic keywords for matching */
  keywords: string[];
  /** Slide count */
  slide_count: number;
  /** Ordered slide sequence */
  slides: ReferenceSlide[];
  /** Key structural principle */
  principle: string;
}

// ═══════════════════════════════════════════════════════
// REFERENCE LIBRARY
// ═══════════════════════════════════════════════════════

export const REFERENCE_LIBRARY: ReferencePresentation[] = [
  // ─── BUSINESS STRATEGY (3 references) ───
  {
    id: "bs_growth_strategy",
    name: "Growth Strategy Deck",
    type: "business_strategy",
    narrative_arc: "PROBLEM-SOLUTION",
    keywords: ["стратегия", "рост", "развитие", "growth", "strategy", "масштабирование", "план развития"],
    slide_count: 12,
    slides: [
      { role: "opening", title_pattern: "{Company}: Стратегия роста на {Year}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Hook with ambitious vision statement" },
      { role: "context", title_pattern: "Текущее положение компании", content_shape: "stat_cards", slide_category: "DATA", purpose: "Key business metrics snapshot" },
      { role: "section", title_pattern: "Анализ рынка", content_shape: "single_concept", slide_category: "SECTION", purpose: "Transition to market analysis" },
      { role: "analysis", title_pattern: "Рыночные возможности", content_shape: "chart_with_context", slide_category: "MARKET", purpose: "Market size and growth data" },
      { role: "analysis", title_pattern: "Конкурентный ландшафт", content_shape: "comparison_two_sides", slide_category: "COMPETITION", purpose: "Competitive positioning" },
      { role: "section", title_pattern: "Стратегия роста", content_shape: "single_concept", slide_category: "SECTION", purpose: "Transition to strategy" },
      { role: "core", title_pattern: "Три направления роста", content_shape: "card_grid", slide_category: "STRATEGY", purpose: "Strategic pillars overview" },
      { role: "core", title_pattern: "План реализации", content_shape: "process_steps", slide_category: "PROCESS", purpose: "Implementation roadmap" },
      { role: "core", title_pattern: "Финансовые прогнозы", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Revenue model and projections" },
      { role: "core", title_pattern: "Дорожная карта", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Key milestones and deadlines" },
      { role: "core", title_pattern: "Риски и митигация", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Risk assessment with mitigation plan" },
      { role: "closing", title_pattern: "Следующие шаги", content_shape: "checklist_items", slide_category: "FINAL", purpose: "Clear action items and CTA" },
    ],
    principle: "Start with current state metrics, build the case with market data, present strategy with clear pillars, close with actionable roadmap.",
  },
  {
    id: "bs_digital_transformation",
    name: "Digital Transformation Plan",
    type: "business_strategy",
    narrative_arc: "JOURNEY",
    keywords: ["цифровая трансформация", "digital transformation", "автоматизация", "цифровизация", "модернизация", "IT стратегия"],
    slide_count: 11,
    slides: [
      { role: "opening", title_pattern: "Цифровая трансформация {Company}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Vision of digital future" },
      { role: "context", title_pattern: "Где мы сейчас", content_shape: "stat_cards", slide_category: "DATA", purpose: "Current digital maturity metrics" },
      { role: "context", title_pattern: "Болевые точки процессов", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Pain points in current operations" },
      { role: "section", title_pattern: "Видение будущего", content_shape: "single_concept", slide_category: "SECTION", purpose: "Transition to solution" },
      { role: "core", title_pattern: "Архитектура решения", content_shape: "process_steps", slide_category: "SOLUTION", purpose: "Technology stack and architecture" },
      { role: "core", title_pattern: "До и после трансформации", content_shape: "comparison_two_sides", slide_category: "CONCEPT", purpose: "Before/after comparison" },
      { role: "core", title_pattern: "Ожидаемые результаты", content_shape: "stat_cards", slide_category: "DATA", purpose: "ROI and efficiency gains" },
      { role: "core", title_pattern: "Этапы внедрения", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Phased implementation plan" },
      { role: "core", title_pattern: "Бюджет и ресурсы", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Investment breakdown" },
      { role: "core", title_pattern: "Управление рисками", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Risk matrix with mitigation" },
      { role: "closing", title_pattern: "Начнём трансформацию", content_shape: "checklist_items", slide_category: "FINAL", purpose: "Immediate next steps" },
    ],
    principle: "Journey arc: show where we are, paint the pain, reveal the vision, prove ROI, provide clear implementation path.",
  },
  {
    id: "bs_market_entry",
    name: "Market Entry Strategy",
    type: "business_strategy",
    narrative_arc: "DATA-DRIVEN",
    keywords: ["выход на рынок", "новый рынок", "экспансия", "market entry", "expansion", "международный"],
    slide_count: 10,
    slides: [
      { role: "opening", title_pattern: "Выход на рынок {Market}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Market opportunity hook" },
      { role: "context", title_pattern: "Размер и динамика рынка", content_shape: "chart_with_context", slide_category: "MARKET", purpose: "TAM/SAM/SOM data" },
      { role: "context", title_pattern: "Целевая аудитория", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Customer segments" },
      { role: "analysis", title_pattern: "Конкуренты на рынке", content_shape: "table_data", slide_category: "COMPETITION", purpose: "Competitive landscape table" },
      { role: "core", title_pattern: "Наше конкурентное преимущество", content_shape: "comparison_two_sides", slide_category: "STRATEGY", purpose: "Why we win" },
      { role: "core", title_pattern: "Стратегия выхода", content_shape: "process_steps", slide_category: "PROCESS", purpose: "Go-to-market plan" },
      { role: "core", title_pattern: "Финансовая модель", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Unit economics and projections" },
      { role: "core", title_pattern: "Ключевые этапы", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Launch milestones" },
      { role: "core", title_pattern: "Риски и барьеры входа", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Entry barriers analysis" },
      { role: "closing", title_pattern: "Инвестиции и возврат", content_shape: "stat_cards", slide_category: "FINAL", purpose: "Investment ask with ROI" },
    ],
    principle: "Data-driven: lead with market size, validate with competitive analysis, prove with financial model.",
  },

  // ─── PRODUCT PITCH (3 references) ───
  {
    id: "pp_saas_product",
    name: "SaaS Product Pitch",
    type: "product_pitch",
    narrative_arc: "PROBLEM-SOLUTION",
    keywords: ["продукт", "SaaS", "платформа", "сервис", "приложение", "product", "software", "решение"],
    slide_count: 11,
    slides: [
      { role: "opening", title_pattern: "{Product}: {One-line value prop}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Product name + compelling tagline" },
      { role: "context", title_pattern: "Проблема, которую мы решаем", content_shape: "stat_cards", slide_category: "DATA", purpose: "Problem quantified with metrics" },
      { role: "context", title_pattern: "Как это выглядит сегодня", content_shape: "comparison_two_sides", slide_category: "CONCEPT", purpose: "Current pain vs desired state" },
      { role: "section", title_pattern: "Наше решение", content_shape: "single_concept", slide_category: "SECTION", purpose: "Product introduction" },
      { role: "core", title_pattern: "Ключевые возможности", content_shape: "card_grid", slide_category: "SOLUTION", purpose: "Feature overview with icons" },
      { role: "core", title_pattern: "Как это работает", content_shape: "process_steps", slide_category: "PROCESS", purpose: "User journey / workflow" },
      { role: "core", title_pattern: "Результаты клиентов", content_shape: "stat_cards", slide_category: "DATA", purpose: "Social proof with metrics" },
      { role: "core", title_pattern: "Отзыв клиента", content_shape: "quote_highlight", slide_category: "CONCEPT", purpose: "Testimonial from key customer" },
      { role: "core", title_pattern: "Тарифные планы", content_shape: "table_data", slide_category: "ECONOMICS", purpose: "Pricing comparison" },
      { role: "core", title_pattern: "Дорожная карта продукта", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Upcoming features" },
      { role: "closing", title_pattern: "Начните бесплатно", content_shape: "single_concept", slide_category: "FINAL", purpose: "CTA with next steps" },
    ],
    principle: "Problem → Solution → Proof → Pricing → CTA. Lead with pain, show the fix, prove it works.",
  },
  {
    id: "pp_hardware_product",
    name: "Hardware/Physical Product Launch",
    type: "product_pitch",
    narrative_arc: "VISION",
    keywords: ["устройство", "hardware", "запуск продукта", "launch", "новинка", "гаджет", "оборудование"],
    slide_count: 10,
    slides: [
      { role: "opening", title_pattern: "Встречайте {Product}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Dramatic product reveal" },
      { role: "context", title_pattern: "Рынок и тренды", content_shape: "chart_with_context", slide_category: "MARKET", purpose: "Market context and opportunity" },
      { role: "core", title_pattern: "Характеристики", content_shape: "stat_cards", slide_category: "DATA", purpose: "Key specs as impressive numbers" },
      { role: "core", title_pattern: "Преимущества перед аналогами", content_shape: "comparison_two_sides", slide_category: "COMPETITION", purpose: "Head-to-head comparison" },
      { role: "core", title_pattern: "Технология внутри", content_shape: "process_steps", slide_category: "SOLUTION", purpose: "How it works technically" },
      { role: "core", title_pattern: "Сценарии использования", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Use cases with icons" },
      { role: "core", title_pattern: "Что говорят эксперты", content_shape: "quote_highlight", slide_category: "CONCEPT", purpose: "Expert endorsement" },
      { role: "core", title_pattern: "Линейка продуктов", content_shape: "table_data", slide_category: "ECONOMICS", purpose: "Product variants and pricing" },
      { role: "core", title_pattern: "План запуска", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Launch timeline" },
      { role: "closing", title_pattern: "Предзаказ открыт", content_shape: "single_concept", slide_category: "FINAL", purpose: "Purchase CTA" },
    ],
    principle: "Vision arc: reveal product, prove superiority, show use cases, close with urgency.",
  },

  // ─── INVESTOR DECK (3 references) ───
  {
    id: "id_seed_round",
    name: "Seed/Series A Pitch Deck",
    type: "investor_deck",
    narrative_arc: "PROBLEM-SOLUTION",
    keywords: ["инвестиции", "раунд", "seed", "series", "инвестор", "pitch deck", "стартап", "фандрайзинг", "венчур"],
    slide_count: 12,
    slides: [
      { role: "opening", title_pattern: "{Company}: {Mission statement}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Company + mission in one line" },
      { role: "context", title_pattern: "Проблема рынка", content_shape: "stat_cards", slide_category: "DATA", purpose: "Problem quantified ($B market inefficiency)" },
      { role: "core", title_pattern: "Наше решение", content_shape: "card_grid", slide_category: "SOLUTION", purpose: "Product overview with key features" },
      { role: "core", title_pattern: "Бизнес-модель", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Revenue model (LTV, CAC, margins)" },
      { role: "core", title_pattern: "Размер рынка", content_shape: "chart_with_context", slide_category: "MARKET", purpose: "TAM → SAM → SOM with growth" },
      { role: "core", title_pattern: "Трекшн и метрики", content_shape: "stat_cards", slide_category: "DATA", purpose: "Traction proof (MRR, users, growth rate)" },
      { role: "core", title_pattern: "Конкурентное преимущество", content_shape: "comparison_two_sides", slide_category: "COMPETITION", purpose: "Moat and differentiation" },
      { role: "core", title_pattern: "Команда", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Founding team with credentials" },
      { role: "core", title_pattern: "Финансовые прогнозы", content_shape: "chart_with_context", slide_category: "ECONOMICS", purpose: "3-year revenue projections" },
      { role: "core", title_pattern: "Дорожная карта", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Product and business milestones" },
      { role: "core", title_pattern: "Использование инвестиций", content_shape: "stat_cards", slide_category: "ECONOMICS", purpose: "Fund allocation breakdown" },
      { role: "closing", title_pattern: "Раунд: ${Amount}", content_shape: "single_concept", slide_category: "FINAL", purpose: "Ask amount + terms + contact" },
    ],
    principle: "Classic investor deck: Problem → Solution → Market → Traction → Team → Financials → Ask. Every slide must build investor confidence.",
  },
  {
    id: "id_growth_round",
    name: "Growth Round / Series B+ Deck",
    type: "investor_deck",
    narrative_arc: "DATA-DRIVEN",
    keywords: ["series b", "series c", "growth", "масштабирование", "unit economics", "юнит-экономика"],
    slide_count: 11,
    slides: [
      { role: "opening", title_pattern: "{Company}: масштабирование лидера рынка", content_shape: "single_concept", slide_category: "TITLE", purpose: "Position as market leader" },
      { role: "context", title_pattern: "Ключевые метрики", content_shape: "stat_cards", slide_category: "DATA", purpose: "Impressive traction numbers" },
      { role: "context", title_pattern: "Динамика роста", content_shape: "chart_with_context", slide_category: "DATA", purpose: "Revenue/user growth charts" },
      { role: "core", title_pattern: "Юнит-экономика", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "LTV/CAC ratio, payback period" },
      { role: "core", title_pattern: "Доля рынка и конкуренция", content_shape: "comparison_two_sides", slide_category: "COMPETITION", purpose: "Market position vs competitors" },
      { role: "core", title_pattern: "Стратегия масштабирования", content_shape: "card_grid", slide_category: "STRATEGY", purpose: "Growth levers" },
      { role: "core", title_pattern: "Новые рынки и продукты", content_shape: "process_steps", slide_category: "PROCESS", purpose: "Expansion plan" },
      { role: "core", title_pattern: "Финансовые прогнозы", content_shape: "chart_with_context", slide_category: "ECONOMICS", purpose: "5-year projections" },
      { role: "core", title_pattern: "Команда и культура", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Leadership team" },
      { role: "core", title_pattern: "Использование средств", content_shape: "stat_cards", slide_category: "ECONOMICS", purpose: "Capital allocation" },
      { role: "closing", title_pattern: "Инвестиционное предложение", content_shape: "single_concept", slide_category: "FINAL", purpose: "Terms and next steps" },
    ],
    principle: "Data-first: lead with impressive metrics, prove unit economics, show clear path to scale.",
  },

  // ─── EDUCATIONAL (3 references) ───
  {
    id: "ed_training_course",
    name: "Training Course / Workshop",
    type: "educational",
    narrative_arc: "FRAMEWORK",
    keywords: ["обучение", "тренинг", "курс", "workshop", "мастер-класс", "навыки", "методология", "training"],
    slide_count: 12,
    slides: [
      { role: "opening", title_pattern: "{Topic}: Практическое руководство", content_shape: "single_concept", slide_category: "TITLE", purpose: "Course title + what you'll learn" },
      { role: "context", title_pattern: "Почему это важно", content_shape: "stat_cards", slide_category: "DATA", purpose: "Industry stats showing relevance" },
      { role: "context", title_pattern: "Программа обучения", content_shape: "process_steps", slide_category: "OVERVIEW", purpose: "Course structure overview" },
      { role: "section", title_pattern: "Основы и концепции", content_shape: "single_concept", slide_category: "SECTION", purpose: "Section 1 header" },
      { role: "core", title_pattern: "Ключевые понятия", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Core definitions and concepts" },
      { role: "core", title_pattern: "Как это работает", content_shape: "process_steps", slide_category: "PROCESS", purpose: "Mechanism or methodology" },
      { role: "section", title_pattern: "Практика и применение", content_shape: "single_concept", slide_category: "SECTION", purpose: "Section 2 header" },
      { role: "core", title_pattern: "Пошаговая методика", content_shape: "checklist_items", slide_category: "PROCESS", purpose: "Step-by-step guide" },
      { role: "core", title_pattern: "Типичные ошибки", content_shape: "comparison_two_sides", slide_category: "CONCEPT", purpose: "Do's vs Don'ts" },
      { role: "core", title_pattern: "Примеры из практики", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Real-world case studies" },
      { role: "core", title_pattern: "Метрики успеха", content_shape: "stat_cards", slide_category: "DATA", purpose: "How to measure results" },
      { role: "closing", title_pattern: "Домашнее задание", content_shape: "checklist_items", slide_category: "FINAL", purpose: "Action items for practice" },
    ],
    principle: "Framework arc: introduce concepts progressively, alternate theory with practice, close with actionable exercises.",
  },
  {
    id: "ed_tech_overview",
    name: "Technology Overview / Deep Dive",
    type: "educational",
    narrative_arc: "FRAMEWORK",
    keywords: ["технология", "AI", "machine learning", "блокчейн", "архитектура", "обзор технологии", "deep dive", "tech"],
    slide_count: 10,
    slides: [
      { role: "opening", title_pattern: "{Technology}: Полный обзор", content_shape: "single_concept", slide_category: "TITLE", purpose: "Technology name + scope" },
      { role: "context", title_pattern: "Зачем это нужно", content_shape: "stat_cards", slide_category: "DATA", purpose: "Market adoption and impact stats" },
      { role: "core", title_pattern: "Как это работает", content_shape: "process_steps", slide_category: "PROCESS", purpose: "Technical mechanism explained simply" },
      { role: "core", title_pattern: "Ключевые компоненты", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Architecture components" },
      { role: "core", title_pattern: "Сравнение подходов", content_shape: "comparison_two_sides", slide_category: "CONCEPT", purpose: "Different approaches compared" },
      { role: "core", title_pattern: "Реальные кейсы", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Industry use cases" },
      { role: "core", title_pattern: "Метрики и бенчмарки", content_shape: "chart_with_context", slide_category: "DATA", purpose: "Performance benchmarks" },
      { role: "core", title_pattern: "Ограничения и вызовы", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Honest limitations assessment" },
      { role: "core", title_pattern: "Тренды и будущее", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Technology evolution roadmap" },
      { role: "closing", title_pattern: "С чего начать", content_shape: "checklist_items", slide_category: "FINAL", purpose: "Getting started guide" },
    ],
    principle: "Progressive disclosure: what → how → why → limitations → future. Build understanding layer by layer.",
  },

  // ─── QUARTERLY REVIEW (3 references) ───
  {
    id: "qr_business_review",
    name: "Quarterly Business Review (QBR)",
    type: "quarterly_review",
    narrative_arc: "DATA-DRIVEN",
    keywords: ["квартальный отчёт", "QBR", "результаты квартала", "quarterly review", "итоги", "отчёт", "KPI"],
    slide_count: 11,
    slides: [
      { role: "opening", title_pattern: "Итоги {Quarter} {Year}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Quarter + headline result" },
      { role: "context", title_pattern: "Ключевые показатели", content_shape: "stat_cards", slide_category: "DATA", purpose: "Top-line KPIs vs targets" },
      { role: "context", title_pattern: "Динамика выручки", content_shape: "chart_with_context", slide_category: "DATA", purpose: "Revenue trend with context" },
      { role: "section", title_pattern: "Результаты по направлениям", content_shape: "single_concept", slide_category: "SECTION", purpose: "Section divider" },
      { role: "core", title_pattern: "Продажи и маркетинг", content_shape: "stat_cards", slide_category: "DATA", purpose: "Sales metrics and funnel" },
      { role: "core", title_pattern: "Продукт и разработка", content_shape: "checklist_items", slide_category: "PROCESS", purpose: "Shipped features and milestones" },
      { role: "core", title_pattern: "Операционная эффективность", content_shape: "comparison_two_sides", slide_category: "DATA", purpose: "Plan vs actual comparison" },
      { role: "core", title_pattern: "Финансовые результаты", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "P&L summary" },
      { role: "core", title_pattern: "Проблемы и уроки", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "What went wrong + lessons" },
      { role: "core", title_pattern: "Планы на {Next Quarter}", content_shape: "card_grid", slide_category: "STRATEGY", purpose: "Next quarter priorities" },
      { role: "closing", title_pattern: "Цели и KPI", content_shape: "stat_cards", slide_category: "FINAL", purpose: "Next quarter targets" },
    ],
    principle: "Data-driven: lead with results, break down by department, be honest about failures, close with forward-looking targets.",
  },
  {
    id: "qr_project_status",
    name: "Project Status Report",
    type: "quarterly_review",
    narrative_arc: "JOURNEY",
    keywords: ["статус проекта", "прогресс", "project status", "milestone", "спринт", "отчёт о проекте"],
    slide_count: 10,
    slides: [
      { role: "opening", title_pattern: "Проект {Name}: статус на {Date}", content_shape: "single_concept", slide_category: "TITLE", purpose: "Project name + overall status" },
      { role: "context", title_pattern: "Обзор проекта", content_shape: "stat_cards", slide_category: "DATA", purpose: "Key project metrics (% complete, budget, timeline)" },
      { role: "core", title_pattern: "Выполненные задачи", content_shape: "checklist_items", slide_category: "PROCESS", purpose: "Completed milestones" },
      { role: "core", title_pattern: "Текущий спринт", content_shape: "kanban_board", slide_category: "PROCESS", purpose: "Current work in progress" },
      { role: "core", title_pattern: "Таймлайн проекта", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Project timeline with status" },
      { role: "core", title_pattern: "Бюджет и ресурсы", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Budget utilization" },
      { role: "core", title_pattern: "Риски и блокеры", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Active risks and blockers" },
      { role: "core", title_pattern: "Команда проекта", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Team roles and responsibilities" },
      { role: "core", title_pattern: "Решения для принятия", content_shape: "comparison_two_sides", slide_category: "STRATEGY", purpose: "Decisions needed from stakeholders" },
      { role: "closing", title_pattern: "Следующие шаги", content_shape: "checklist_items", slide_category: "FINAL", purpose: "Action items with owners" },
    ],
    principle: "Journey arc: where we are, what we've done, what's blocking us, what we need from you.",
  },
  {
    id: "qr_annual_report",
    name: "Annual Report / Year in Review",
    type: "quarterly_review",
    narrative_arc: "JOURNEY",
    keywords: ["годовой отчёт", "итоги года", "annual report", "year in review", "годовые результаты"],
    slide_count: 12,
    slides: [
      { role: "opening", title_pattern: "{Year}: Год достижений", content_shape: "single_concept", slide_category: "TITLE", purpose: "Year + headline achievement" },
      { role: "context", title_pattern: "Год в цифрах", content_shape: "stat_cards", slide_category: "DATA", purpose: "Top-line annual metrics" },
      { role: "context", title_pattern: "Динамика ключевых показателей", content_shape: "chart_with_context", slide_category: "DATA", purpose: "Year-over-year trends" },
      { role: "section", title_pattern: "Ключевые достижения", content_shape: "single_concept", slide_category: "SECTION", purpose: "Section divider" },
      { role: "core", title_pattern: "Главные победы года", content_shape: "card_grid", slide_category: "CONCEPT", purpose: "Top achievements" },
      { role: "core", title_pattern: "Хронология событий", content_shape: "timeline_events", slide_category: "TIMELINE", purpose: "Key events throughout the year" },
      { role: "core", title_pattern: "Финансовые результаты", content_shape: "financial_formula", slide_category: "ECONOMICS", purpose: "Annual P&L" },
      { role: "core", title_pattern: "Рост команды", content_shape: "stat_cards", slide_category: "DATA", purpose: "Team growth metrics" },
      { role: "core", title_pattern: "Уроки и вызовы", content_shape: "analysis_with_verdict", slide_category: "RISKS", purpose: "Honest reflection" },
      { role: "section", title_pattern: "Планы на {Next Year}", content_shape: "single_concept", slide_category: "SECTION", purpose: "Section divider" },
      { role: "core", title_pattern: "Стратегические приоритеты", content_shape: "card_grid", slide_category: "STRATEGY", purpose: "Next year focus areas" },
      { role: "closing", title_pattern: "Вместе к новым высотам", content_shape: "single_concept", slide_category: "FINAL", purpose: "Inspirational close" },
    ],
    principle: "Celebrate achievements, be transparent about challenges, inspire with future vision.",
  },
];

// ═══════════════════════════════════════════════════════
// MATCHING LOGIC
// ═══════════════════════════════════════════════════════

/**
 * Match user prompt to the best reference presentation.
 * Scoring: type match (required) + keyword overlap + slide count proximity.
 */
export function matchReference(
  prompt: string,
  type: PresentationType,
  requestedSlideCount?: number,
): ReferencePresentation | null {
  const promptLower = prompt.toLowerCase();

  // Filter by type first
  const candidates = REFERENCE_LIBRARY.filter((ref) => ref.type === type);
  if (candidates.length === 0) return null;

  // Score each candidate
  const scored = candidates.map((ref) => {
    let score = 0;

    // Keyword match score (0-10)
    const keywordMatches = ref.keywords.filter((kw) => promptLower.includes(kw.toLowerCase()));
    score += Math.min(keywordMatches.length * 2, 10);

    // Slide count proximity bonus (0-3)
    if (requestedSlideCount) {
      const diff = Math.abs(ref.slide_count - requestedSlideCount);
      score += Math.max(0, 3 - diff);
    }

    return { ref, score, keywordMatches };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return best match (or first candidate if no keywords match)
  return scored[0].ref;
}

/**
 * Format a reference presentation as a hint for the Outline Agent.
 * Returns a structured text block that guides the LLM.
 */
export function formatReferenceHint(ref: ReferencePresentation): string {
  const slideList = ref.slides
    .map(
      (s, i) =>
        `  ${i + 1}. [${s.role.toUpperCase()}] "${s.title_pattern}" → content_shape: ${s.content_shape}, category: ${s.slide_category} — ${s.purpose}`,
    )
    .join("\n");

  return `<reference_structure>
REFERENCE: "${ref.name}" (${ref.narrative_arc} arc, ${ref.slide_count} slides)
PRINCIPLE: ${ref.principle}

RECOMMENDED SLIDE SEQUENCE:
${slideList}

INSTRUCTIONS:
- Use this structure as a TEMPLATE, not a rigid copy. Adapt titles and content to the user's specific topic.
- Keep the same narrative flow (opening → context → core → closing).
- You may add or remove 1-2 slides based on the topic complexity.
- Content shapes should match the reference unless the user's content clearly needs a different shape.
- Maintain the diversity of content_shapes shown in the reference.
</reference_structure>`;
}
