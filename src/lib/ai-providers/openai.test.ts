import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { OpenAIProvider } from "./openai";
import { getAIProvider, generateContentWithProvider } from "./index";

let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-openai";
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
});
const output = (text = "hello") => ({
  status: "completed",
  output: [
    { type: "reasoning", summary: [] },
    { type: "message", content: [{ type: "output_text", text }] },
  ],
});
type Config = ConstructorParameters<typeof OpenAIProvider>[0];
const provider = (body: unknown, config: Config = {}) =>
  new OpenAIProvider({
    ...config,
    _fetch: (async () => Response.json(body)) as unknown as typeof fetch,
  });

describe("OpenAI Responses provider", () => {
  it("sends Luna, separated prompts and Bearer auth without DeepSeek parameters", async () => {
    let captured: RequestInit = {};
    let url: unknown;
    const ai = new OpenAIProvider({
      _fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        url = input;
        captured = init!;
        return Response.json(output());
      }) as unknown as typeof fetch,
    });
    expect(await ai.generateContent("user prompt", "system prompt")).toBe("hello");
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(captured.headers).toMatchObject({ Authorization: "Bearer test-openai" });
    expect(JSON.parse(captured.body as string)).toEqual({
      model: "gpt-6-luna",
      instructions: "system prompt",
      input: "user prompt",
      max_output_tokens: 65535,
      reasoning: { effort: "high" },
      store: false,
    });
  });
  it("supports a configured model and output budget", async () => {
    let body;
    const ai = new OpenAIProvider({
      modelId: "custom-model",
      maxTokens: 1024,
      _fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(init!.body as string);
        return Response.json(output());
      }) as unknown as typeof fetch,
    });
    await ai.generateContent("test");
    expect(body).toMatchObject({ model: "custom-model", max_output_tokens: 1024 });
  });
  it("concatenates text blocks and ignores reasoning and refusals", async () => {
    expect(
      await provider({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "one" },
              { type: "refusal", refusal: "no" },
              { type: "output_text", text: "two" },
            ],
          },
        ],
      }).generateContent("test"),
    ).toBe("onetwo");
  });
  it("rejects empty, refused, malformed and truncated responses", async () => {
    for (const body of [
      null,
      {},
      output(""),
      {
        status: "completed",
        output: [{ type: "message", content: [null, { type: "output_text", text: 123 }] }],
      },
      {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: output().output,
      },
    ]) {
      await expect(provider(body).generateContent("test")).rejects.toThrow(/OpenAI/);
    }
  });
  it("fails before fetch for invalid input or missing credentials", async () => {
    await expect(provider(output()).generateContent("")).rejects.toThrow("Invalid input");
    delete process.env.OPENAI_API_KEY;
    await expect(provider(output()).generateContent("test")).rejects.toThrow("OPENAI_API_KEY");
  });
  it("does not retry authentication failures, even if the error text says rate limit", async () => {
    let calls = 0;
    const ai = new OpenAIProvider({
      _fetch: (async () => {
        calls++;
        return Response.json({ error: "rate limit" }, { status: 401 });
      }) as unknown as typeof fetch,
    });
    await expect(ai.generateContent("test")).rejects.toThrow("401");
    expect(calls).toBe(1);
  });
  it("retries transient HTTP errors and serializes the request once", async () => {
    const serialize = spyOn(JSON, "stringify");
    let calls = 0;
    const bodies: unknown[] = [];
    const ai = new OpenAIProvider({
      retryDelayMs: 0,
      _fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(init!.body);
        calls++;
        return new Response(
          calls === 1
            ? "server error"
            : '{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"ok"}]}]}',
          { status: calls === 1 ? 500 : 200 },
        );
      }) as unknown as typeof fetch,
    });
    try {
      expect(await ai.generateContent("test")).toBe("ok");
      expect(calls).toBe(2);
      expect(bodies[0]).toBe(bodies[1]);
      expect(serialize).toHaveBeenCalledTimes(1);
    } finally {
      serialize.mockRestore();
    }
  });
  it("selects providers explicitly in the factory and generation helper", async () => {
    expect(getAIProvider("openai")).toBeInstanceOf(OpenAIProvider);
    expect(getAIProvider("deepseek").getName()).toBe("DeepSeek V4 Flash");
    const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue("selected");
    try {
      expect(await generateContentWithProvider("test", "openai")).toBe("selected");
    } finally {
      spy.mockRestore();
    }
  });
  it("fast extraction disables reasoning and reduces output tokens", async () => {
    const ai = OpenAIProvider.createFast();
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      expect(JSON.parse(init!.body as string)).toMatchObject({
        reasoning: { effort: "none" },
        max_output_tokens: 8192,
      });
      return Response.json(output());
    }) as unknown as typeof fetch);
    try {
      await ai.generateContent("extract");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
