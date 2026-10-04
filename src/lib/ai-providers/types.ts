export type AIProvider = "deepseek" | "openai";

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
  openai: { default: "gpt-6-luna" },
} as const;

export const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  deepseek: "DeepSeek V4 Flash",
  openai: "OpenAI Luna",
};

export const PROVIDER_SETTINGS = {
  deepseek: {
    envKey: "DEEPSEEK_API_KEY",
    storageKey: "fd_deepseek_api_key",
    cookie: "fd_api_key",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    storageKey: "fd_openai_api_key",
    cookie: "fd_openai_api_key",
    keyUrl: "https://platform.openai.com/api-keys",
  },
} as const;

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "deepseek" || value === "openai";
}

export function getConfiguredProvider(): AIProvider {
  if (isAIProvider(process.env.AI_PROVIDER)) return process.env.AI_PROVIDER;
  return process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY ? "openai" : "deepseek";
}
