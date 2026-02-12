/**
 * Visual Adaptive Typography Test — renders key templates at all 3 density levels
 * to verify that font sizes scale down properly with more content.
 * 
 * Run: npx tsx scripts/visual-adaptive-test.mjs
 * Output: /tmp/adaptive-test.html (open in browser to inspect)
 */

import { renderSlide, renderPresentation, BASE_CSS } from "../server/pipeline/templateEngine.ts";
import { writeFileSync } from "fs";

// Long text generators
const longTitle = (n = 80) => "Стратегическое планирование развития компании в условиях цифровой трансформации и глобальных вызовов ".repeat(2).slice(0, n);
const longDesc = (n = 200) => "Подробное описание с множеством деталей, которое должно быть обрезано шаблоном, чтобы не выходить за границы слайда. Это очень длинный текст для тестирования overflow. ".repeat(5).slice(0, n);
const longBullet = (n = 150) => "Ключевой пункт с развёрнутым описанием, включающим статистику, примеры и рекомендации для дальнейших действий команды. ".repeat(3).slice(0, n);

// ═══════════════════════════════════════════════════════
// Test cases: each template at 3 density levels
// ═══════════════════════════════════════════════════════

function makeTextSlide(bulletCount) {
  return {
    layoutId: "text-slide",
    data: {
      title: longTitle(bulletCount > 6 ? 100 : 60),
      bullets: Array.from({ length: bulletCount }, (_, i) => ({
        title: `Пункт ${i + 1}: ${longBullet(60)}`,
        description: longDesc(bulletCount > 6 ? 150 : 100),
      })),
    },
  };
}

function makeTwoColumn(bulletCount) {
  return {
    layoutId: "two-column",
    data: {
      title: longTitle(bulletCount > 4 ? 100 : 60),
      leftColumn: {
        title: "Преимущества подхода",
        bullets: Array.from({ length: bulletCount }, () => longBullet(100)),
      },
      rightColumn: {
        title: "Риски и ограничения",
        bullets: Array.from({ length: bulletCount }, () => longBullet(100)),
      },
    },
  };
}

function makeIconsNumbers(count) {
  return {
    layoutId: "icons-numbers",
    data: {
      title: longTitle(count > 4 ? 100 : 60),
      metrics: Array.from({ length: count }, (_, i) => ({
        label: `Метрика ${i + 1} с описанием`,
        value: `${(i + 1) * 23.5}%`,
        description: longDesc(80),
        icon: { name: "star", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/star.svg" },
      })),
    },
  };
}

function makeTimeline(count) {
  return {
    layoutId: "timeline",
    data: {
      title: longTitle(count > 5 ? 100 : 60),
      events: Array.from({ length: count }, (_, i) => ({
        date: `${2020 + i}`,
        title: `Этап ${i + 1}: ${longBullet(40)}`,
        description: longDesc(100),
      })),
    },
  };
}

function makeComparison(pointCount) {
  return {
    layoutId: "comparison",
    data: {
      title: longTitle(pointCount > 4 ? 100 : 60),
      optionA: {
        title: "Вариант А: Облачная инфраструктура",
        points: Array.from({ length: pointCount }, () => longBullet(80)),
        color: "#22c55e",
      },
      optionB: {
        title: "Вариант Б: Локальное развёртывание",
        points: Array.from({ length: pointCount }, () => longBullet(80)),
        color: "#ef4444",
      },
    },
  };
}

function makeChecklist(count) {
  return {
    layoutId: "checklist",
    data: {
      title: longTitle(count > 6 ? 100 : 60),
      items: Array.from({ length: count }, (_, i) => ({
        title: `Задача ${i + 1}: ${longBullet(50)}`,
        description: longDesc(60),
        done: i < Math.floor(count / 2),
      })),
    },
  };
}

function makeProsCons(count) {
  return {
    layoutId: "pros-cons",
    data: {
      title: longTitle(count > 4 ? 100 : 60),
      pros: {
        title: "Преимущества",
        items: Array.from({ length: count }, () => longBullet(80)),
      },
      cons: {
        title: "Недостатки",
        items: Array.from({ length: count }, () => longBullet(80)),
      },
    },
  };
}

function makeSWOT(count) {
  return {
    layoutId: "swot-analysis",
    data: {
      title: longTitle(count > 4 ? 100 : 60),
      strengths: { title: "Сильные стороны", items: Array.from({ length: count }, () => longBullet(60)) },
      weaknesses: { title: "Слабые стороны", items: Array.from({ length: count }, () => longBullet(60)) },
      opportunities: { title: "Возможности", items: Array.from({ length: count }, () => longBullet(60)) },
      threats: { title: "Угрозы", items: Array.from({ length: count }, () => longBullet(60)) },
    },
  };
}

function makeProcessSteps(count) {
  return {
    layoutId: "process-steps",
    data: {
      title: longTitle(count > 4 ? 100 : 60),
      steps: Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        title: `Шаг ${i + 1}: ${longBullet(40)}`,
        description: longDesc(80),
      })),
    },
  };
}

function makeHighlightStats(count) {
  return {
    layoutId: "highlight-stats",
    data: {
      title: longTitle(count > 3 ? 100 : 60),
      mainStat: {
        value: "47.3%",
        label: "Рост выручки год к году",
        description: longDesc(100),
      },
      supportingStats: Array.from({ length: count }, (_, i) => ({
        value: `${(i + 1) * 12.5}K`,
        label: `Метрика ${i + 1} с описанием`,
      })),
    },
  };
}

// Build slides: each template at 3 density levels (normal → compact → dense)
const testSlides = [
  // ── text-slide ──
  makeTextSlide(3),   // normal
  makeTextSlide(6),   // compact
  makeTextSlide(9),   // dense

  // ── two-column ──
  makeTwoColumn(2),   // normal
  makeTwoColumn(5),   // compact
  makeTwoColumn(7),   // dense

  // ── icons-numbers ──
  makeIconsNumbers(3), // normal
  makeIconsNumbers(5), // compact
  makeIconsNumbers(7), // dense

  // ── timeline ──
  makeTimeline(3),    // normal
  makeTimeline(6),    // compact
  makeTimeline(8),    // dense

  // ── comparison ──
  makeComparison(3),  // normal
  makeComparison(5),  // compact
  makeComparison(7),  // dense

  // ── checklist ──
  makeChecklist(4),   // normal
  makeChecklist(7),   // compact
  makeChecklist(11),  // dense

  // ── pros-cons ──
  makeProsCons(3),    // normal
  makeProsCons(5),    // compact
  makeProsCons(7),    // dense

  // ── swot-analysis ──
  makeSWOT(3),        // normal
  makeSWOT(5),        // compact
  makeSWOT(7),        // dense

  // ── process-steps ──
  makeProcessSteps(3), // normal
  makeProcessSteps(5), // compact
  makeProcessSteps(7), // dense

  // ── highlight-stats ──
  makeHighlightStats(2), // normal
  makeHighlightStats(4), // compact
  makeHighlightStats(6), // dense
];

// Theme CSS
const themeCss = `:root {
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
}`;

// Render each slide individually to add density labels
const slidesHtml = testSlides.map((slide, index) => {
  const html = renderSlide(slide.layoutId, {
    ...slide.data,
    _slide_index: index,
    _slideNumber: index + 1,
    _totalSlides: testSlides.length,
    _presentationTitle: "Adaptive Typography Test",
  });
  
  // Detect density from the rendered HTML
  let density = "normal";
  if (html.includes("density-dense")) density = "dense";
  else if (html.includes("density-compact")) density = "compact";
  
  const densityColor = density === "dense" ? "#ef4444" : density === "compact" ? "#f59e0b" : "#22c55e";
  const itemCount = slide.data.bullets?.length || slide.data.metrics?.length || slide.data.events?.length || 
    slide.data.steps?.length || slide.data.items?.length || 
    slide.data.strengths?.items?.length || slide.data.supportingStats?.length ||
    slide.data.optionA?.points?.length || slide.data.pros?.items?.length || "?";
  
  return `<div class="slide-container">
    <div class="slide-meta">
      <span class="slide-number">Slide ${index + 1} / ${testSlides.length}</span>
      <span class="slide-layout">${slide.layoutId}</span>
      <span class="slide-density" style="background: ${densityColor};">${density.toUpperCase()}</span>
      <span class="slide-items">${itemCount} items</span>
    </div>
    <div class="slide" style="width:1280px; height:720px; overflow:hidden; border-radius:4px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
      ${html}
    </div>
  </div>`;
}).join("\n");

const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <title>Adaptive Typography Test</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>${BASE_CSS}</style>
  <style>${themeCss}</style>
  <style>
    body { margin: 0; padding: 40px 0; background: #0f172a; display: flex; flex-direction: column; align-items: center; gap: 40px; font-family: 'Inter', sans-serif; }
    .slide-container { position: relative; }
    .slide-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .slide-number { font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 500; }
    .slide-layout { font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 600; font-family: monospace; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; }
    .slide-density { font-size: 11px; color: #fff; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .slide-items { font-size: 12px; color: rgba(255,255,255,0.4); }
    
    /* Group separator every 3 slides */
    .slide-container:nth-child(3n+1) { margin-top: 40px; padding-top: 40px; border-top: 2px solid rgba(255,255,255,0.1); }
    .slide-container:first-child { margin-top: 0; padding-top: 0; border-top: none; }
  </style>
</head>
<body>
  <div style="text-align: center; color: white; padding: 20px;">
    <h1 style="font-size: 24px; margin: 0 0 8px;">Adaptive Typography — Visual Test</h1>
    <p style="font-size: 14px; color: rgba(255,255,255,0.6); margin: 0;">Each template shown at 3 density levels: <span style="color: #22c55e;">NORMAL</span> → <span style="color: #f59e0b;">COMPACT</span> → <span style="color: #ef4444;">DENSE</span></p>
  </div>
  ${slidesHtml}
</body>
</html>`;

writeFileSync("/tmp/adaptive-test.html", fullHtml);
console.log(`✅ Generated /tmp/adaptive-test.html with ${testSlides.length} slides`);
console.log(`Templates tested: text-slide, two-column, icons-numbers, timeline, comparison, checklist, pros-cons, swot-analysis, process-steps, highlight-stats`);
