import { AsyncLocalStorage } from "node:async_hooks";
import type { AIProvider } from "./ai-providers/types";

export interface GenerationCost {
  calls: number;
  usd: number;
  incomplete: boolean;
}
const costs = new AsyncLocalStorage<GenerationCost>();
export const captureGenerationCost = <T>(task: () => Promise<T>, summary: GenerationCost) =>
  costs.run(summary, task);

// Standard direct-API USD rates per million tokens, verified 2026-10-08.
// https://developers.openai.com/api/docs/models/gpt-6-luna
// Never assume an unknown/custom model has Luna's price.
export function responseCost(provider: AIProvider, model: string, data: Record<string, unknown>) {
  if (!data || typeof data !== "object") return null;
  if (provider !== "openai" || !/^gpt-6-luna(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return null;
  const usage = data.usage as
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number; cache_creation_tokens?: number };
      }
    | undefined;
  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const writes = usage?.input_tokens_details?.cache_creation_tokens ?? 0;
  if (
    ![input, output, cached, writes].every(
      (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
    ) ||
    cached + writes > input!
  )
    return null;
  const tier = data.service_tier;
  if (
    tier != null &&
    !["auto", "default", "standard", "flex", "priority", "fast"].includes(String(tier))
  )
    return null;
  const tierMultiplier =
    tier === "flex" ? 0.5 : ["priority", "fast"].includes(String(tier)) ? 2 : 1;
  const long = input! > 272_000;
  // output_tokens already includes reasoning tokens; do not count them twice.
  return (
    (((input! - cached - writes) * 0.1 * (long ? 2 : 1) +
      cached * 0.01 * (long ? 2 : 1) +
      writes * 0.125 * (long ? 2 : 1) +
      output! * 0.5 * (long ? 1.5 : 1)) /
      1_000_000) *
    tierMultiplier
  );
}

export function recordGenerationResponse(
  provider: AIProvider,
  model: string,
  data: Record<string, unknown>,
) {
  const summary = costs.getStore();
  if (!summary) return;
  summary.calls++;
  const usd = responseCost(provider, model, data);
  // Token pricing does not include hosted web-search tool charges.
  if (Array.isArray(data?.output) && data.output.some((item) => item?.type === "web_search_call"))
    summary.incomplete = true;
  if (usd === null) summary.incomplete = true;
  else summary.usd += usd;
}
