import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  scrapeAllCompanies,
  filterJobs,
  getTargetRoles,
  getExcludedKeywords,
  type Job,
} from "@/lib/scrapers";

const JOBS_FILE = path.join(process.cwd(), "data", "jobs.json");

interface JobsData {
  lastScraped: string;
  totalJobs: number;
  jobs: Job[];
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

    // Check if jobs file exists
    if (!fs.existsSync(JOBS_FILE)) {
      return NextResponse.json({
        lastScraped: null,
        totalJobs: 0,
        jobs: [],
        message: "No jobs scraped yet. POST to /api/jobs to trigger scraping.",
      });
    }

    const data: JobsData = JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
    let jobs = data.jobs;

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
      lastScraped: data.lastScraped,
      totalJobs: data.totalJobs,
      returnedJobs: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Error loading jobs:", error);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}

/**
 * POST /api/jobs - Trigger job scraping
 */
export async function POST() {
  try {
    console.log("Starting job scrape...");

    const { jobs, summary } = await scrapeAllCompanies();

    // Save to file
    const jobsData: JobsData = {
      lastScraped: summary.scrapedAt,
      totalJobs: jobs.length,
      jobs,
    };

    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    return NextResponse.json({
      success: true,
      summary,
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
