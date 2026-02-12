/**
 * Visual Overflow Test — renders all 23 templates with intentionally long content
 * to verify that no text overflows the 1280x720 slide boundaries.
 * 
 * Run: node scripts/visual-overflow-test.mjs
 * Output: /tmp/overflow-test.html (open in browser to inspect)
 */

import { renderSlide, renderPresentation, listLayouts, BASE_CSS } from "../server/pipeline/templateEngine.ts";

// Long text generators
const longTitle = (n = 80) => "Стратегическое планирование развития компании в условиях цифровой трансформации и глобальных вызовов ".repeat(2).slice(0, n);
const longDesc = (n = 200) => "Подробное описание с множеством деталей, которое должно быть обрезано шаблоном, чтобы не выходить за границы слайда. Это очень длинный текст для тестирования overflow. ".repeat(5).slice(0, n);
const longBullet = (n = 150) => "Ключевой пункт с развёрнутым описанием, включающим статистику, примеры и рекомендации для дальнейших действий команды. ".repeat(3).slice(0, n);

// Test data for each layout with intentionally long content
const testSlides = [
  {
    layoutId: "title-slide",
    data: {
      title: longTitle(120),
      subtitle: longDesc(200),
      author: "Иванов Иван Иванович, Генеральный директор компании",
      date: "12 февраля 2026",
    },
  },
  {
    layoutId: "section-header",
    data: {
      title: longTitle(100),
      subtitle: longDesc(150),
      sectionNumber: "01",
    },
  },
  {
    layoutId: "text-slide",
    data: {
      title: longTitle(100),
      bullets: Array.from({ length: 8 }, (_, i) => ({
        title: `Пункт ${i + 1}: ${longBullet(80)}`,
        description: longDesc(200),
      })),
    },
  },
  {
    layoutId: "two-column",
    data: {
      title: longTitle(100),
      leftColumn: {
        title: "Преимущества нашего подхода к решению задач",
        bullets: Array.from({ length: 6 }, (_, i) => `${longBullet(120)}`),
      },
      rightColumn: {
        title: "Риски и ограничения текущей стратегии",
        bullets: Array.from({ length: 6 }, (_, i) => `${longBullet(120)}`),
      },
    },
  },
  {
    layoutId: "image-text",
    data: {
      title: longTitle(100),
      description: longDesc(300),
      bullets: Array.from({ length: 6 }, (_, i) => `${longBullet(100)}`),
      image: { url: "https://placehold.co/600x400/1e40af/ffffff?text=Test+Image", alt: "Test" },
    },
  },
  {
    layoutId: "image-fullscreen",
    data: {
      title: longTitle(80),
      subtitle: longDesc(100),
      image: { url: "https://placehold.co/1280x720/1e40af/ffffff?text=Fullscreen+Image", alt: "Test" },
    },
  },
  {
    layoutId: "quote-slide",
    data: {
      quote: "Единственный способ делать великую работу — любить то, что делаешь. Если вы ещё не нашли своё дело, продолжайте искать. Не останавливайтесь. Как и со всеми делами сердца, вы узнаете, когда найдёте. И, как любые великие отношения, с годами это становится только лучше и лучше.",
      author: "Стив Джобс, сооснователь Apple Inc.",
      role: "Генеральный директор и председатель совета директоров Apple Inc., Pixar Animation Studios",
    },
  },
  {
    layoutId: "chart-slide",
    data: {
      title: longTitle(100),
      description: longDesc(150),
      chartSvg: `<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
        <rect x="50" y="50" width="80" height="200" fill="#3b82f6" rx="4"/>
        <rect x="170" y="100" width="80" height="150" fill="#22c55e" rx="4"/>
        <rect x="290" y="30" width="80" height="220" fill="#f59e0b" rx="4"/>
        <rect x="410" y="80" width="80" height="170" fill="#ef4444" rx="4"/>
        <text x="90" y="280" text-anchor="middle" fill="#666" font-size="14">Q1</text>
        <text x="210" y="280" text-anchor="middle" fill="#666" font-size="14">Q2</text>
        <text x="330" y="280" text-anchor="middle" fill="#666" font-size="14">Q3</text>
        <text x="450" y="280" text-anchor="middle" fill="#666" font-size="14">Q4</text>
      </svg>`,
    },
  },
  {
    layoutId: "table-slide",
    data: {
      title: longTitle(80),
      description: longDesc(100),
      headers: ["Показатель", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Итого за год"],
      rows: Array.from({ length: 12 }, (_, i) => [
        `Метрика ${i + 1} с длинным названием`,
        `${Math.floor(Math.random() * 1000)}K`,
        `${Math.floor(Math.random() * 1000)}K`,
        `${Math.floor(Math.random() * 1000)}K`,
        `${Math.floor(Math.random() * 1000)}K`,
        `${Math.floor(Math.random() * 5000)}K`,
      ]),
    },
  },
  {
    layoutId: "icons-numbers",
    data: {
      title: longTitle(80),
      metrics: Array.from({ length: 6 }, (_, i) => ({
        label: `Метрика ${i + 1} с подробным описанием`,
        value: `${(i + 1) * 23.5}%`,
        description: longDesc(100),
        icon: { name: "star", url: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/star.svg" },
      })),
    },
  },
  {
    layoutId: "timeline",
    data: {
      title: longTitle(80),
      events: Array.from({ length: 7 }, (_, i) => ({
        date: `${2020 + i}`,
        title: `Этап ${i + 1}: ${longBullet(60)}`,
        description: longDesc(150),
      })),
    },
  },
  {
    layoutId: "process-steps",
    data: {
      title: longTitle(80),
      steps: Array.from({ length: 8 }, (_, i) => ({
        number: i + 1,
        title: `Шаг ${i + 1}: ${longBullet(50)}`,
        description: longDesc(120),
      })),
    },
  },
  {
    layoutId: "comparison",
    data: {
      title: longTitle(80),
      optionA: {
        title: "Вариант А: Облачная инфраструктура с микросервисной архитектурой",
        points: Array.from({ length: 6 }, (_, i) => `${longBullet(100)}`),
        color: "#22c55e",
      },
      optionB: {
        title: "Вариант Б: Локальное развёртывание с монолитной архитектурой",
        points: Array.from({ length: 6 }, (_, i) => `${longBullet(100)}`),
        color: "#ef4444",
      },
    },
  },
  {
    layoutId: "final-slide",
    data: {
      title: longTitle(80),
      subtitle: longDesc(150),
      thankYouText: "Спасибо за внимание! Вопросы и обсуждение",
      contactInfo: "email@company.com | +7 (999) 123-45-67",
    },
  },
  {
    layoutId: "agenda-table-of-contents",
    data: {
      title: longTitle(80),
      sections: Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        title: `Раздел ${i + 1}: ${longBullet(60)}`,
        description: longDesc(100),
      })),
    },
  },
  {
    layoutId: "team-profiles",
    data: {
      title: longTitle(80),
      teamMembers: Array.from({ length: 8 }, (_, i) => ({
        name: `Иванов Иван Иванович ${i + 1}`,
        role: `Старший вице-президент по стратегическому развитию и инновациям`,
        description: longDesc(100),
        avatar: { url: `https://placehold.co/200x200/1e40af/ffffff?text=P${i + 1}` },
      })),
    },
  },
  {
    layoutId: "logo-grid",
    data: {
      title: longTitle(80),
      description: longDesc(150),
      logos: Array.from({ length: 12 }, (_, i) => ({
        name: `Компания-партнёр ${i + 1} с длинным названием`,
        url: `https://placehold.co/200x100/e5e7eb/666?text=Logo+${i + 1}`,
      })),
    },
  },
  {
    layoutId: "video-embed",
    data: {
      title: longTitle(80),
      description: longDesc(200),
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  },
  {
    layoutId: "waterfall-chart",
    data: {
      title: longTitle(80),
      description: longDesc(100),
      bars: Array.from({ length: 8 }, (_, i) => ({
        label: `Категория ${i + 1} с описанием`,
        value: `${i % 2 === 0 ? "+" : "-"}$${(i + 1) * 2.5}M`,
        height: 30 + Math.random() * 60,
        color: i % 2 === 0 ? "#22c55e" : "#ef4444",
        change: `${i % 2 === 0 ? "+" : "-"}${(i + 1) * 5}%`,
      })),
    },
  },
  {
    layoutId: "swot-analysis",
    data: {
      title: longTitle(80),
      strengths: {
        title: "Сильные стороны",
        items: Array.from({ length: 5 }, (_, i) => `${longBullet(80)}`),
      },
      weaknesses: {
        title: "Слабые стороны",
        items: Array.from({ length: 5 }, (_, i) => `${longBullet(80)}`),
      },
      opportunities: {
        title: "Возможности",
        items: Array.from({ length: 5 }, (_, i) => `${longBullet(80)}`),
      },
      threats: {
        title: "Угрозы",
        items: Array.from({ length: 5 }, (_, i) => `${longBullet(80)}`),
      },
    },
  },
  {
    layoutId: "funnel",
    data: {
      title: longTitle(80),
      stages: Array.from({ length: 6 }, (_, i) => ({
        title: `Этап ${i + 1}: ${longBullet(40)}`,
        value: `${(6 - i) * 15}K`,
        description: longDesc(80),
        color: ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#9333ea"][i],
        conversion: `${100 - i * 15}%`,
      })),
    },
  },
  {
    layoutId: "roadmap",
    data: {
      title: longTitle(80),
      description: longDesc(100),
      milestones: Array.from({ length: 7 }, (_, i) => ({
        date: `Q${(i % 4) + 1} ${2025 + Math.floor(i / 4)}`,
        title: `Milestone ${i + 1}: ${longBullet(40)}`,
        description: longDesc(80),
        color: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#9333ea", "#0ea5e9", "#6366f1"][i],
      })),
    },
  },
  {
    layoutId: "pyramid",
    data: {
      title: longTitle(80),
      levels: [
        { title: "Самоактуализация и самореализация", description: longDesc(100), color: "#9333ea" },
        { title: "Признание и уважение коллег", description: longDesc(100), color: "#6366f1" },
        { title: "Социальные потребности и принадлежность", description: longDesc(100), color: "#3b82f6" },
        { title: "Безопасность и стабильность", description: longDesc(100), color: "#22c55e" },
        { title: "Базовые физиологические потребности", description: longDesc(100), color: "#f59e0b" },
      ],
    },
  },
  {
    layoutId: "matrix-2x2",
    data: {
      title: longTitle(80),
      axisX: "УСИЛИЯ →",
      axisY: "ВЛИЯНИЕ →",
      quadrants: [
        { title: "Быстрые победы", description: longDesc(60), items: Array.from({ length: 4 }, (_, i) => `Задача ${i + 1}: ${longBullet(60)}`) },
        { title: "Крупные проекты", description: longDesc(60), items: Array.from({ length: 4 }, (_, i) => `Проект ${i + 1}: ${longBullet(60)}`) },
        { title: "Заполнители", description: longDesc(60), items: Array.from({ length: 4 }, (_, i) => `Мелочь ${i + 1}: ${longBullet(60)}`) },
        { title: "Неблагодарные задачи", description: longDesc(60), items: Array.from({ length: 4 }, (_, i) => `Рутина ${i + 1}: ${longBullet(60)}`) },
      ],
    },
  },
  {
    layoutId: "pros-cons",
    data: {
      title: longTitle(80),
      pros: {
        title: "Преимущества облачной инфраструктуры",
        items: Array.from({ length: 7 }, (_, i) => `${longBullet(100)}`),
      },
      cons: {
        title: "Недостатки и риски облачного подхода",
        items: Array.from({ length: 7 }, (_, i) => `${longBullet(100)}`),
      },
    },
  },
  {
    layoutId: "checklist",
    data: {
      title: longTitle(80),
      description: longDesc(100),
      items: Array.from({ length: 12 }, (_, i) => ({
        title: `Задача ${i + 1}: ${longBullet(60)}`,
        description: longDesc(80),
        done: i < 5,
        status: i < 5 ? "Выполнено" : i < 8 ? "В процессе" : "Ожидание",
      })),
    },
  },
  {
    layoutId: "highlight-stats",
    data: {
      title: longTitle(80),
      mainStat: {
        value: "47.3%",
        label: "Рост выручки год к году с учётом сезонных колебаний",
        description: longDesc(150),
      },
      supportingStats: Array.from({ length: 4 }, (_, i) => ({
        value: `${(i + 1) * 12.5}K`,
        label: `Метрика ${i + 1} с подробным описанием показателя`,
        description: longDesc(80),
      })),
    },
  },
];

// Build the HTML
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

const html = renderPresentation(testSlides, themeCss, "Visual Overflow Test — All 23 Templates", "ru");

// Write to file
import { writeFileSync } from "fs";
writeFileSync("/tmp/overflow-test.html", html);
console.log(`✅ Generated /tmp/overflow-test.html with ${testSlides.length} slides (${listLayouts().length} layouts total)`);
console.log(`Layouts tested: ${testSlides.map(s => s.layoutId).join(", ")}`);
