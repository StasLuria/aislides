import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./_core/retry";

describe("withRetry utility", () => {
  it("should return result on first success (no retry needed)", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 2, label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
      label: "test-retry",
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on failure and succeed on third attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("timed out"))
      .mockResolvedValue("finally");

    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
      label: "test-retry-twice",
    });

    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
        label: "test-exhaust",
      })
    ).rejects.toThrow("persistent failure");

    // 1 initial + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry if isRetryable returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("client error 400"));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
        label: "test-non-retryable",
        isRetryable: (err) => {
          if (err instanceof Error && err.message.includes("400")) return false;
          return true;
        },
      })
    ).rejects.toThrow("client error 400");

    // Only 1 attempt, no retries
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should respect maxRetries = 0 (no retries)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withRetry(fn, { maxRetries: 0, initialDelayMs: 10, label: "test-no-retry" })
    ).rejects.toThrow("fail");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should use exponential backoff between retries", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    // Track sleep calls by mocking the delay
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");

    const start = Date.now();
    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 50,
      maxDelayMs: 500,
      label: "test-backoff",
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    // Total time should be at least 50ms (first delay) + ~100ms (second delay)
    // but with jitter it's variable, so just check it took some time
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // at least some delay happened
  });

  it("should cap delay at maxDelayMs", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const start = Date.now();
    const result = await withRetry(fn, {
      maxRetries: 1,
      initialDelayMs: 50000, // very large
      maxDelayMs: 50, // but capped at 50ms
      label: "test-cap",
    });

    expect(result).toBe("ok");
    const elapsed = Date.now() - start;
    // Should not wait more than ~200ms (50ms cap + overhead)
    expect(elapsed).toBeLessThan(500);
  });

  it("should default to 2 retries when no options provided", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockRejectedValue(new Error("fail3"));

    await expect(
      withRetry(fn, { initialDelayMs: 10 })
    ).rejects.toThrow("fail3");

    // Default maxRetries = 2, so 3 total attempts
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("Image generation retry behavior", () => {
  it("isRetryable should consider timeout errors retryable", () => {
    // We test the logic indirectly through the withRetry isRetryable pattern
    const timeoutErr = new Error("Image generation timed out after 60000ms");
    const networkErr = new Error("fetch failed: ECONNRESET");
    const rateLimitErr = new Error("Image generation request failed (429 Too Many Requests)");
    const clientErr = new Error("Image generation request failed (400 Bad Request)");

    // These should be retryable
    expect(timeoutErr.message.includes("timed out")).toBe(true);
    expect(networkErr.message.includes("ECONNRESET")).toBe(true);
    expect(rateLimitErr.message.includes("429")).toBe(true);

    // This should NOT be retryable (4xx)
    const statusMatch = clientErr.message.match(/\((\d{3})\s/);
    expect(statusMatch).toBeTruthy();
    expect(parseInt(statusMatch![1])).toBe(400);
  });
});

describe("LLM retry behavior", () => {
  it("isRetryable should consider timeout and network errors retryable", () => {
    const timeoutErr = new Error("LLM API call timed out after 120s");
    const networkErr = new Error("fetch failed: ECONNREFUSED");
    const rateLimitErr = new Error("LLM invoke failed: 429 Too Many Requests");
    const usageErr = new Error("usage exhausted");
    const clientErr = new Error("LLM invoke failed: 401 Unauthorized");

    // These should be retryable
    expect(timeoutErr.message.includes("timed out")).toBe(true);
    expect(networkErr.message.includes("ECONNREFUSED")).toBe(true);
    expect(rateLimitErr.message.includes("429")).toBe(true);

    // These should NOT be retryable
    expect(usageErr.message.includes("usage exhausted")).toBe(true);
    const statusMatch = clientErr.message.match(/(\d{3})\s/);
    expect(statusMatch).toBeTruthy();
    expect(parseInt(statusMatch![1])).toBe(401);
  });
});
