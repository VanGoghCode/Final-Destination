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
  platform: "greenhouse" | "lever" | "workday" | "custom";
}

/**
 * Career URL configuration for a company
 */
export interface CareerConfig {
  id: string;
  name: string;
  careerUrl: string;
  platform: "greenhouse" | "lever" | "workday" | "custom";
  greenhouseId: string | null;
  leverId: string | null;
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
 */
export function getTargetRoles(): string[] {
  const envRoles = process.env.TARGET_ROLES;
  if (envRoles) {
    return envRoles.split(",").map((r) => r.trim());
  }
  return [
    "software engineer",
    "software developer",
    "data scientist",
    "data engineer",
    "ml engineer",
    "machine learning",
    "backend engineer",
    "frontend engineer",
    "full stack",
    "devops",
    "sre",
    "platform engineer",
  ];
}

/**
 * Get excluded keywords from env or defaults
 */
export function getExcludedKeywords(): string[] {
  const envExcluded = process.env.EXCLUDED_KEYWORDS;
  if (envExcluded) {
    return envExcluded.split(",").map((k) => k.trim());
  }
  return [
    "senior director",
    "vp",
    "vice president",
    "chief",
    "head of",
    "principal",
    "staff",
    "intern",
    "internship",
  ];
}
