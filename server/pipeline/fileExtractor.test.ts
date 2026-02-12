/**
 * Tests for fileExtractor module
 * Covers: validation, text extraction from various formats, truncation, formatting
 */

import { describe, it, expect } from "vitest";
import {
  validateFile,
  extractTextFromFile,
  formatContentForPrompt,
  detectFileType,
  MAX_FILE_SIZE,
  type ExtractedContent,
} from "./fileExtractor";

// ─── detectFileType ────────────────────────────────────────

describe("detectFileType", () => {
  it("detects PDF from MIME type", () => {
    expect(detectFileType("file.pdf", "application/pdf")).toBe("pdf");
  });

  it("detects DOCX from MIME type", () => {
    expect(detectFileType("file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
  });

  it("detects PPTX from MIME type", () => {
    expect(detectFileType("file.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("pptx");
  });

  it("detects TXT from MIME type", () => {
    expect(detectFileType("file.txt", "text/plain")).toBe("txt");
  });

  it("detects MD from MIME type", () => {
    expect(detectFileType("file.md", "text/markdown")).toBe("txt");
  });

  it("detects CSV from MIME type", () => {
    expect(detectFileType("data.csv", "text/csv")).toBe("txt");
  });

  it("falls back to extension when MIME unknown", () => {
    expect(detectFileType("report.pdf")).toBe("pdf");
    expect(detectFileType("doc.docx")).toBe("docx");
    expect(detectFileType("slides.pptx")).toBe("pptx");
    expect(detectFileType("notes.txt")).toBe("txt");
    expect(detectFileType("readme.md")).toBe("txt");
    expect(detectFileType("data.csv")).toBe("txt");
  });

  it("returns unknown for unsupported types", () => {
    expect(detectFileType("image.png", "image/png")).toBe("unknown");
    expect(detectFileType("file.xyz")).toBe("unknown");
  });
});

// ─── validateFile ──────────────────────────────────────────

describe("validateFile", () => {
  it("accepts PDF files", () => {
    const result = validateFile("report.pdf", 1024 * 1024, "application/pdf");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts DOCX files", () => {
    const result = validateFile(
      "document.docx",
      500 * 1024,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.valid).toBe(true);
  });

  it("accepts TXT files", () => {
    const result = validateFile("notes.txt", 100 * 1024, "text/plain");
    expect(result.valid).toBe(true);
  });

  it("accepts PPTX files", () => {
    const result = validateFile(
      "slides.pptx",
      2 * 1024 * 1024,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(result.valid).toBe(true);
  });

  it("accepts MD files", () => {
    const result = validateFile("readme.md", 50 * 1024, "text/markdown");
    expect(result.valid).toBe(true);
  });

  it("accepts CSV files", () => {
    const result = validateFile("data.csv", 200 * 1024, "text/csv");
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported file types", () => {
    const result = validateFile("image.png", 1024, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Неподдерживаемый");
  });

  it("rejects EXE files", () => {
    const result = validateFile("malware.exe", 1024, "application/x-msdownload");
    expect(result.valid).toBe(false);
  });

  it("rejects files over 10MB", () => {
    const result = validateFile("huge.pdf", MAX_FILE_SIZE + 1, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toContain("больш");
  });

  it("accepts files at exactly 10MB limit", () => {
    const result = validateFile("exact.pdf", MAX_FILE_SIZE, "application/pdf");
    expect(result.valid).toBe(true);
  });
});

// ─── extractTextFromFile ───────────────────────────────────

describe("extractTextFromFile", () => {
  it("extracts text from TXT buffer", async () => {
    const content = "Это тестовый документ для презентации.\nВторая строка текста.";
    const buffer = Buffer.from(content, "utf-8");

    const result = await extractTextFromFile(buffer, "test.txt", "text/plain");

    expect(result.rawText).toContain("Это тестовый документ");
    expect(result.rawText).toContain("Вторая строка");
    expect(result.fileType).toBe("txt");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.wasTruncated).toBe(false);
    expect(result.filename).toBe("test.txt");
  });

  it("extracts text from MD buffer", async () => {
    const content = "# Заголовок\n\nПараграф текста с **жирным** и *курсивом*.\n\n- Пункт 1\n- Пункт 2";
    const buffer = Buffer.from(content, "utf-8");

    const result = await extractTextFromFile(buffer, "readme.md", "text/markdown");

    expect(result.rawText).toContain("Заголовок");
    expect(result.rawText).toContain("Параграф текста");
    // MD is treated as txt type
    expect(result.fileType).toBe("txt");
  });

  it("extracts text from CSV buffer", async () => {
    const content = "Год,Выручка,Прибыль\n2023,100M,20M\n2024,150M,35M\n2025,200M,50M";
    const buffer = Buffer.from(content, "utf-8");

    const result = await extractTextFromFile(buffer, "data.csv", "text/csv");

    expect(result.rawText).toContain("Год");
    expect(result.rawText).toContain("Выручка");
    expect(result.rawText).toContain("2024");
    expect(result.fileType).toBe("txt");
  });

  it("truncates very long text content", async () => {
    // Create a very long text (over 8000 chars)
    const longText = Array(5000).fill("слово тест ").join("");
    const buffer = Buffer.from(longText, "utf-8");

    const result = await extractTextFromFile(buffer, "long.txt", "text/plain");

    expect(result.wasTruncated).toBe(true);
    expect(result.contextText.length).toBeLessThan(result.rawText.length);
    expect(result.contextText).toContain("обрезан");
  });

  it("sets correct word count", async () => {
    const content = "Один два три четыре пять шесть семь восемь девять десять";
    const buffer = Buffer.from(content, "utf-8");

    const result = await extractTextFromFile(buffer, "count.txt", "text/plain");

    expect(result.wordCount).toBe(10);
  });

  it("handles whitespace-only text", async () => {
    const buffer = Buffer.from("   \n\n  ", "utf-8");

    const result = await extractTextFromFile(buffer, "empty.txt", "text/plain");

    expect(result.wordCount).toBe(0);
    expect(result.rawText).toBeDefined();
  });

  it("throws for unsupported file types", async () => {
    const buffer = Buffer.from("binary content", "utf-8");

    await expect(
      extractTextFromFile(buffer, "file.xyz", "application/octet-stream"),
    ).rejects.toThrow();
  });

  it("returns contextText equal to rawText when not truncated", async () => {
    const content = "Short text for testing.";
    const buffer = Buffer.from(content, "utf-8");

    const result = await extractTextFromFile(buffer, "short.txt", "text/plain");

    expect(result.wasTruncated).toBe(false);
    expect(result.contextText).toBe(result.rawText);
  });
});

// ─── formatContentForPrompt ────────────────────────────────

describe("formatContentForPrompt", () => {
  const mockContent: ExtractedContent = {
    filename: "report.pdf",
    fileType: "pdf",
    rawText: "Текст документа о финансовых результатах компании.",
    contextText: "Текст документа о финансовых результатах компании.",
    wordCount: 6,
    wasTruncated: false,
    pageCount: 5,
  };

  it("formats content with filename", () => {
    const result = formatContentForPrompt(mockContent);

    expect(result).toContain("report.pdf");
    expect(result).toContain("Текст документа");
    expect(result).toContain("<source_document>");
    expect(result).toContain("</source_document>");
  });

  it("includes file metadata", () => {
    const result = formatContentForPrompt(mockContent);

    expect(result).toContain("<file_type>pdf</file_type>");
    expect(result).toContain("<word_count>6</word_count>");
    expect(result).toContain("<page_count>5</page_count>");
  });

  it("uses summary when provided", () => {
    const result = formatContentForPrompt(mockContent, "Краткое резюме документа");

    expect(result).toContain("Краткое резюме документа");
  });

  it("uses contextText when no summary", () => {
    const result = formatContentForPrompt(mockContent);

    expect(result).toContain("Текст документа о финансовых результатах");
  });

  it("handles content without pageCount", () => {
    const contentNoPages: ExtractedContent = {
      ...mockContent,
      pageCount: undefined,
    };

    const result = formatContentForPrompt(contentNoPages);

    expect(result).not.toContain("<page_count>");
    expect(result).toContain("<filename>report.pdf</filename>");
  });

  it("wraps content in XML delimiters", () => {
    const result = formatContentForPrompt(mockContent);

    expect(result).toContain("<content>");
    expect(result).toContain("</content>");
  });
});
