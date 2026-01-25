import type { Job, ScrapeResult } from "./types";

const ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board";

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  department: string;
  jobPostingUrl: string;
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
): Promise<ScrapeResult> {
  try {
    const url = `${ASHBY_API_BASE}/${orgName}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        jobs: [],
        error: `Ashby API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: AshbyResponse = await response.json();

    const jobs: Job[] = data.jobs.map((job) => ({
      id: `ashby-${orgName}-${job.id}`,
      companyId,
      companyName,
      title: job.title,
      location: job.location,
      department: job.department,
      url: job.jobPostingUrl,
      postedAt: job.publishedAt,
      scrapedAt: new Date().toISOString(),
      platform: "ashby" as any, // Cast to any since we'll add 'ashby' to the type
    }));

    return {
      success: true,
      jobs,
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: `Failed to scrape Ashby: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
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
