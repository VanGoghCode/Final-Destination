import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { getAIHeaders, saveAISettings, removeAIKey } from "./client-ai";

const globalNames = ["window", "document", "localStorage"] as const;
let globals: Array<PropertyDescriptor | undefined>;
beforeEach(() => {
  globals = globalNames.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const browser = new Window({ url: "http://localhost:3000" });
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
  });
});
afterEach(() =>
  globalNames.forEach((name, i) => {
    if (globals[i]) Object.defineProperty(globalThis, name, globals[i]!);
    else Reflect.deleteProperty(globalThis, name);
  }),
);

describe("browser AI settings", () => {
  it("saves separate credentials and model selection and forwards only the selected key", () => {
    saveAISettings("deepseek", "deepseek-key");
    saveAISettings("openai", "openai-key", "gpt-6-luna");
    expect(localStorage.getItem("fd_deepseek_api_key")).toBe("deepseek-key");
    expect(getAIHeaders()).toEqual({
      "x-ai-provider": "openai",
      "x-ai-model": "gpt-6-luna",
      "x-openai-api-key": "openai-key",
    });
    expect(document.cookie).toContain("fd_ai_provider=openai");
    expect(document.cookie).toContain("fd_openai_api_key=openai-key");
  });
  it("allows selecting a provider without a browser key for environment-based credentials", () => {
    saveAISettings("openai", "", "custom-model");
    expect(getAIHeaders()).toEqual({ "x-ai-provider": "openai", "x-ai-model": "custom-model" });
  });
  it("removes only the selected provider's key and cookie", () => {
    saveAISettings("deepseek", "one");
    saveAISettings("openai", "two");
    removeAIKey("openai");
    expect(localStorage.getItem("fd_openai_api_key")).toBeNull();
    expect(localStorage.getItem("fd_deepseek_api_key")).toBe("one");
    expect(document.cookie).not.toContain("fd_openai_api_key=");
  });
  it("defaults to Luna without forwarding a different provider's key", () => {
    localStorage.setItem("fd_deepseek_api_key", "legacy");
    expect(getAIHeaders()).toEqual({ "x-ai-provider": "openai", "x-ai-model": "gpt-6-luna" });
  });
  it("uses Secure cookies on HTTPS", () => {
    const browser = new Window({ url: "https://example.com" });
    Object.assign(globalThis, {
      window: browser,
      document: browser.document,
      localStorage: browser.localStorage,
    });
    saveAISettings("openai", "key+value");
    expect(document.cookie).toContain("fd_openai_api_key=key%2Bvalue");
  });
});
