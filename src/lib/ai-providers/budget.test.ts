import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { withAIBudget } from "./http";
import { OpenAIProvider } from "./openai";
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "fixture";
});
afterEach(() => {
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
});
describe("request-wide AI deadline", () => {
  it("cancels an in-flight provider request without retrying", async () => {
    const controller = new AbortController();
    let calls = 0;
    const provider = new OpenAIProvider({
      _fetch: (async (_: unknown, init?: RequestInit) => {
        calls++;
        setTimeout(() => controller.abort(new Error("Job cancelled")), 5);
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), {
            once: true,
          }),
        );
      }) as typeof fetch,
    });
    await expect(
      withAIBudget(1000, () => provider.generateContent("resume prompt"), controller.signal),
    ).rejects.toThrow("Job cancelled");
    expect(calls).toBe(1);
  });
  it("shares the remaining time between serial calls", async () => {
    let calls = 0;
    const provider = new OpenAIProvider({
      totalBudgetMs: 1000,
      timeoutMs: 1000,
      _fetch: (async (_: unknown, init?: RequestInit) => {
        if (++calls === 1)
          return Response.json({
            status: "completed",
            output: [{ type: "message", content: [{ type: "output_text", text: "resume" }] }],
          });
        return await new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          ),
        );
      }) as typeof fetch,
    });
    const start = Date.now();
    await withAIBudget(40, async () => {
      expect(await provider.generateContent("resume prompt")).toBe("resume");
      await new Promise((resolve) => setTimeout(resolve, 20));
      await expect(provider.generateContent("cover prompt")).rejects.toThrow("timeout");
    });
    expect(Date.now() - start).toBeLessThan(300);
  });
});
