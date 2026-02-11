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
  writer: {
    name: "Writer Agent",
    nameRu: "Агент-писатель",
    icon: "✍️",
    team: "content" as const,
  },
  search: {
    name: "Search Agent",
    nameRu: "Агент поиска",
    icon: "🔍",
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
  html_composer: {
    name: "HTML Composer",
    nameRu: "HTML-композитор",
    icon: "🔧",
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
  { key: "outline", label: "Структура", agent: "outline", percent: 15 },
  { key: "research", label: "Исследование", agent: "search", percent: 25 },
  { key: "writing", label: "Написание контента", agent: "writer", percent: 40 },
  { key: "layout", label: "Выбор макетов", agent: "layout", percent: 50 },
  { key: "theme", label: "Дизайн темы", agent: "theme", percent: 60 },
  { key: "images", label: "Подбор изображений", agent: "image", percent: 70 },
  { key: "charts", label: "Создание графиков", agent: "chart", percent: 78 },
  { key: "composing", label: "Сборка HTML", agent: "html_composer", percent: 88 },
  { key: "review", label: "Проверка качества", agent: "reviewer", percent: 95 },
  { key: "completed", label: "Готово", agent: "reviewer", percent: 100 },
] as const;

// Theme presets — 10 curated themes with gradient backgrounds
export const THEME_PRESETS = [
  { id: "corporate_blue", name: "Corporate Blue", nameRu: "Корпоративный синий", color: "#2563EB", gradient: "linear-gradient(135deg, #1e40af, #3b82f6)", dark: false },
  { id: "modern_purple", name: "Modern Purple", nameRu: "Современный фиолетовый", color: "#7C3AED", gradient: "linear-gradient(135deg, #6d28d9, #a78bfa)", dark: false },
  { id: "ocean_deep", name: "Ocean Deep", nameRu: "Глубокий океан", color: "#0891B2", gradient: "linear-gradient(135deg, #164e63, #06b6d4)", dark: false },
  { id: "sunset_warm", name: "Sunset Warm", nameRu: "Тёплый закат", color: "#EA580C", gradient: "linear-gradient(135deg, #c2410c, #fb923c)", dark: false },
  { id: "forest_green", name: "Forest Green", nameRu: "Лесной зелёный", color: "#16A34A", gradient: "linear-gradient(135deg, #166534, #4ade80)", dark: false },
  { id: "cosmic_dark", name: "Cosmic Dark", nameRu: "Космический тёмный", color: "#8B5CF6", gradient: "linear-gradient(135deg, #1e1b4b, #7c3aed, #06b6d4)", dark: true },
  { id: "rose_gold", name: "Rose Gold", nameRu: "Розовое золото", color: "#E11D48", gradient: "linear-gradient(135deg, #9f1239, #fb7185)", dark: false },
  { id: "arctic_frost", name: "Arctic Frost", nameRu: "Арктический мороз", color: "#6366F1", gradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe, #a5b4fc)", dark: false },
  { id: "midnight_noir", name: "Midnight Noir", nameRu: "Полночный нуар", color: "#F59E0B", gradient: "linear-gradient(135deg, #1c1917, #292524, #f59e0b)", dark: true },
  { id: "citrus_energy", name: "Citrus Energy", nameRu: "Цитрусовая энергия", color: "#84CC16", gradient: "linear-gradient(135deg, #4d7c0f, #a3e635)", dark: false },
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
] as const;
