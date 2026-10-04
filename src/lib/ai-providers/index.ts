import { getConfiguredProvider, type AIProvider, type AIProviderInterface } from "./types";
import { DeepSeekProvider } from "./deepseek";
import { OpenAIProvider } from "./openai";
import { getAISelection } from "../api-key";

export * from "./types";
export { DeepSeekProvider, OpenAIProvider };
export const getDefaultProvider = getConfiguredProvider;

export function getAIProvider(
  provider = getDefaultProvider(),
  options: { fast?: boolean; callTag?: string; modelId?: string } = {},
): AIProviderInterface {
  const { fast, callTag, modelId } = options;
  if (provider === "openai")
    return fast
      ? OpenAIProvider.createFast(callTag, modelId)
      : new OpenAIProvider({ callTag, modelId });
  if (fast) return DeepSeekProvider.createFast(callTag);
  return new DeepSeekProvider({
    temperature: 0.7,
    maxTokens: 65535,
    thinking: { type: "enabled", reasoning_effort: "high" },
    callTag,
  });
}

export async function getSelectedAIProvider(
  callTag?: string,
  fast = false,
): Promise<AIProviderInterface> {
  const { provider, modelId } = await getAISelection();
  return getAIProvider(provider, { modelId, callTag, fast });
}

export async function generateContentWithProvider(
  prompt: string,
  provider?: AIProvider,
): Promise<string> {
  return (provider ? getAIProvider(provider) : await getSelectedAIProvider()).generateContent(
    prompt,
  );
}
