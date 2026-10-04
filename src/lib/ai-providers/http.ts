import { getApiKey } from "../api-key";
import { AsyncLocalStorage } from "node:async_hooks";
import { isValidInput } from "../sanitize";
import { PROVIDER_SETTINGS, type AIProvider, type AIProviderInterface } from "./types";

const budgets = new AsyncLocalStorage<{ deadline: number; signal?: AbortSignal }>();
export const withAIBudget = <T>(duration: number, task: () => Promise<T>, signal?: AbortSignal) =>
  budgets.run({ deadline: Date.now() + duration, signal }, task);

export interface HTTPConfig {
  _fetch?: typeof fetch;
  callTag?: string;
  timeoutMs?: number;
  totalBudgetMs?: number;
  retryDelayMs?: number;
  maxTokens?: number;
  modelId?: string;
}

class HTTPError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const retryable = (error: Error) =>
  error instanceof HTTPError
    ? error.status === 429 || error.status >= 500
    : /rate limit|temporarily unavailable|server error|503|429|timeout|connection|fetch failed|network/i.test(
        error.message,
      );

export abstract class HTTPProvider implements AIProviderInterface {
  protected abstract provider: AIProvider;
  protected abstract endpoint: string;
  protected abstract label: string;
  constructor(protected config: HTTPConfig) {}
  abstract getName(): string;
  protected abstract buildBody(prompt: string, systemPrompt?: string): object;
  protected abstract readText(data: Record<string, unknown>): string;

  async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!isValidInput(prompt)) throw new Error("Invalid input detected");
    const apiKey = await getApiKey(this.provider);
    if (!apiKey)
      throw new Error(
        `${this.label} API key not configured. Set ${PROVIDER_SETTINGS[this.provider].envKey} in environment or add your key in the app sidebar.`,
      );

    // Serialize large prompts once and reuse the body for retries.
    const body = JSON.stringify(this.buildBody(prompt, systemPrompt));
    const deadline = Math.min(
      Date.now() + (this.config.totalBudgetMs ?? 290_000),
      budgets.getStore()?.deadline ?? Infinity,
    );
    let lastError = new Error(`${this.label} API timeout: request budget exhausted`);
    for (let attempt = 0; attempt <= 3; attempt++) {
      budgets.getStore()?.signal?.throwIfAborted();
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const timeoutMs = Math.min(this.config.timeoutMs ?? 290_000, remaining);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await (this.config._fetch ?? globalThis.fetch)(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
          signal: budgets.getStore()?.signal
            ? AbortSignal.any([controller.signal, budgets.getStore()!.signal!])
            : controller.signal,
        });
        if (!response.ok)
          throw new HTTPError(
            `${this.label} API error (${response.status}): ${await response.text()}`,
            response.status,
          );
        return this.readText(await response.json());
      } catch (error) {
        budgets.getStore()?.signal?.throwIfAborted();
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError.name === "TimeoutError") {
          lastError = new Error(`${this.label} API timeout after ${timeoutMs}ms`);
        }
      } finally {
        clearTimeout(timer);
      }
      console.error(`[${this.label}] Error (attempt ${attempt + 1}/4):`, lastError);
      const retryRemaining = deadline - Date.now();
      if (!retryable(lastError) || attempt === 3 || retryRemaining < 2_000) break;
      const delay = Math.min(
        (this.config.retryDelayMs ?? 1000) * 2 ** attempt,
        retryRemaining - 2_000,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw lastError;
  }
}
