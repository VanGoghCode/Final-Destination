// ========================================
// COMPREHENSIVE TEST SUITE — Prompt System & Tone
// ========================================

import { describe, it, expect } from "bun:test";
import {
  SYSTEM_BASE_PERSONA,
  SYSTEM_RESUME_RULES,
  SYSTEM_COVER_LETTER_RULES,
  SYSTEM_ANSWERS_RULES,
  SYSTEM_EMAIL_RULES,
} from "./system";
import { TONE_INSTRUCTIONS } from "./tone";

describe("System Prompts", () => {
  it("SYSTEM_BASE_PERSONA should be non-empty", () => {
    expect(SYSTEM_BASE_PERSONA.length).toBeGreaterThan(100);
  });

  it("SYSTEM_RESUME_RULES should include critical instructions", () => {
    expect(SYSTEM_RESUME_RULES).toContain("POSITION THE CANDIDATE");
    expect(SYSTEM_RESUME_RULES).toContain("SEMANTIC ALIGNMENT");
    expect(SYSTEM_RESUME_RULES).toContain("PROOF OF WORK");
  });

  it("SYSTEM_RESUME_RULES should forbid markdown bold syntax", () => {
    expect(SYSTEM_RESUME_RULES).toContain("Do NOT use **");
  });

  it("SYSTEM_COVER_LETTER_RULES should forbid AI clichés", () => {
    expect(SYSTEM_COVER_LETTER_RULES).toContain("NO AI CLICHÉS");
    expect(SYSTEM_COVER_LETTER_RULES).toContain("tapestry");
  });

  it("SYSTEM_ANSWERS_RULES should specify writing tone", () => {
    expect(SYSTEM_ANSWERS_RULES).toContain("CANDIDATE VOICE");
    expect(SYSTEM_ANSWERS_RULES).toContain("TRUTHFULNESS");
  });

  it("SYSTEM_EMAIL_RULES should specify word count", () => {
    expect(SYSTEM_EMAIL_RULES).toContain("100-200");
  });
});

describe("Tone Instructions", () => {
  it("Tone Instructions should forbid hollow corporate filler", () => {
    expect(TONE_INSTRUCTIONS).toContain("Avoid hollow corporate filler");
  });

  it("Tone Instructions should guide authentic voice", () => {
    expect(TONE_INSTRUCTIONS).toContain("AUTHENTIC VOICE");
  });

  it("Tone Instructions should require contractions", () => {
    expect(TONE_INSTRUCTIONS).toContain("contractions");
  });
});
