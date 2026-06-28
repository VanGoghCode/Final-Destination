import { describe, it, expect } from "bun:test";
import { buildResumePrompt, buildCoverLetterPrompt, buildExtractionPrompt } from "./prompts/index";

describe("Prompts", () => {
  it("buildResumePrompt should include resume latex and character budget", () => {
    const pair = buildResumePrompt({
      masterContext: "Experienced dev",
      resumeLatex: "\\documentclass{article}",
      jobDescription: "Job Desc",
      personalDetails: "John Doe",
      contentCharBudget: { floor: 425, target: 500, limit: 575 },
    });

    expect(pair.user).toContain("\\documentclass{article}");
    expect(pair.user).toContain("ORIGINAL RESUME");
    expect(pair.user).toContain("CHARACTER BUDGET");
    expect(pair.user).toContain("Floor:");
    expect(pair.user).toContain("Hard cap:");
    expect(pair.user).toContain("425");
    expect(pair.user).toContain("500");
    expect(pair.user).toContain("575");
    expect(pair.system).toContain("resume writer");
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
    expect(pair.user).toContain("ORIGINAL COVER LETTER");
    expect(pair.system).toContain("COVER LETTER");
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
