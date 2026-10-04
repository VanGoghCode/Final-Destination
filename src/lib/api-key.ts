import {
  getConfiguredProvider,
  isAIProvider,
  PROVIDER_MODELS,
  PROVIDER_SETTINGS,
  type AIProvider,
  type AIProviderConfig,
} from "./ai-providers/types";

async function requestValue(
  header: string,
  cookie: string,
  request?: Request,
): Promise<string | undefined> {
  try {
    if (request) {
      const headerValue = request.headers.get(header);
      if (headerValue) return headerValue;
      const prefix = `${cookie}=`;
      const value = request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix))
        ?.slice(prefix.length);
      return value ? decodeURIComponent(value) : undefined;
    }
    const { headers, cookies } = await import("next/headers");
    return (await headers()).get(header) || (await cookies()).get(cookie)?.value || undefined;
  } catch {
    return undefined;
  }
}

export async function getApiKey(
  provider: AIProvider,
  request?: Request,
): Promise<string | undefined> {
  const settings = PROVIDER_SETTINGS[provider];
  return (
    process.env[settings.envKey] || requestValue(`x-${provider}-api-key`, settings.cookie, request)
  );
}

export const getDeepSeekApiKey = () => getApiKey("deepseek");

export async function getAISelection(request?: Request): Promise<AIProviderConfig> {
  const selected = await requestValue("x-ai-provider", "fd_ai_provider", request);
  const provider = isAIProvider(selected) ? selected : getConfiguredProvider();
  const modelId =
    provider === "openai"
      ? (await requestValue("x-ai-model", "fd_openai_model", request)) ||
        process.env.OPENAI_MODEL ||
        PROVIDER_MODELS.openai.default
      : PROVIDER_MODELS.deepseek.default;
  return { provider, modelId };
}
