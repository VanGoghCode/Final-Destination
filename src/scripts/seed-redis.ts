/**
 * Script to seed Redis with data from local JSON files.
 * Run with: npx tsx src/scripts/seed-redis.ts
 */

import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, ""); // Remove quotes if present
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

// Types (duplicated to avoid import issues in standalone script)
interface Company {
  id: string;
  name: string;
  city: string;
  state: string;
  lcaCount: number;
  lcaQ1: number;
  lcaQ2: number;
  lcaQ3: number;
  lcaQ4: number;
  approvalRate: number;
  priorityScore: number;
  tier: string;
  pocFirstName?: string;
  pocLastName?: string;
  pocEmail?: string;
  pocPhone?: string;
  careerUrls?: string[];
}

interface CompaniesData {
  generatedAt: string;
  totalCompanies: number;
  tierCounts: {
    top: number;
    middle: number;
    lower: number;
    lowest: number;
    below50: number;
  };
  companies: Company[];
}

interface TierData {
  generatedAt: string;
  count: number;
  tier: string;
  companies: Company[];
}

interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  url: string;
  postedAt: string;
  scrapedAt: string;
  platform: string;
}

interface JobsData {
  lastScraped: string;
  totalJobs: number;
  jobs: Job[];
}

// Redis keys
const KEYS = {
  COMPANIES: "data:companies",
  JOBS: "data:jobs",
  TIER_TOP: "data:tier:top",
  TIER_MIDDLE: "data:tier:middle",
  TIER_LOWER: "data:tier:lower",
  TIER_LOWEST: "data:tier:lowest",
};

async function main() {
  // Check environment variables
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error(
      "Error: KV_REST_API_URL and KV_REST_API_TOKEN environment variables are required",
    );

    process.exit(1);
  }

  const redis = new Redis({ url, token });
  const dataDir = path.join(process.cwd(), "data");

  // Seed companies.json
  const companiesPath = path.join(dataDir, "companies.json");
  if (fs.existsSync(companiesPath)) {
    const companies: CompaniesData = JSON.parse(
      fs.readFileSync(companiesPath, "utf-8"),
    );
    try {
      await redis.set(KEYS.COMPANIES, companies);
    } catch (error) {
      console.error(
        `   ❌ Failed to seed companies:`,
        error instanceof Error ? error.message : error,
      );
    }
  } else {
  }

  // Seed tier files
  const tierFiles = [
    { file: "top-tier.json", key: KEYS.TIER_TOP, name: "top-tier" },
    { file: "middle-tier.json", key: KEYS.TIER_MIDDLE, name: "middle-tier" },
    { file: "lower-tier.json", key: KEYS.TIER_LOWER, name: "lower-tier" },
    { file: "lowest-tier.json", key: KEYS.TIER_LOWEST, name: "lowest-tier" },
  ];

  await Promise.all(
    tierFiles.map(async ({ file, key, name }) => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        const tierData: TierData = JSON.parse(
          fs.readFileSync(filePath, "utf-8"),
        );

        try {
          await redis.set(key, tierData);
        } catch (error) {
          console.error(
            `   ❌ Failed to seed ${name}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }),
  );

  // Seed jobs.json
  const jobsPath = path.join(dataDir, "jobs.json");
  if (fs.existsSync(jobsPath)) {
    const jobs: JobsData = JSON.parse(fs.readFileSync(jobsPath, "utf-8"));
    try {
      await redis.set(KEYS.JOBS, jobs);
    } catch (error) {
      console.error(
        `   ❌ Failed to seed jobs:`,
        error instanceof Error ? error.message : error,
      );
    }
  } else {
  }
}

main().catch(console.error);
