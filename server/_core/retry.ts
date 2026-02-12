/**
 * Generic retry utility with exponential backoff.
 *
 * Usage:
 *   const result = await withRetry(() => fetchSomething(), { maxRetries: 2, label: "fetchSomething" });
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2). Total calls = 1 + maxRetries. */
  maxRetries?: number;
  /** Initial delay in ms before the first retry (default: 1000). Doubles each retry. */
  initialDelayMs?: number;
  /** Maximum delay cap in ms (default: 10000). */
  maxDelayMs?: number;
  /** Label for log messages (default: "operation"). */
  label?: string;
  /** Optional predicate: return true if the error is retryable. Defaults to always true. */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2,
  initialDelayMs: 1_000,
  maxDelayMs: 10_000,
  label: "operation",
  isRetryable: () => true,
};

/**
 * Execute `fn` with automatic retries on failure.
 * Uses exponential backoff with jitter between retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    label,
    isRetryable,
  } = { ...DEFAULT_OPTIONS, ...opts };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt >= maxRetries;
      const retryable = isRetryable(err);

      if (isLast || !retryable) {
        // No more retries or error is not retryable
        if (!isLast && !retryable) {
          console.warn(
            `[Retry] ${label}: non-retryable error on attempt ${attempt + 1}/${maxRetries + 1}: ${errMsg(err)}`,
          );
        }
        break;
      }

      // Calculate delay with jitter
      const baseDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * baseDelay; // up to 30% jitter
      const delay = Math.min(baseDelay + jitter, maxDelayMs);

      console.warn(
        `[Retry] ${label}: attempt ${attempt + 1}/${maxRetries + 1} failed: ${errMsg(err)}. Retrying in ${Math.round(delay)}ms...`,
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
