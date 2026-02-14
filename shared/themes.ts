/**
 * Shared Theme Definitions — single source of truth for theme metadata.
 *
 * Both client (UI selector) and server (theme engine) import from here.
 * Server extends with cssVariables/fontsUrl/mood in server/pipeline/themes.ts.
 * Client uses the base fields directly for the theme picker UI.
 */

/** Base theme metadata shared between client and server */
export interface ThemePresetBase {
  id: string;
  name: string;
  nameRu: string;
  /** Primary accent color (hex) */
  color: string;
  /** CSS gradient for preview swatch */
  gradient: string;
  /** Whether this is a dark theme */
  dark: boolean;
  /** Theme category for filtering */
  category: "business" | "creative" | "dark" | "nature";
  /** Russian description for UI */
  descRu: string;
}

/** Theme category for the filter UI */
export interface ThemeCategory {
  id: "all" | "business" | "creative" | "dark" | "nature";
  nameRu: string;
}

/**
 * 12 curated theme presets — the canonical list.
 * Add new themes here; both client and server will pick them up automatically.
 */
export const THEME_PRESETS_BASE: ThemePresetBase[] = [
  { id: "bspb_corporate", name: "БСПБ Корпоративный", nameRu: "БСПБ Корпоративный", color: "#0057AB", gradient: "linear-gradient(135deg, #0057AB, #E9243A)", dark: false, category: "business", descRu: "Официальный стиль Банка Санкт-Петербург" },
  { id: "corporate_blue", name: "Corporate Blue", nameRu: "Корпоративный синий", color: "#2563EB", gradient: "linear-gradient(135deg, #1e40af, #3b82f6)", dark: false, category: "business", descRu: "Профессиональный стиль для бизнес-презентаций" },
  { id: "modern_purple", name: "Modern Purple", nameRu: "Современный фиолетовый", color: "#7C3AED", gradient: "linear-gradient(135deg, #6d28d9, #a78bfa)", dark: false, category: "creative", descRu: "Творческий и инновационный дизайн" },
  { id: "ocean_deep", name: "Ocean Deep", nameRu: "Глубокий океан", color: "#0891B2", gradient: "linear-gradient(135deg, #164e63, #06b6d4)", dark: false, category: "business", descRu: "Спокойный и глубокий профессиональный стиль" },
  { id: "sunset_warm", name: "Sunset Warm", nameRu: "Тёплый закат", color: "#EA580C", gradient: "linear-gradient(135deg, #c2410c, #fb923c)", dark: false, category: "creative", descRu: "Яркий и энергичный стиль" },
  { id: "forest_green", name: "Forest Green", nameRu: "Лесной зелёный", color: "#16A34A", gradient: "linear-gradient(135deg, #166534, #4ade80)", dark: false, category: "nature", descRu: "Природный и экологичный стиль" },
  { id: "cosmic_dark", name: "Cosmic Dark", nameRu: "Космический тёмный", color: "#8B5CF6", gradient: "linear-gradient(135deg, #1e1b4b, #7c3aed, #06b6d4)", dark: true, category: "dark", descRu: "Тёмная тема с космическими акцентами" },
  { id: "rose_gold", name: "Rose Gold", nameRu: "Розовое золото", color: "#E11D48", gradient: "linear-gradient(135deg, #9f1239, #fb7185)", dark: false, category: "creative", descRu: "Элегантный и утончённый дизайн" },
  { id: "arctic_frost", name: "Arctic Frost", nameRu: "Арктический мороз", color: "#6366F1", gradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe, #a5b4fc)", dark: false, category: "nature", descRu: "Лёгкий и воздушный зимний стиль" },
  { id: "midnight_noir", name: "Midnight Noir", nameRu: "Полночный нуар", color: "#F59E0B", gradient: "linear-gradient(135deg, #1c1917, #292524, #f59e0b)", dark: true, category: "dark", descRu: "Тёмный стиль с золотыми акцентами" },
  { id: "citrus_energy", name: "Citrus Energy", nameRu: "Цитрусовая энергия", color: "#84CC16", gradient: "linear-gradient(135deg, #4d7c0f, #a3e635)", dark: false, category: "nature", descRu: "Свежий и энергичный дизайн" },
  { id: "executive_navy_red", name: "Executive Navy & Red", nameRu: "Деловой тёмно-синий", color: "#DC2626", gradient: "linear-gradient(135deg, #1a1a3e, #dc2626)", dark: false, category: "business", descRu: "Строгий деловой стиль с красным акцентом" },
  { id: "data_navy_blue", name: "Data Navy & Blue", nameRu: "Аналитический синий", color: "#2563EB", gradient: "linear-gradient(135deg, #1a1a3e, #2563eb, #dc2626)", dark: false, category: "business", descRu: "Для аналитических и дата-презентаций" },
];

/** Theme categories for the filter UI */
export const THEME_CATEGORIES: ThemeCategory[] = [
  { id: "all", nameRu: "Все" },
  { id: "business", nameRu: "Бизнес" },
  { id: "creative", nameRu: "Креатив" },
  { id: "dark", nameRu: "Тёмные" },
  { id: "nature", nameRu: "Природа" },
];

/** All valid theme IDs */
export const THEME_IDS = THEME_PRESETS_BASE.map((t) => t.id);

/** Check if a theme is dark-mode */
export function isDarkTheme(themeId: string): boolean {
  const theme = THEME_PRESETS_BASE.find((t) => t.id === themeId);
  return theme?.dark ?? false;
}
