/**
 * Unified Scraper Interface
 * Exports all scrapers and provides a unified scraping function
 */

export * from "./types";
export * from "./greenhouse";
export * from "./lever";

import { scrapeGreenhouse, GREENHOUSE_COMPANIES } from "./greenhouse";
import { scrapeLever, LEVER_COMPANIES } from "./lever";
import {
  filterJobs,
  getTargetRoles,
  getExcludedKeywords,
  type Job,
  type ScrapeResult,
} from "./types";

export interface ScrapeSummary {
  totalJobs: number;
  filteredJobs: number;
  companiesScraped: number;
  errors: string[];
  scrapedAt: string;
}

/**
 * Scrape all configured companies
 */
export async function scrapeAllCompanies(): Promise<{
  jobs: Job[];
  summary: ScrapeSummary;
}> {
  const allJobs: Job[] = [];
  const errors: string[] = [];
  let companiesScraped = 0;

  // Scrape Greenhouse companies
  for (const [token, company] of Object.entries(GREENHOUSE_COMPANIES)) {
    const result = await scrapeGreenhouse(token, company.id, company.name);
    if (result.success) {
      allJobs.push(...result.jobs);
      companiesScraped++;
    } else if (result.error) {
      errors.push(`${company.name}: ${result.error}`);
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  // Scrape Lever companies
  for (const [lever, company] of Object.entries(LEVER_COMPANIES)) {
    const result = await scrapeLever(lever, company.id, company.name);
    if (result.success) {
      allJobs.push(...result.jobs);
      companiesScraped++;
    } else if (result.error) {
      errors.push(`${company.name}: ${result.error}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Filter jobs based on target roles
  const targetRoles = getTargetRoles();
  const excludedKeywords = getExcludedKeywords();
  const filteredJobs = filterJobs(allJobs, targetRoles, excludedKeywords);

  return {
    jobs: filteredJobs,
    summary: {
      totalJobs: allJobs.length,
      filteredJobs: filteredJobs.length,
      companiesScraped,
      errors,
      scrapedAt: new Date().toISOString(),
    },
  };
}

/**
 * Scrape a single company by platform
 */
export async function scrapeCompany(
  platform: "greenhouse" | "lever",
  token: string,
  companyId: string,
  companyName: string,
): Promise<ScrapeResult> {
  switch (platform) {
    case "greenhouse":
      return scrapeGreenhouse(token, companyId, companyName);
    case "lever":
      return scrapeLever(token, companyId, companyName);
    default:
      return {
        success: false,
        jobs: [],
        error: `Unsupported platform: ${platform}`,
      };
  }
}
