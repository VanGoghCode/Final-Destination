// DeepSeek V4 Flash Provider — OpenAI-compatible API
import { AIProviderInterface } from "./types";
import { isValidInput } from "../sanitize";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL_NAME = "deepseek-v4-flash";

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Total time budget per generateContent call (ms).
// On Vercel the platform kills functions at maxDuration (60s in vercel.json)
// with a plain-text error body, so all attempts + backoff MUST fit inside that
// window for the route to answer with JSON. Locally there is no such cap, so a
// generous budget lets even a slow DeepSeek response complete.
const IS_VERCEL = process.env.VERCEL === "1";
const DEFAULT_TOTAL_BUDGET_MS = IS_VERCEL ? 50_000 : 120_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = IS_VERCEL ? 50_000 : 120_000;
// Don't start another attempt if less than this remains — it could not finish
// anyway and would only burn the deadline.
const MIN_RETRY_GRACE_MS = 2_000;

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
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";

  return RETRYABLE_ERRORS.some(
    (pattern) =>
      errorString.includes(pattern.toLowerCase()) || errorMessage.includes(pattern.toLowerCase()),
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
  /** Tag for cache hit/miss logging. */
  callTag?: string;
  /** Per-attempt timeout. Defaults to DEFAULT_ATTEMPT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Total budget across all attempts + backoff. Defaults to DEFAULT_TOTAL_BUDGET_MS. */
  totalBudgetMs?: number;
}

const DEFAULT_CONFIG: DeepSeekConfig = {
  temperature: 0.7,
  // 65k tokens let a single generation run for minutes — past Vercel's function
  // deadline. A tailored resume never needs more than ~2-4k output tokens;
  // 16k caps worst-case latency while leaving headroom for reasoning.
  maxTokens: 16384,
  // Thinking is DISABLED for standard generation. Measured against the live
  // API: thinking=high takes 8-12s (and spikes past 50s under load — blowing
  // the batch timeout), while thinking=disabled completes in 2-4s with zero
  // reasoning tokens. Resume/cover-letter tailoring is structured rewriting,
  // not deep reasoning, so the speed and reliability win outweighs the loss.
  // Flip to enabled here (or in a per-call config) to restore reasoning.
  thinking: { type: "disabled" },
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
  static createFast(callTag?: string): DeepSeekProvider {
    return new DeepSeekProvider({ ...FAST_CONFIG, callTag });
  }

  async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!isValidInput(prompt)) {
      throw new Error("Invalid input detected");
    }

    const { getDeepSeekApiKey } = await import("@/lib/api-key");
    const apiKey = await getDeepSeekApiKey();
    if (!apiKey) {
      throw new Error(
        "DeepSeek API key not configured. Set DEEPSEEK_API_KEY in environment or add your key in the app sidebar.",
      );
    }

    let lastError: Error | null = null;

    const attemptTimeoutMs = this.config.timeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
    const deadline = Date.now() + (this.config.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // No budget left at all — the route would be killed by Vercel before it
      // can answer, so stop. (The grace window that gates retries lives in the
      // catch below; the first attempt always runs.)
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        break;
      }
      const timeoutMs = Math.min(attemptTimeoutMs, remaining);

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
          max_tokens: this.config.maxTokens ?? 16384,
          stream: false,
        };

        if (this.config.thinking) {
          body.thinking = this.config.thinking;
        }

        if (this.config.responseFormat) {
          body.response_format = this.config.responseFormat;
        }

        // Abort hung generations instead of waiting until Vercel kills the
        // whole function with a non-JSON error body. Manual controller rather
        // than AbortSignal.timeout — equivalent in production, and reliable
        // under the test runner.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await this._fetchFn(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`DeepSeek API error (${response.status}): ${errorBody}`);
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";

          // Log KV cache metrics (DeepSeek disk cache — always active, no opt-in needed)
          if (data.usage) {
            const hit = data.usage.prompt_cache_hit_tokens ?? 0;
            const miss = data.usage.prompt_cache_miss_tokens ?? 0;
            const totalPrompt = data.usage.prompt_tokens ?? 0;
            const cacheRate = totalPrompt > 0 ? ((hit / totalPrompt) * 100).toFixed(0) : "0";
            const tag = this.config.callTag || "unknown";
            console.info(
              `[DeepSeek Cache] tag=${tag} hit=${hit} miss=${miss} prompt_total=${totalPrompt} ` +
                `cache_rate=${cacheRate}% ` +
                (hit > 0 ? "REUSED" : "COLD"),
            );
          }

          return text;
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Wrap abort timeouts so the message is clear and matches the
        // "timeout" retry classification (retryable when budget remains).
        // AbortError covers runtimes that report the default abort reason.
        const name =
          typeof error === "object" && error !== null ? (error as { name?: string }).name : "";
        const isTimeout = name === "TimeoutError" || name === "AbortError";
        if (isTimeout) {
          lastError = new Error(`DeepSeek API timeout after ${timeoutMs}ms`);
        }

        console.error(`[DeepSeek] Error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, lastError);

        if (isRetryableError(lastError) && attempt < MAX_RETRIES) {
          // Backoff but never beyond the deadline — leave the route time to
          // return a JSON error before Vercel's hard cap.
          const remainingAfterError = deadline - Date.now();
          if (remainingAfterError < MIN_RETRY_GRACE_MS) {
            break;
          }
          const delay = Math.min(
            BASE_DELAY_MS * Math.pow(2, attempt),
            remainingAfterError - MIN_RETRY_GRACE_MS,
          );
          await sleep(Math.max(0, delay));
          continue;
        }

        break;
      }
    }

    throw lastError || new Error("Failed to generate content after retries");
  }
}
