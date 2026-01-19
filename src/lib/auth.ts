import { GoogleAuth } from "google-auth-library";

/**
 * Gets Google Auth credentials from environment variables.
 * Supports two methods:
 * 1. GOOGLE_SERVICE_ACCOUNT_KEY - JSON string (preferred for Vercel)
 * 2. GOOGLE_APPLICATION_CREDENTIALS - File path (local development)
 */
export function getGoogleAuthCredentials(): GoogleAuth {
  // Priority 1: Raw JSON from environment variable (for Vercel/serverless)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      return new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    } catch (e) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", e);
      console.error(
        "Raw value starts with:",
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.substring(0, 50),
      );
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY format");
    }
  }

  // Priority 2: File path (for local development)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  throw new Error(
    "No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
  );
}

/**
 * Gets parsed credentials object for libraries that need raw credentials.
 */
export function getCredentialsObject(): Record<string, unknown> | undefined {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const rawValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      // Log first chars for debugging (no sensitive data)
      console.log(
        "[Auth] Parsing GOOGLE_SERVICE_ACCOUNT_KEY, starts with:",
        rawValue?.substring(0, 20),
      );
      const parsed = JSON.parse(rawValue);
      console.log(
        "[Auth] Successfully parsed credentials for project:",
        parsed.project_id,
      );
      return parsed;
    } catch (e) {
      console.error("[Auth] Failed to parse credentials:", e);
      return undefined;
    }
  }
  console.log("[Auth] No GOOGLE_SERVICE_ACCOUNT_KEY found, using default auth");
  return undefined;
}
