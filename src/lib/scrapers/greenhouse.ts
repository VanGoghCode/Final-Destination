import type { Job, ScrapeResult } from "./types";

const GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards";

/**
 * Greenhouse job from API
 */
interface GreenhouseJob {
  id: number;
  title: string;
  location: {
    name: string;
  };
  departments: Array<{ name: string }>;
  absolute_url: string;
  updated_at: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

/**
 * Scrape jobs from Greenhouse API
 * @param boardToken - Company's Greenhouse board token (e.g., "stripe", "netflix")
 * @param companyId - Internal company ID for reference
 * @param companyName - Company display name
 */
export async function scrapeGreenhouse(
  boardToken: string,
  companyId: string,
  companyName: string,
): Promise<ScrapeResult> {
  try {
    const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        jobs: [],
        error: `Greenhouse API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: GreenhouseResponse = await response.json();

    const jobs: Job[] = data.jobs.map((job) => ({
      id: `gh-${boardToken}-${job.id}`,
      companyId,
      companyName,
      title: job.title,
      location: job.location?.name || "Remote",
      department: job.departments?.[0]?.name,
      url: job.absolute_url,
      postedAt: job.updated_at,
      scrapedAt: new Date().toISOString(),
      platform: "greenhouse",
    }));

    return {
      success: true,
      jobs,
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: `Failed to scrape Greenhouse: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get list of known Greenhouse companies
 */
export const GREENHOUSE_COMPANIES: Record<
  string,
  { id: string; name: string }
> = {
  netflix: { id: "NETFLIX", name: "Netflix" },
  uber: { id: "UBER_TECHNOLOGIES,_INC.", name: "Uber" },
  stripe: { id: "STRIPE", name: "Stripe" },
  coinbase: { id: "COINBASE", name: "Coinbase" },
  databricks: { id: "DATABRICKS", name: "Databricks" },
  snowflake: { id: "SNOWFLAKE", name: "Snowflake" },
  palantir: { id: "PALANTIR", name: "Palantir" },
  airbnb: { id: "AIRBNB", name: "Airbnb" },
  dropbox: { id: "DROPBOX", name: "Dropbox" },
  servicenow: { id: "SERVICENOW,_INC.", name: "ServiceNow" },
  reddit: { id: "REDDIT", name: "Reddit" },
  figma: { id: "FIGMA", name: "Figma" },
  notion: { id: "NOTION", name: "Notion" },
  discord: { id: "DISCORD", name: "Discord" },
  plaid: { id: "PLAID", name: "Plaid" },
  doordash: { id: "DOORDASH", name: "DoorDash" },
  instacart: { id: "INSTACART", name: "Instacart" },
  robinhood: { id: "ROBINHOOD", name: "Robinhood" },
  squarespace: { id: "SQUARESPACE", name: "Squarespace" },
  ramp: { id: "RAMP", name: "Ramp" },
};
