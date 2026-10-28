import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as ai from "./ai";
import { OpenAIProvider } from "./ai-providers/openai";
import {
  KIRTAN_COVER_LETTER_INSTRUCTIONS,
  KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS,
} from "./prompts/kirtan-cover-letter";

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
  it("keeps recipient line breaks left aligned without changing letter content", async () => {
    const raw =
      "\\begin{document}Arizona State University\\linebreak Tempe, Arizona\\end{document}";
    const expected = "\\begin{document}Arizona State University\\\\ Tempe, Arizona\\end{document}";
    const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue(raw);
    try {
      expect(await ai.tailorCoverLetter("shell", "job", "", "facts")).toBe(expected);
      expect(await ai.regenerateCoverLetter("draft", "feedback", "shell", "job", "", "facts")).toBe(
        expected,
      );
      expect(await ai.tailorResume("shell", "job", "", "facts")).toBe(raw);
    } finally {
      spy.mockRestore();
    }
  });
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
      const quickQuestion = name.includes("question");
      const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue(
        quickQuestion ? "Question: Message to the hiring team\n\nAnswer: output" : "output",
      );
      try {
        expect(await run()).toBe("output");
        expect(spy).toHaveBeenCalledTimes(name.includes("cover letter") ? 2 : 1);
        expect(spy.mock.calls[0]![0]).toBeTruthy();
        expect(spy.mock.calls[0]![1]).toBeTruthy();
        if (quickQuestion) {
          const system = spy.mock.calls[0]![1]!;
          expect(system).toContain("Return only the answer text");
          expect(system).toContain("1-2 small spelling mistakes");
          expect(system).toContain("Do not invent experience");
          expect(system).not.toContain('6. FORMAT: "Question:');
        }
      } finally {
        spy.mockRestore();
      }
    });
  }
  it("uses Kirtan's cover-letter skill while retaining context inputs and LaTeX output", async () => {
    const latex = "\\documentclass{article}\n\\begin{document}Private draft.\\end{document}";
    const spy = spyOn(OpenAIProvider.prototype, "generateContent").mockResolvedValue(latex);
    try {
      expect(
        await ai.tailorCoverLetter(
          "format-shell",
          "role-needs",
          "voice-preferences",
          "verified-background",
          "research-notes",
          "resume-evidence",
        ),
      ).toBe(latex);
      expect(
        await ai.regenerateCoverLetter(
          "current-draft",
          "revision-feedback",
          "format-shell",
          "role-needs",
          "voice-preferences",
          "verified-background",
          "revision-resume-evidence",
          "revision-research-notes",
        ),
      ).toBe(latex);
      for (const [index, [user, system]] of spy.mock.calls.entries()) {
        expect(system).toBe(
          index % 2 === 0
            ? KIRTAN_COVER_LETTER_INSTRUCTIONS
            : KIRTAN_COVER_LETTER_EDITOR_INSTRUCTIONS,
        );
        expect(user).toContain("verified-background");
        expect(user).toContain("format-shell");
        expect(user).toContain("role-needs");
        expect(user).toContain("voice-preferences");
        expect(user).toContain("CURRENT DATE");
      }
      expect(spy.mock.calls[0]![0]).toContain("research-notes");
      expect(spy.mock.calls[0]![0]).toContain("resume-evidence");
      for (const index of [2, 3]) {
        expect(spy.mock.calls[index]![0]).toContain("current-draft");
        expect(spy.mock.calls[index]![0]).toContain("revision-feedback");
        expect(spy.mock.calls[index]![0]).toContain("revision-resume-evidence");
        expect(spy.mock.calls[index]![0]).toContain("revision-research-notes");
      }
    } finally {
      spy.mockRestore();
    }
  });
  it("surfaces editorial failure instead of returning the first draft as final", async () => {
    const spy = spyOn(OpenAIProvider.prototype, "generateContent")
      .mockResolvedValueOnce("first draft")
      .mockRejectedValueOnce(new Error("editor failed"));
    try {
      await expect(ai.tailorCoverLetter("shell", "job", "", "facts")).rejects.toThrow(
        "editor failed",
      );
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1]![0]).toContain("first draft");
    } finally {
      spy.mockRestore();
    }
  });
  it("keeps answer paragraphs and removes legacy labels and code fences", async () => {
    const expected = "I like building things.\n\nI want to learn more about your work.";
    const spy = spyOn(OpenAIProvider.prototype, "generateContent");
    try {
      for (const output of [
        expected,
        `Answer: ${expected}`,
        `Question: Why this role?\n\nAnswer: ${expected}`,
        `**Question:** Why this role?\n\n**Answer:** ${expected}`,
        `\`\`\`text\nAnswer: ${expected}\n\`\`\``,
      ]) {
        spy.mockResolvedValue(output);
        expect(
          await ai.answerGeneralQuestion("Why this role?", "resume", "", "job", "context", "", ""),
        ).toBe(expected);
      }
    } finally {
      spy.mockRestore();
    }
  });
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
