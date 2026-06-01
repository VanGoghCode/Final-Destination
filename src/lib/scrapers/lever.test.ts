// ========================================
// COMPREHENSIVE TEST SUITE — Lever Scraper
// ========================================

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Lever Scraper", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should parse Lever API response correctly", async () => {
    const { scrapeLever } = await import("./lever");

    const mockJobs = [
      {
        id: "abc123",
        text: "Backend Engineer",
        categories: { location: "Remote", team: "Engineering" },
        hostedUrl: "https://jobs.lever.co/acme/abc123",
        createdAt: 1700000000000,
      },
    ];

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockJobs),
      })) as unknown as typeof fetch;

    const result = await scrapeLever("acme", "ACME", "Acme Corp");

    expect(result.success).toBe(true);
    expect(result.jobs.length).toBe(1);
    expect(result.jobs[0]?.title).toBe("Backend Engineer");
    expect(result.jobs[0]?.platform).toBe("lever");
  });

  it("should handle Lever API errors", async () => {
    const { scrapeLever } = await import("./lever");

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })) as unknown as typeof fetch;

    const result = await scrapeLever("bad", "ID", "Name");
    expect(result.success).toBe(false);
  });
});
