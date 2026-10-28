import { expect, it } from "bun:test";
import {
  responseCost,
  recordGenerationResponse,
  captureGenerationCost,
  type GenerationCost,
} from "./generation-cost";
import {
  addJobGenerationCost,
  persistJobGenerationCost,
  withJobGenerationCost,
} from "./job-generation-cost";
import { OpenAIProvider } from "./ai-providers/openai";
import { job } from "./__tests__/job";
const summary = (): GenerationCost => ({ calls: 0, usd: 0, incomplete: false });
const usage = (input = 10_000, output = 2_000, cached = 0) => ({
  usage: {
    input_tokens: input,
    output_tokens: output,
    input_tokens_details: { cached_tokens: cached },
    output_tokens_details: { reasoning_tokens: 1000 },
  },
});

it("marks the estimate partial when hosted web-search fees are not included", async () => {
  const cost = summary();
  await captureGenerationCost(async () => {
    recordGenerationResponse("openai", "gpt-6-luna", {
      ...usage(),
      output: [{ type: "web_search_call", status: "completed" }],
    });
  }, cost);
  expect(cost.calls).toBe(1);
  expect(cost.usd).toBeGreaterThan(0);
  expect(cost.incomplete).toBe(true);
});

it("prices cached input separately and counts reasoning only once", () => {
  expect(responseCost("openai", "gpt-6-luna", usage(10_000, 2_000, 4_000))).toBeCloseTo(
    0.00164,
    10,
  );
  expect(responseCost("openai", "gpt-6-luna", { ...usage(), service_tier: "flex" })).toBeCloseTo(
    0.001,
    10,
  );
  expect(
    responseCost("openai", "gpt-6-luna", { ...usage(), service_tier: "priority" }),
  ).toBeCloseTo(0.004, 10);
});
it("applies long-context rates and cache-write rates", () => {
  expect(responseCost("openai", "gpt-6-luna", usage(300_000, 2_000))).toBeCloseTo(0.0615, 10);
  const data = usage(10_000, 2_000);
  Object.assign(data.usage.input_tokens_details, { cache_creation_tokens: 4000 });
  expect(responseCost("openai", "gpt-6-luna", data)).toBeCloseTo(0.0021, 10);
});
it("never invents a cost for missing usage, invalid counts or unpriced models", () => {
  for (const data of [{}, { usage: { input_tokens: -1, output_tokens: 0 } }, usage(100, 0, 200)]) {
    expect(responseCost("openai", "gpt-6-luna", data)).toBeNull();
  }
  expect(responseCost("openai", "custom-model", usage())).toBeNull();
  expect(responseCost("deepseek", "deepseek-v4-flash", usage())).toBeNull();
});
it("isolates concurrent requests while combining parallel calls within each request", async () => {
  const a = summary(),
    b = summary();
  await Promise.all([
    captureGenerationCost(async () => {
      await Promise.all([
        Promise.resolve().then(() => recordGenerationResponse("openai", "gpt-6-luna", usage())),
        Promise.resolve().then(() => recordGenerationResponse("openai", "gpt-6-luna", usage())),
      ]);
    }, a),
    captureGenerationCost(
      async () => recordGenerationResponse("openai", "gpt-6-luna", usage(1000, 0)),
      b,
    ),
  ]);
  expect(a).toEqual({ calls: 2, usd: 0.004, incomplete: false });
  expect(b.usd).toBeCloseTo(0.0001, 10);
});
it("captures the real provider response and persists cost even if subsequent work fails", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-cost-key";
  const recorded: Array<{ id: string; cost: GenerationCost }> = [];
  try {
    const provider = new OpenAIProvider({
      _fetch: (async () =>
        Response.json({
          ...usage(),
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "latex" }] }],
        })) as unknown as typeof fetch,
    });
    const result = await withJobGenerationCost(
      new Request("http://localhost/api/tailor", { headers: { "x-job-id": "job-a" } }),
      async () => {
        await provider.generateContent("fixture prompt");
        return Response.json({ error: "later operation failed" }, { status: 500 });
      },
      async (id, cost) => {
        recorded.push({ id, cost });
      },
    );
    expect(result.status).toBe(500);
    expect(recorded).toEqual([{ id: "job-a", cost: { calls: 1, usd: 0.002, incomplete: false } }]);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
it("adds cost to fresh shared state after a conflict without dropping concurrent charges", async () => {
  let state = { jobs: [job("job-a")], paused: true },
    writes = 0;
  await persistJobGenerationCost(
    "job-a",
    { calls: 2, usd: 0.43, incomplete: false },
    {
      read: async () => ({ state: structuredClone(state), sha: String(writes) }),
      write: async (next) => {
        if (!writes++) {
          state.jobs[0]!.generationCostUsd = 0.12;
          return false;
        }
        state = next;
        return true;
      },
    },
  );
  expect(state.jobs[0]!.generationCostUsd).toBeCloseTo(0.55, 10);
  expect(state.jobs[0]!.generationCostIncomplete).toBe(false);
});
it("keeps historical and partially tracked totals incomplete", () => {
  const historical = job("old", { tailoredResume: "existing" });
  addJobGenerationCost(historical, { calls: 1, usd: 0.02, incomplete: false });
  expect(historical.generationCostIncomplete).toBe(true);
  const fresh = job("new");
  addJobGenerationCost(fresh, { calls: 1, usd: 0.02, incomplete: true });
  addJobGenerationCost(fresh, { calls: 1, usd: 0.03, incomplete: false });
  expect(fresh.generationCostUsd).toBeCloseTo(0.05, 10);
  expect(fresh.generationCostIncomplete).toBe(true);
});
