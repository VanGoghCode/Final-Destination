// DeepSeek V4 Flash Provider — OpenAI-compatible API
import { AIProviderInterface } from "./types";
import { isValidInput } from "../sanitize";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL_NAME = "deepseek-v4-flash";

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const RETRYABLE_ERRORS = [
  "rate limit",
  "temporarily unavailable",
  "server error",
  "internal server error",
  "503",
  "429",
  "timeout",
  "connection",
];

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : "";

  return RETRYABLE_ERRORS.some(
    (pattern) =>
      errorString.includes(pattern.toLowerCase()) ||
      errorMessage.includes(pattern.toLowerCase()),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DeepSeekConfig {
  temperature?: number;
  maxTokens?: number;
  thinking?: { type: "enabled" | "disabled"; reasoning_effort?: "high" | "max" };
  responseFormat?: { type: "text" | "json_object" };
  /** Inject custom fetch for testing. Defaults to globalThis.fetch. */
  _fetch?: typeof fetch;
}

const DEFAULT_CONFIG: DeepSeekConfig = {
  temperature: 0.7,
  maxTokens: 65535,
  thinking: { type: "enabled", reasoning_effort: "high" },
};

const FAST_CONFIG: DeepSeekConfig = {
  temperature: 0.1,
  maxTokens: 8192,
  thinking: { type: "disabled" },
};

export class DeepSeekProvider implements AIProviderInterface {
  private config: DeepSeekConfig;
  private _fetchFn: typeof fetch;

  constructor(config?: DeepSeekConfig) {
    this.config = config || DEFAULT_CONFIG;
    this._fetchFn = this.config._fetch || (globalThis as typeof globalThis).fetch;
  }

  getName(): string {
    return "DeepSeek V4 Flash";
  }

  /** Create a fast instance (no thinking, low temp) for extraction tasks */
  static createFast(): DeepSeekProvider {
    return new DeepSeekProvider(FAST_CONFIG);
  }

  async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!isValidInput(prompt)) {
      throw new Error("Invalid input detected");
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY environment variable is required");
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const body: Record<string, unknown> = {
          model: MODEL_NAME,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 65535,
          stream: false,
        };

        if (this.config.thinking) {
          body.thinking = this.config.thinking;
        }

        if (this.config.responseFormat) {
          body.response_format = this.config.responseFormat;
        }

        const response = await this._fetchFn(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `DeepSeek API error (${response.status}): ${errorBody}`,
          );
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";

        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[DeepSeek] Error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
          error,
        );

        if (isRetryableError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        break;
      }
    }

    throw lastError || new Error("Failed to generate content after retries");
  }
}
