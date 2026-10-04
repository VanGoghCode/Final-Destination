import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { scrapeAllCompanies } from "./index";
import { fetchJobs } from "./fetch-jobs";
const original = globalThis.fetch,
  budget = process.env.SCRAPE_TIME_BUDGET_MS,
  expanded = process.env.EXPANDED_SCRAPE_MAX;
afterEach(() => {
  globalThis.fetch = original;
  if (budget === undefined) delete process.env.SCRAPE_TIME_BUDGET_MS;
  else process.env.SCRAPE_TIME_BUDGET_MS = budget;
  if (expanded === undefined) delete process.env.EXPANDED_SCRAPE_MAX;
  else process.env.EXPANDED_SCRAPE_MAX = expanded;
});
describe("scrape deadlines", () => {
  it("applies its budget to primary and hardcoded sources", async () => {
    let clock = 0,
      calls = 0;
    const now = spyOn(Date, "now").mockImplementation(() => clock);
    globalThis.fetch = (async () => {
      calls++;
      clock += 1000;
      return Response.json({ jobs: [], results: [] });
    }) as unknown as typeof fetch;
    process.env.SCRAPE_TIME_BUDGET_MS = "1";
    process.env.EXPANDED_SCRAPE_MAX = "0";
    try {
      await scrapeAllCompanies();
      expect(calls).toBeLessThanOrEqual(1);
    } finally {
      now.mockRestore();
    }
  });
  it("aborts a stalled request and returns a scrape failure", async () => {
    globalThis.fetch = ((_, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      })) as typeof fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10);
    const response = await fetchJobs(
      "greenhouse",
      "Greenhouse",
      "https://mock.invalid",
      "id",
      "Name",
      () => [],
      { signal: controller.signal },
    );
    clearTimeout(timer);
    expect(response.success).toBe(false);
  }, 1000);
});
