import type { Job, ScrapeResult } from "./types";

const LEVER_API_BASE = "https://api.lever.co/v0/postings";

/**
 * Lever job from API
 */
interface LeverJob {
  id: string;
  text: string;
  categories: {
    location?: string;
    team?: string;
    department?: string;
  };
  hostedUrl: string;
  createdAt: number;
}

/**
 * Scrape jobs from Lever API
 * @param company - Company's Lever identifier
 * @param companyId - Internal company ID for reference
 * @param companyName - Company display name
 */
export async function scrapeLever(
  company: string,
  companyId: string,
  companyName: string,
): Promise<ScrapeResult> {
  try {
    const url = `${LEVER_API_BASE}/${company}?mode=json`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        jobs: [],
        error: `Lever API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: LeverJob[] = await response.json();

    const jobs: Job[] = data.map((job) => ({
      id: `lever-${company}-${job.id}`,
      companyId,
      companyName,
      title: job.text,
      location: job.categories?.location || "Remote",
      department: job.categories?.team || job.categories?.department,
      url: job.hostedUrl,
      postedAt: new Date(job.createdAt).toISOString(),
      scrapedAt: new Date().toISOString(),
      platform: "lever",
    }));

    return {
      success: true,
      jobs,
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: `Failed to scrape Lever: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get list of known Lever companies
 * Organized by job count (descending) from lower-tier probing
 */
export const LEVER_COMPANIES: Record<string, { id: string; name: string }> = {
  // High volume (200+ jobs)
  palantir: { id: "PALANTIR_TECHNOLOGIES_INC", name: "Palantir" },

  // Medium-high volume (100-200 jobs)
  spotify: { id: "SPOTIFY_USA_INC", name: "Spotify" },

  // Medium volume (50-100 jobs)
  capital: { id: "CAPITAL_ONE_NATIONAL_ASSOCIATION", name: "Capital One" },

  // Medium-low volume (20-50 jobs)
  metlife: { id: "METLIFE_GROUP_INC", name: "MetLife" },

  // Low volume (<20 jobs)
  genesis: { id: "GENESIS_CORP", name: "Genesis Corp" },
  linkedin: { id: "LINKEDIN_CORPORATION", name: "LinkedIn" },

  // Legacy/other companies (from previous config)
  atlassian: { id: "ATLASSIAN_US_INC", name: "Atlassian" },
};
