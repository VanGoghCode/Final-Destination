// ========================================
// UNIFIED TYPES — Single source of truth
// Used by: config.ts, db.ts, storage.ts, scrapers
// ========================================

/** Company from DOL LCA data, stored in tier JSON files */
export interface Company {
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
  tier: "top" | "middle" | "lower" | "lowest" | "below50";
  careerUrls?: string[];
  careerUrl?: string;
  lastScraped?: string;
  // POC Contact Info
  pocFirstName?: string;
  pocLastName?: string;
  pocEmail?: string;
  pocPhone?: string;
}

/** Scraped job listing */
export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  url: string;
  description?: string;
  salary?: string;
  department?: string;
  postedAt?: string;
  discoveredAt?: string;
  scrapedAt: string;
  platform: "greenhouse" | "lever" | "workday" | "ashby" | "custom";
  status?: "new" | "viewed" | "applied" | "rejected";
}

/** Queued job for batch processing */
export interface QueuedJob {
  id: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails: string;
  includeCoverLetter: boolean;
  status:
    | "pending"
    | "researching"
    | "tailoring-resume"
    | "tailoring-cover-letter"
    | "completed"
    | "failed"
    | "cancelled";
  progress: number;
  error?: string;
  retryCount?: number;
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  companyWebsite?: string;
  companyResearch?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  resumeLatex?: string;
  coverLetterLatex?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** Template for resume/cover letter storage */
export interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/** User profile */
export interface Profile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  defaultResumeId: string | null;
  defaultCoverLetterId: string | null;
  color: string;
  avatarText?: string;
  createdAt: number;
  updatedAt: number;
}

/** Personal details */
export interface PersonalDetails {
  firstName: string;
  lastName: string;
}

/** Tier data container */
export interface TierData {
  generatedAt: string;
  count: number;
  tier: string;
  companies: Company[];
}
