// AI Provider types and interfaces
// Gemini and Claude removed per migration (2026-06-01).

export type AIProvider = "deepseek";

export interface AIProviderConfig {
  provider: AIProvider;
  modelId?: string;
}

export interface AIProviderInterface {
  generateContent(prompt: string, systemPrompt?: string): Promise<string>;
  getName(): string;
}

export const PROVIDER_MODELS = {
  deepseek: {
    default: "deepseek-v4-flash",
  },
} as const;

export const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  deepseek: "DeepSeek V4 Flash",
};
