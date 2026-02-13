/**
 * Constants for AI Presentation Generator Frontend
 * Swiss Precision Design System
 */

// Agent names and their display info
export const AGENTS = {
  master_planner: {
    name: "Master Planner",
    nameRu: "Мастер-планировщик",
    icon: "🎯",
    team: "content" as const,
  },
  outline: {
    name: "Outline Agent",
    nameRu: "Агент структуры",
    icon: "📋",
    team: "content" as const,
  },
  outline_critic: {
    name: "Outline Critic",
    nameRu: "Критик структуры",
    icon: "🔍",
    team: "content" as const,
  },
  writer: {
    name: "Writer Agent",
    nameRu: "Агент-писатель",
    icon: "✍️",
    team: "content" as const,
  },
  storytelling: {
    name: "Storytelling Agent",
    nameRu: "Агент нарратива",
    icon: "📖",
    team: "content" as const,
  },
  research: {
    name: "Research Agent",
    nameRu: "Агент исследования",
    icon: "🔬",
    team: "content" as const,
  },
  layout: {
    name: "Layout Agent",
    nameRu: "Агент разметки",
    icon: "📐",
    team: "design" as const,
  },
  theme: {
    name: "Theme Agent",
    nameRu: "Агент темы",
    icon: "🎨",
    team: "design" as const,
  },
  image: {
    name: "Image Agent",
    nameRu: "Агент изображений",
    icon: "🖼️",
    team: "design" as const,
  },
  chart: {
    name: "Chart Agent",
    nameRu: "Агент графиков",
    icon: "📊",
    team: "design" as const,
  },
  speaker_coach: {
    name: "Speaker Coach",
    nameRu: "Коуч спикера",
    icon: "🎙️",
    team: "content" as const,
  },
  html_composer: {
    name: "HTML Composer",
    nameRu: "HTML-композитор",
    icon: "🔧",
    team: "design" as const,
  },
  design_critic: {
    name: "Design Critic",
    nameRu: "Критик дизайна",
    icon: "🎨",
    team: "design" as const,
  },
  reviewer: {
    name: "Reviewer Agent",
    nameRu: "Агент-ревьюер",
    icon: "✅",
    team: "design" as const,
  },
} as const;

// Generation steps in order
export const GENERATION_STEPS = [
  { key: "planning", label: "Планирование", agent: "master_planner", percent: 5 },
  { key: "outline", label: "Структура", agent: "outline", percent: 12 },
  { key: "critique", label: "Проверка структуры", agent: "outline_critic", percent: 22 },
  { key: "researching", label: "Исследование фактов", agent: "research", percent: 28 },
  { key: "writing", label: "Написание контента", agent: "writer", percent: 38 },
  { key: "storytelling", label: "Улучшение нарратива", agent: "storytelling", percent: 45 },
  { key: "layout", label: "Выбор макетов", agent: "layout", percent: 50 },
  { key: "theme", label: "Дизайн темы", agent: "theme", percent: 60 },
  { key: "images", label: "Генерация иллюстраций", agent: "image", percent: 70 },
  { key: "speaker_notes", label: "Заметки спикера", agent: "speaker_coach", percent: 72 },
  { key: "data_viz", label: "Визуализация данных", agent: "chart", percent: 74 },
  { key: "composing", label: "Сборка HTML", agent: "html_composer", percent: 85 },
  { key: "design_review", label: "Проверка дизайна", agent: "design_critic", percent: 92 },
  { key: "review", label: "Проверка качества", agent: "reviewer", percent: 95 },
  { key: "completed", label: "Готово", agent: "reviewer", percent: 100 },
] as const;

// Theme presets — 10 curated themes with gradient backgrounds
export const THEME_PRESETS = [
  { id: "corporate_blue", name: "Corporate Blue", nameRu: "Корпоративный синий", color: "#2563EB", gradient: "linear-gradient(135deg, #1e40af, #3b82f6)", dark: false, category: "business" as const, descRu: "Профессиональный стиль для бизнес-презентаций" },
  { id: "modern_purple", name: "Modern Purple", nameRu: "Современный фиолетовый", color: "#7C3AED", gradient: "linear-gradient(135deg, #6d28d9, #a78bfa)", dark: false, category: "creative" as const, descRu: "Творческий и инновационный дизайн" },
  { id: "ocean_deep", name: "Ocean Deep", nameRu: "Глубокий океан", color: "#0891B2", gradient: "linear-gradient(135deg, #164e63, #06b6d4)", dark: false, category: "business" as const, descRu: "Спокойный и глубокий профессиональный стиль" },
  { id: "sunset_warm", name: "Sunset Warm", nameRu: "Тёплый закат", color: "#EA580C", gradient: "linear-gradient(135deg, #c2410c, #fb923c)", dark: false, category: "creative" as const, descRu: "Яркий и энергичный стиль" },
  { id: "forest_green", name: "Forest Green", nameRu: "Лесной зелёный", color: "#16A34A", gradient: "linear-gradient(135deg, #166534, #4ade80)", dark: false, category: "nature" as const, descRu: "Природный и экологичный стиль" },
  { id: "cosmic_dark", name: "Cosmic Dark", nameRu: "Космический тёмный", color: "#8B5CF6", gradient: "linear-gradient(135deg, #1e1b4b, #7c3aed, #06b6d4)", dark: true, category: "dark" as const, descRu: "Тёмная тема с космическими акцентами" },
  { id: "rose_gold", name: "Rose Gold", nameRu: "Розовое золото", color: "#E11D48", gradient: "linear-gradient(135deg, #9f1239, #fb7185)", dark: false, category: "creative" as const, descRu: "Элегантный и утончённый дизайн" },
  { id: "arctic_frost", name: "Arctic Frost", nameRu: "Арктический мороз", color: "#6366F1", gradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe, #a5b4fc)", dark: false, category: "nature" as const, descRu: "Лёгкий и воздушный зимний стиль" },
  { id: "midnight_noir", name: "Midnight Noir", nameRu: "Полночный нуар", color: "#F59E0B", gradient: "linear-gradient(135deg, #1c1917, #292524, #f59e0b)", dark: true, category: "dark" as const, descRu: "Тёмный стиль с золотыми акцентами" },
  { id: "citrus_energy", name: "Citrus Energy", nameRu: "Цитрусовая энергия", color: "#84CC16", gradient: "linear-gradient(135deg, #4d7c0f, #a3e635)", dark: false, category: "nature" as const, descRu: "Свежий и энергичный дизайн" },
  { id: "executive_navy_red", name: "Executive Navy & Red", nameRu: "Деловой тёмно-синий", color: "#DC2626", gradient: "linear-gradient(135deg, #1a1a3e, #dc2626)", dark: false, category: "business" as const, descRu: "Строгий деловой стиль с красным акцентом" },
  { id: "data_navy_blue", name: "Data Navy & Blue", nameRu: "Аналитический синий", color: "#2563EB", gradient: "linear-gradient(135deg, #1a1a3e, #2563eb, #dc2626)", dark: false, category: "business" as const, descRu: "Для аналитических и дата-презентаций" },
] as const;

export const THEME_CATEGORIES = [
  { id: "all", nameRu: "Все" },
  { id: "business", nameRu: "Бизнес" },
  { id: "creative", nameRu: "Креатив" },
  { id: "dark", nameRu: "Тёмные" },
  { id: "nature", nameRu: "Природа" },
] as const;

// Layout names
export const LAYOUT_NAMES = [
  "title-slide",
  "section-header",
  "text-slide",
  "two-column",
  "image-text",
  "image-fullscreen",
  "chart-slide",
  "table-slide",
  "icons-numbers",
  "timeline",
  "process-steps",
  "comparison",
  "quote-slide",
  "team-profiles",
  "logo-grid",
  "agenda-table-of-contents",
  "video-embed",
  "final-slide",
  "waterfall-chart",
  "swot-analysis",
  "funnel",
  "roadmap",
  "pyramid",
  "matrix-2x2",
  "pros-cons",
  "checklist",
  "highlight-stats",
] as const;
