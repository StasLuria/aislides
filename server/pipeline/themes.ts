/**
 * Predefined Theme System — curated color palettes with gradient backgrounds.
 * Each theme provides complete CSS variables for consistent, high-quality slide design.
 * The Theme Agent can fine-tune fonts based on the topic, but colors come from presets.
 */

export interface ThemePreset {
  id: string;
  name: string;
  nameRu: string;
  /** Preview color for the frontend selector */
  previewColor: string;
  /** Gradient CSS for preview swatch */
  previewGradient: string;
  /** Complete CSS variables block */
  cssVariables: string;
  /** Google Fonts import URL */
  fontsUrl: string;
  /** Description for the LLM to understand the theme mood */
  mood: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "corporate_blue",
    name: "Corporate Blue",
    nameRu: "Корпоративный синий",
    previewColor: "#2563EB",
    previewGradient: "linear-gradient(135deg, #1e40af, #3b82f6)",
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
  {
    id: "modern_purple",
    name: "Modern Purple",
    nameRu: "Современный фиолетовый",
    previewColor: "#7C3AED",
    previewGradient: "linear-gradient(135deg, #6d28d9, #a78bfa)",
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
  {
    id: "ocean_deep",
    name: "Ocean Deep",
    nameRu: "Глубокий океан",
    previewColor: "#0891B2",
    previewGradient: "linear-gradient(135deg, #164e63, #06b6d4)",
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
  {
    id: "sunset_warm",
    name: "Sunset Warm",
    nameRu: "Тёплый закат",
    previewColor: "#EA580C",
    previewGradient: "linear-gradient(135deg, #c2410c, #fb923c)",
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
  {
    id: "forest_green",
    name: "Forest Green",
    nameRu: "Лесной зелёный",
    previewColor: "#16A34A",
    previewGradient: "linear-gradient(135deg, #166534, #4ade80)",
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
  {
    id: "cosmic_dark",
    name: "Cosmic Dark",
    nameRu: "Космический тёмный",
    previewColor: "#8B5CF6",
    previewGradient: "linear-gradient(135deg, #1e1b4b, #7c3aed, #06b6d4)",
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
  {
    id: "rose_gold",
    name: "Rose Gold",
    nameRu: "Розовое золото",
    previewColor: "#E11D48",
    previewGradient: "linear-gradient(135deg, #9f1239, #fb7185)",
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
  {
    id: "arctic_frost",
    name: "Arctic Frost",
    nameRu: "Арктический мороз",
    previewColor: "#6366F1",
    previewGradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe, #a5b4fc)",
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
  {
    id: "midnight_noir",
    name: "Midnight Noir",
    nameRu: "Полночный нуар",
    previewColor: "#F59E0B",
    previewGradient: "linear-gradient(135deg, #1c1917, #292524, #f59e0b)",
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
  {
    id: "citrus_energy",
    name: "Citrus Energy",
    nameRu: "Цитрусовая энергия",
    previewColor: "#84CC16",
    previewGradient: "linear-gradient(135deg, #4d7c0f, #a3e635)",
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
  {
    id: "executive_navy_red",
    name: "Executive Navy & Red",
    nameRu: "Деловой тёмно-синий",
    previewColor: "#DC2626",
    previewGradient: "linear-gradient(135deg, #1a1a3e, #dc2626)",
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
  {
    id: "data_navy_blue",
    name: "Data Navy & Blue",
    nameRu: "Аналитический синий",
    previewColor: "#2563EB",
    previewGradient: "linear-gradient(135deg, #1a1a3e, #2563eb, #dc2626)",
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
];

/**
 * Get a theme preset by ID. Falls back to corporate_blue.
 */
export function getThemePreset(themeId: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
}

/**
 * Check if a theme is dark-mode (dark card background).
 */
export function isDarkTheme(themeId: string): boolean {
  return ["cosmic_dark", "midnight_noir"].includes(themeId);
}

/**
 * Get the list of theme IDs for frontend.
 */
export function listThemeIds(): string[] {
  return THEME_PRESETS.map((t) => t.id);
}
