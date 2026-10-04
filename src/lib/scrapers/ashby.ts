import type { ScrapeResult } from "./types";
import { fetchJobs } from "./fetch-jobs";

const ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board";

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  department: string;
  jobUrl: string;
  publishedAt: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

/**
 * Scrape jobs from Ashby API
 */
export async function scrapeAshby(
  orgName: string,
  companyId: string,
  companyName: string,
  signal?: AbortSignal,
): Promise<ScrapeResult> {
  return fetchJobs<AshbyResponse>(
    "ashby",
    "Ashby",
    `${ASHBY_API_BASE}/${orgName}`,
    companyId,
    companyName,
    (data, metadata) =>
      data.jobs.map((job) => ({
        ...metadata,
        id: `ashby-${orgName}-${job.id}`,
        title: job.title,
        location: job.location,
        department: job.department,
        url: job.jobUrl,
        postedAt: job.publishedAt,
      })),
    { signal },
  );
}

/**
 * Get list of known Ashby companies
 * Organized by job count (descending) from lower-tier probing
 */
export const ASHBY_COMPANIES: Record<string, { id: string; name: string }> = {
  // High volume (300+ jobs)
  snowflake: { id: "SNOWFLAKE_INC", name: "Snowflake" },

  // Medium-high volume (100-200 jobs)
  confluent: { id: "CONFLUENT_INC", name: "Confluent" },

  // Low volume (<20 jobs)
  cas: { id: "CITADEL_AMERICAS_SERVICES_LLC", name: "Citadel" },
  tiger: { id: "TIGER_ANALYTICS_INC", name: "Tiger Analytics" },
  eli: { id: "ELI_LILLY_AND_COMPANY", name: "Eli Lilly" },
  pure: { id: "PURE_STORAGE_INC", name: "Pure Storage" },

  // Legacy/other companies (from previous config - AI companies)
  openai: { id: "OPENAI", name: "OpenAI" },
  replicate: { id: "REPLICATE", name: "Replicate" },
  perplexity: { id: "PERPLEXITY", name: "Perplexity" },
  pika: { id: "PIKA", name: "Pika" },
  character: { id: "CHARACTER_AI", name: "Character.ai" },
};
