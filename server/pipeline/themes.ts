/**
 * Server Theme System — extends shared base with CSS variables, fonts, and mood.
 *
 * Base metadata (id, name, nameRu, color, gradient, dark, category, descRu)
 * lives in shared/themes.ts — the single source of truth.
 * This file adds server-only fields: cssVariables, fontsUrl, mood.
 */

import { THEME_PRESETS_BASE, isDarkTheme as sharedIsDarkTheme, type ThemePresetBase } from "@shared/themes";

/** Full theme preset with server-only rendering fields */
export interface ThemePreset extends ThemePresetBase {
  /** Preview color for the frontend selector (alias for color) */
  previewColor: string;
  /** Gradient CSS for preview swatch (alias for gradient) */
  previewGradient: string;
  /** Complete CSS variables block */
  cssVariables: string;
  /** Google Fonts import URL */
  fontsUrl: string;
  /** Description for the LLM to understand the theme mood */
  mood: string;
}

/** Server-only extensions keyed by theme ID */
const THEME_EXTENSIONS: Record<string, { cssVariables: string; fontsUrl: string; mood: string }> = {
  bspb_corporate: {
    mood: "Официальный корпоративный стиль Банка Санкт-Петербург. Строгий, профессиональный, банковский. Белый фон, синие заголовки, красные акценты. Логотип БСПБ обязателен.",
    fontsUrl: "",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: #ffffff;
  --slide-bg-gradient: #ffffff;
  --slide-bg-accent-gradient: linear-gradient(135deg, #003d7a 0%, #0057AB 50%, #0070d4 100%);
  --text-heading-color: #0057AB;
  --text-body-color: #333333;
  --primary-accent-color: #0057AB;
  --primary-accent-light: #4d9de0;
  --secondary-accent-color: #E9243A;
  --heading-font-family: 'Arial';
  --body-font-family: 'Arial';
  --decorative-shape-color: transparent;
  --card-border-color: rgba(0, 87, 171, 0.15);
  --card-shadow: 0 2px 12px rgba(0, 87, 171, 0.08);
}

/* BSPB Logo — top-right corner on content slides */
.slide {
  position: relative;
}
.slide::after {
  content: '';
  position: absolute;
  top: 20px;
  right: 24px;
  width: 120px;
  height: 40px;
  background-image: url('https://files.manuscdn.com/user_upload_by_module/session_file/310519663124868360/SCJeOuRodLGBvIFn.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 100;
  pointer-events: none;
}

/* BSPB Red accent line under headings */
.accent-line {
  width: 60px !important;
  height: 3px !important;
  background: #E9243A !important;
  border-radius: 0 !important;
}

/* BSPB Decorative circles — hide ALL decorative shapes for clean corporate look */
.slide-decor-circle {
  display: none !important;
}

/* Hide inline decorative circles (absolute positioned, border-radius 50%, semi-transparent) */
.slide > div > div[style*="border-radius: 50%"][style*="pointer-events: none"][style*="position: absolute"] {
  display: none !important;
}
.slide > div > div > div[style*="border-radius: 50%"][style*="pointer-events: none"][style*="position: absolute"] {
  display: none !important;
}

/* Also hide via color-mix circles */
.slide div[style*="border-radius: 50%"][style*="color-mix"][style*="position: absolute"] {
  display: none !important;
}

/* BSPB Title slide — hide theme logo and bottom bar (title has its own) */
.slide:has(.bspb-title-slide)::after {
  display: none !important;
}
.slide:has(.bspb-title-slide)::before {
  display: none !important;
}
.slide:has(.bspb-title-slide) {
  background: transparent !important;
}

/* BSPB Bottom bar — red stripe at bottom of each slide */
.slide::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #E9243A;
  z-index: 100;
}`,
  },
  corporate_blue: {
    mood: "Professional, trustworthy, corporate. Clean and authoritative.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Sans+3:wght@300;400;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f0f4ff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f8faff 0%, #e8f0fe 50%, #f0f4ff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
  --text-heading-color: #0f172a;
  --text-body-color: #475569;
  --primary-accent-color: #2563eb;
  --primary-accent-light: #93bbfd;
  --secondary-accent-color: #0ea5e9;
  --heading-font-family: 'Inter';
  --body-font-family: 'Source Sans 3';
  --decorative-shape-color: rgba(37, 99, 235, 0.06);
  --card-border-color: rgba(37, 99, 235, 0.12);
  --card-shadow: 0 4px 24px rgba(37, 99, 235, 0.08);
}`,
  },
  modern_purple: {
    mood: "Creative, innovative, modern tech. Bold and forward-thinking.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f5f0ff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #faf5ff 0%, #ede9fe 50%, #f5f0ff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%);
  --text-heading-color: #1e1b4b;
  --text-body-color: #4c4577;
  --primary-accent-color: #7c3aed;
  --primary-accent-light: #c4b5fd;
  --secondary-accent-color: #ec4899;
  --heading-font-family: 'Space Grotesk';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(124, 58, 237, 0.06);
  --card-border-color: rgba(124, 58, 237, 0.12);
  --card-shadow: 0 4px 24px rgba(124, 58, 237, 0.08);
}`,
  },
  ocean_deep: {
    mood: "Calm, deep, professional. Oceanic depth with clarity.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #ecfeff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f0fdfa 0%, #e0f7fa 50%, #ecfeff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #134e4a 0%, #0891b2 50%, #22d3ee 100%);
  --text-heading-color: #0c4a6e;
  --text-body-color: #4a7c8a;
  --primary-accent-color: #0891b2;
  --primary-accent-light: #67e8f9;
  --secondary-accent-color: #14b8a6;
  --heading-font-family: 'Plus Jakarta Sans';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(8, 145, 178, 0.06);
  --card-border-color: rgba(8, 145, 178, 0.12);
  --card-shadow: 0 4px 24px rgba(8, 145, 178, 0.08);
}`,
  },
  sunset_warm: {
    mood: "Warm, energetic, inspiring. Sunset warmth with passion.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #fff7ed 100%);
  --slide-bg-gradient: linear-gradient(135deg, #fffbeb 0%, #fff1e6 50%, #fff7ed 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #9a3412 0%, #ea580c 50%, #f97316 100%);
  --text-heading-color: #431407;
  --text-body-color: #78542e;
  --primary-accent-color: #ea580c;
  --primary-accent-light: #fdba74;
  --secondary-accent-color: #dc2626;
  --heading-font-family: 'DM Sans';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(234, 88, 12, 0.06);
  --card-border-color: rgba(234, 88, 12, 0.12);
  --card-shadow: 0 4px 24px rgba(234, 88, 12, 0.08);
}`,
  },
  forest_green: {
    mood: "Natural, sustainable, growth-oriented. Fresh and organic.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #ecfdf5 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #14532d 0%, #16a34a 50%, #22c55e 100%);
  --text-heading-color: #14532d;
  --text-body-color: #4d7c5e;
  --primary-accent-color: #16a34a;
  --primary-accent-light: #86efac;
  --secondary-accent-color: #0d9488;
  --heading-font-family: 'Outfit';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(22, 163, 74, 0.06);
  --card-border-color: rgba(22, 163, 74, 0.12);
  --card-shadow: 0 4px 24px rgba(22, 163, 74, 0.08);
}`,
  },
  cosmic_dark: {
    mood: "Futuristic, bold, dark mode. Space-inspired with neon accents.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #1a1a2e;
  --card-background-gradient: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
  --slide-bg-gradient: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #16162a 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #312e81 0%, #7c3aed 50%, #06b6d4 100%);
  --text-heading-color: #e2e8f0;
  --text-body-color: #94a3b8;
  --primary-accent-color: #8b5cf6;
  --primary-accent-light: #c4b5fd;
  --secondary-accent-color: #06b6d4;
  --heading-font-family: 'Space Grotesk';
  --body-font-family: 'JetBrains Mono';
  --decorative-shape-color: rgba(139, 92, 246, 0.1);
  --card-border-color: rgba(139, 92, 246, 0.2);
  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}`,
  },
  rose_gold: {
    mood: "Elegant, luxurious, refined. Sophisticated with warmth.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #fff1f2 100%);
  --slide-bg-gradient: linear-gradient(135deg, #fff5f5 0%, #ffe4e6 50%, #fdf2f8 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #881337 0%, #e11d48 50%, #f43f5e 100%);
  --text-heading-color: #1c1917;
  --text-body-color: #78716c;
  --primary-accent-color: #e11d48;
  --primary-accent-light: #fda4af;
  --secondary-accent-color: #d97706;
  --heading-font-family: 'Playfair Display';
  --body-font-family: 'Lato';
  --decorative-shape-color: rgba(225, 29, 72, 0.06);
  --card-border-color: rgba(225, 29, 72, 0.12);
  --card-shadow: 0 4px 24px rgba(225, 29, 72, 0.08);
}`,
  },
  arctic_frost: {
    mood: "Clean, minimal, icy cool. Scandinavian precision with clarity.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #eef2ff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #e0e7ff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #3730a3 0%, #6366f1 50%, #818cf8 100%);
  --text-heading-color: #1e1b4b;
  --text-body-color: #64748b;
  --primary-accent-color: #6366f1;
  --primary-accent-light: #a5b4fc;
  --secondary-accent-color: #8b5cf6;
  --heading-font-family: 'Inter';
  --body-font-family: 'IBM Plex Sans';
  --decorative-shape-color: rgba(99, 102, 241, 0.06);
  --card-border-color: rgba(99, 102, 241, 0.12);
  --card-shadow: 0 4px 24px rgba(99, 102, 241, 0.08);
}`,
  },
  midnight_noir: {
    mood: "Dark, premium, executive. Sophisticated dark mode with gold accents.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #1c1917;
  --card-background-gradient: linear-gradient(180deg, #1c1917 0%, #171412 100%);
  --slide-bg-gradient: linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #171412 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%);
  --text-heading-color: #fafaf9;
  --text-body-color: #a8a29e;
  --primary-accent-color: #f59e0b;
  --primary-accent-light: #fcd34d;
  --secondary-accent-color: #ef4444;
  --heading-font-family: 'Sora';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(245, 158, 11, 0.08);
  --card-border-color: rgba(245, 158, 11, 0.15);
  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}`,
  },
  citrus_energy: {
    mood: "Energetic, fresh, dynamic. Bright and motivating with natural energy.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f7fee7 100%);
  --slide-bg-gradient: linear-gradient(135deg, #fefce8 0%, #f7fee7 50%, #ecfccb 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #365314 0%, #65a30d 50%, #84cc16 100%);
  --text-heading-color: #1a2e05;
  --text-body-color: #4d7c0f;
  --primary-accent-color: #65a30d;
  --primary-accent-light: #bef264;
  --secondary-accent-color: #ea580c;
  --heading-font-family: 'Nunito Sans';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(101, 163, 13, 0.06);
  --card-border-color: rgba(101, 163, 13, 0.12);
  --card-shadow: 0 4px 24px rgba(101, 163, 13, 0.08);
}`,
  },
  executive_navy_red: {
    mood: "Executive, authoritative, high-contrast. Navy and red for corporate strategy and leadership presentations.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f8f9fc 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f8f9fc 0%, #f0f1f5 50%, #f5f6fa 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #0f0f2d 0%, #1a1a3e 50%, #252550 100%);
  --text-heading-color: #1a1a3e;
  --text-body-color: #4a4a6a;
  --primary-accent-color: #dc2626;
  --primary-accent-light: #fca5a5;
  --secondary-accent-color: #1a1a3e;
  --heading-font-family: 'Manrope';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(220, 38, 38, 0.06);
  --card-border-color: rgba(26, 26, 62, 0.10);
  --card-shadow: 0 4px 24px rgba(26, 26, 62, 0.08);
}`,
  },
  data_navy_blue: {
    mood: "Data-driven, analytical, chart-heavy. Navy base with blue and red accents for data presentations.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
    cssVariables: `:root {
  --card-background-color: #ffffff;
  --card-background-gradient: linear-gradient(180deg, #ffffff 0%, #f0f4ff 100%);
  --slide-bg-gradient: linear-gradient(135deg, #f8f9fc 0%, #eef2ff 50%, #f0f4ff 100%);
  --slide-bg-accent-gradient: linear-gradient(135deg, #0f0f2d 0%, #1a1a3e 50%, #1e3a8a 100%);
  --text-heading-color: #1a1a3e;
  --text-body-color: #475569;
  --primary-accent-color: #2563eb;
  --primary-accent-light: #93bbfd;
  --secondary-accent-color: #dc2626;
  --heading-font-family: 'Manrope';
  --body-font-family: 'Inter';
  --decorative-shape-color: rgba(37, 99, 235, 0.06);
  --card-border-color: rgba(26, 26, 62, 0.10);
  --card-shadow: 0 4px 24px rgba(37, 99, 235, 0.08);
}`,
  },
};

/**
 * Full theme presets — base metadata from shared + server-only extensions.
 * Built at module load time by merging the two sources.
 */
export const THEME_PRESETS: ThemePreset[] = THEME_PRESETS_BASE.map((base) => {
  const ext = THEME_EXTENSIONS[base.id];
  if (!ext) {
    throw new Error(`Missing theme extension for "${base.id}". Add it to THEME_EXTENSIONS in server/pipeline/themes.ts`);
  }
  return {
    ...base,
    previewColor: base.color,
    previewGradient: base.gradient,
    ...ext,
  };
});

/**
 * Get a theme preset by ID. Falls back to corporate_blue.
 */
export function getThemePreset(themeId: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
}

/**
 * Check if a theme is dark-mode.
 */
export { sharedIsDarkTheme as isDarkTheme };

/**
 * Get the list of theme IDs for frontend.
 */
export function listThemeIds(): string[] {
  return THEME_PRESETS.map((t) => t.id);
}
