import { describe, it, expect } from "vitest";
import { extractTextFromFile, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE, MAX_FILES_PER_MESSAGE, getFileTypeLabel } from "./fileExtractor";

describe("File Upload Feature", () => {
  describe("extractTextFromFile — text extraction", () => {
    it("should extract text from plain text buffer", async () => {
      const content = "Hello, this is a test document about AI presentations.";
      const buffer = Buffer.from(content, "utf-8");
      const result = await extractTextFromFile(buffer, "text/plain", "test.txt");
      expect(result.text).toBe(content);
      expect(result.error).toBeUndefined();
    });

    it("should handle empty text buffer", async () => {
      const buffer = Buffer.from("", "utf-8");
      const result = await extractTextFromFile(buffer, "text/plain", "empty.txt");
      expect(result.text).toBe("");
    });

    it("should return empty text for unsupported mime type without s3Url", async () => {
      const buffer = Buffer.from("binary data");
      const result = await extractTextFromFile(buffer, "application/octet-stream", "file.bin");
      expect(result.text).toBe("");
    });

    it("should handle markdown as text/plain variant", async () => {
      const content = "# Heading\n\nSome **bold** text.";
      const buffer = Buffer.from(content, "utf-8");
      // markdown files are typically sent as text/plain or text/markdown
      const result = await extractTextFromFile(buffer, "text/plain", "readme.md");
      expect(result.text).toBe(content);
    });

    it("should handle CSV as text content", async () => {
      const content = "Name,Age,City\nAlice,30,Moscow\nBob,25,London";
      const buffer = Buffer.from(content, "utf-8");
      const result = await extractTextFromFile(buffer, "text/plain", "data.csv");
      expect(result.text).toBe(content);
    });

    it("should handle large text buffers", async () => {
      const longContent = "A".repeat(100000);
      const buffer = Buffer.from(longContent, "utf-8");
      const result = await extractTextFromFile(buffer, "text/plain", "long.txt");
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.text.length).toBeLessThanOrEqual(longContent.length);
    });

    it("should handle UTF-8 content with Cyrillic characters", async () => {
      const content = "Презентация о качестве воды в мире. Данные за 2025 год.";
      const buffer = Buffer.from(content, "utf-8");
      const result = await extractTextFromFile(buffer, "text/plain", "report.txt");
      expect(result.text).toContain("Презентация");
      expect(result.text).toContain("качестве воды");
    });
  });

  describe("SUPPORTED_MIME_TYPES", () => {
    it("should include PDF", () => {
      expect(SUPPORTED_MIME_TYPES).toContain("application/pdf");
    });

    it("should include DOCX", () => {
      expect(SUPPORTED_MIME_TYPES).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("should include PPTX", () => {
      expect(SUPPORTED_MIME_TYPES).toContain(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
    });

    it("should include plain text", () => {
      expect(SUPPORTED_MIME_TYPES).toContain("text/plain");
    });

    it("should include images", () => {
      expect(SUPPORTED_MIME_TYPES).toContain("image/png");
      expect(SUPPORTED_MIME_TYPES).toContain("image/jpeg");
    });

    it("should not include unsupported types", () => {
      expect(SUPPORTED_MIME_TYPES).not.toContain("application/octet-stream");
    });
  });

  describe("Constants", () => {
    it("MAX_FILE_SIZE should be 10MB", () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it("MAX_FILES_PER_MESSAGE should be 5", () => {
      expect(MAX_FILES_PER_MESSAGE).toBe(5);
    });
  });

  describe("getFileTypeLabel", () => {
    it("should return correct label for PDF", () => {
      expect(getFileTypeLabel("application/pdf")).toBe("PDF");
    });

    it("should return correct label for DOCX", () => {
      expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
    });

    it("should return correct label for PPTX", () => {
      expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("PPTX");
    });

    it("should return correct label for images", () => {
      expect(getFileTypeLabel("image/png")).toBe("PNG");
      expect(getFileTypeLabel("image/jpeg")).toBe("JPG");
    });

    it("should return correct label for text", () => {
      expect(getFileTypeLabel("text/plain")).toBe("TXT");
    });

    it("should return 'FILE' for unknown types", () => {
      expect(getFileTypeLabel("application/octet-stream")).toBe("FILE");
    });
  });

  describe("File context building for orchestrator", () => {
    it("should build file context string from file data", () => {
      const files = [
        {
          filename: "report.pdf",
          extractedText: "Revenue grew by 15% in Q3 2025. Key drivers include...",
        },
        {
          filename: "data.csv",
          extractedText: "Month,Revenue\nJan,100\nFeb,120\nMar,150",
        },
      ];

      const contextParts = files.map(
        (f) => `--- Файл: ${f.filename} ---\n${f.extractedText}`
      );
      const fullContext = contextParts.join("\n\n");

      expect(fullContext).toContain("report.pdf");
      expect(fullContext).toContain("Revenue grew by 15%");
      expect(fullContext).toContain("data.csv");
      expect(fullContext).toContain("Month,Revenue");
    });

    it("should handle empty file list", () => {
      const files: any[] = [];
      const contextParts = files.map(
        (f: any) => `--- Файл: ${f.filename} ---\n${f.extractedText}`
      );
      const fullContext = contextParts.join("\n\n");
      expect(fullContext).toBe("");
    });
  });
});
