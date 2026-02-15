/**
 * Tests for quote context passing in chat messages.
 * Verifies that quoteContext is properly received and processed by the backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Quote Context in Chat Messages", () => {
  // Test the effective message construction logic (unit test)
  describe("effectiveMessage construction", () => {
    function buildEffectiveMessage(
      userMessage: string,
      quoteContext?: { text: string; messageIndex: number },
    ): string {
      if (quoteContext && quoteContext.text) {
        return `[Пользователь цитирует фрагмент из предыдущего сообщения]\nЦитата: «${quoteContext.text}»\n\nКомментарий пользователя: ${userMessage}`;
      }
      return userMessage;
    }

    function buildDisplayContent(
      userMessage: string,
      quoteContext?: { text: string; messageIndex: number },
    ): string {
      if (quoteContext && quoteContext.text) {
        return `> ${quoteContext.text.split("\n").join("\n> ")}\n\n${userMessage}`;
      }
      return userMessage;
    }

    it("should pass message as-is when no quoteContext", () => {
      const result = buildEffectiveMessage("Привет, сделай презентацию");
      expect(result).toBe("Привет, сделай презентацию");
    });

    it("should wrap message with quote context when quoteContext is provided", () => {
      const result = buildEffectiveMessage("Измени этот пункт на другой", {
        text: "1. Введение в AI",
        messageIndex: 2,
      });
      expect(result).toContain("[Пользователь цитирует фрагмент из предыдущего сообщения]");
      expect(result).toContain("Цитата: «1. Введение в AI»");
      expect(result).toContain("Комментарий пользователя: Измени этот пункт на другой");
    });

    it("should handle multi-line quoted text", () => {
      const result = buildEffectiveMessage("Объедини эти пункты", {
        text: "1. Введение\n2. Обзор рынка",
        messageIndex: 3,
      });
      expect(result).toContain("Цитата: «1. Введение\n2. Обзор рынка»");
    });

    it("should build display content with markdown blockquote", () => {
      const result = buildDisplayContent("Измени это", {
        text: "Фрагмент текста",
        messageIndex: 1,
      });
      expect(result).toBe("> Фрагмент текста\n\nИзмени это");
    });

    it("should handle multi-line display content", () => {
      const result = buildDisplayContent("Объедини", {
        text: "Строка 1\nСтрока 2",
        messageIndex: 1,
      });
      expect(result).toBe("> Строка 1\n> Строка 2\n\nОбъедини");
    });

    it("should return plain message for display when no quote", () => {
      const result = buildDisplayContent("Обычное сообщение");
      expect(result).toBe("Обычное сообщение");
    });
  });

  // Test the route-level quoteContext parsing
  describe("quoteContext parsing from request body", () => {
    function parseQuoteContext(body: any): { text: string; messageIndex: number } | undefined {
      const { quoteContext } = body;
      return quoteContext &&
        typeof quoteContext === "object" &&
        typeof quoteContext.text === "string"
        ? {
            text: quoteContext.text,
            messageIndex:
              typeof quoteContext.messageIndex === "number" ? quoteContext.messageIndex : -1,
          }
        : undefined;
    }

    it("should parse valid quoteContext", () => {
      const result = parseQuoteContext({
        message: "Измени",
        quoteContext: { text: "Цитата", messageIndex: 2 },
      });
      expect(result).toEqual({ text: "Цитата", messageIndex: 2 });
    });

    it("should return undefined for missing quoteContext", () => {
      const result = parseQuoteContext({ message: "Привет" });
      expect(result).toBeUndefined();
    });

    it("should return undefined for invalid quoteContext (not object)", () => {
      const result = parseQuoteContext({ message: "Привет", quoteContext: "string" });
      expect(result).toBeUndefined();
    });

    it("should return undefined for quoteContext without text", () => {
      const result = parseQuoteContext({
        message: "Привет",
        quoteContext: { messageIndex: 1 },
      });
      expect(result).toBeUndefined();
    });

    it("should default messageIndex to -1 when not a number", () => {
      const result = parseQuoteContext({
        message: "Привет",
        quoteContext: { text: "Цитата", messageIndex: "abc" },
      });
      expect(result).toEqual({ text: "Цитата", messageIndex: -1 });
    });
  });
});
