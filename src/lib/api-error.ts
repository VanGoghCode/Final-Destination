// ========================================
// API ERROR EXTRACTION
// Safely pull a readable message out of a failed API response.
// Platform failures (e.g. Vercel killing a slow function) return plain-text
// bodies — never let response.json() throw "Unexpected token" on those.
// ========================================

export async function extractApiError(
  response: Response,
  fallback = "Request failed",
): Promise<string> {
  // Read the body once — a failed response.json() consumes it, leaving
  // response.text() empty and hiding the real error message.
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return fallback;
  }

  try {
    const data = JSON.parse(text);
    if (data && typeof data === "object") {
      const errorField = (data as { error?: unknown }).error;
      if (typeof errorField === "string" && errorField.trim()) {
        return errorField;
      }
      // Valid JSON without an error field — raw JSON is not user-readable
      return fallback;
    }
  } catch {
    // Not JSON (platform error page) — return the raw text below
  }

  return text.trim();
}
