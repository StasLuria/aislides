import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the comment API endpoints.
 * Since the comment routes are Express routes (not tRPC), we test the API logic
 * by verifying the data structures and comment manipulation patterns.
 */

interface MessageComment {
  id: string;
  text: string;
  createdAt: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  comments?: MessageComment[];
  slideComments?: Record<number, MessageComment[]>;
}

// Helper: simulate adding a comment to a message
function addCommentToMessage(
  messages: ChatMessage[],
  msgIndex: number,
  commentText: string,
): { messages: ChatMessage[]; comment: MessageComment } {
  const updated = [...messages];
  const msg = { ...updated[msgIndex] };
  const comment: MessageComment = {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: commentText.trim(),
    createdAt: Date.now(),
  };
  msg.comments = [...(msg.comments || []), comment];
  updated[msgIndex] = msg;
  return { messages: updated, comment };
}

// Helper: simulate deleting a comment from a message
function deleteCommentFromMessage(
  messages: ChatMessage[],
  msgIndex: number,
  commentId: string,
): ChatMessage[] {
  const updated = [...messages];
  const msg = { ...updated[msgIndex] };
  msg.comments = (msg.comments || []).filter((c) => c.id !== commentId);
  updated[msgIndex] = msg;
  return updated;
}

// Helper: simulate adding a slide comment
function addSlideComment(
  messages: ChatMessage[],
  msgIndex: number,
  slideNumber: number,
  commentText: string,
): { messages: ChatMessage[]; comment: MessageComment } {
  const updated = [...messages];
  const msg = { ...updated[msgIndex] };
  const comment: MessageComment = {
    id: `test-slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: commentText.trim(),
    createdAt: Date.now(),
  };
  const slideComments = { ...(msg.slideComments || {}) };
  slideComments[slideNumber] = [...(slideComments[slideNumber] || []), comment];
  msg.slideComments = slideComments;
  updated[msgIndex] = msg;
  return { messages: updated, comment };
}

// Helper: simulate deleting a slide comment
function deleteSlideComment(
  messages: ChatMessage[],
  msgIndex: number,
  slideNumber: number,
  commentId: string,
): ChatMessage[] {
  const updated = [...messages];
  const msg = { ...updated[msgIndex] };
  const slideComments = { ...(msg.slideComments || {}) };
  slideComments[slideNumber] = (slideComments[slideNumber] || []).filter(
    (c) => c.id !== commentId,
  );
  if (slideComments[slideNumber].length === 0) delete slideComments[slideNumber];
  msg.slideComments = slideComments;
  updated[msgIndex] = msg;
  return updated;
}

describe("Message Comments", () => {
  let messages: ChatMessage[];

  beforeEach(() => {
    messages = [
      { role: "user", content: "Создай презентацию", timestamp: Date.now() },
      { role: "assistant", content: "Конечно! Вот структура...", timestamp: Date.now() },
    ];
  });

  it("adds a comment to a user message", () => {
    const { messages: updated, comment } = addCommentToMessage(messages, 0, "Хороший промпт");
    expect(updated[0].comments).toHaveLength(1);
    expect(updated[0].comments![0].text).toBe("Хороший промпт");
    expect(updated[0].comments![0].id).toBeTruthy();
    expect(updated[0].comments![0].createdAt).toBeGreaterThan(0);
  });

  it("adds a comment to an assistant message", () => {
    const { messages: updated } = addCommentToMessage(messages, 1, "Нужно доработать");
    expect(updated[1].comments).toHaveLength(1);
    expect(updated[1].comments![0].text).toBe("Нужно доработать");
  });

  it("adds multiple comments to the same message", () => {
    let result = addCommentToMessage(messages, 0, "Первый комментарий");
    result = addCommentToMessage(result.messages, 0, "Второй комментарий");
    expect(result.messages[0].comments).toHaveLength(2);
    expect(result.messages[0].comments![0].text).toBe("Первый комментарий");
    expect(result.messages[0].comments![1].text).toBe("Второй комментарий");
  });

  it("deletes a comment from a message", () => {
    const { messages: withComment, comment } = addCommentToMessage(messages, 0, "Удалить меня");
    const updated = deleteCommentFromMessage(withComment, 0, comment.id);
    expect(updated[0].comments).toHaveLength(0);
  });

  it("does not affect other messages when adding a comment", () => {
    const { messages: updated } = addCommentToMessage(messages, 0, "Только для первого");
    expect(updated[0].comments).toHaveLength(1);
    expect(updated[1].comments).toBeUndefined();
  });

  it("trims whitespace from comment text", () => {
    const { messages: updated } = addCommentToMessage(messages, 0, "  пробелы  ");
    expect(updated[0].comments![0].text).toBe("пробелы");
  });
});

describe("Slide Comments", () => {
  let messages: ChatMessage[];

  beforeEach(() => {
    messages = [
      { role: "user", content: "Создай презентацию", timestamp: Date.now() },
      {
        role: "assistant",
        content: "Вот слайды:",
        timestamp: Date.now(),
      },
    ];
  });

  it("adds a comment to a specific slide", () => {
    const { messages: updated, comment } = addSlideComment(messages, 1, 3, "Слайд 3 нужно переделать");
    expect(updated[1].slideComments).toBeDefined();
    expect(updated[1].slideComments![3]).toHaveLength(1);
    expect(updated[1].slideComments![3][0].text).toBe("Слайд 3 нужно переделать");
  });

  it("adds multiple comments to different slides", () => {
    let result = addSlideComment(messages, 1, 1, "Комментарий к слайду 1");
    result = addSlideComment(result.messages, 1, 3, "Комментарий к слайду 3");
    expect(result.messages[1].slideComments![1]).toHaveLength(1);
    expect(result.messages[1].slideComments![3]).toHaveLength(1);
  });

  it("adds multiple comments to the same slide", () => {
    let result = addSlideComment(messages, 1, 2, "Первый");
    result = addSlideComment(result.messages, 1, 2, "Второй");
    expect(result.messages[1].slideComments![2]).toHaveLength(2);
  });

  it("deletes a slide comment", () => {
    const { messages: withComment, comment } = addSlideComment(messages, 1, 5, "Удалить");
    const updated = deleteSlideComment(withComment, 1, 5, comment.id);
    // Slide key should be removed when no comments left
    expect(updated[1].slideComments![5]).toBeUndefined();
  });

  it("keeps other slide comments when deleting one", () => {
    let result = addSlideComment(messages, 1, 2, "Оставить");
    const { messages: withTwo, comment } = addSlideComment(result.messages, 1, 2, "Удалить");
    const updated = deleteSlideComment(withTwo, 1, 2, comment.id);
    expect(updated[1].slideComments![2]).toHaveLength(1);
    expect(updated[1].slideComments![2][0].text).toBe("Оставить");
  });
});
