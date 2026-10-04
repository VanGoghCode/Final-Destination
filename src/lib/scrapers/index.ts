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
import { scrapeWorkday } from "./workday";
import {
  filterJobs,
  getTargetRoles,
  getExcludedKeywords,
  type Job,
  type ScrapeResult,
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
            c.platform && c.platform !== "custom" && (c.greenhouseId || c.leverId || c.ashbyId),
        );
        allCompanies.push(
          ...companiesWithPlatform.map((company) => ({
            ...company,
            tier: tier.replace("-tier", ""),
          })),
        );
      }
    } catch (error) {
      console.error(`Error loading ${tier}.json:`, error);
    }
  }

  return allCompanies;
}

/**
 * Expanded company entry (from validated JSON files)
 */
interface ExpandedCompany {
  token: string;
  id: string;
  name: string;
}

/**
 * Load expanded company lists from validated JSON files.
 * Falls back gracefully if files don't exist yet.
 */
function loadExpandedCompanies(): Record<string, ExpandedCompany[]> {
  const result: Record<string, ExpandedCompany[]> = {
    greenhouse: [],
    lever: [],
    ashby: [],
  };

  const files: { key: string; file: string }[] = [
    { key: "greenhouse", file: "greenhouse-expanded.json" },
    { key: "lever", file: "lever-expanded.json" },
    { key: "ashby", file: "ashby-expanded.json" },
  ];

  for (const { key, file } of files) {
    const filePath = path.join(process.cwd(), "data", file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Validate entries
          result[key] = parsed.filter(
            (c: unknown): c is ExpandedCompany =>
              typeof c === "object" &&
              c !== null &&
              typeof (c as ExpandedCompany).token === "string" &&
              typeof (c as ExpandedCompany).id === "string" &&
              typeof (c as ExpandedCompany).name === "string",
          );
          console.log(`  Loaded ${result[key].length} expanded ${key} companies from ${file}`);
        }
      }
    } catch (error) {
      console.error(`  Error loading expanded ${key} companies:`, error);
      // Graceful — non-fatal, just skip
    }
  }

  return result;
}

/**
 * Shuffle an array in place (Fisher-Yates)
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Scrape all configured companies from tier files and legacy sources
 */
export async function scrapeAllCompanies(): Promise<{ jobs: Job[]; summary: ScrapeSummary }> {
  const budget = Math.max(1, Number(process.env.SCRAPE_TIME_BUDGET_MS) || 45_000);
  const deadline = Date.now() + budget;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);
  const sources = {
    greenhouse: { scrape: scrapeGreenhouse, companies: GREENHOUSE_COMPANIES },
    lever: { scrape: scrapeLever, companies: LEVER_COMPANIES },
    ashby: { scrape: scrapeAshby, companies: ASHBY_COMPANIES },
  };
  type Platform = keyof typeof sources;
  type Candidate = { platform: Platform; token: string; id: string; name: string; tier?: string };
  const candidates = new Map<string, Candidate>();
  const add = (candidate: Candidate) => {
    const key = candidate.platform + ":" + candidate.token;
    if (!candidates.has(key)) candidates.set(key, candidate);
  };
  const jobs: Job[] = [],
    errors: string[] = [];
  const tierBreakdown = { top: 0, middle: 0, lower: 0, lowest: 0 };
  let companiesScraped = 0,
    companiesWithJobs = 0;
  try {
    for (const company of loadTierCompanies()) {
      const platform = company.platform as Platform;
      if (!sources[platform]) continue;
      const token =
        company.greenhouseId && platform === "greenhouse"
          ? company.greenhouseId
          : platform === "lever"
            ? company.leverId
            : company.ashbyId;
      if (token) add({ platform, token, id: company.id, name: company.name, tier: company.tier });
    }
    for (const platform of Object.keys(sources) as Platform[])
      for (const [token, company] of Object.entries(sources[platform].companies))
        add({ platform, token, ...company });
    const max = Math.max(0, Number(process.env.EXPANDED_SCRAPE_MAX ?? 200) || 0);
    if (max && Date.now() < deadline) {
      const expanded = loadExpandedCompanies();
      for (const platform of Object.keys(sources) as Platform[]) {
        let added = 0;
        for (const company of shuffleArray([...(expanded[platform] ?? [])])) {
          if (candidates.has(platform + ":" + company.token)) continue;
          add({ platform, ...company });
          if (++added >= max) break;
        }
      }
    }
    for (const company of candidates.values()) {
      if (controller.signal.aborted || Date.now() >= deadline) break;
      const result = await sources[company.platform].scrape(
        company.token,
        company.id,
        company.name,
        controller.signal,
      );
      companiesScraped++;
      if (result.success && result.jobs.length) {
        jobs.push(...result.jobs);
        companiesWithJobs++;
        if (company.tier && company.tier in tierBreakdown)
          tierBreakdown[company.tier as keyof typeof tierBreakdown]++;
      } else if (result.error && !result.error.includes("reachable"))
        errors.push(company.name + ": " + result.error);
      const remaining = deadline - Date.now();
      if (remaining > 0 && !controller.signal.aborted)
        await new Promise((resolve) => setTimeout(resolve, Math.min(150, remaining)));
    }
  } finally {
    clearTimeout(timer);
  }
  const filtered = filterJobs(jobs, getTargetRoles(), getExcludedKeywords());
  return {
    jobs: filtered,
    summary: {
      totalJobs: jobs.length,
      filteredJobs: filtered.length,
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
