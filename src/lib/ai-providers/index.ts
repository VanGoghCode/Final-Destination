// AI Provider Factory — DeepSeek V4 Flash
// Gemini and Claude removed per migration (2026-06-01).

import type { AIProvider, AIProviderInterface } from "./types";
import { DeepSeekProvider } from "./deepseek";

export * from "./types";
export { DeepSeekProvider } from "./deepseek";

export function getAIProvider(_provider?: AIProvider): AIProviderInterface {
  return new DeepSeekProvider();
}

export function getDefaultProvider(): AIProvider {
  return "deepseek";
}

export async function generateContentWithProvider(
  prompt: string,
  _provider?: AIProvider,
): Promise<string> {
  return getAIProvider().generateContent(prompt);
}
