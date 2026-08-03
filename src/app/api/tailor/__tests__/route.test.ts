// ========================================
// Tailor API Route — error response tests
// Verifies the route always answers with JSON, even when the AI layer
// times out (previously a hung DeepSeek call let Vercel kill the function,
// returning a plain-text body the frontend could not parse).
// ========================================

import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mutable AI behavior — the route's imports are mocked once, per-test state
// via closure.
let aiError: Error | null = null;

mock.module("@/lib/ai", () => ({
  tailorResume: async () => {
    if (aiError) throw aiError;
    return "\\documentclass{article}% tailored resume";
  },
  extractJobLocationInfo: async () => ({ country: "USA", workMode: "On-site" }),
}));

// Import after mocking so the route picks up the mocked module
const { POST } = await import("../route");

function makeRequest() {
  return new Request("http://localhost/api/tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeLatex: "\\documentclass{article}% base",
      jobDescription: "Software Engineer role",
      companyName: "Acme Corp",
    }),
  });
}

describe("POST /api/tailor", () => {
  beforeEach(() => {
    aiError = null;
  });

  it("returns 200 with tailored output on success", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tailoredResume).toContain("tailored resume");
    expect(body.jobCountry).toBe("USA");
    expect(body.jobWorkMode).toBe("On-site");
  });

  it("returns 504 JSON when the AI call times out", async () => {
    aiError = new Error("DeepSeek API timeout after 50000ms");
    const res = await POST(makeRequest());
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toContain("took too long");
  });

  it("returns 500 JSON on generic AI errors (never a non-JSON body)", async () => {
    aiError = new Error("Something exploded");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 429 JSON on rate-limit style errors", async () => {
    aiError = new Error("DeepSeek API error (429): rate limit exceeded");
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("busy");
  });
});
