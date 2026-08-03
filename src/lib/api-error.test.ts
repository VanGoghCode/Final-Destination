// ========================================
// TEST SUITE — extractApiError
// Safely extracts a readable message from a failed API response,
// including non-JSON bodies (e.g. Vercel's plain-text platform errors).
// ========================================

import { describe, it, expect } from "bun:test";
import { extractApiError } from "./api-error";

function res(status: number, body: string, contentType = "text/plain"): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

describe("extractApiError", () => {
  it("returns the error field from a JSON body", async () => {
    const response = res(500, JSON.stringify({ error: "AI service is busy" }), "application/json");
    expect(await extractApiError(response)).toBe("AI service is busy");
  });

  it("returns plain-text body when JSON parsing fails", async () => {
    const response = res(500, "An error occurred while processing your request");
    expect(await extractApiError(response)).toBe("An error occurred while processing your request");
  });

  it("returns fallback when body is empty", async () => {
    const response = res(500, "");
    expect(await extractApiError(response, "Generation failed")).toBe("Generation failed");
  });

  it("returns fallback for a JSON body without an error field", async () => {
    const response = res(500, JSON.stringify({ ok: false }), "application/json");
    expect(await extractApiError(response, "Fallback")).toBe("Fallback");
  });

  it("trims surrounding whitespace from text bodies", async () => {
    const response = res(500, "  \nAn error occurred while processing your request\n  ");
    expect(await extractApiError(response)).toBe("An error occurred while processing your request");
  });
});
