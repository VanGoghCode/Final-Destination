import { NextResponse } from "next/server";
import {
  scrapeAllCompanies,
} from "@/lib/scrapers";
import { 
  getJobs, 
  setJobs,
  type JobsData,
} from "@/lib/db";

/**
 * GET /api/jobs - Get all scraped jobs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "100");

    const jobsData = await getJobs();
    
    if (!jobsData) {
      return NextResponse.json({
        lastScraped: null,
        totalJobs: 0,
        jobs: [],
        message: "No jobs in database. Click 'Refresh Jobs' to trigger scraping.",
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

    // Save to Redis
    await setJobs(jobsData);

    console.log(`Saved ${recentJobs.length} jobs to Redis`);

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
