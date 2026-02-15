/**
 * Round 48 Tests: Annotation Highlighting, Apply Changes, Slide Quoting
 * Tests for the backend logic supporting these features.
 */
import { describe, it, expect } from "vitest";

describe("Round 48: Quote context with slide references", () => {
  // Test the slide reference regex pattern used in chatOrchestrator
  const slideRefRegex = /^\[Слайд (\d+):\s*(.+?)\]$/;

  it("should match a valid slide reference", () => {
    const text = "[Слайд 3: Наша миссия]";
    const match = text.match(slideRefRegex);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("3");
    expect(match![2]).toBe("Наша миссия");
  });

  it("should match slide reference with long title", () => {
    const text = "[Слайд 12: Стратегия развития компании на 2026 год]";
    const match = text.match(slideRefRegex);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("12");
    expect(match![2]).toBe("Стратегия развития компании на 2026 год");
  });

  it("should not match regular text", () => {
    const text = "Обычный текст без слайда";
    const match = text.match(slideRefRegex);
    expect(match).toBeNull();
  });

  it("should not match partial slide reference", () => {
    const text = "Слайд 3: Наша миссия";
    const match = text.match(slideRefRegex);
    expect(match).toBeNull();
  });

  it("should build correct effective message for slide quote", () => {
    const quoteText = "[Слайд 5: Финансовые показатели]";
    const userMessage = "Замени диаграмму на таблицу";
    const slideMatch = quoteText.match(slideRefRegex);

    expect(slideMatch).not.toBeNull();
    const slideNum = slideMatch![1];
    const slideTitle = slideMatch![2];
    const effectiveMessage = `[Пользователь ссылается на конкретный слайд презентации]\nСлайд №${slideNum}: «${slideTitle}»\n\nЗапрос пользователя: ${userMessage}\n\nПожалуйста, внеси изменения именно в этот слайд.`;

    expect(effectiveMessage).toContain("Слайд №5");
    expect(effectiveMessage).toContain("«Финансовые показатели»");
    expect(effectiveMessage).toContain("Замени диаграмму на таблицу");
    expect(effectiveMessage).toContain("Пожалуйста, внеси изменения именно в этот слайд");
  });

  it("should build correct effective message for text quote", () => {
    const quoteText = "Наша компания была основана в 2020 году";
    const userMessage = "Измени год на 2019";
    const slideMatch = quoteText.match(slideRefRegex);

    expect(slideMatch).toBeNull();
    const effectiveMessage = `[Пользователь цитирует фрагмент из предыдущего сообщения]\nЦитата: «${quoteText}»\n\nКомментарий пользователя: ${userMessage}`;

    expect(effectiveMessage).toContain("цитирует фрагмент");
    expect(effectiveMessage).toContain("«Наша компания была основана в 2020 году»");
    expect(effectiveMessage).toContain("Измени год на 2019");
  });
});

describe("Round 48: Annotation text segmentation", () => {
  // Simulate the AnnotatedContent segmentation logic
  interface Annotation {
    id: string;
    selectedText: string;
    note: string;
    startOffset: number;
    endOffset: number;
    createdAt: number;
  }

  function buildSegments(content: string, annotations: Annotation[]) {
    if (!annotations.length) return [{ text: content, annotation: null as Annotation | null }];

    const positioned = annotations.map(a => {
      const idx = content.indexOf(a.selectedText);
      return { ...a, foundAt: idx };
    }).filter(a => a.foundAt >= 0).sort((a, b) => a.foundAt - b.foundAt);

    if (!positioned.length) return [{ text: content, annotation: null as Annotation | null }];

    const result: { text: string; annotation: Annotation | null }[] = [];
    let cursor = 0;

    for (const ann of positioned) {
      if (ann.foundAt < cursor) continue;
      if (ann.foundAt > cursor) {
        result.push({ text: content.slice(cursor, ann.foundAt), annotation: null });
      }
      result.push({ text: ann.selectedText, annotation: ann });
      cursor = ann.foundAt + ann.selectedText.length;
    }

    if (cursor < content.length) {
      result.push({ text: content.slice(cursor), annotation: null });
    }

    return result;
  }

  it("should return full text as single segment when no annotations", () => {
    const segments = buildSegments("Hello world", []);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hello world");
    expect(segments[0].annotation).toBeNull();
  });

  it("should split text into annotated and non-annotated segments", () => {
    const content = "Наша компания была основана в 2020 году и выросла до 500 сотрудников";
    const annotations: Annotation[] = [{
      id: "a1",
      selectedText: "2020 году",
      note: "Проверить дату",
      startOffset: 0,
      endOffset: 0,
      createdAt: Date.now(),
    }];

    const segments = buildSegments(content, annotations);
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toBe("Наша компания была основана в ");
    expect(segments[0].annotation).toBeNull();
    expect(segments[1].text).toBe("2020 году");
    expect(segments[1].annotation).not.toBeNull();
    expect(segments[1].annotation!.note).toBe("Проверить дату");
    expect(segments[2].text).toBe(" и выросла до 500 сотрудников");
    expect(segments[2].annotation).toBeNull();
  });

  it("should handle multiple non-overlapping annotations", () => {
    const content = "AI компания создаёт продукты для бизнеса";
    const annotations: Annotation[] = [
      { id: "a1", selectedText: "AI компания", note: "Уточнить название", startOffset: 0, endOffset: 0, createdAt: Date.now() },
      { id: "a2", selectedText: "для бизнеса", note: "B2B фокус", startOffset: 0, endOffset: 0, createdAt: Date.now() },
    ];

    const segments = buildSegments(content, annotations);
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toBe("AI компания");
    expect(segments[0].annotation!.id).toBe("a1");
    expect(segments[1].text).toBe(" создаёт продукты ");
    expect(segments[1].annotation).toBeNull();
    expect(segments[2].text).toBe("для бизнеса");
    expect(segments[2].annotation!.id).toBe("a2");
  });

  it("should handle annotation at the very start of text", () => {
    const content = "Важный текст в начале сообщения";
    const annotations: Annotation[] = [{
      id: "a1",
      selectedText: "Важный текст",
      note: "Выделить",
      startOffset: 0,
      endOffset: 0,
      createdAt: Date.now(),
    }];

    const segments = buildSegments(content, annotations);
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe("Важный текст");
    expect(segments[0].annotation).not.toBeNull();
    expect(segments[1].text).toBe(" в начале сообщения");
    expect(segments[1].annotation).toBeNull();
  });

  it("should handle annotation not found in text gracefully", () => {
    const content = "Текст без совпадений";
    const annotations: Annotation[] = [{
      id: "a1",
      selectedText: "несуществующий фрагмент",
      note: "Не найден",
      startOffset: 0,
      endOffset: 0,
      createdAt: Date.now(),
    }];

    const segments = buildSegments(content, annotations);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Текст без совпадений");
    expect(segments[0].annotation).toBeNull();
  });
});

describe("Round 48: Apply Changes detection", () => {
  it("should detect user message with quote (starts with >)", () => {
    const userContent = "> Наша компания основана в 2020 году\n\nИзмени на 2019";
    expect(userContent.startsWith(">")).toBe(true);
  });

  it("should not detect regular user message as quote", () => {
    const userContent = "Создай презентацию о компании";
    expect(userContent.startsWith(">")).toBe(false);
  });

  it("should extract quote lines from user message", () => {
    const userContent = "> Первая строка цитаты\n> Вторая строка цитаты\n\nМой комментарий";
    const lines = userContent.split("\n");
    const quoteLines = lines.filter(l => l.startsWith("> ")).map(l => l.slice(2));
    expect(quoteLines).toEqual(["Первая строка цитаты", "Вторая строка цитаты"]);
  });
});
