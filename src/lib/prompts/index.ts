// ========================================
// PROMPT ASSEMBLY — system + user combinations
// ========================================

export * from "./system";
export * from "./user";
export * from "./tone";

import {
  SYSTEM_BASE_PERSONA,
  SYSTEM_RESUME_RULES,
  SYSTEM_COVER_LETTER_RULES,
  SYSTEM_ANSWERS_RULES,
  SYSTEM_EMAIL_RULES,
  SYSTEM_EXTRACTION,
} from "./system";
import { TONE_INSTRUCTIONS } from "./tone";
import {
  buildResumeUserPrompt,
  buildCoverLetterUserPrompt,
  buildAnswersUserPrompt,
  buildColdEmailUserPrompt,
  buildReferenceEmailUserPrompt,
  buildLocationExtractionUserPrompt,
  buildResumeRegenerationUserPrompt,
  buildCoverLetterRegenerationUserPrompt,
  buildGeneralQuestionUserPrompt,
  buildInternetQuestionUserPrompt,
} from "./user";
import type {
  ResumeTailoringData,
  CoverLetterData,
  AnswersData,
  EmailData,
  LocationExtractionData,
  RegenerationData,
  QuestionData,
} from "./user";

// ========================================
// PROMPT PAIRS (system + user)
// ========================================

export interface PromptPair {
  system: string;
  user: string;
}

/** Resume tailoring: system persona + resume rules, user data */
export function buildResumePrompt(
  data: ResumeTailoringData & { contentCharBudget?: { target: number; limit: number } },
): PromptPair {
  return {
    system: [SYSTEM_BASE_PERSONA, SYSTEM_RESUME_RULES].join("\n\n"),
    user: buildResumeUserPrompt(data),
  };
}

/** Cover letter: system persona + cover letter rules + tone, user data */
export function buildCoverLetterPrompt(data: CoverLetterData): PromptPair {
  return {
    system: [SYSTEM_BASE_PERSONA, SYSTEM_COVER_LETTER_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildCoverLetterUserPrompt(data),
  };
}

/** Application answers: system answer rules + tone, user data */
export function buildAnswersPrompt(data: AnswersData): PromptPair {
  return {
    system: [SYSTEM_BASE_PERSONA, SYSTEM_ANSWERS_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildAnswersUserPrompt(data),
  };
}

/** Cold email: system email rules + tone, user data */
export function buildColdEmailPrompt(data: EmailData): PromptPair {
  return {
    system: [SYSTEM_EMAIL_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildColdEmailUserPrompt(data),
  };
}

/** Reference email: system email rules + tone, user data */
export function buildReferenceEmailPrompt(data: EmailData): PromptPair {
  return {
    system: [SYSTEM_EMAIL_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildReferenceEmailUserPrompt(data),
  };
}

/** Location extraction: extraction rules, user data. No tone. */
export function buildExtractionPrompt(data: LocationExtractionData): PromptPair {
  return {
    system: SYSTEM_EXTRACTION,
    user: buildLocationExtractionUserPrompt(data),
  };
}

/** Resume regeneration: system persona + resume rules, user data with feedback */
export function buildResumeRegenerationPrompt(data: RegenerationData): PromptPair {
  return {
    system: [SYSTEM_BASE_PERSONA, SYSTEM_RESUME_RULES].join("\n\n"),
    user: buildResumeRegenerationUserPrompt(data),
  };
}

/** Cover letter regeneration: system + cover letter rules + tone */
export function buildCoverLetterRegenerationPrompt(data: RegenerationData): PromptPair {
  return {
    system: [SYSTEM_BASE_PERSONA, SYSTEM_COVER_LETTER_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildCoverLetterRegenerationUserPrompt(data),
  };
}

/** General question (context only): system answer rules + tone */
export function buildQuestionPrompt(data: QuestionData): PromptPair {
  return {
    system: [SYSTEM_ANSWERS_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildGeneralQuestionUserPrompt(data),
  };
}

/** Internet question (context + web): system answer rules + tone */
export function buildInternetQuestionPrompt(data: QuestionData): PromptPair {
  return {
    system: [SYSTEM_ANSWERS_RULES, TONE_INSTRUCTIONS].join("\n\n"),
    user: buildInternetQuestionUserPrompt(data),
  };
}

// ========================================
// SINGLE-STRING FALLBACKS (backward compat)
// ========================================

/** Single-string prompt for simple extraction tasks (no system role needed) */
export function buildExtractionPromptFlat(data: LocationExtractionData): string {
  const pair = buildExtractionPrompt(data);
  return pair.system + "\n\n" + pair.user;
}
