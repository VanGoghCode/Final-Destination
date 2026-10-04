import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as ai from "./ai";
import { OpenAIProvider } from "./ai-providers/openai";

let selected: string | undefined;
beforeEach(() => {
  selected = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "openai";
});
afterEach(() => {
  if (selected === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = selected;
});

describe("OpenAI generation workflows", () => {
  const workflows = [
    ["resume", () => ai.tailorResume("latex", "job", "details", "context")],
    ["cover letter", () => ai.tailorCoverLetter("latex", "job", "details", "context")],
    ["answers", () => ai.generateAnswers("questions", "resume", "letter", "job", "context")],
    [
      "cold email",
      () => ai.generateColdEmail("resume", "letter", "job", "context", "title", "company"),
    ],
    [
      "reference email",
      () => ai.generateReferenceEmail("resume", "letter", "job", "context", "title", "company"),
    ],
    [
      "regenerate resume",
      () => ai.regenerateResume("current", "feedback", "latex", "job", "details", "context"),
    ],
    [
      "regenerate cover letter",
      () => ai.regenerateCoverLetter("current", "feedback", "latex", "job", "details", "context"),
    ],
    [
      "regenerate answers",
      () =>
        ai.regenerateAnswers(
          "current",
          "feedback",
          "questions",
          "resume",
          "letter",
          "job",
          "context",
        ),
    ],
    [
      "regenerate email",
      () =>
        ai.regenerateEmail(
          "coldEmail",
          "current",
          "feedback",
          "resume",
          "letter",
          "job",
          "context",
          "title",
          "company",
        ),
    ],
    [
      "general question",
      () =>
        ai.answerGeneralQuestion(
          "question",
          "resume",
          "letter",
          "job",
          "context",
          "company",
          "title",
        ),
    ],
    [
      "question with internet context",
      () =>
        ai.answerWithInternet("question", "resume", "letter", "job", "context", "company", "title"),
    ],
    ["internet-only question", () => ai.answerInternetOnly("question", "company", "title")],
  ] as const;
  for (const [name, run] of workflows) {
    it(`${name} uses the selected OpenAI provider and retains separated prompts`, async () => {
      const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue("output");
      try {
        expect(await run()).toBe("output");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0]).toBeTruthy();
        expect(spy.mock.calls[0]![1]).toBeTruthy();
      } finally {
        spy.mockRestore();
      }
    });
  }
  it("extracts location with the selected provider and preserves JSON normalization", async () => {
    const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue(
      '{"country":"USA","workMode":"Remote"}',
    );
    try {
      expect(await ai.extractJobLocationInfo("job", "company")).toEqual({
        country: "USA",
        workMode: "Remote",
      });
    } finally {
      spy.mockRestore();
    }
  });
});
