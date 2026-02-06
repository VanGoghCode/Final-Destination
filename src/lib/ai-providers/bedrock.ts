// AWS Bedrock Claude Provider
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { AIProviderInterface, PROVIDER_MODELS } from "./types";
import { isValidInput } from "../sanitize";

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Error types that are retryable
const RETRYABLE_ERRORS = [
  "ThrottlingException",
  "ServiceUnavailableException",
  "InternalServerException",
  "rate limit",
  "throttl",
  "temporarily unavailable",
  "503",
  "429",
];

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : "";
  const errorName = error instanceof Error ? error.name.toLowerCase() : "";

  return RETRYABLE_ERRORS.some(
    (pattern) =>
      errorString.includes(pattern.toLowerCase()) ||
      errorMessage.includes(pattern.toLowerCase()) ||
      errorName.includes(pattern.toLowerCase()),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initialize Bedrock client
function getBedrockClient(): BedrockRuntimeClient {
  const region =
    process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || "us-west-2";

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for Bedrock",
    );
  }

  return new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Get the inference profile ARN for Claude models
function getInferenceProfileId(modelId: string): string {
  // Check if already an ARN or inference profile ID
  if (
    modelId.startsWith("arn:") ||
    modelId.startsWith("us.") ||
    modelId.startsWith("eu.")
  ) {
    return modelId;
  }

  // For Claude Opus 4.5, use the cross-region inference profile
  // Format: us.anthropic.claude-opus-4-5-20251101-v1:0
  const region =
    process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || "us-west-2";
  const regionPrefix = region.startsWith("eu") ? "eu" : "us";

  return `${regionPrefix}.${modelId}`;
}

export class BedrockClaudeProvider implements AIProviderInterface {
  private modelId: string;

  constructor(modelId?: string) {
    const baseModelId =
      modelId || process.env.CLAUDE_MODEL_ID || PROVIDER_MODELS.claude.default;
    // Convert to inference profile ID
    this.modelId = getInferenceProfileId(baseModelId);
  }

  getName(): string {
    return "Claude (Bedrock)";
  }

  async generateContent(prompt: string): Promise<string> {
    // Validate input
    if (!isValidInput(prompt)) {
      throw new Error("Invalid input detected");
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const client = getBedrockClient();

        if (attempt === 0) {
          console.log(`[Bedrock] Using inference profile: ${this.modelId}`);
          console.log("[Bedrock] Sending request to AWS Bedrock...");
        } else {
          console.log(`[Bedrock] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        }

        // Use Converse API which supports inference profiles
        const command = new ConverseCommand({
          modelId: this.modelId,
          messages: [
            {
              role: "user",
              content: [{ text: prompt }],
            },
          ],
          inferenceConfig: {
            maxTokens: 64000,
            temperature: 0.7,
          },
        });

        const apiResponse = await client.send(command);

        // Extract text from Converse API response
        const text = apiResponse.output?.message?.content?.[0]?.text || "";

        console.log(
          "[Bedrock] Successfully received response, length:",
          text.length,
        );
        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[Bedrock] Error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
          error,
        );

        // Check if error is retryable and we have retries left
        if (isRetryableError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[Bedrock] Retrying in ${delay}ms...`);
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
