import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  scrapeAllCompanies,
  type Job,
} from "@/lib/scrapers";

const JOBS_FILE_PATH = path.join(process.cwd(), "data", "jobs.json");
const REDIS_JOBS_KEY = "scraped_jobs";

// Check if running in production (Vercel)
const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

interface JobsData {
  lastScraped: string;
  totalJobs: number;
  jobs: Job[];
}

// Dynamic import for Redis (only used in production)
async function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

// Read jobs from storage (Redis in production, local file in development)
async function readJobsData(): Promise<JobsData | null> {
  if (isProduction) {
    const redis = await getRedis();
    if (redis) {
      const data = await redis.get<JobsData>(REDIS_JOBS_KEY);
      return data;
    }
  }
  
  // Local development: read from JSON file
  try {
    const fileContent = await fs.readFile(JOBS_FILE_PATH, "utf-8");
    return JSON.parse(fileContent);
  } catch {
    return null;
  }
}

// Write jobs to storage (Redis in production, local file in development)
async function writeJobsData(data: JobsData): Promise<void> {
  if (isProduction) {
    const redis = await getRedis();
    if (redis) {
      await redis.set(REDIS_JOBS_KEY, data);
      return;
    }
  }
  
  // Local development: write to JSON file
  await fs.writeFile(JOBS_FILE_PATH, JSON.stringify(data, null, 2));
}

/**
 * GET /api/jobs - Get all scraped jobs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Read from storage (Redis in production, local file in development)
    const jobsData = await readJobsData();
    
    if (!jobsData) {
      return NextResponse.json({
        lastScraped: null,
        totalJobs: 0,
        jobs: [],
        message: "No jobs scraped yet. Click 'Refresh Jobs' to trigger scraping.",
      });
    }

    let jobs = jobsData.jobs || [];

    // Filter by company if specified
    if (company) {
      jobs = jobs.filter((j) =>
        j.companyName.toLowerCase().includes(company.toLowerCase()),
      );
    }

    // Filter by location if specified
    if (location) {
      jobs = jobs.filter((j) =>
        j.location.toLowerCase().includes(location.toLowerCase()),
      );
    }

    // Apply limit
    jobs = jobs.slice(0, limit);

    return NextResponse.json({
      lastScraped: jobsData.lastScraped,
      totalJobs: jobsData.totalJobs,
      returnedJobs: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Error loading jobs:", error);
    return NextResponse.json(
      { error: "Failed to load jobs", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs - Trigger job scraping and save
 */
export async function POST() {
  try {
    console.log("Starting job scrape...");

    const { jobs: scrapedJobs, summary } = await scrapeAllCompanies();

    // Filter for last 10 days
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const recentJobs = scrapedJobs.filter((job) => {
      if (!job.postedAt) return true; // Keep unknown dates
      const jobDate = new Date(job.postedAt);
      return jobDate >= tenDaysAgo;
    });

    // Update summary with filtered count
    const removedCount = scrapedJobs.length - recentJobs.length;
    console.log(`Removed ${removedCount} jobs older than 10 days`);

    // Prepare data to save
    const jobsData: JobsData = {
      lastScraped: summary.scrapedAt,
      totalJobs: recentJobs.length,
      jobs: recentJobs,
    };

    // Save to storage (Redis in production, local file in development)
    await writeJobsData(jobsData);

    console.log(`Saved ${recentJobs.length} jobs (${isProduction ? 'Redis' : 'local file'})`);

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        totalJobs: scrapedJobs.length,
        retainedJobs: recentJobs.length,
        filteredOldJobs: removedCount,
      },
      message: `Scraped ${summary.filteredJobs} matching jobs from ${summary.companiesScraped} companies`,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Scraping failed",
      },
      { status: 500 },
    );
  }
}
