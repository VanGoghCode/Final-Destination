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
 * Organized by job count (descending) from lower-tier probing
 */
export const GREENHOUSE_COMPANIES: Record<
  string,
  { id: string; name: string }
> = {
  // High volume (500+ jobs)
  databricks: { id: "DATABRICKS_INC", name: "Databricks" },
  coupang: { id: "COUPANG_GLOBAL_LLC", name: "Coupang" },
  cloudflare: { id: "CLOUDFLARE_INC", name: "Cloudflare" },
  doordashusa: { id: "DOORDASH_INC", name: "DoorDash" },
  stripe: { id: "STRIPE_INC", name: "Stripe" },

  // Medium-high volume (200-500 jobs)
  waymo: { id: "WAYMO_LLC", name: "Waymo" },
  datadog: { id: "DATADOG_INC", name: "Datadog" },
  mongodb: { id: "MONGODB_INC", name: "MongoDB" },
  purestorage: { id: "PURE_STORAGE_INC", name: "Pure Storage" },
  coinbase: { id: "COINBASE_INC", name: "Coinbase" },
  zscaler: { id: "ZSCALER_INC", name: "Zscaler" },
  block: { id: "BLOCK_INC", name: "Block" },
  hubspotjobs: { id: "HUBSPOT_INC", name: "HubSpot" },
  roblox: { id: "ROBLOX_CORPORATION", name: "Roblox" },
  airbnb: { id: "AIRBNB_INC", name: "Airbnb" },
  roku: { id: "ROKU_INC", name: "Roku" },
  rubrik: { id: "RUBRIK_INC", name: "Rubrik" },

  // Medium volume (100-200 jobs)
  dropbox: { id: "DROPBOX_INC", name: "Dropbox" },
  hitachidigitalservices: {
    id: "HITACHI_DIGITAL_SERVICES_LLC",
    name: "Hitachi Digital Services",
  },
  lyft: { id: "LYFT_INC", name: "Lyft" },
  pinterest: { id: "PINTEREST_INC", name: "Pinterest" },
  robinhood: { id: "ROBINHOOD_MARKETS_INC", name: "Robinhood" },
  twilio: { id: "TWILIO_INC", name: "Twilio" },

  // Medium-low volume (50-100 jobs)
  godaddy: { id: "GODADDY_COM_LLC", name: "GoDaddy" },
  creditkarma: { id: "CREDIT_KARMA_LLC", name: "Credit Karma" },
  linkedin: { id: "LINKEDIN_CORPORATION", name: "LinkedIn" },

  // Low volume (10-50 jobs)
  governmentcareers: { id: "GEICO", name: "GEICO" },
  elite: { id: "ELITE_IT_TECHNOLOGIES_LLC", name: "Elite IT Technologies" },
  insurance: {
    id: "INSURANCE_SERVICES_OFFICE_INC",
    name: "Insurance Services Office",
  },
  ie: {
    id: "INTERCONTINENTAL_EXCHANGE_HOLDINGS_INC",
    name: "Intercontinental Exchange",
  },
  iris: { id: "IRIS_SOFTWARE_INC", name: "Iris Software" },
  lpl: { id: "LPL_FINANCIAL_LLC", name: "LPL Financial" },
  pt: { id: "PALANTIR_TECHNOLOGIES_INC", name: "Palantir (GH)" },
  system: {
    id: "SYSTEM_SOFT_TECHNOLOGIES_LLC",
    name: "System Soft Technologies",
  },
  si: { id: "SAGE_IT_INC", name: "Sage IT" },
  tss: { id: "TOTAL_SYSTEM_SERVICES_LLC", name: "Total System Services" },
  bhs: { id: "BEACON_HILL_SOLUTIONS_GROUP_LLC", name: "Beacon Hill Solutions" },
  socialfinance: { id: "SOCIAL_FINANCE_LLC", name: "SoFi" },
  imt: { id: "ICE_MORTGAGE_TECHNOLOGY_INC", name: "ICE Mortgage Technology" },
  nds: { id: "NTT_DATA_SERVICES_LLC", name: "NTT DATA Services" },
  cc: { id: "CHARTER_COMMUNICATIONS_INC", name: "Charter Communications" },
  fms: { id: "FIS_MANAGEMENT_SERVICES_LLC", name: "FIS" },
  ela: { id: "ELI_LILLY_AND_COMPANY", name: "Eli Lilly" },
  general: { id: "GENERAL_MOTORS", name: "General Motors" },
  indeed: { id: "INDEED_INC", name: "Indeed" },
  new: { id: "NEW_YORK_LIFE_INSURANCE_COMPANY", name: "New York Life" },
  peopletech: { id: "PEOPLE_TECH_GROUP_INC", name: "People Tech Group" },

  // Legacy/other companies (from previous config)
  uber: { id: "UBER_TECHNOLOGIES_INC", name: "Uber" },
  reddit: { id: "REDDIT_INC", name: "Reddit" },
  figma: { id: "FIGMA_INC", name: "Figma" },
  discord: { id: "DISCORD_INC", name: "Discord" },
  instacart: { id: "INSTACART_INC", name: "Instacart" },
  squarespace: { id: "SQUARESPACE_INC", name: "Squarespace" },
  anthropic: { id: "ANTHROPIC_INC", name: "Anthropic" },
};
