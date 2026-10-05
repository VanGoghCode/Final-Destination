import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ModelSelector from "../ModelSelector";
import { AISettingsProvider, type AISettings } from "@/context/AISettingsContext";
import { fireEvent } from "@testing-library/react";
import { saveAISettings, removeAIKey } from "@/lib/client-ai";

const globalNames = [
  "window",
  "document",
  "localStorage",
  "HTMLElement",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;
let globals: Array<PropertyDescriptor | undefined>;
let root: Root;
beforeEach(() => {
  globals = globalNames.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const browser = new Window({ url: "http://localhost:3000" });
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    HTMLElement: browser.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  globalNames.forEach((name, i) => {
    if (globals[i]) Object.defineProperty(globalThis, name, globals[i]!);
    else Reflect.deleteProperty(globalThis, name);
  });
});
const defaults: AISettings = {
  provider: "deepseek",
  modelId: "deepseek-v4-flash",
  configured: { deepseek: false, openai: false },
};
const render = async (settings = defaults) => {
  await act(() =>
    root.render(
      <AISettingsProvider settings={settings}>
        <ModelSelector />
      </AISettingsProvider>,
    ),
  );
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
};
const click = async (label: string) => {
  const button = Array.from(document.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  expect(button).toBeDefined();
  await act(() => button!.click());
};

describe("AI model selector", () => {
  it("shows Luna by default in a new browser", async () => {
    await act(() => root.render(<ModelSelector />));
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
    expect(document.body.textContent).toContain("OpenAI Luna");
  });
  it("saves a pasted key and restores it after remount without revealing it", async () => {
    await render({ ...defaults, provider: "openai", modelId: "gpt-6-luna" });
    await click("OpenAI Luna");
    await act(() =>
      fireEvent.input(document.querySelector('[aria-label="API key"]')!, {
        target: { value: "test-luna-key" },
      }),
    );
    await click("Save");
    expect(localStorage.getItem("fd_openai_api_key")).toBe("test-luna-key");
    await act(() => root.render(null));
    await render();
    expect(document.body.textContent).toContain("Key configured");
    expect(document.body.textContent).not.toContain("test-luna-key");
  });
  it("refreshes settings when another tab saves or removes a key", async () => {
    await render();
    await act(() => saveAISettings("openai", "fixture"));
    expect(document.body.textContent).toContain("OpenAI Luna");
    expect(document.body.textContent).toContain("Key configured");
    await act(() => removeAIKey("openai"));
    expect(document.body.textContent).toContain("No API key");
    localStorage.setItem("fd_openai_api_key", "other-tab");
    await act(() => window.dispatchEvent(new window.Event("storage")));
    expect(document.body.textContent).toContain("Key configured");
  });
  it("shows a storage failure and keeps settings open instead of claiming the key was saved", async () => {
    await render();
    await click("DeepSeek V4 Flash");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw Error("Browser storage is full");
        },
      },
    });
    await click("Save");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Browser storage is full",
    );
  });
  it("shows the configured server provider without exposing its key", async () => {
    await render({
      provider: "openai",
      modelId: "gpt-6-luna",
      configured: { openai: true, deepseek: false },
    });
    expect(document.body.textContent).toContain("OpenAI Luna");
    expect(document.body.textContent).toContain("Server key configured");
    expect(localStorage.getItem("fd_openai_api_key")).toBeNull();
  });
  it("switches to Luna, saves without a browser key and persists the choice", async () => {
    await render();
    await click("DeepSeek V4 Flash");
    const select = document.querySelector("select")!;
    await act(() => {
      select.value = "openai";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    expect(document.querySelector<HTMLInputElement>('[aria-label="OpenAI model ID"]')?.value).toBe(
      "gpt-6-luna",
    );
    await click("Save");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem("fd_ai_provider")).toBe("openai");
    expect(document.body.textContent).toContain("OpenAI Luna");
  });
  it("canceling changes leaves the active provider unchanged", async () => {
    await render();
    await click("DeepSeek V4 Flash");
    const select = document.querySelector("select")!;
    await act(() => {
      select.value = "openai";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await click("Cancel");
    expect(document.body.textContent).toContain("DeepSeek V4 Flash");
    expect(localStorage.getItem("fd_ai_provider")).toBeNull();
  });
  it("shows only the AI key when switching providers", async () => {
    localStorage.setItem("fd_admin_key", "owner");
    await render();
    await click("DeepSeek V4 Flash");
    expect(document.querySelector('[aria-label="App access key"]')).toBeNull();
    expect(document.querySelector('[aria-label="API key"]')).not.toBeNull();
    await act(() => {
      const select = document.querySelector("select")!;
      select.value = "openai";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await click("Save");
    expect(localStorage.getItem("fd_admin_key")).toBe("owner");
  });
  it("removing a browser key retains the other provider's credential", async () => {
    localStorage.setItem("fd_deepseek_api_key", "one");
    localStorage.setItem("fd_openai_api_key", "two");
    await render();
    await click("DeepSeek V4 Flash");
    await click("Remove");
    expect(localStorage.getItem("fd_deepseek_api_key")).toBeNull();
    expect(localStorage.getItem("fd_openai_api_key")).toBe("two");
  });
});
