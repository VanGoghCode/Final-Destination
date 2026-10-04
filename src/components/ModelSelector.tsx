"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAISettings } from "@/context/AISettingsContext";
import {
  isAIProvider,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_MODELS,
  PROVIDER_SETTINGS,
  type AIProvider,
} from "@/lib/ai-providers/types";
import { removeAIKey, saveAISettings, setAICookie } from "@/lib/client-ai";
import { getAdminKey, setAdminKey } from "@/lib/client-admin";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-500";
const buttonClass = "rounded-lg border px-3.5 py-1.5 text-xs font-semibold";

export default function ModelSelector() {
  const defaults = useAISettings();
  const [provider, setProvider] = useState(defaults.provider);
  const [draftProvider, setDraftProvider] = useState(defaults.provider);
  const [model, setModel] = useState(defaults.modelId);
  const [hasKey, setHasKey] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [accessKey, setAccessKey] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      const selected = localStorage.getItem("fd_ai_provider");
      const current = isAIProvider(selected) ? selected : defaults.provider;
      setProvider(current);
      setHasKey(!!localStorage.getItem(PROVIDER_SETTINGS[current].storageKey));
      // Restore cookies cleared since the last visit without overwriting server defaults.
      for (const name of ["deepseek", "openai"] as const) {
        const key = localStorage.getItem(PROVIDER_SETTINGS[name].storageKey);
        if (key) setAICookie(PROVIDER_SETTINGS[name].cookie, key);
      }
      if (isAIProvider(selected)) {
        setAICookie("fd_ai_provider", selected);
        const storedModel = localStorage.getItem("fd_openai_model");
        if (storedModel) setAICookie("fd_openai_model", storedModel);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [defaults.provider]);

  const selectDraft = (next: AIProvider) => {
    setDraftProvider(next);
    setInputKey(localStorage.getItem(PROVIDER_SETTINGS[next].storageKey) || "");
    setModel(
      next === "openai"
        ? localStorage.getItem("fd_openai_model") ||
            (defaults.provider === "openai" ? defaults.modelId : PROVIDER_MODELS.openai.default)
        : PROVIDER_MODELS.deepseek.default,
    );
  };
  const save = () => {
    setAdminKey(accessKey);
    saveAISettings(draftProvider, inputKey, model);
    setProvider(draftProvider);
    setHasKey(!!localStorage.getItem(PROVIDER_SETTINGS[draftProvider].storageKey));
    setInputKey("");
    setShowModal(false);
  };
  const configured = hasKey || defaults.configured[provider];
  const draftHasKey =
    showModal && !!localStorage.getItem(PROVIDER_SETTINGS[draftProvider].storageKey);

  return (
    <>
      <div className="flex w-full flex-col gap-1.5">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            AI Model
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${configured ? "bg-green-500" : "bg-red-500"}`}
          />
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 hover:bg-gray-100"
          onClick={() => {
            setAccessKey(getAdminKey() || "");
            selectDraft(provider);
            setShowModal(true);
          }}
          title="Configure AI provider and API key"
        >
          <span className="text-xs font-semibold text-gray-700">
            {PROVIDER_DISPLAY_NAMES[provider]}
          </span>
          <span
            className={`text-[10px] font-medium ${configured ? "text-green-600" : "text-red-600"}`}
          >
            {hasKey ? "Key configured" : configured ? "Server key configured" : "No API key"}
          </span>
        </button>
      </div>
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-settings-title"
              className="w-[400px] max-w-[90vw] rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="ai-settings-title" className="mb-2 text-base font-bold text-gray-900">
                AI Provider &amp; API Key
              </h3>
              <label className="mb-3 block text-xs text-gray-600">
                App access key
                <input
                  aria-label="App access key"
                  type="password"
                  className={`${inputClass} mt-1`}
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="ADMIN_API_KEY from your server"
                />
              </label>
              <label className="mb-3 block text-xs text-gray-600">
                Provider
                <select
                  aria-label="AI provider"
                  className={`${inputClass} mt-1`}
                  value={draftProvider}
                  onChange={(event) => selectDraft(event.target.value as AIProvider)}
                >
                  {Object.entries(PROVIDER_DISPLAY_NAMES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {draftProvider === "openai" && (
                <label className="mb-3 block text-xs text-gray-600">
                  Model ID
                  <input
                    aria-label="OpenAI model ID"
                    className={`${inputClass} mt-1 font-mono`}
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="gpt-6-luna"
                  />
                </label>
              )}
              <p className="mb-4 text-xs leading-relaxed text-gray-500">
                Get a key at{" "}
                <a
                  className="text-blue-600 underline"
                  href={PROVIDER_SETTINGS[draftProvider].keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {draftProvider === "openai" ? "OpenAI" : "DeepSeek"}
                </a>
                . Your browser key is stored locally and sent to this app’s server to call the AI
                provider. Leave it blank to use a configured server key.
              </p>
              <input
                aria-label="API key"
                type="password"
                className={`${inputClass} font-mono`}
                placeholder="sk-your-api-key"
                value={inputKey}
                onChange={(event) => setInputKey(event.target.value)}
                autoFocus
                onKeyDown={(event) => event.key === "Enter" && save()}
              />
              <div className="mt-4 flex justify-end gap-2">
                {draftHasKey && (
                  <button
                    type="button"
                    className={`${buttonClass} mr-auto border-red-300 text-red-600`}
                    onClick={() => {
                      removeAIKey(draftProvider);
                      if (draftProvider === provider) setHasKey(false);
                      setInputKey("");
                      setShowModal(false);
                    }}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  className={`${buttonClass} border-gray-300 text-gray-700`}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${buttonClass} border-transparent bg-gray-900 text-white hover:bg-gray-800`}
                  onClick={save}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
