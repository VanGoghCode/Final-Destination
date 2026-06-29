/**
 * Job interface for scraped jobs
 */
export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  department?: string;
  url: string;
  postedAt?: string;
  scrapedAt: string;
  platform: "greenhouse" | "lever" | "workday" | "ashby" | "custom";
}

/**
 * Career URL configuration for a company
 */
export interface CareerConfig {
  id: string;
  name: string;
  careerUrl: string;
  platform: "greenhouse" | "lever" | "workday" | "ashby" | "custom";
  greenhouseId: string | null;
  leverId: string | null;
  ashbyId: string | null;
}

/**
 * Scraper result
 */
export interface ScrapeResult {
  success: boolean;
  jobs: Job[];
  error?: string;
}

/**
 * Filter jobs based on target roles and excluded keywords
 */
export function filterJobs(jobs: Job[], targetRoles: string[], excludedKeywords: string[]): Job[] {
  return jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();

    // Check if title matches any target role
    const matchesRole = targetRoles.some((role) => titleLower.includes(role.toLowerCase()));

    // Check if title contains excluded keywords
    const hasExcluded = excludedKeywords.some((keyword) =>
      titleLower.includes(keyword.toLowerCase()),
    );

    return matchesRole && !hasExcluded;
  });
}

/**
 * Get target roles from env or defaults
 * Curated for: AI/Cloud/Infra engineer profile — MS IT grad, 4+ yrs experience,
 * AI orchestration thesis, full-stack to infra ownership.
 */
export function getTargetRoles(): string[] {
  const envRoles = process.env.TARGET_ROLES;
  if (envRoles) {
    return envRoles.split(",").map((r) => r.trim());
  }
  return [
    // === AI / ML (primary target — matches his thesis) ===
    "ai engineer",
    "ai infrastructure",
    "ai platform",
    "ai orchestration",
    "ai agent",
    "ai product",
    "ai software",
    "ai systems",
    "ai developer",
    "ai full stack",
    "ai backend",
    "machine learning engineer",
    "ml engineer",
    "ml infrastructure",
    "ml platform",
    "ml ops",
    "mlops",
    "llm",
    "llm engineer",
    "llm ops",
    "genai",
    "generative ai",
    "rag",
    "prompt engineer",
    "model serving",
    "inference",
    "ai reliability",
    "ai evaluation",
    "agent engineer",
    "agentic",

    // === AI-Adjacent SWE (current market pattern: "AI x SWE") ===
    "ai software engineer",
    "ai platform engineer",
    "ai infrastructure engineer",
    "ai systems engineer",
    "ai full stack engineer",
    "ai ml engineer",

    // === Cloud & Infrastructure ===
    "cloud engineer",
    "cloud architect",
    "solutions architect",
    "solutions engineer",
    "infrastructure",
    "platform engineer",
    "devops",
    "sre",
    "site reliability",

    // === Software Engineering (with AI/cloud angle) ===
    "software engineer",
    "sde",
    "swe",
    "full stack",
    "fullstack",
    "backend",

    // === Specialized tech matches (catches roles listing these as primary) ===
    "terraform",
    "kubernetes",
    "aws",
    "gcp",
    "python",
    "typescript",
    "node.js",
    "react",
    "next.js",
  ];
}

/**
 * Get excluded keywords from env or defaults
 * Excluding: internships, junior roles, exec/management, non-technical,
 * and data-science-only (pure stats/analytics, not ML engineering).
 */
export function getExcludedKeywords(): string[] {
  const envExcluded = process.env.EXCLUDED_KEYWORDS;
  if (envExcluded) {
    return envExcluded.split(",").map((k) => k.trim());
  }
  return [
    // Too senior (beyond IC/contributor level)
    "principal",

    // Executive/Leadership (too senior or management-only)
    "senior director",
    "director of",
    "vp ",
    "vice president",
    "chief",
    "head of",
    "cto",
    "cio",

    // Management-only (not IC)
    "engineering manager",
    "program manager",
    "product manager",

    // Non-technical
    "recruiter",
    "hr ",
    "sales",
    "marketing",
    "customer success",
    "technical writer",
    "account executive",
    "account manager",

    // Not a fit — pure analytic/domain mismatch
    "data analyst",
    "business analyst",
    "embedded",
    "hardware",
    "firmware",
  ];
}
