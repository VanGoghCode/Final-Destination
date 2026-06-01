import { describe, it, expect } from "bun:test";
import {
  getJobLocationPrompt,
  getCompanyResearchPrompt,
  getResumeTailoringPrompt,
  getGeneralQuestionPrompt,
  getInternetOnlyAnswerPrompt,
} from "./prompts";

describe("Prompts", () => {
  it("getJobLocationPrompt should return correct prompt", () => {
    const prompt = getJobLocationPrompt("Software Engineer", "Acme Corp");
    expect(prompt).toContain("## JOB DESCRIPTION:\nSoftware Engineer");
    expect(prompt).toContain("## COMPANY: Acme Corp");
  });

  it("getCompanyResearchPrompt should return empty (research step removed)", () => {
    const prompt = getCompanyResearchPrompt();
    // Research step was removed — function now returns empty string
    expect(prompt).toBe("");
  });

  it("getCompanyResearchPrompt should return empty regardless of args", () => {
    const prompt = getCompanyResearchPrompt();
    expect(prompt).toBe("");
  });

  it("getResumeTailoringPrompt should include resume latex", () => {
    const prompt = getResumeTailoringPrompt(
      "\\documentclass{article}",
      "Job Desc",
      "John Doe",
      "Company Info",
    );
    expect(prompt).toContain("\\documentclass{article}");
    expect(prompt).toContain("ORIGINAL RESUME");
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
    expect(prompt).toContain("Answer MUST be within 100 words");
  });

  it("getInternetOnlyAnswerPrompt should include context hint", () => {
    const prompt = getInternetOnlyAnswerPrompt("Question", "Company", "Position");
    expect(prompt).toContain("## CONTEXT HINT:");
    expect(prompt).toContain("Position");
    expect(prompt).toContain("Company");
  });
});
