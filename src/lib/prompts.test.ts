import { describe, it, expect } from "bun:test";
import {
  getJobLocationPrompt,
  getCompanyResearchPrompt,
  getResumeTailoringPrompt,
  getCoverLetterTailoringPrompt,
  getAnswerGenerationPrompt,
  getColdEmailPrompt,
  getReferenceEmailPrompt,
  getResumeRegenerationPrompt,
  getCoverLetterRegenerationPrompt,
  getAnswerRegenerationPrompt,
  getEmailRegenerationPrompt,
  getGeneralQuestionPrompt,
  getInternetAnswerPrompt,
  getInternetOnlyAnswerPrompt,
} from "./prompts";

describe("Prompts", () => {
  it("getJobLocationPrompt should return correct prompt", () => {
    const prompt = getJobLocationPrompt("Software Engineer", "Acme Corp");
    expect(prompt).toContain("## JOB DESCRIPTION:\nSoftware Engineer");
    expect(prompt).toContain("## COMPANY: Acme Corp");
  });

  it("getCompanyResearchPrompt should include company URL info if provided", () => {
    const prompt = getCompanyResearchPrompt(
      "Acme Corp",
      "Engineer",
      "Job Desc",
      "https://example.com",
    );
    expect(prompt).toContain("## COMPANY WEBSITE:");
    expect(prompt).toContain("https://example.com");
  });

  it("getCompanyResearchPrompt should not include company URL info if undefined", () => {
    const prompt = getCompanyResearchPrompt(
      "Acme Corp",
      "Engineer",
      "Job Desc",
      undefined,
    );
    expect(prompt).not.toContain("## COMPANY WEBSITE:");
  });

  it("getResumeTailoringPrompt should include resume latex", () => {
    const prompt = getResumeTailoringPrompt(
      "\\documentclass{article}",
      "Job Desc",
      "John Doe",
      "Company Info",
    );
    expect(prompt).toContain("## ORIGINAL RESUME (LaTeX):\n\\documentclass{article}");
  });

  it("getGeneralQuestionPrompt should include limit instruction", () => {
    const prompt = getGeneralQuestionPrompt(
      "Question",
      "Resume",
      "Cover Letter",
      "Position",
      "Company",
      "Job",
      "Company Info",
      "words",
      100,
    );
    expect(prompt).toContain(
      "IMPORTANT: Your answer MUST be within 100 words",
    );
  });

    it("getInternetOnlyAnswerPrompt should include context hint", () => {
    const prompt = getInternetOnlyAnswerPrompt(
      "Question",
      "Company",
      "Position",
    );
    expect(prompt).toContain("## CONTEXT HINT:");
    expect(prompt).toContain("Position");
    expect(prompt).toContain("Company");
  });
});
