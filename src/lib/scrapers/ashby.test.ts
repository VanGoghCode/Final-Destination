// ========================================
// COMPREHENSIVE TEST SUITE — Ashby Scraper
// ========================================

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Ashby Scraper", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should parse Ashby API response correctly", async () => {
    const { scrapeAshby } = await import("./ashby");

    const mockJobs = [
      {
        id: "job-1",
        title: "ML Engineer",
        location: "San Francisco",
        department: "AI",
        jobPostingUrl: "https://jobs.ashbyhq.com/acme/job-1",
        publishedAt: "2026-01-15",
      },
    ];

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: mockJobs }),
      })) as unknown as typeof fetch;

    const result = await scrapeAshby("acme", "ACME", "Acme Corp");

    expect(result.success).toBe(true);
    expect(result.jobs.length).toBe(1);
    expect(result.jobs[0]?.title).toBe("ML Engineer");
    expect(result.jobs[0]?.platform).toBe("ashby");
  });

  it("should return empty result on error", async () => {
    const { scrapeAshby } = await import("./ashby");

    globalThis.fetch = (() => Promise.reject(new Error("Timeout"))) as unknown as typeof fetch;

    const result = await scrapeAshby("acme", "ID", "Name");
    expect(result.success).toBe(false);
  });
});
