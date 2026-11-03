import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { POST } from "./route";

const names = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL"] as const;
let saved: Array<string | undefined>;
beforeEach(() => {
  saved = names.map((name) => process.env[name]);
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-key-not-real";
  process.env.OPENAI_MODEL = "gpt-6-luna";
});
afterEach(() => {
  names.forEach((name, i) => {
    if (saved[i] === undefined) delete process.env[name];
    else process.env[name] = saved[i];
  });
});

test("all Quick Question modes offer real search with truthful research instructions", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return Response.json({
      status: "completed",
      output: [
        { type: "web_search_call", status: "completed" },
        { type: "message", content: [{ type: "output_text", text: "Verified answer." }] },
      ],
    });
  }) as typeof fetch);
  try {
    for (const searchMode of ["context", "context+internet", "internet"]) {
      const response = await POST(
        new Request("https://example.test/api/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `web-test-${searchMode}`,
          },
          body: JSON.stringify({
            searchMode,
            question: "What did this company announce this week?",
            tailoredResume: "Supplied candidate facts",
            limitType: "words",
            limitValue: 100,
          }),
        }),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).answer).toBe("Verified answer.");
    }
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.model).toBe("gpt-6-luna");
      expect(call.tools).toEqual([{ type: "web_search" }]);
      expect(call.max_tool_calls).toBe(3);
      expect(call.instructions).toContain("Use web search when current");
      expect(call.instructions).toContain(
        "Never claim to have searched or verified facts unless a search actually succeeded",
      );
      expect(call.input).not.toContain("Use your training knowledge for external facts");
      expect(call.input).not.toContain("answer based on your training knowledge");
      expect(call.input).toContain("within 100 words");
    }
  } finally {
    fetchSpy.mockRestore();
  }
});
