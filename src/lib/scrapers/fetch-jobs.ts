import type { Job, ScrapeResult } from "./types";

// Keep platform parsing separate while sharing transport and result metadata.
export async function fetchJobs<T>(
  platform: Job["platform"],
  label: string,
  url: string,
  companyId: string,
  companyName: string,
  parse: (
    data: T,
    metadata: Pick<Job, "companyId" | "companyName" | "scrapedAt" | "platform">,
  ) => Job[],
  init?: RequestInit,
): Promise<ScrapeResult> {
  try {
    const timeout = AbortSignal.timeout(10_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await fetch(url, { ...init, signal });
    if (!response.ok)
      return {
        success: false,
        jobs: [],
        error: `${label} API error: ${response.status} ${response.statusText}`,
      };
    const data: T = await response.json();
    const scrapedAt = new Date().toISOString();
    return {
      success: true,
      jobs: parse(data, { companyId, companyName, scrapedAt, platform }),
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: `Failed to scrape ${label}: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
