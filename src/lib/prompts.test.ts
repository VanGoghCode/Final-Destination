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
    expect(pair.system).toContain("There is no percentage limit on rewriting");
    expect(pair.system).not.toContain("35% as the hard ceiling");
    expect(pair.system).toContain("Reassess every skills row");
    expect(pair.system).toContain("not per-entry caps");
    expect(pair.system).toContain("Each experience entry must have 4-6 bullets");
    expect(pair.system).toContain("Each retained project must have 3 bullets");
    expect(pair.system).toContain("a slight overflow onto a second page is acceptable");
    expect(pair.system).toContain("Prefer 5-6 distinct, substantive bullets");
    expect(pair.system).toContain("remove the empty project heading");
    expect(pair.system).not.toContain("do not add more bullets");
    expect(pair.system).toContain("Unsupported JD requirements stay unclaimed");
    expect(pair.system).toContain("SENIORITY WITHOUT INFLATION");
    expect(pair.system).toContain("Do not copy JD phrases into Skills");
    expect(pair.system).toContain("Do not hide an unsupported skill in an experience bullet");
    expect(pair.system).toContain("Preserve the supplied section order");
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

  it("uses an explicit fallback when the template has no recognized bullet lists", () => {
    const pair = buildResumePrompt({
      masterContext: "",
      resumeLatex: "\\section{test}",
      jobDescription: "JD",
      personalDetails: "",
    });

    expect(pair.user).toContain("no automatic text-length estimate");
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
