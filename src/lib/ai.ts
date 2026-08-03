// ========================================
// AI GENERATION — DeepSeek V4 Flash
// Uses system + user message separation.
// Master context injected into all user prompts.
// Research step removed — replaced by manualResearch param.
// ========================================

import { isValidInput } from "./sanitize";
import { getLatexCharBudget } from "./latex-count";
import { DeepSeekProvider } from "./ai-providers/deepseek";
import {
  buildResumePrompt,
  buildCoverLetterPrompt,
  buildAnswersPrompt,
  buildColdEmailPrompt,
  buildReferenceEmailPrompt,
  buildExtractionPrompt,
  buildResumeRegenerationPrompt,
  buildCoverLetterRegenerationPrompt,
  buildQuestionPrompt,
  buildInternetQuestionPrompt,
} from "./prompts/index";

// ========================================
// PROVIDER INSTANCES
// ========================================

function getStandardProvider(callTag?: string): DeepSeekProvider {
  return new DeepSeekProvider({
    temperature: 0.7,
    maxTokens: 65535,
    thinking: { type: "enabled", reasoning_effort: "high" },
    callTag,
  });
}

function getFastProvider(callTag?: string): DeepSeekProvider {
  return DeepSeekProvider.createFast(callTag);
}

// ========================================
// CORE GENERATION
// ========================================

async function generate(prompt: string, systemPrompt?: string, callTag?: string): Promise<string> {
  const provider = getStandardProvider(callTag);

  if (!isValidInput(prompt)) {
    throw new Error("Invalid input detected");
  }

  // Retries live inside the provider, which bounds all attempts + backoff to a
  // single time budget so the route answers before Vercel's function deadline.
  return provider.generateContent(prompt, systemPrompt);
}

// Clean LaTeX response
function cleanLatex(result: string): string {
  return result
    .replace(/^```latex\n?|^```\n?/i, "")
    .replace(/\n?```$/i, "")
    .replace(/\*\*/g, "")
    .trim();
}

// ========================================
// JOB INFO EXTRACTION
// ========================================

export async function extractJobLocationInfo(
  jobDescription: string,
  companyName: string,
): Promise<{ country: string; workMode: string }> {
  const pair = buildExtractionPrompt({ jobDescription, companyName });
  // Extraction uses fast provider, single prompt (no system separation needed for simple JSON extraction)
  const prompt = pair.system + "\n\n" + pair.user;

  try {
    const fastProvider = getFastProvider("extraction");
    const response = await fastProvider.generateContent(prompt);

    // The extraction object is flat JSON — match the first balanced {…} block.
    // (A greedy [\s\S]* pattern also swallows any trailing text, e.g. a model
    // "here you go" line, and then JSON.parse throws.)
    const jsonMatch = response.match(/\{[^{}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        country: parsed.country || "",
        workMode: ["Remote", "Hybrid", "On-site"].includes(parsed.workMode) ? parsed.workMode : "",
      };
    }
    return { country: "", workMode: "" };
  } catch (error) {
    console.error("[DeepSeek] Error extracting job info:", error);
    return { country: "", workMode: "" };
  }
}

// ========================================
// RESUME TAILORING
// ========================================

export async function tailorResume(
  resumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  masterContext: string,
  manualResearch?: string,
): Promise<string> {
  // Compute character budget from the original template
  const contentCharBudget = getLatexCharBudget(resumeLatex);

  const pair = buildResumePrompt({
    masterContext,
    resumeLatex,
    jobDescription,
    personalDetails,
    manualResearch,
    contentCharBudget,
  });

  const result = await generate(pair.user, pair.system, "resume");
  return cleanLatex(result);
}

// ========================================
// COVER LETTER TAILORING
// ========================================

export async function tailorCoverLetter(
  coverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  masterContext: string,
  manualResearch?: string,
  tailoredResume?: string,
): Promise<string> {
  const pair = buildCoverLetterPrompt({
    masterContext,
    coverLetterLatex,
    jobDescription,
    personalDetails,
    manualResearch,
    tailoredResume,
  });

  const result = await generate(pair.user, pair.system, "cover-letter");
  return cleanLatex(result);
}

// ========================================
// ANSWERS
// ========================================

export async function generateAnswers(
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string | undefined,
  jobDescription: string,
  masterContext: string,
): Promise<string> {
  const pair = buildAnswersPrompt({
    masterContext,
    questions,
    tailoredResume,
    tailoredCoverLetter,
    jobDescription,
  });

  return await generate(pair.user, pair.system, "answers");
}

// ========================================
// EMAILS
// ========================================

export async function generateColdEmail(
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const pair = buildColdEmailPrompt({
    masterContext,
    positionTitle,
    companyName,
    jobDescription,
    tailoredResume,
    tailoredCoverLetter,
  });

  return await generate(pair.user, pair.system, "cold-email");
}

export async function generateReferenceEmail(
  tailoredResume: string,
  _tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const pair = buildReferenceEmailPrompt({
    masterContext,
    positionTitle,
    companyName,
    jobDescription,
    tailoredResume,
    tailoredCoverLetter: _tailoredCoverLetter,
  });

  return await generate(pair.user, pair.system, "reference-email");
}

// ========================================
// REGENERATION
// ========================================

export async function regenerateResume(
  currentContent: string,
  userComment: string,
  originalResumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  masterContext: string,
): Promise<string> {
  const pair = buildResumeRegenerationPrompt({
    userComment,
    currentContent,
    originalLatex: originalResumeLatex,
    jobDescription,
    personalDetails,
    masterContext,
  });

  const result = await generate(pair.user, pair.system, "regenerate-resume");
  return cleanLatex(result);
}

export async function regenerateCoverLetter(
  currentContent: string,
  userComment: string,
  originalCoverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  masterContext: string,
): Promise<string> {
  const pair = buildCoverLetterRegenerationPrompt({
    userComment,
    currentContent,
    originalLatex: originalCoverLetterLatex,
    jobDescription,
    personalDetails,
    masterContext,
  });

  const result = await generate(pair.user, pair.system, "regenerate-cover-letter");
  return cleanLatex(result);
}

export async function regenerateAnswers(
  currentContent: string,
  userComment: string,
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
): Promise<string> {
  // Build a simple prompt pair for answer regeneration
  const systemPrompt = `You are an expert career coach. Apply the user's feedback to regenerate the answers. Maintain 70% formal + 30% informal tone. Keep Question/Answer format. Reference real experiences from the resume. Do NOT use ** or em dashes. Follow the tone rules for human authenticity.`;

  const userPrompt = `## CANDIDATE MASTER CONTEXT:
${masterContext}

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
Apply the user's feedback to the Current Answers. Use Master Context for accurate details. Return the regenerated answers in Question/Answer format.`;

  return await generate(userPrompt, systemPrompt, "regenerate-answers");
}

export async function regenerateEmail(
  emailType: "coldEmail" | "referenceEmail",
  currentContent: string,
  userComment: string,
  tailoredResume: string,
  _tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const desc =
    emailType === "coldEmail"
      ? "cold outreach email to a hiring authority"
      : "referral request email to an employee";

  const systemPrompt = `You are helping rewrite a ${desc}. Apply the user's feedback. Keep 100-200 words. 70% formal + 30% informal. Sound like a real person. Do NOT use ** or em dashes. Follow tone rules for human authenticity.`;

  const userPrompt = `## CANDIDATE MASTER CONTEXT:
${masterContext}

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
Apply the feedback. Return the regenerated email.`;

  return await generate(userPrompt, systemPrompt, "regenerate-email");
}

// ========================================
// QUESTION ANSWERING
// ========================================

export async function answerGeneralQuestion(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const pair = buildQuestionPrompt({
    masterContext,
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    limitType,
    limitValue,
  });

  return await generate(pair.user, pair.system, "question");
}

export async function answerWithInternet(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  masterContext: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const pair = buildInternetQuestionPrompt({
    masterContext,
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    limitType,
    limitValue,
  });

  return await generate(pair.user, pair.system, "question-internet");
}

export async function answerInternetOnly(
  question: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const systemPrompt =
    "You are a helpful research assistant. Provide accurate information from your training knowledge.";
  const limitInstruction =
    limitType && limitValue ? `\nIMPORTANT: Answer MUST be within ${limitValue} ${limitType}.` : "";
  const contextHint =
    companyName || positionTitle
      ? `\n## CONTEXT: Researching for ${positionTitle || "position"} at ${companyName || "a company"}.`
      : "";

  const userPrompt = `## QUESTION:
${question}
${contextHint}
## INSTRUCTIONS:
Provide a clear, accurate answer based on your training knowledge. Use natural tone. Do NOT use ** or em dashes.${limitInstruction}`;

  return await generate(userPrompt, systemPrompt, "question-internet-only");
}
