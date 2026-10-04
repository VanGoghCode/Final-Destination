"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AIProvider } from "@/lib/ai-providers/types";

export interface AISettings {
  provider: AIProvider;
  modelId: string;
  configured: Record<AIProvider, boolean>;
}
const Context = createContext<AISettings>({
  provider: "deepseek",
  modelId: "deepseek-v4-flash",
  configured: { deepseek: false, openai: false },
});
export const useAISettings = () => useContext(Context);
export function AISettingsProvider({
  settings,
  children,
}: {
  settings: AISettings;
  children: ReactNode;
}) {
  return <Context.Provider value={settings}>{children}</Context.Provider>;
}
