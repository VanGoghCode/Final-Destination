// Gemini Provider - Wrapper around existing Gemini implementation
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
  type GenerateContentConfig,
} from "@google/genai";
import { AIProviderInterface, PROVIDER_MODELS } from "./types";
import { isValidInput } from "../sanitize";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initialize Google GenAI client
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

export class GeminiProvider implements AIProviderInterface {
  private modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId || PROVIDER_MODELS.gemini.default;
  }

  getName(): string {
    return "Gemini";
  }

  async generateContent(prompt: string): Promise<string> {
    // Validate input
    if (!isValidInput(prompt)) {
      throw new Error("Invalid input detected");
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const ai = getGenAI();

        if (attempt === 0) {
          console.log(`[Gemini] Initializing model ${this.modelId}`);
          console.log("[Gemini] Sending request to Google GenAI...");
        } else {
          console.log(`[Gemini] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        }

        const response = await ai.models.generateContent({
          model: this.modelId,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: generationConfig,
        });

        const text = response.text || "";

        console.log(
          "[Gemini] Successfully received response, length:",
          text.length,
        );
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
          console.log(`[Gemini] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        break;
      }
    }

    throw lastError || new Error("Failed to generate content after retries");
  }
}
