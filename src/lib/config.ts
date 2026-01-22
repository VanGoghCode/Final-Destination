// Centralized config - all values from .env.local
export const config = {
  // Scraping
  chunkSize: parseInt(process.env.CHUNK_SIZE || "200"),
  topChunkSize: parseInt(process.env.TOP_CHUNK_SIZE || "20"),
  regularChunkSize: parseInt(process.env.REGULAR_CHUNK_SIZE || "180"),
  scrapeIntervalMinutes: parseInt(process.env.SCRAPE_INTERVAL_MINUTES || "30"),

  // Job Matching
  targetRoles: (
    process.env.TARGET_ROLES ||
    "software engineer,data scientist,ml engineer,ai engineer,cloud engineer,solutions architect,cloud architect,devops,sre,aws"
  )
    .split(",")
    .map((r) => r.trim().toLowerCase()),
  excludedKeywords: (
    process.env.EXCLUDED_KEYWORDS ||
    "senior director,vp,vice president,principal,staff,15+ years"
  )
    .split(",")
    .map((k) => k.trim().toLowerCase()),

  // Notifications
  notificationEmail: process.env.NOTIFICATION_EMAIL || "",

  // AWS
  awsRegion: process.env.AWS_REGION || "us-west-2",

  // Google Sheets
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || "",
};

// Company type definitions
export interface Company {
  id: string;
  name: string;
  city: string;
  state: string;
  lcaCount: number;
  lcaQ1?: number;
  lcaQ2?: number;
  lcaQ3?: number;
  lcaQ4?: number;
  approvalRate: number;
  priorityScore: number;
  tier: "top" | "middle" | "lower" | "lowest" | "below50";
  careerUrl?: string;
  lastScraped?: string;
  // POC Contact Info
  pocFirstName?: string;
  pocLastName?: string;
  pocEmail?: string;
  pocPhone?: string;
}

// Job type definitions
export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  url: string;
  description?: string;
  salary?: string;
  postedAt?: string;
  discoveredAt: string;
  status: "new" | "viewed" | "applied" | "rejected";
}
