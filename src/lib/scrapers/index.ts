/**
 * Unified Scraper Interface
 * Exports all scrapers and provides a unified scraping function
 */

export * from "./types";
export * from "./greenhouse";
export * from "./lever";
export * from "./workday";

import { scrapeGreenhouse, GREENHOUSE_COMPANIES } from "./greenhouse";
import { scrapeLever, LEVER_COMPANIES } from "./lever";
import { scrapeAshby, ASHBY_COMPANIES } from "./ashby";
import { scrapeWorkday, WORKDAY_COMPANIES } from "./workday";
import {
  filterJobs,
  getTargetRoles,
  getExcludedKeywords,
  type Job,
  type ScrapeResult,
  type CareerConfig,
} from "./types";
import fs from "fs";
import path from "path";

export interface ScrapeSummary {
  totalJobs: number;
  filteredJobs: number;
  companiesScraped: number;
  companiesWithJobs: number;
  errors: string[];
  scrapedAt: string;
  tierBreakdown: {
    top: number;
    middle: number;
    lower: number;
    lowest: number;
  };
}

interface TierCompany {
  id: string;
  name: string;
  platform?: string;
  greenhouseId?: string | null;
  leverId?: string | null;
  ashbyId?: string | null;
  tier: string;
}

interface TierData {
  companies: TierCompany[];
}

/**
 * Load companies from all tier JSON files
 */
function loadTierCompanies(): TierCompany[] {
  const tiers = ["top-tier", "middle-tier", "lower-tier", "lowest-tier"];
  const allCompanies: TierCompany[] = [];

  for (const tier of tiers) {
    try {
      const tierPath = path.join(process.cwd(), "data", `${tier}.json`);
      if (fs.existsSync(tierPath)) {
        const data: TierData = JSON.parse(fs.readFileSync(tierPath, "utf-8"));
        // Only include companies with valid platform data
        const companiesWithPlatform = data.companies.filter(
          (c) =>
            c.platform &&
            c.platform !== "custom" &&
            (c.greenhouseId || c.leverId || c.ashbyId),
        );
        allCompanies.push(...companiesWithPlatform);
      }
    } catch (error) {
      console.error(`Error loading ${tier}.json:`, error);
    }
  }

  return allCompanies;
}

/**
 * Scrape all configured companies from tier files and legacy sources
 */
export async function scrapeAllCompanies(): Promise<{
  jobs: Job[];
  summary: ScrapeSummary;
}> {
  const allJobs: Job[] = [];
  const errors: string[] = [];
  let companiesScraped = 0;
  let companiesWithJobs = 0;
  const tierBreakdown = { top: 0, middle: 0, lower: 0, lowest: 0 };
  const scrapedTokens = new Set<string>();

  // Helper to run a scrape and collect results
  const runScrape = async (
    result: ScrapeResult,
    name: string,
    tier?: string,
  ) => {
    companiesScraped++;
    if (result.success) {
      if (result.jobs.length > 0) {
        allJobs.push(...result.jobs);
        companiesWithJobs++;
        if (tier && tier in tierBreakdown) {
          tierBreakdown[tier as keyof typeof tierBreakdown]++;
        }
      }
    } else if (result.error && !result.error.includes("reachable")) {
      errors.push(`${name}: ${result.error}`);
    }
  };

  // 1. Load and scrape from tier JSON files (Primary Source)
  console.log("Loading companies from tier files...");
  const tierCompanies = loadTierCompanies();
  console.log(`Found ${tierCompanies.length} companies with platform data`);

  for (const company of tierCompanies) {
    let result: ScrapeResult | null = null;
    let token: string | null = null;

    if (company.platform === "greenhouse" && company.greenhouseId) {
      token = company.greenhouseId;
      if (!scrapedTokens.has(`gh-${token}`)) {
        scrapedTokens.add(`gh-${token}`);
        result = await scrapeGreenhouse(token, company.id, company.name);
      }
    } else if (company.platform === "lever" && company.leverId) {
      token = company.leverId;
      if (!scrapedTokens.has(`lever-${token}`)) {
        scrapedTokens.add(`lever-${token}`);
        result = await scrapeLever(token, company.id, company.name);
      }
    } else if (company.platform === "ashby" && company.ashbyId) {
      token = company.ashbyId;
      if (!scrapedTokens.has(`ashby-${token}`)) {
        scrapedTokens.add(`ashby-${token}`);
        result = await scrapeAshby(token, company.id, company.name);
      }
    }

    if (result) {
      await runScrape(result, company.name, company.tier);
      // Rate limiting
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 2. Scrape additional Greenhouse companies from hardcoded list
  for (const [token, company] of Object.entries(GREENHOUSE_COMPANIES)) {
    if (!scrapedTokens.has(`gh-${token}`)) {
      scrapedTokens.add(`gh-${token}`);
      const result = await scrapeGreenhouse(token, company.id, company.name);
      await runScrape(result, company.name);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 3. Scrape additional Lever companies from hardcoded list
  for (const [lever, company] of Object.entries(LEVER_COMPANIES)) {
    if (!scrapedTokens.has(`lever-${lever}`)) {
      scrapedTokens.add(`lever-${lever}`);
      const result = await scrapeLever(lever, company.id, company.name);
      await runScrape(result, company.name);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 4. Scrape Ashby companies from hardcoded list
  for (const [org, company] of Object.entries(ASHBY_COMPANIES)) {
    if (!scrapedTokens.has(`ashby-${org}`)) {
      scrapedTokens.add(`ashby-${org}`);
      const result = await scrapeAshby(org, company.id, company.name);
      await runScrape(result, company.name);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Filter jobs based on target roles
  const targetRoles = getTargetRoles();
  const excludedKeywords = getExcludedKeywords();
  const filteredJobs = filterJobs(allJobs, targetRoles, excludedKeywords);

  console.log(`\nScraping complete:`);
  console.log(`  Companies scraped: ${companiesScraped}`);
  console.log(`  Companies with jobs: ${companiesWithJobs}`);
  console.log(`  Total jobs found: ${allJobs.length}`);
  console.log(`  Jobs after filtering: ${filteredJobs.length}`);

  return {
    jobs: filteredJobs,
    summary: {
      totalJobs: allJobs.length,
      filteredJobs: filteredJobs.length,
      companiesScraped,
      companiesWithJobs,
      errors,
      scrapedAt: new Date().toISOString(),
      tierBreakdown,
    },
  };
}

/**
 * Scrape a single company by platform
 */
export async function scrapeCompany(
  platform: "greenhouse" | "lever" | "ashby" | "workday",
  token: string,
  companyId: string,
  companyName: string,
): Promise<ScrapeResult> {
  switch (platform) {
    case "greenhouse":
      return scrapeGreenhouse(token, companyId, companyName);
    case "lever":
      return scrapeLever(token, companyId, companyName);
    case "ashby":
      return scrapeAshby(token, companyId, companyName);
    case "workday":
      return scrapeWorkday(token, companyId, companyName);
    default:
      return {
        success: false,
        jobs: [],
        error: `Unsupported platform: ${platform}`,
      };
  }
}
