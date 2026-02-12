/**
 * Image generation helper using internal ImageService.
 * Includes per-request timeout (60s) and automatic retry (up to 2 retries).
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";
import { withRetry } from "./retry";

/** Default timeout for image generation requests (60 seconds) */
const IMAGE_GENERATION_TIMEOUT_MS = 60_000;

/** Default max retries for image generation */
const IMAGE_GENERATION_MAX_RETRIES = 2;

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** Timeout in milliseconds. Defaults to 60000 (60s). */
  timeoutMs?: number;
  /** Max retries on failure. Defaults to 2. Set to 0 to disable retry. */
  maxRetries?: number;
};

export type GenerateImageResponse = {
  url?: string;
};

/**
 * Determine if an image generation error is retryable.
 * Timeouts, network errors, and 5xx are retryable.
 * 4xx client errors (except 429 rate limit) are NOT retryable.
 */
function isRetryableImageError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message;

  // Timeout → retryable
  if (msg.includes("timed out")) return true;

  // Network errors → retryable
  if (msg.includes("ECONNRESET") || msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) return true;

  // Rate limit (429) → retryable
  if (msg.includes("429")) return true;

  // 4xx client errors → NOT retryable (except 429 above)
  const statusMatch = msg.match(/\((\d{3})\s/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    if (status >= 400 && status < 500) return false;
  }

  // Everything else (5xx, unknown) → retryable
  return true;
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const maxRetries = options.maxRetries ?? IMAGE_GENERATION_MAX_RETRIES;

  return withRetry(
    () => generateImageOnce(options),
    {
      maxRetries,
      initialDelayMs: 2_000,
      maxDelayMs: 10_000,
      label: `generateImage("${options.prompt.substring(0, 50)}...")`,
      isRetryable: isRetryableImageError,
    },
  );
}

/** Single attempt at image generation (no retry). */
async function generateImageOnce(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  // Use AbortController for timeout
  const timeoutMs = options.timeoutMs ?? IMAGE_GENERATION_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        prompt: options.prompt,
        original_images: options.originalImages || [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
    }

    const result = (await response.json()) as {
      image: {
        b64Json: string;
        mimeType: string;
      };
    };
    const base64Data = result.image.b64Json;
    const buffer = Buffer.from(base64Data, "base64");

    // Save to S3
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      result.image.mimeType
    );
    return {
      url,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Image generation timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
