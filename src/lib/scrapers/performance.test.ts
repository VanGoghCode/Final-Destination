import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { filterJobs, type Job } from "./types";
import { scrapeGreenhouse } from "./greenhouse";
import { scrapeLever } from "./lever";
import { scrapeAshby } from "./ashby";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("scraper performance regressions", () => {
  it("normalizes keywords once and preserves order, identity and substring matching", () => {
    const jobs = ["BACKEND Engineer", "Director of Backend", "Backend developer", "Designer"].map(
      (title, i) => ({ title, id: String(i) }) as Job,
    );
    const roles = ["BACKEND", "Engineer"],
      excluded = ["Director"];
    const lower = spyOn(String.prototype, "toLowerCase");
    try {
      const result = filterJobs(jobs, roles, excluded);
      expect(result).toEqual([jobs[0]!, jobs[2]!]);
      expect(result[0]).toBe(jobs[0]);
      expect(lower).toHaveBeenCalledTimes(jobs.length + roles.length + excluded.length);
      expect(roles).toEqual(["BACKEND", "Engineer"]);
    } finally {
      lower.mockRestore();
    }
  });
  for (const [name, scrape, body] of [
    [
      "Greenhouse",
      scrapeGreenhouse,
      {
        jobs: [
          { id: 1, title: "Engineer" },
          { id: 2, title: "Designer" },
        ],
      },
    ],
    [
      "Lever",
      scrapeLever,
      [
        { id: 1, text: "Engineer", createdAt: 0 },
        { id: 2, text: "Designer", createdAt: 0 },
      ],
    ],
    [
      "Ashby",
      scrapeAshby,
      {
        jobs: [
          { id: 1, title: "Engineer" },
          { id: 2, title: "Designer" },
        ],
      },
    ],
  ] as const) {
    it(`${name}: computes a single timestamp per response`, async () => {
      globalThis.fetch = (async () => Response.json(body)) as unknown as typeof fetch;
      const iso = spyOn(Date.prototype, "toISOString");
      const mappings = spyOn(Array.prototype, "map");
      try {
        const result = await scrape("acme", "ACME", "Acme");
        expect(result.success).toBe(true);
        expect(result.jobs).toHaveLength(2);
        expect(result.jobs[0]!.scrapedAt).toBe(result.jobs[1]!.scrapedAt);
        expect(iso).toHaveBeenCalledTimes(name === "Lever" ? 3 : 1);
        expect(mappings).toHaveBeenCalledTimes(1);
      } finally {
        iso.mockRestore();
        mappings.mockRestore();
      }
    });
  }
});
