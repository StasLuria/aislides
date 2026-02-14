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

// Theme presets — imported from shared single source of truth
export { THEME_PRESETS_BASE as THEME_PRESETS, THEME_CATEGORIES } from "@shared/themes";

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
