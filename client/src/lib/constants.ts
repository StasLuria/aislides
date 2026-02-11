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

// Theme presets
export const THEME_PRESETS = [
  { id: "corporate_blue", name: "Corporate Blue", color: "#2563EB" },
  { id: "modern_purple", name: "Modern Purple", color: "#7C3AED" },
  { id: "vibrant_orange", name: "Vibrant Orange", color: "#EA580C" },
  { id: "elegant_dark", name: "Elegant Dark", color: "#1E293B" },
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
