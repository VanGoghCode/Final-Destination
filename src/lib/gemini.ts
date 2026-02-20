import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
  type GenerateContentConfig,
} from "@google/genai";
import { isValidInput } from "./sanitize";
import { AIProvider, getAIProvider } from "./ai-providers";
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

const MODEL_NAME = "gemini-3.1-pro-preview";
const MODEL_NAME_GROUNDED = "gemini-3.1-pro-preview";

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Error types that are retryable
const RETRYABLE_ERRORS = [
  "RESOURCE_EXHAUSTED",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  "INTERNAL",
  "rate limit",
  "quota exceeded",
  "temporarily unavailable",
  "503",
  "429",
];

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : "";

  return RETRYABLE_ERRORS.some(
    (pattern) =>
      errorString.includes(pattern.toLowerCase()) ||
      errorMessage.includes(pattern.toLowerCase()),
  );
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initialize Google GenAI client using API key mode
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY environment variable is required");
  }

  return new GoogleGenAI({ apiKey });
}

// Generation config with thinking enabled
const generationConfig: GenerateContentConfig = {
  maxOutputTokens: 65535,
  temperature: 1,
  topP: 0.95,
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.HIGH,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.OFF,
    },
  ],
};

// Generation config with Google Search grounding (for internet search)
const groundedConfig: GenerateContentConfig = {
  maxOutputTokens: 8192,
  temperature: 0.7,
  topP: 0.95,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.OFF,
    },
  ],
  tools: [
    {
      googleSearch: {},
    },
  ],
};

// Helper to generate content using selected AI provider with retry logic
async function generateContent(
  prompt: string,
  provider?: AIProvider,
): Promise<string> {
  // If provider specified, use the provider abstraction
  if (provider) {
    const aiProvider = getAIProvider(provider);
    return aiProvider.generateContent(prompt);
  }

  // Default: use Gemini directly (backward compatibility)
  // Validate input
  if (!isValidInput(prompt)) {
    throw new Error("Invalid input detected");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ai = getGenAI();

      if (attempt === 0) {
      } else {
        // Retry attempt
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: generationConfig,
      });

      const text = response.text || "";

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Gemini] Error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        error,
      );

      // Check if error is retryable and we have retries left
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);

        await sleep(delay);
        continue;
      }

      // Non-retryable error or max retries reached
      break;
    }
  }

  throw lastError || new Error("Failed to generate content after retries");
}

// Helper to generate content with Google Search grounding and retry logic
async function generateContentWithSearch(prompt: string): Promise<string> {
  // Validate input
  if (!isValidInput(prompt)) {
    throw new Error("Invalid input detected");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ai = getGenAI();

      if (attempt === 0) {
      } else {
        // Retry attempt
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME_GROUNDED,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: groundedConfig,
      });

      const text = response.text || "";

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Gemini] Error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        error,
      );

      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);

        await sleep(delay);
        continue;
      }

      break;
    }
  }

  throw (
    lastError || new Error("Failed to generate grounded content after retries")
  );
}

// ========================================
// JOB INFO EXTRACTION
// ========================================

export async function extractJobLocationInfo(
  jobDescription: string,
  companyName: string,
): Promise<{ country: string; workMode: string }> {
  const prompt = getJobLocationPrompt(jobDescription, companyName);

  try {
    const response = await generateContent(prompt);

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        country: parsed.country || "",
        workMode: ["Remote", "Hybrid", "On-site"].includes(parsed.workMode)
          ? parsed.workMode
          : "",
      };
    }

    return { country: "", workMode: "" };
  } catch (error) {
    console.error("[Gemini] Error extracting job info:", error);
    return { country: "", workMode: "" };
  }
}

export async function researchCompany(
  companyName: string,
  companyUrl: string | undefined,
  positionTitle: string,
  jobDescription: string,
): Promise<string> {
  const prompt = getCompanyResearchPrompt(
    companyName,
    positionTitle,
    jobDescription,
    companyUrl,
  );

  return await generateContent(prompt);
}

export async function tailorResume(
  resumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
  provider: AIProvider = "claude",
): Promise<string> {
  // Use specified provider for resume tailoring (defaults to Claude)
  const prompt = getResumeTailoringPrompt(
    resumeLatex,
    jobDescription,
    personalDetails,
    companyInfo,
  );

  let result = await generateContent(prompt, provider);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");
  // Strip any ** markers that slipped through (LaTeX doesn't support them)
  result = result.replace(/\*\*/g, "");

  return result.trim();
}

export async function tailorCoverLetter(
  coverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
  provider: AIProvider = "claude",
): Promise<string> {
  const prompt = getCoverLetterTailoringPrompt(
    coverLetterLatex,
    jobDescription,
    personalDetails,
    companyInfo,
  );

  // Use specified provider for cover letter tailoring (defaults to Claude)
  let result = await generateContent(prompt, provider);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");
  // Strip any ** markers that slipped through (LaTeX doesn't support them)
  result = result.replace(/\*\*/g, "");

  return result.trim();
}

export async function generateAnswers(
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string | undefined,
  jobDescription: string,
  companyInfo: string,
): Promise<string> {
  const prompt = getAnswerGenerationPrompt(
    questions,
    tailoredResume,
    tailoredCoverLetter,
    jobDescription,
    companyInfo,
  );

  return await generateContent(prompt);
}

export async function generateColdEmail(
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const prompt = getColdEmailPrompt(
    positionTitle,
    companyName,
    jobDescription,
    companyInfo,
    tailoredResume,
    tailoredCoverLetter,
  );

  return await generateContent(prompt);
}

export async function generateReferenceEmail(
  tailoredResume: string,
  _tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const prompt = getReferenceEmailPrompt(
    positionTitle,
    companyName,
    jobDescription,
    companyInfo,
    tailoredResume,
  );

  return await generateContent(prompt);
}

// ========================================
// REGENERATION FUNCTIONS (with user feedback)
// ========================================

export async function regenerateResume(
  currentContent: string,
  userComment: string,
  originalResumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = getResumeRegenerationPrompt(
    userComment,
    currentContent,
    originalResumeLatex,
    jobDescription,
    personalDetails,
    companyInfo,
  );

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function regenerateCoverLetter(
  currentContent: string,
  userComment: string,
  originalCoverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = getCoverLetterRegenerationPrompt(
    userComment,
    currentContent,
    originalCoverLetterLatex,
    jobDescription,
    personalDetails,
    companyInfo,
  );

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function regenerateAnswers(
  currentContent: string,
  userComment: string,
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
): Promise<string> {
  const prompt = getAnswerRegenerationPrompt(
    userComment,
    currentContent,
    questions,
    tailoredResume,
    tailoredCoverLetter,
    jobDescription,
    companyInfo,
  );

  return await generateContent(prompt);
}

export async function regenerateEmail(
  emailType: "coldEmail" | "referenceEmail",
  currentContent: string,
  userComment: string,
  tailoredResume: string,
  _tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const prompt = getEmailRegenerationPrompt(
    emailType,
    userComment,
    currentContent,
    positionTitle,
    companyName,
    jobDescription,
    companyInfo,
    tailoredResume,
  );

  return await generateContent(prompt);
}

// ========================================
// GENERAL QUESTION ANSWERING
// ========================================

export async function answerGeneralQuestion(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const prompt = getGeneralQuestionPrompt(
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    companyInfo,
    limitType,
    limitValue,
  );

  return await generateContent(prompt);
}

export async function answerWithInternet(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const prompt = getInternetAnswerPrompt(
    question,
    tailoredResume,
    tailoredCoverLetter,
    positionTitle,
    companyName,
    jobDescription,
    companyInfo,
    limitType,
    limitValue,
  );

  return await generateContentWithSearch(prompt);
}

export async function answerInternetOnly(
  question: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const prompt = getInternetOnlyAnswerPrompt(
    question,
    companyName,
    positionTitle,
    limitType,
    limitValue,
  );

  return await generateContentWithSearch(prompt);
}
