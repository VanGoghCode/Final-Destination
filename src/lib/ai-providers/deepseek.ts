import { HTTPProvider, type HTTPConfig } from "./http";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_MODELS } from "./types";

export interface DeepSeekConfig extends HTTPConfig {
  temperature?: number;
  thinking?: { type: "enabled" | "disabled"; reasoning_effort?: "high" | "max" };
  responseFormat?: { type: "text" | "json_object" };
}

export class DeepSeekProvider extends HTTPProvider {
  protected provider = "deepseek" as const;
  protected endpoint = "https://api.deepseek.com/chat/completions";
  protected label = "DeepSeek";
  constructor(
    protected config: DeepSeekConfig = {
      temperature: 0.7,
      maxTokens: 65535,
      thinking: { type: "enabled", reasoning_effort: "high" },
    },
  ) {
    super(config);
  }

  getName() {
    return PROVIDER_DISPLAY_NAMES.deepseek;
  }
  static createFast(callTag?: string) {
    return new DeepSeekProvider({
      temperature: 0.1,
      maxTokens: 8192,
      thinking: { type: "disabled" },
      callTag,
    });
  }

  protected buildBody(prompt: string, systemPrompt?: string) {
    return {
      model: PROVIDER_MODELS.deepseek.default,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 16384,
      stream: false,
      ...(this.config.thinking && { thinking: this.config.thinking }),
      ...(this.config.responseFormat && { response_format: this.config.responseFormat }),
    };
  }

  protected readText(data: Record<string, unknown>): string {
    const usage = data.usage as Record<string, number> | undefined;
    if (usage) {
      const hit = usage.prompt_cache_hit_tokens ?? 0,
        miss = usage.prompt_cache_miss_tokens ?? 0,
        total = usage.prompt_tokens ?? 0;
      const rate = total > 0 ? ((hit / total) * 100).toFixed(0) : "0";
      console.info(
        `[DeepSeek Cache] tag=${this.config.callTag || "unknown"} hit=${hit} miss=${miss} prompt_total=${total} cache_rate=${rate}% ${hit > 0 ? "REUSED" : "COLD"}`,
      );
    }
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content || "";
  }
}
