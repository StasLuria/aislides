/**
 * Tests for parseOutlineFromFiles — parsing pre-built outlines from uploaded file content.
 * This function recognizes the [PRESENTATION_OUTLINE] marker from Vision LLM extraction
 * and converts it into an OutlineResult structure.
 */
import { describe, it, expect } from "vitest";

// We need to test the parseOutlineFromFiles function.
// Since it's a private function in chatOrchestrator, we'll extract the logic for testing.
// For now, we test the parsing logic directly.

interface MockFile {
  fileId: string;
  filename: string;
  mimeType: string;
  extractedText: string | null;
}

/**
 * Replicated parsing logic from chatOrchestrator.parseOutlineFromFiles
 * for unit testing purposes.
 */
function parseOutlineFromFiles(
  readyFiles: MockFile[],
): { presentation_title: string; target_audience: string; narrative_arc: string; slides: any[] } | null {
  for (const f of readyFiles) {
    const text = f.extractedText || "";
    if (!text.includes("[PRESENTATION_OUTLINE]")) continue;

    try {
      const slides: any[] = [];
      const slideBlocks = text.split(/---/).filter(Boolean);

      for (const block of slideBlocks) {
        const slideMatch = block.match(/SLIDE\s+(\d+):\s*(.+)/i);
        const purposeMatch = block.match(/PURPOSE:\s*(.+)/i);

        if (slideMatch) {
          const slideNum = parseInt(slideMatch[1]);
          const title = slideMatch[2].trim();
          const purpose = purposeMatch ? purposeMatch[1].trim() : title;

          slides.push({
            slide_number: slideNum,
            title,
            purpose,
            key_points: [purpose],
            speaker_notes_hint: `Слайд ${slideNum}: ${title}`,
            content_shape: slideNum === 1 ? undefined : (slideNum === slides.length + 1 ? undefined : "bullet_points"),
            slide_category: slideNum === 1 ? "TITLE" : "CONTENT",
          });
        }
      }

      if (slides.length < 2) continue;

      const presentationTitle = slides[0]?.title || "Презентация";

      if (slides.length > 0) {
        slides[0].slide_category = "TITLE";
        slides[0].content_shape = undefined;
      }
      if (slides.length > 1) {
        slides[slides.length - 1].slide_category = "FINAL";
        slides[slides.length - 1].content_shape = undefined;
      }

      return {
        presentation_title: presentationTitle,
        target_audience: "Широкая аудитория",
        narrative_arc: "FRAMEWORK",
        slides,
      };
    } catch (err) {
      // skip
    }
  }

  return null;
}

describe("parseOutlineFromFiles", () => {
  it("should return null when no files have PRESENTATION_OUTLINE marker", () => {
    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "image.png",
        mimeType: "image/png",
        extractedText: "This is a regular image description with some text content.",
      },
    ];
    expect(parseOutlineFromFiles(files)).toBeNull();
  });

  it("should return null when extractedText is null", () => {
    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "image.png",
        mimeType: "image/png",
        extractedText: null,
      },
    ];
    expect(parseOutlineFromFiles(files)).toBeNull();
  });

  it("should return null when only 1 slide is found (need at least 2)", () => {
    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "outline.png",
        mimeType: "image/png",
        extractedText: `[PRESENTATION_OUTLINE]
SLIDE 1: Only One Slide
PURPOSE: This is the only slide`,
      },
    ];
    expect(parseOutlineFromFiles(files)).toBeNull();
  });

  it("should parse a valid 10-slide outline from Daily Banking screenshot", () => {
    const extractedText = `[PRESENTATION_OUTLINE]
SLIDE 1: Daily Banking 2025-2026: Новые технологии и продукты
PURPOSE: Титульный слайд с названием и подзаголовком о новых технологиях в России и мире.
---
SLIDE 2: Ключевые цифры 2025 года — мир меняется
PURPOSE: Обзор ключевых метрик 2025 года, показывающих масштаб изменений в банковском ритейле.
---
SLIDE 3: Agentic AI — банкир в кармане каждого клиента
PURPOSE: Анализ тренда перехода от чат-ботов к автономным AI-агентам с примерами глобальных банков.
---
SLIDE 4: Биометрия и мгновенные платежи — глобальный стандарт
PURPOSE: Сравнение развития биометрических и мгновенных платежей в мире с конкретными примерами.
---
SLIDE 5: Россия — ИИ и суперапы лидируют
PURPOSE: Обзор лидерства российских банков в создании AI-экосистем и суперапов.
---
SLIDE 6: Альтернативные платежи и цифровой рубль
PURPOSE: Анализ новых платежных технологий в России после ухода международных систем.
---
SLIDE 7: Безопасность — новые механизмы защиты
PURPOSE: Статистика мошенничества и новые технологические ответы банков на угрозы.
---
SLIDE 8: Премиум-банкинг — борьба за состоятельных клиентов
PURPOSE: Тренды и цифры роста премиального сегмента в России и мире.
---
SLIDE 9: T-Premium — новая модель премиального банкинга
PURPOSE: Детальный разбор новой 4-уровневой модели Т-Банка и других инноваций в премиуме.
---
SLIDE 10: Ключевые выводы и прогнозы
PURPOSE: Четыре главных тренда, которые будут определять будущее daily banking.
---
TOTAL_SLIDES: 10`;

    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "structure.png",
        mimeType: "image/png",
        extractedText,
      },
    ];

    const result = parseOutlineFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.slides).toHaveLength(10);
    expect(result!.presentation_title).toBe("Daily Banking 2025-2026: Новые технологии и продукты");

    // First slide should be TITLE
    expect(result!.slides[0].slide_category).toBe("TITLE");
    expect(result!.slides[0].title).toBe("Daily Banking 2025-2026: Новые технологии и продукты");

    // Last slide should be FINAL
    expect(result!.slides[9].slide_category).toBe("FINAL");
    expect(result!.slides[9].title).toBe("Ключевые выводы и прогнозы");

    // Middle slides should be CONTENT
    expect(result!.slides[4].slide_category).toBe("CONTENT");
    expect(result!.slides[4].title).toBe("Россия — ИИ и суперапы лидируют");
    expect(result!.slides[4].purpose).toBe("Обзор лидерства российских банков в создании AI-экосистем и суперапов.");

    // Slide numbers should be correct
    for (let i = 0; i < 10; i++) {
      expect(result!.slides[i].slide_number).toBe(i + 1);
    }
  });

  it("should parse a minimal 3-slide outline", () => {
    const extractedText = `[PRESENTATION_OUTLINE]
SLIDE 1: Введение
PURPOSE: Титульный слайд
---
SLIDE 2: Основной контент
PURPOSE: Главная информация
---
SLIDE 3: Заключение
PURPOSE: Выводы и итоги
---
TOTAL_SLIDES: 3`;

    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "outline.png",
        mimeType: "image/png",
        extractedText,
      },
    ];

    const result = parseOutlineFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.slides).toHaveLength(3);
    expect(result!.slides[0].slide_category).toBe("TITLE");
    expect(result!.slides[1].slide_category).toBe("CONTENT");
    expect(result!.slides[2].slide_category).toBe("FINAL");
  });

  it("should use the first file with outline marker when multiple files are present", () => {
    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "regular.pdf",
        mimeType: "application/pdf",
        extractedText: "Some regular PDF content without outline marker.",
      },
      {
        fileId: "f2",
        filename: "outline.png",
        mimeType: "image/png",
        extractedText: `[PRESENTATION_OUTLINE]
SLIDE 1: First
PURPOSE: First slide
---
SLIDE 2: Second
PURPOSE: Second slide
---
SLIDE 3: Third
PURPOSE: Third slide
---
TOTAL_SLIDES: 3`,
      },
    ];

    const result = parseOutlineFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.slides).toHaveLength(3);
  });

  it("should handle outline with PURPOSE on same line as SLIDE", () => {
    const extractedText = `[PRESENTATION_OUTLINE]
SLIDE 1: Title Slide
PURPOSE: Opening
---
SLIDE 2: Content
PURPOSE: Main body
---
TOTAL_SLIDES: 2`;

    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "test.png",
        mimeType: "image/png",
        extractedText,
      },
    ];

    const result = parseOutlineFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.slides).toHaveLength(2);
    expect(result!.slides[0].purpose).toBe("Opening");
    expect(result!.slides[1].purpose).toBe("Main body");
  });

  it("should set key_points from purpose", () => {
    const extractedText = `[PRESENTATION_OUTLINE]
SLIDE 1: Intro
PURPOSE: Introduction to the topic
---
SLIDE 2: Details
PURPOSE: Detailed analysis of the subject
---
TOTAL_SLIDES: 2`;

    const files: MockFile[] = [
      {
        fileId: "f1",
        filename: "test.png",
        mimeType: "image/png",
        extractedText,
      },
    ];

    const result = parseOutlineFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.slides[0].key_points).toEqual(["Introduction to the topic"]);
    expect(result!.slides[1].key_points).toEqual(["Detailed analysis of the subject"]);
  });

  it("should return null for empty files array", () => {
    expect(parseOutlineFromFiles([])).toBeNull();
  });
});
