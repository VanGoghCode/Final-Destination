// AI Provider Factory - Unified provider selection
import { AIProvider, AIProviderInterface } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { BedrockClaudeProvider } from "./bedrock";

export * from "./types";
export { GeminiProvider } from "./gemini-provider";
export { BedrockClaudeProvider } from "./bedrock";

/**
 * Get the appropriate AI provider based on selection
 */
export function getAIProvider(provider: AIProvider): AIProviderInterface {
  switch (provider) {
    case "claude":
      return new BedrockClaudeProvider();
    case "gemini":
    default:
      return new GeminiProvider();
  }
}

/**
 * Get the default AI provider from environment or fallback to gemini
 */
export function getDefaultProvider(): AIProvider {
  const defaultProvider = process.env.DEFAULT_AI_PROVIDER as AIProvider;
  return defaultProvider === "claude" ? "claude" : "gemini";
}

/**
 * Generate content using the specified provider
 */
export async function generateContentWithProvider(
  prompt: string,
  provider: AIProvider = getDefaultProvider(),
): Promise<string> {
  const aiProvider = getAIProvider(provider);
  return aiProvider.generateContent(prompt);
}
