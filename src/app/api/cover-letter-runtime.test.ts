import { afterEach, beforeEach, expect, test, spyOn } from "bun:test";
import { POST as draft } from "./tailor-cover-letter/route";
import { POST as revise } from "./regenerate/route";
import {
  KIRTAN_COVER_LETTER_INSTRUCTIONS,
  KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS,
} from "@/lib/prompts/kirtan-cover-letter";

const names = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL"] as const;
let saved: Array<string | undefined>;
beforeEach(() => {
  saved = names.map((key) => process.env[key]);
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-key-not-real";
  process.env.OPENAI_MODEL = "gpt-6-luna";
});
afterEach(() =>
  names.forEach((key, i) => {
    if (saved[i] === undefined) delete process.env[key];
    else process.env[key] = saved[i];
  }),
);

test("deployed draft and revision handlers send hosted web search through Responses API", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const latex = "\\documentclass{article}\\begin{document}Verified draft.\\end{document}";
  const edited = "\\documentclass{article}\\begin{document}Edited final letter.\\end{document}";
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json({
      status: "completed",
      output: [
        { type: "web_search_call", status: "completed", action: { type: "search" } },
        {
          type: "message",
          content: [{ type: "output_text", text: calls.length % 2 === 0 ? edited : latex }],
        },
      ],
    });
  }) as typeof fetch);
  const data = {
    coverLetterLatex: latex,
    jobDescription: "Build and operate cloud services.",
    companyName: "Example Company",
    positionTitle: "Senior Engineer",
    masterContext: "",
    tailoredResume: "Verified resume evidence",
    manualResearch: "Supplied research",
  };
  const request = (path: string, body: object) =>
    new Request(`https://final-destination-rose.vercel.app/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `cover-runtime-${path}` },
      body: JSON.stringify(body),
    });
  try {
    const first = await draft(request("tailor-cover-letter", data));
    expect(first.status).toBe(200);
    expect((await first.json()).tailoredCoverLetter).toBe(edited);
    const second = await revise(
      request("regenerate", {
        ...data,
        type: "coverLetter",
        currentContent: latex,
        comment: "Make it more concise",
      }),
    );
    expect(second.status).toBe(200);
    expect((await second.json()).regeneratedContent).toBe(edited);
    expect(calls).toHaveLength(4);
    for (const [index, call] of calls.entries()) {
      expect(call.url).toBe("https://api.openai.com/v1/responses");
      expect(call.body.model).toBe("gpt-6-luna");
      if (index % 2 === 0) {
        expect(call.body).toMatchObject({
          tools: [{ type: "web_search" }],
          max_tool_calls: 3,
          instructions: KIRTAN_COVER_LETTER_INSTRUCTIONS,
        });
      } else {
        expect(call.body.tools).toBeUndefined();
        expect(call.body.instructions).toBe(KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS);
        expect(call.body.input).toContain(latex);
      }
      expect(call.body.input).toContain("Company: Example Company");
      expect(call.body.input).toContain("Role: Senior Engineer");
      expect(call.body.input).toContain("Verified resume evidence");
      expect(call.body.input).toContain("Supplied research");
      expect(call.body.input).toContain("I used ASU's CreateAI while developing CCR");
    }
  } finally {
    fetchSpy.mockRestore();
  }
});

test("draft and revision share their deadline with the editorial call", async () => {
  let now = Date.now();
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () => {
    // The first model call used the route's entire budget. A second call must
    // not get a new five-minute budget and outlive the serverless request.
    now += 286_000;
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "\\begin{document}First draft\\end{document}",
            },
          ],
        },
      ],
    });
  }) as unknown as typeof fetch);
  try {
    for (const [path, handler] of [
      ["tailor-cover-letter", draft],
      ["regenerate", revise],
    ] as const) {
      fetchSpy.mockClear();
      const response = await handler(
        new Request(`https://example.test/api/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": `deadline-${path}` },
          body: JSON.stringify({
            type: "coverLetter",
            currentContent: "old draft",
            comment: "Revise",
            coverLetterLatex: "shell",
            jobDescription: "job",
            masterContext: "facts",
          }),
        }),
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    }
  } finally {
    fetchSpy.mockRestore();
    clock.mockRestore();
  }
});
