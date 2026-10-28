import { describe, it, expect } from "bun:test";
import {
  buildResumePrompt,
  buildResumeRegenerationPrompt,
  buildCoverLetterPrompt,
  buildExtractionPrompt,
} from "./prompts/index";

describe("Prompts", () => {
  it("tailors for the role's recruiter while preserving facts and the one-page format", () => {
    const pair = buildResumePrompt({
      masterContext: "Experienced dev",
      resumeLatex: "\\documentclass{article}",
      jobDescription: "Job Desc",
      personalDetails: "John Doe",
    });

    expect(pair.user).toContain("\\documentclass{article}");
    expect(pair.user).toContain("ORIGINAL RESUME");
    expect(pair.system).toContain("recruiter for this JD");
    expect(pair.system).toContain("ONLY the original resume and master context");
    expect(pair.system).toContain("Never invent");
    expect(pair.system).toContain("Rewrite and reorder skills and bullets within entries");
    expect(pair.system).toContain("one page with similar word count and density");
    expect(pair.system).toContain("Aim to cover every supported keyword within the rewrite budget");
    expect(pair.system).toContain("35% as the hard ceiling");
    expect(pair.system).toContain("Preserve at least 65% of the original wording");
    expect(pair.system).toContain("Measure the budget against the original resume");
    expect(pair.system).not.toContain("Substantial sentence rewrites");
    expect(pair.system).toContain("Reassess every skills row and every experience/project bullet");
    expect(pair.system).toContain("Target 95-100%");
    expect(pair.system).toContain("never exceed 105%");
    expect(pair.system).toContain("original line footprint");
    expect(pair.system).toContain("Unsupported JD requirements stay unclaimed");
    expect(pair.system).toContain("silently audit supported keyword coverage");
    expect(pair.system).not.toMatch(/minimal edits|prefer small wording changes/);
  });

  it("regeneration uses the same comprehensive rules and does not trust previous generated claims", () => {
    const pair = buildResumeRegenerationPrompt({
      masterContext: "facts",
      originalLatex: "original",
      currentContent: "draft",
      userComment: "feedback",
      personalDetails: "preferences",
      jobDescription: "JD",
    });
    expect(pair.system).toBe(
      buildResumePrompt({
        masterContext: "",
        resumeLatex: "",
        jobDescription: "",
        personalDetails: "",
      }).system,
    );
    expect(pair.user).toContain("draft");
    expect(pair.user).toContain("feedback");
    expect(pair.user).toContain("not a factual source");
  });

  it("buildResumePrompt should omit budget block when not provided", () => {
    const pair = buildResumePrompt({
      masterContext: "",
      resumeLatex: "\\section{test}",
      jobDescription: "JD",
      personalDetails: "",
    });

    expect(pair.user).not.toContain("CHARACTER BUDGET");
  });

  it("buildCoverLetterPrompt should include cover letter data", () => {
    const pair = buildCoverLetterPrompt({
      masterContext: "Dev",
      coverLetterLatex: "\\begin{document}Cover\\end{document}",
      jobDescription: "JD",
      personalDetails: "Name",
    });

    expect(pair.user).toContain("\\begin{document}Cover\\end{document}");
    expect(pair.user).toContain("COVER LETTER FORMAT");
    expect(pair.system).toContain("cover letter");
  });

  it("buildExtractionPrompt should include extraction instructions", () => {
    const pair = buildExtractionPrompt({
      jobDescription: "Software Eng at Acme",
      companyName: "Acme Corp",
    });

    expect(pair.user).toContain("Acme Corp");
    expect(pair.user).toContain("country");
    expect(pair.user).toContain("workMode");
    expect(pair.system).toContain("job listing analyzer");
  });
});
