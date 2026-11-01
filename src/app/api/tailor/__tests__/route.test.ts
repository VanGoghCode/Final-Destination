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
let locationWait: Promise<void> | undefined;
let locationStarted: (() => void) | undefined;

mock.module("@/lib/ai", () => ({
  tailorResume: async () => {
    if (aiError) throw aiError;
    return "\\documentclass{article}% tailored resume";
  },
  extractJobLocationInfo: async () => {
    locationStarted?.();
    await locationWait;
    return { country: "USA", workMode: "On-site" };
  },
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
    locationWait = undefined;
    locationStarted = undefined;
  });

  it("returns 200 with tailored output on success", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tailoredResume).toContain("tailored resume");
    expect(body.jobCountry).toBe("USA");
    expect(body.jobWorkMode).toBe("On-site");
  });

  it("waits for the other paid call before returning a failure for cost accounting", async () => {
    aiError = new Error("resume failed");
    let finish!: () => void;
    locationWait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const started = new Promise<void>((resolve) => {
      locationStarted = resolve;
    });
    let settled = false;
    const pending = POST(makeRequest()).then((response) => {
      settled = true;
      return response;
    });
    await started;
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    expect((await pending).status).toBe(500);
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
  it.each(["OpenAI API key not configured", "OpenAI API error (401): Invalid API key"])(
    "returns an actionable key error: %s",
    async (message) => {
      aiError = new Error(message);
      const response = await POST(makeRequest());
      expect(response.status).toBe(401);
      expect((await response.json()).error).toContain("API key");
    },
  );
});
