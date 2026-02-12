import { ENV } from "./env";
import { withRetry } from "./retry";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveForgeApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

function buildPayload(params: InvokeParams, model: string): Record<string, unknown> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // OpenAI models have different max_tokens limits
  if (model === OPENAI_MODEL) {
    payload.max_tokens = 16384;
  } else {
    payload.max_tokens = 32768;
    payload.thinking = {
      "budget_tokens": 128
    };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
}

/** Timeout for individual LLM API calls (120 seconds) */
const LLM_CALL_TIMEOUT_MS = 120_000;

/** Max retries for LLM calls */
const LLM_MAX_RETRIES = 2;

/**
 * Determine if an LLM error is retryable.
 * Timeouts, network errors, 429, and 5xx are retryable.
 * 4xx client errors (except 429) are NOT retryable.
 */
function isRetryableLLMError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message;

  // Timeout → retryable
  if (msg.includes("timed out")) return true;

  // Network errors → retryable
  if (msg.includes("ECONNRESET") || msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) return true;

  // Rate limit (429) → retryable
  if (msg.includes("429")) return true;

  // Usage exhausted → NOT retryable
  if (msg.includes("usage exhausted")) return false;

  // 4xx client errors → NOT retryable
  const statusMatch = msg.match(/(\d{3})\s/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    if (status >= 400 && status < 500) return false;
  }

  // Everything else (5xx, unknown) → retryable
  return true;
}

async function callApi(url: string, apiKey: string, payload: Record<string, unknown>): Promise<InvokeResult> {
  return withRetry(
    () => callApiOnce(url, apiKey, payload),
    {
      maxRetries: LLM_MAX_RETRIES,
      initialDelayMs: 2_000,
      maxDelayMs: 15_000,
      label: "LLM callApi",
      isRetryable: isRetryableLLMError,
    },
  );
}

/** Single attempt at calling the LLM API (no retry). */
async function callApiOnce(url: string, apiKey: string, payload: Record<string, unknown>): Promise<InvokeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
      );
    }

    return (await response.json()) as InvokeResult;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`LLM API call timed out after ${LLM_CALL_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // Try built-in Manus Forge API first
  if (ENV.forgeApiKey) {
    try {
      const forgePayload = buildPayload(params, "gemini-2.5-flash");
      const result = await callApi(resolveForgeApiUrl(), ENV.forgeApiKey, forgePayload);
      return result;
    } catch (forgeError: unknown) {
      const errorMsg = forgeError instanceof Error ? forgeError.message : String(forgeError);
      console.log(`[LLM] Forge API failed: ${errorMsg}`);

      // If OpenAI key is available, fall back to it
      if (ENV.openaiApiKey) {
        console.log("[LLM] Falling back to OpenAI API...");
      } else {
        // No fallback available, re-throw original error
        throw forgeError;
      }
    }
  }

  // Fallback to OpenAI API
  if (ENV.openaiApiKey) {
    const openaiPayload = buildPayload(params, OPENAI_MODEL);
    const result = await callApi(OPENAI_API_URL, ENV.openaiApiKey, openaiPayload);
    return result;
  }

  throw new Error("No LLM API key configured. Set BUILT_IN_FORGE_API_KEY or OPENAI_API_KEY.");
}
