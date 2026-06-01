// ========================================
// PROMPTS — backward-compatible wrappers
// Delegates to new prompt pair system internally.
// New code: import from @/lib/prompts/index
// ========================================

import {
  buildResumePrompt,
  buildCoverLetterPrompt,
  buildAnswersPrompt,
  buildColdEmailPrompt,
  buildReferenceEmailPrompt,
  buildResumeRegenerationPrompt,
  buildCoverLetterRegenerationPrompt,
  buildQuestionPrompt,
  buildInternetQuestionPrompt,
  buildExtractionPromptFlat,
} from "./prompts/index";

export type {
  PromptPair,
  ResumeTailoringData,
  CoverLetterData,
  AnswersData,
  EmailData,
  LocationExtractionData,
  RegenerationData,
  QuestionData,
} from "./prompts/index";

// ========================================
// Old function names → new prompt pairs
// ========================================

export function getJobLocationPrompt(jd: string, company: string): string {
  return buildExtractionPromptFlat({ jobDescription: jd, companyName: company });
}

export function getCompanyResearchPrompt(): string {
  return "";
}

export function getResumeTailoringPrompt(
  resumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): string {
  const { system, user } = buildResumePrompt({
    masterContext: "",
    resumeLatex,
    jobDescription,
    personalDetails,
    manualResearch: companyInfo || undefined,
  });
  return system + "\n\n" + user;
}

export function getCoverLetterTailoringPrompt(
  coverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): string {
  const { system, user } = buildCoverLetterPrompt({
    masterContext: "",
    coverLetterLatex,
    jobDescription,
    personalDetails,
    manualResearch: companyInfo || undefined,
  });
  return system + "\n\n" + user;
}

export function getAnswerGenerationPrompt(
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string | undefined,
  jobDescription: string,
  companyInfo: string,
): string {
  void companyInfo;
  const { system, user } = buildAnswersPrompt({
    masterContext: "",
    questions,
    tailoredResume,
    tailoredCoverLetter,
    jobDescription,
  });
  return system + "\n\n" + user;
}

export function getColdEmailPrompt(
  positionTitle: string,
  companyName: string,
  jobDescription: string,
  _companyInfo: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
): string {
  const { system, user } = buildColdEmailPrompt({
    masterContext: "",
    positionTitle,
    companyName,
    jobDescription,
    tailoredResume,
    tailoredCoverLetter,
  });
  return system + "\n\n" + user;
}

export function getReferenceEmailPrompt(
  positionTitle: string,
  companyName: string,
  jobDescription: string,
  _companyInfo: string,
  tailoredResume: string,
): string {
  const { system, user } = buildReferenceEmailPrompt({
    masterContext: "",
    positionTitle,
    companyName,
    jobDescription,
    tailoredResume,
    tailoredCoverLetter: "",
  });
  return system + "\n\n" + user;
}

export function getResumeRegenerationPrompt(
  userComment: string,
  currentContent: string,
  originalLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): string {
  const { system, user } = buildResumeRegenerationPrompt({
    userComment,
    currentContent,
    originalLatex,
    jobDescription,
    personalDetails,
    masterContext: companyInfo || "",
  });
  return system + "\n\n" + user;
}

export function getCoverLetterRegenerationPrompt(
  userComment: string,
  currentContent: string,
  originalLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): string {
  const { system, user } = buildCoverLetterRegenerationPrompt({
    userComment,
    currentContent,
    originalLatex,
    jobDescription,
    personalDetails,
    masterContext: companyInfo || "",
  });
  return system + "\n\n" + user;
}

export function getAnswerRegenerationPrompt(
  userComment: string,
  currentContent: string,
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
): string {
  void companyInfo;
  return `You are an expert career coach. Apply feedback.

## USER'S FEEDBACK:
${userComment}

## CURRENT ANSWERS (to modify):
${currentContent}

## ORIGINAL QUESTIONS:
${questions}

## CONTEXT:
- Job: ${jobDescription}
- Resume: ${tailoredResume}
- Cover Letter: ${tailoredCoverLetter}

## INSTRUCTIONS:
Apply feedback. Maintain 70% formal + 30% informal tone. Keep Question/Answer format. Reference real resume experiences. Do NOT use ** or em dashes.`;
}

export function getEmailRegenerationPrompt(
  emailType: "coldEmail" | "referenceEmail",
  userComment: string,
  currentContent: string,
  positionTitle: string,
  companyName: string,
  jobDescription: string,
  _companyInfo: string,
  tailoredResume: string,
): string {
  const desc =
    emailType === "coldEmail"
      ? "cold outreach email to a hiring authority"
      : "referral request email to an employee";
  return `You are helping rewrite a ${desc}.

## USER'S FEEDBACK:
${userComment}

## CURRENT EMAIL (to modify):
${currentContent}

## CONTEXT:
- Position: ${positionTitle}
- Company: ${companyName}
- Job Description: ${jobDescription}
- Resume highlights: ${tailoredResume.slice(0, 2000)}

## INSTRUCTIONS:
Apply feedback. Keep 100-200 words. 70% formal + 30% informal. Sound human. Do NOT use ** or em dashes.`;
}

export function getGeneralQuestionPrompt(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  positionTitle: string,
  companyName: string,
  jobDescription: string,
  companyInfo: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): string {
  const { system, user } = buildQuestionPrompt({
    masterContext: companyInfo || "",
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    limitType,
    limitValue,
  });
  return system + "\n\n" + user;
}

export function getInternetAnswerPrompt(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  positionTitle: string,
  companyName: string,
  jobDescription: string,
  companyInfo: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): string {
  const { system, user } = buildInternetQuestionPrompt({
    masterContext: companyInfo || "",
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    limitType,
    limitValue,
  });
  return system + "\n\n" + user;
}

export function getInternetOnlyAnswerPrompt(
  question: string,
  companyName?: string,
  positionTitle?: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): string {
  const limit =
    limitType && limitValue ? `\nIMPORTANT: Answer MUST be within ${limitValue} ${limitType}.` : "";
  const ctx =
    companyName || positionTitle
      ? `\n\n## CONTEXT HINT:\nResearching for ${positionTitle || "position"} at ${companyName || "a company"}.`
      : "";
  return `You are a helpful research assistant.${ctx}\n\n## QUESTION:\n${question}\n\n## INSTRUCTIONS:\nProvide a clear, accurate answer. Use natural tone. Do NOT use ** or em dashes.${limit}`;
}
