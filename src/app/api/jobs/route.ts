import { NextResponse } from "next/server";
import { google } from "googleapis";
import {
  scrapeAllCompanies,
  filterJobs,
  getTargetRoles,
  getExcludedKeywords,
  type Job,
} from "@/lib/scrapers";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";
const JOBS_SHEET_NAME = "jobs";

interface JobsData {
  lastScraped: string;
  totalJobs: number;
  jobs: Job[];
  summary?: any;
}

function getGoogleAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  throw new Error("No Google credentials configured");
}

// Convert Job object to row array
function jobToRow(job: Job): string[] {
  return [
    job.id,
    job.companyName,
    job.companyId,
    job.title,
    job.location,
    job.url,
    job.postedAt || "",
    job.department || "",
    job.scrapedAt,
    job.platform,
  ];
}

// Convert row array to Job object
function rowToJob(row: string[]): Job {
  return {
    id: row[0] || "",
    companyName: row[1] || "",
    companyId: row[2] || "",
    title: row[3] || "",
    location: row[4] || "",
    url: row[5] || "",
    postedAt: row[6] || undefined,
    department: row[7] || undefined,
    scrapedAt: row[8] || "",
    platform: (row[9] as Job["platform"]) || "custom",
  };
}

/**
 * GET /api/jobs - Get all scraped jobs from Google Sheets
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "100");

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Read metadata from first row (A1 = lastScraped timestamp)
    const metaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${JOBS_SHEET_NAME}!A1:B1`,
    });

    const metaRow = metaResponse.data.values?.[0];
    const lastScraped = metaRow?.[0] || null;
    const totalJobs = parseInt(metaRow?.[1] || "0");

    if (!lastScraped) {
      return NextResponse.json({
        lastScraped: null,
        totalJobs: 0,
        jobs: [],
        message: "No jobs scraped yet. POST to /api/jobs to trigger scraping.",
      });
    }

    // Read job data starting from row 3 (row 2 is headers)
    const jobsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${JOBS_SHEET_NAME}!A3:J`,
    });

    const rows = jobsResponse.data.values || [];
    let jobs: Job[] = rows.map(rowToJob);

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
      lastScraped,
      totalJobs,
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
 * POST /api/jobs - Trigger job scraping and save to Google Sheets
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

    // Save to Google Sheets
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Clear existing data (but keep sheet structure)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${JOBS_SHEET_NAME}!A1:J`,
    });

    // Prepare all data: metadata row, header row, then job rows
    const allRows = [
      // Row 1: Metadata (lastScraped, totalJobs)
      [summary.scrapedAt, recentJobs.length.toString()],
      // Row 2: Headers
      ["id", "companyName", "companyId", "title", "location", "url", "postedAt", "department", "scrapedAt", "platform"],
      // Row 3+: Job data
      ...recentJobs.map(jobToRow),
    ];

    // Write all data at once
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${JOBS_SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: allRows,
      },
    });

    console.log(`Saved ${recentJobs.length} jobs to Google Sheets`);

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
