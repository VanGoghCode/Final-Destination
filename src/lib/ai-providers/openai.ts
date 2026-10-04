import { HTTPProvider, type HTTPConfig } from "./http";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_MODELS } from "./types";

export interface OpenAIConfig extends HTTPConfig {
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
}

export class OpenAIProvider extends HTTPProvider {
  protected provider = "openai" as const;
  protected endpoint = "https://api.openai.com/v1/responses";
  protected label = "OpenAI";
  constructor(protected config: OpenAIConfig = {}) {
    super(config);
  }
  getName() {
    return PROVIDER_DISPLAY_NAMES.openai;
  }
  static createFast(callTag?: string, modelId?: string) {
    return new OpenAIProvider({ reasoningEffort: "none", maxTokens: 8192, callTag, modelId });
  }
  protected buildBody(prompt: string, systemPrompt?: string) {
    return {
      model: this.config.modelId || process.env.OPENAI_MODEL || PROVIDER_MODELS.openai.default,
      input: prompt,
      ...(systemPrompt && { instructions: systemPrompt }),
      max_output_tokens: this.config.maxTokens ?? 65535,
      reasoning: { effort: this.config.reasoningEffort ?? "high" },
      store: false,
    };
  }
  protected readText(data: Record<string, unknown>): string {
    if (data?.status !== "completed" || !Array.isArray(data.output)) {
      throw new Error(
        "OpenAI returned an incomplete or malformed response. Try again or increase the output token budget.",
      );
    }
    const text = data.output
      .flatMap((item) =>
        item?.type === "message" && Array.isArray(item.content)
          ? item.content
              .filter(
                (part: { type: string; text?: unknown } | null) =>
                  part?.type === "output_text" && typeof part.text === "string",
              )
              .map((part: { text: string }) => part.text)
          : [],
      )
      .join("");
    if (!text.trim())
      throw new Error("OpenAI returned no text (the request may have been refused).");
    return text;
  }
}
