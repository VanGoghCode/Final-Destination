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
 */
export const LEVER_COMPANIES: Record<string, { id: string; name: string }> = {
  openai: { id: "OPENAI", name: "OpenAI" },
  anthropic: { id: "ANTHROPIC", name: "Anthropic" },
  scale: { id: "SCALE_AI", name: "Scale AI" },
  anduril: { id: "ANDURIL", name: "Anduril" },
  flexport: { id: "FLEXPORT", name: "Flexport" },
  verkada: { id: "VERKADA", name: "Verkada" },
  lacework: { id: "LACEWORK", name: "Lacework" },
  airtable: { id: "AIRTABLE", name: "Airtable" },
  asana: { id: "ASANA", name: "Asana" },
  gusto: { id: "GUSTO", name: "Gusto" },
  carta: { id: "CARTA", name: "Carta" },
  brex: { id: "BREX", name: "Brex" },
  nerdwallet: { id: "NERDWALLET", name: "NerdWallet" },
  samsara: { id: "SAMSARA", name: "Samsara" },
  rippling: { id: "RIPPLING", name: "Rippling" },
};
