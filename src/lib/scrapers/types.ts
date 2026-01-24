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
export function filterJobs(
  jobs: Job[],
  targetRoles: string[],
  excludedKeywords: string[],
): Job[] {
  return jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();

    // Check if title matches any target role
    const matchesRole = targetRoles.some((role) =>
      titleLower.includes(role.toLowerCase()),
    );

    // Check if title contains excluded keywords
    const hasExcluded = excludedKeywords.some((keyword) =>
      titleLower.includes(keyword.toLowerCase()),
    );

    return matchesRole && !hasExcluded;
  });
}

/**
 * Get target roles from env or defaults
 * Broadened for: Software Engineer, Cloud, DevOps, Platform, AI/ML roles
 */
export function getTargetRoles(): string[] {
  const envRoles = process.env.TARGET_ROLES;
  if (envRoles) {
    return envRoles.split(",").map((r) => r.trim());
  }
  return [
    // Core Software Engineering
    "software engineer",
    "software developer",
    "engineer",
    "developer",
    "sde",
    "swe",

    // Backend & Systems
    "backend",
    "systems engineer",
    "infrastructure",
    "platform engineer",

    // Cloud & DevOps
    "cloud engineer",
    "cloud architect",
    "solutions architect",
    "devops",
    "sre",
    "site reliability",
    "devsecops",

    // AI/ML
    "machine learning",
    "ml engineer",
    "ai engineer",
    "data scientist",
    "data engineer",
    "genai",

    // Full Stack & Frontend
    "full stack",
    "fullstack",
    "frontend",
    "front end",

    // Specialized
    "golang",
    "python",
    "typescript",
    "node.js",
    "aws",
    "gcp",
    "azure",
    "terraform",
    "kubernetes",
  ];
}

/**
 * Get excluded keywords from env or defaults
 * Excluding: Leadership/Exec roles, Interns (too junior)
 */
export function getExcludedKeywords(): string[] {
  const envExcluded = process.env.EXCLUDED_KEYWORDS;
  if (envExcluded) {
    return envExcluded.split(",").map((k) => k.trim());
  }
  return [
    // Executive/Leadership (too senior)
    "senior director",
    "director",
    "vp",
    "vice president",
    "chief",
    "head of",
    "cto",
    "cio",

    // Non-technical
    "recruiter",
    "hr ",
    "sales",
    "marketing",
    "customer success",
  ];
}
