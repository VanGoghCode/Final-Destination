// AI Provider types and interfaces

export type AIProvider = "gemini" | "claude";

export interface AIProviderConfig {
  provider: AIProvider;
  modelId?: string;
}

export interface AIProviderInterface {
  generateContent(prompt: string): Promise<string>;
  getName(): string;
}

// Model configurations
export const PROVIDER_MODELS = {
  gemini: {
    default: "gemini-3-pro-preview",
    grounded: "gemini-3-pro-preview",
  },
  claude: {
    default: "anthropic.claude-opus-4-5-20251101-v1:0",
  },
} as const;

export const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  gemini: "Gemini 3 Pro",
  claude: "Claude Opus 4.5",
};
