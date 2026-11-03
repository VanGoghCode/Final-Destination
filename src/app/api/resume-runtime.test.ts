import { afterEach, beforeEach, expect, test, spyOn } from "bun:test";
import { POST as draft } from "./tailor/route";
import { POST as revise } from "./regenerate/route";
import {
  KIRTAN_RESUME_INSTRUCTIONS,
  KIRTAN_RESUME_EDITOR_INSTRUCTIONS,
} from "@/lib/prompts/kirtan-resume";

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

const original = "\\documentclass{article}\\begin{document}Original resume.\\end{document}";
const proposed = "\\documentclass{article}\\begin{document}Proposed resume.\\end{document}";
const final = "\\documentclass{article}\\begin{document}Reviewed resume.\\end{document}";
function request(path: string, suffix: string) {
  return new Request(`https://example.test/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `resume-${suffix}-${path}` },
    body: JSON.stringify({
      type: "resume",
      resumeLatex: original,
      currentContent: "old proposal",
      comment: "Emphasize production work",
      jobDescription: "Operate cloud applications",
      masterContext: "Candidate built a queue worker",
      personalDetails: "Preserve section order",
      manualResearch: "Employer operates a payments API",
    }),
  });
}
function response(text: string) {
  return Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  });
}

test("resume draft and revision return the selected model's reviewed output with original evidence", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    return response(
      body.tools && body.instructions?.startsWith(KIRTAN_RESUME_INSTRUCTIONS)
        ? proposed
        : body.instructions === KIRTAN_RESUME_EDITOR_INSTRUCTIONS
          ? final
          : '{"country":"USA","workMode":"Remote"}',
    );
  }) as typeof fetch);
  try {
    const first = await draft(request("tailor", "success"));
    expect(first.status).toBe(200);
    expect((await first.json()).tailoredResume).toBe(final);
    const second = await revise(request("regenerate", "success"));
    expect(second.status).toBe(200);
    expect((await second.json()).regeneratedContent).toBe(final);
    const resumeCalls = calls.filter((call) => call.instructions);
    expect(resumeCalls).toHaveLength(4);
    for (const [i, call] of resumeCalls.entries()) {
      expect(call.model).toBe("gpt-6-luna");
      if (i % 2) expect(call.tools).toBeUndefined();
      else expect(call.tools).toEqual([{ type: "web_search" }]);
      expect(call.instructions).toContain(
        i % 2 ? KIRTAN_RESUME_EDITOR_INSTRUCTIONS : KIRTAN_RESUME_INSTRUCTIONS,
      );
      expect(call.input).toContain(original);
      expect(call.input).toContain("Candidate built a queue worker");
      expect(call.input).toContain("Employer operates a payments API");
      if (i % 2) expect(call.input).toContain(proposed);
      if (i >= 2) expect(call.input).toContain("Emphasize production work");
    }
  } finally {
    fetchSpy.mockRestore();
  }
});

test("resume review failure is not silently replaced by an unchecked draft", async () => {
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.instructions === KIRTAN_RESUME_EDITOR_INSTRUCTIONS)
      return Response.json({ error: "test" }, { status: 400 });
    return response(body.instructions ? proposed : '{"country":"USA","workMode":"Remote"}');
  }) as typeof fetch);
  try {
    for (const [path, handler] of [
      ["tailor", draft],
      ["regenerate", revise],
    ] as const) {
      const result = await handler(request(path, "failure"));
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(await result.json())).not.toContain(proposed);
    }
  } finally {
    fetchSpy.mockRestore();
  }
});

test("resume review cannot start a fresh deadline after drafting exhausts the route budget", async () => {
  let now = Date.now();
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const instructions: unknown[] = [];
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    instructions.push(body.instructions);
    if (body.tools && body.instructions?.startsWith(KIRTAN_RESUME_INSTRUCTIONS)) now += 286_000;
    return response(body.instructions ? proposed : '{"country":"USA","workMode":"Remote"}');
  }) as typeof fetch);
  try {
    for (const [path, handler] of [
      ["tailor", draft],
      ["regenerate", revise],
    ] as const) {
      const result = await handler(request(path, "deadline"));
      expect(result.status).toBeGreaterThanOrEqual(400);
    }
    expect(instructions).not.toContain(KIRTAN_RESUME_EDITOR_INSTRUCTIONS);
  } finally {
    fetchSpy.mockRestore();
    clock.mockRestore();
  }
});
