// ========================================
// API ERROR EXTRACTION
// Safely pull a readable message out of a failed API response.
// Platform failures (e.g. Vercel killing a slow function) return plain-text
// bodies — never let response.json() throw "Unexpected token" on those.
// ========================================

export function aiErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/API key not configured|\b401\b|\b403\b/i.test(message))
    return Response.json(
      { error: "Check the selected provider's API key in AI settings." },
      { status: 401 },
    );
  if (/\b429\b|rate limit/i.test(message))
    return Response.json(
      { error: "AI service is busy. Please try again in a moment." },
      { status: 429 },
    );
  if (/timeout|timed out/i.test(message))
    return Response.json(
      { error: "The AI service took too long to respond. Please try again." },
      { status: 504 },
    );
  if (error instanceof SyntaxError || error instanceof TypeError || /Invalid input/i.test(message))
    return Response.json({ error: "Missing or invalid request fields." }, { status: 400 });
  if (/\b503\b|fetch failed|network|connection/i.test(message))
    return Response.json(
      { error: "AI service is unavailable. Check your connection and try again." },
      { status: 503 },
    );
  return Response.json({ error: fallback }, { status: 500 });
}

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
