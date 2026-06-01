// ========================================
// COMPREHENSIVE TEST SUITE — Greenhouse Scraper
// ========================================

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// We test the function's logic by mocking fetch at the global level.
// The actual API call is not made.

describe("Greenhouse Scraper", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should parse Greenhouse API response correctly", async () => {
    // Dynamic import to avoid module-level fetch calls
    const { scrapeGreenhouse } = await import("./greenhouse");

    const mockJobs = [
      {
        id: 123,
        title: "Software Engineer",
        location: { name: "San Francisco, CA" },
        departments: [{ name: "Engineering" }],
        absolute_url: "https://boards.greenhouse.io/acme/jobs/123",
        updated_at: "2026-01-15T00:00:00Z",
      },
    ];

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: mockJobs }),
      })) as unknown as typeof fetch;

    const result = await scrapeGreenhouse("acme", "ACME", "Acme Corp");

    expect(result.success).toBe(true);
    expect(result.jobs.length).toBe(1);
    expect(result.jobs[0]?.title).toBe("Software Engineer");
    expect(result.jobs[0]?.companyName).toBe("Acme Corp");
    expect(result.jobs[0]?.platform).toBe("greenhouse");
  });

  it("should handle Greenhouse API errors gracefully", async () => {
    const { scrapeGreenhouse } = await import("./greenhouse");

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })) as unknown as typeof fetch;

    const result = await scrapeGreenhouse("nonexistent", "ID", "Name");
    expect(result.success).toBe(false);
    expect(result.jobs.length).toBe(0);
    expect(result.error).toBeDefined();
  });

  it("should handle network errors", async () => {
    const { scrapeGreenhouse } = await import("./greenhouse");

    globalThis.fetch = (() =>
      Promise.reject(new Error("Network error"))) as unknown as typeof fetch;

    const result = await scrapeGreenhouse("acme", "ID", "Name");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to scrape Greenhouse");
  });
});
