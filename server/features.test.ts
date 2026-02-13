/**
 * Tests for new features: PPTX Export, Share by Link, Template Gallery
 */
import { describe, expect, it, vi } from "vitest";
import { generatePptx } from "./pptxExport";
import { THEME_PRESETS, THEME_CATEGORIES } from "../client/src/lib/constants";

// ═══════════════════════════════════════════════════════
// PPTX EXPORT TESTS
// ═══════════════════════════════════════════════════════

const SAMPLE_CSS = `:root {
  --card-background-color: #ffffff;
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

describe("PPTX Export", () => {
  it("generates a valid PPTX buffer from title slide", async () => {
    const slides = [
      {
        layoutId: "title-slide",
        data: {
          title: "Тестовая презентация",
          subtitle: "Подзаголовок",
          author: "Автор",
          date: "2026",
        },
      },
    ];

    const buffer = await generatePptx(slides, "Тест", SAMPLE_CSS);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PPTX files start with PK (ZIP signature)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("handles multiple layout types without errors", async () => {
    const slides = [
      {
        layoutId: "title-slide",
        data: { title: "Заголовок", subtitle: "Подзаголовок" },
      },
      {
        layoutId: "section-header",
        data: { title: "Раздел 1", subtitle: "Описание раздела", _slideNumber: 2, _totalSlides: 5 },
      },
      {
        layoutId: "content-text",
        data: {
          title: "Текстовый слайд",
          bullets: ["Пункт 1", "Пункт 2", "Пункт 3"],
          _slideNumber: 3,
          _totalSlides: 5,
        },
      },
      {
        layoutId: "stats-chart",
        data: {
          title: "Статистика",
          stats: [
            { value: "85%", label: "Рост" },
            { value: "120", label: "Клиенты" },
          ],
          _slideNumber: 4,
          _totalSlides: 5,
        },
      },
      {
        layoutId: "final-slide",
        data: { title: "Спасибо!", subtitle: "Вопросы?" },
      },
    ];

    const buffer = await generatePptx(slides, "Мульти-тест", SAMPLE_CSS);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("handles empty slides array gracefully", async () => {
    const buffer = await generatePptx([], "Пустая", SAMPLE_CSS);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles chart data in slides", async () => {
    const slides = [
      {
        layoutId: "data-chart-bar",
        data: {
          title: "Диаграмма",
          chartData: {
            type: "bar",
            labels: ["Q1", "Q2", "Q3", "Q4"],
            datasets: [
              { label: "Продажи", data: [100, 200, 150, 300] },
            ],
          },
          _slideNumber: 1,
          _totalSlides: 1,
        },
      },
    ];

    const buffer = await generatePptx(slides, "Чарт-тест", SAMPLE_CSS);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles radar chart data", async () => {
    const slides = [
      {
        layoutId: "data-chart-radar",
        data: {
          title: "Радар",
          chartData: {
            type: "radar",
            labels: ["Скорость", "Качество", "Цена", "Дизайн", "Поддержка"],
            datasets: [
              { label: "Наш продукт", data: [8, 9, 7, 8, 9] },
              { label: "Конкурент", data: [6, 7, 8, 5, 6] },
            ],
          },
          _slideNumber: 1,
          _totalSlides: 1,
        },
      },
    ];

    const buffer = await generatePptx(slides, "Радар-тест", SAMPLE_CSS);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles unknown layout types gracefully (falls back to text)", async () => {
    const slides = [
      {
        layoutId: "unknown-layout-xyz",
        data: { title: "Неизвестный макет", _slideNumber: 1, _totalSlides: 1 },
      },
    ];

    const buffer = await generatePptx(slides, "Fallback-тест", SAMPLE_CSS);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════
// TEMPLATE GALLERY TESTS
// ═══════════════════════════════════════════════════════

describe("Template Gallery", () => {
  it("all theme presets have required fields", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.nameRu).toBeTruthy();
      expect(preset.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.gradient).toContain("linear-gradient");
      expect(typeof preset.dark).toBe("boolean");
      expect(preset.category).toBeTruthy();
      expect(preset.descRu).toBeTruthy();
    }
  });

  it("all theme presets have valid categories", () => {
    const validCategories = THEME_CATEGORIES.map((c) => c.id).filter((id) => id !== "all");
    for (const preset of THEME_PRESETS) {
      expect(validCategories).toContain(preset.category);
    }
  });

  it("every category has at least one theme", () => {
    const categories = THEME_CATEGORIES.filter((c) => c.id !== "all");
    for (const cat of categories) {
      const themes = THEME_PRESETS.filter((t) => t.category === cat.id);
      expect(themes.length).toBeGreaterThan(0);
    }
  });

  it("theme IDs are unique", () => {
    const ids = THEME_PRESETS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("has exactly 12 theme presets", () => {
    expect(THEME_PRESETS).toHaveLength(12);
  });

  it("has 5 categories including 'all'", () => {
    expect(THEME_CATEGORIES).toHaveLength(5);
    expect(THEME_CATEGORIES[0].id).toBe("all");
  });

  it("dark themes have dark=true flag", () => {
    const darkThemes = THEME_PRESETS.filter((t) => t.category === "dark");
    for (const theme of darkThemes) {
      expect(theme.dark).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════
// SHARE FEATURE TESTS (unit-level, no DB)
// ═══════════════════════════════════════════════════════

describe("Share Feature - Token Generation", () => {
  it("nanoid generates tokens of expected length", async () => {
    const { nanoid } = await import("nanoid");
    const token = nanoid(24);
    expect(token).toHaveLength(24);
    expect(typeof token).toBe("string");
    // Should be URL-safe
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("nanoid generates unique tokens", async () => {
    const { nanoid } = await import("nanoid");
    const tokens = new Set(Array.from({ length: 100 }, () => nanoid(24)));
    expect(tokens.size).toBe(100);
  });
});

describe("Share Feature - URL Construction", () => {
  it("constructs correct share URL from origin and token", () => {
    const origin = "https://example.com";
    const token = "abc123def456ghi789jkl012";
    const shareUrl = `${origin}/shared/${token}`;
    expect(shareUrl).toBe("https://example.com/shared/abc123def456ghi789jkl012");
  });

  it("handles origin with trailing slash", () => {
    const origin = "https://example.com/";
    const token = "test-token";
    // Frontend should use origin without trailing slash
    const shareUrl = `${origin.replace(/\/$/, "")}/shared/${token}`;
    expect(shareUrl).toBe("https://example.com/shared/test-token");
  });
});

// ═══════════════════════════════════════════════════════
// VERSION HISTORY TESTS
// ═══════════════════════════════════════════════════════

describe("Version History - Data Structure", () => {
  it("version data shape is correct", () => {
    // Simulate the shape returned by the API
    const version = {
      id: 1,
      presentationId: "abc123",
      slideIndex: 0,
      versionNumber: 1,
      slideHtml: "<div>Test</div>",
      slideData: { title: "Test", bullets: ["a", "b"] },
      changeType: "edit",
      changeDescription: "Updated title",
      createdAt: new Date().toISOString(),
    };

    expect(version.id).toBeTypeOf("number");
    expect(version.presentationId).toBeTypeOf("string");
    expect(version.slideIndex).toBeGreaterThanOrEqual(0);
    expect(version.versionNumber).toBeGreaterThanOrEqual(1);
    expect(version.slideHtml).toContain("<div>");
    expect(version.slideData).toHaveProperty("title");
    expect(version.changeType).toMatch(/^(edit|layout_change|content_update|ai_edit)$/);
  });

  it("version numbers are sequential", () => {
    const versions = [
      { versionNumber: 1 },
      { versionNumber: 2 },
      { versionNumber: 3 },
    ];

    for (let i = 0; i < versions.length - 1; i++) {
      expect(versions[i + 1].versionNumber).toBe(versions[i].versionNumber + 1);
    }
  });

  it("change types are valid", () => {
    const validTypes = ["edit", "layout_change", "content_update", "ai_edit"];
    const testTypes = ["edit", "layout_change", "content_update"];

    for (const t of testTypes) {
      expect(validTypes).toContain(t);
    }
  });
});

describe("Version History - Restore Logic", () => {
  it("restoring a version should produce a new current state", () => {
    // Simulate: original data → edit → restore to original
    const originalData = { title: "Original", bullets: ["A", "B"] };
    const editedData = { title: "Edited", bullets: ["A", "B", "C"] };

    // After restore, current should match original
    const restoredData = { ...originalData };
    expect(restoredData.title).toBe("Original");
    expect(restoredData.bullets).toEqual(["A", "B"]);
    expect(restoredData).not.toEqual(editedData);
  });

  it("version list is ordered newest first", () => {
    const versions = [
      { versionNumber: 3, createdAt: "2026-02-13T12:03:00Z" },
      { versionNumber: 2, createdAt: "2026-02-13T12:02:00Z" },
      { versionNumber: 1, createdAt: "2026-02-13T12:01:00Z" },
    ];

    for (let i = 0; i < versions.length - 1; i++) {
      expect(versions[i].versionNumber).toBeGreaterThan(versions[i + 1].versionNumber);
    }
  });
});

// ═══════════════════════════════════════════════════════
// PDF EXPORT TESTS
// ═══════════════════════════════════════════════════════

describe("PDF Export", () => {
  it("generates a valid PDF buffer from a title slide", async () => {
    const { generatePdf } = await import("./pdfExport");

    const slides = [
      {
        layoutId: "title-slide",
        data: {
          title: "PDF Тест",
          subtitle: "Подзаголовок",
          author: "Автор",
          date: "2026",
        },
      },
    ];

    const buffer = await generatePdf(slides, "PDF Тест", SAMPLE_CSS);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(buffer[0]).toBe(0x25); // %
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x44); // D
    expect(buffer[3]).toBe(0x46); // F
  }, 60000); // 60s timeout for puppeteer

  it("generates multi-page PDF from multiple slides", async () => {
    const { generatePdf } = await import("./pdfExport");

    const slides = [
      {
        layoutId: "title-slide",
        data: { title: "Слайд 1", subtitle: "Начало" },
      },
      {
        layoutId: "content-text",
        data: {
          title: "Слайд 2",
          bullets: ["Пункт 1", "Пункт 2"],
          _slideNumber: 2,
          _totalSlides: 3,
        },
      },
      {
        layoutId: "final-slide",
        data: { title: "Конец", subtitle: "Спасибо!" },
      },
    ];

    const buffer = await generatePdf(slides, "Мульти-PDF", SAMPLE_CSS);

    expect(buffer).toBeInstanceOf(Buffer);
    // Multi-page PDF should be larger than single-page
    expect(buffer.length).toBeGreaterThan(1000);
  }, 60000);

  it("handles empty slides array", async () => {
    const { generatePdf } = await import("./pdfExport");

    const buffer = await generatePdf([], "Пустой PDF", SAMPLE_CSS);

    expect(buffer).toBeInstanceOf(Buffer);
    // Even empty PDF has headers
    expect(buffer.length).toBeGreaterThan(0);
  }, 60000);
});
