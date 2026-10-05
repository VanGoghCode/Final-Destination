import {
  isAIProvider,
  PROVIDER_MODELS,
  PROVIDER_SETTINGS,
  type AIProvider,
} from "./ai-providers/types";

export function setAICookie(name: string, value: string, remove = false) {
  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${remove ? 0 : 31536000};SameSite=Lax${secure}${remove ? ";expires=Thu, 01 Jan 1970 00:00:00 GMT" : ""}`;
}

export function saveAISettings(
  provider: AIProvider,
  key: string,
  modelId = PROVIDER_MODELS[provider].default as string,
) {
  const settings = PROVIDER_SETTINGS[provider];
  localStorage.setItem("fd_ai_provider", provider);
  setAICookie("fd_ai_provider", provider);
  if (key.trim()) {
    localStorage.setItem(settings.storageKey, key.trim());
    setAICookie(settings.cookie, key.trim());
  }
  if (provider === "openai") {
    localStorage.setItem("fd_openai_model", modelId.trim() || PROVIDER_MODELS.openai.default);
    setAICookie("fd_openai_model", localStorage.getItem("fd_openai_model")!);
  }
  window.dispatchEvent(new window.Event("fd-ai-settings"));
}

export function removeAIKey(provider: AIProvider) {
  const settings = PROVIDER_SETTINGS[provider];
  localStorage.removeItem(settings.storageKey);
  setAICookie(settings.cookie, "", true);
}

export function getAIHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const selected = localStorage.getItem("fd_ai_provider");
  const provider = isAIProvider(selected) ? selected : "openai";
  const headers: Record<string, string> = { "x-ai-provider": provider };
  if (provider === "openai")
    headers["x-ai-model"] =
      localStorage.getItem("fd_openai_model") || PROVIDER_MODELS.openai.default;
  const key = localStorage.getItem(PROVIDER_SETTINGS[provider].storageKey);
  if (key) headers[`x-${provider}-api-key`] = key;
  return headers;
}
