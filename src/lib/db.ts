import { Redis } from "@upstash/redis";

// Types
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
  pocFirstName?: string;
  pocLastName?: string;
  pocEmail?: string;
  pocPhone?: string;
  careerUrls?: string[];
}

export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  url: string;
  postedAt?: string;
  scrapedAt: string;
  platform: string;
}

export interface CompaniesData {
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

export interface TierData {
  generatedAt: string;
  count: number;
  tier: string;
  companies: Company[];
}

export interface JobsData {
  lastScraped: string;
  totalJobs: number;
  jobs: Job[];
}

export interface QueuedJob {
  id: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails: string;
  status:
    | "pending"
    | "researching"
    | "tailoring-resume"
    | "tailoring-cover-letter"
    | "completed"
    | "failed"
    | "cancelled";
  progress: number; // 0-100
  error?: string;
  retryCount?: number;
  // Profile info
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  // Company website for research (separate from job posting URL)
  companyWebsite?: string;
  // Results
  companyResearch?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  // Timestamps
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

// Redis keys
const KEYS = {
  JOBS: "data:jobs",
  QUEUE: "data:queue",
  PROFILES: "data:profiles",
  TIER_TOP: "data:tier:top",
  TIER_MIDDLE: "data:tier:middle",
  TIER_LOWER: "data:tier:lower",
  TIER_LOWEST: "data:tier:lowest",
};

// Get user-specific key for queue and profiles
function getUserKey(baseKey: string, passcode?: string | null): string {
  if (passcode) {
    return `user:${passcode}:${baseKey}`;
  }
  return baseKey;
}

// Singleton Redis instance
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error(
      "Redis is not configured. Please set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.",
    );
  }

  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  return redisInstance;
}

// ============== TIER DATA ==============

const TIER_KEY_MAP: Record<string, string> = {
  top: KEYS.TIER_TOP,
  middle: KEYS.TIER_MIDDLE,
  lower: KEYS.TIER_LOWER,
  lowest: KEYS.TIER_LOWEST,
};

export async function getTierData(
  tier: "top" | "middle" | "lower" | "lowest",
): Promise<TierData | null> {
  const redis = getRedis();

  const key = TIER_KEY_MAP[tier];
  if (!key) return null;

  try {
    const data = await redis.get<TierData>(key);
    return data;
  } catch (error) {
    console.error(`Failed to get ${tier}-tier data from Redis:`, error);
    throw error;
  }
}

export async function setTierData(
  tier: "top" | "middle" | "lower" | "lowest",
  data: TierData,
): Promise<boolean> {
  const redis = getRedis();

  const key = TIER_KEY_MAP[tier];
  if (!key) return false;

  try {
    await redis.set(key, data);
    return true;
  } catch (error) {
    console.error(`Failed to save ${tier}-tier data to Redis:`, error);
    throw error;
  }
}

export async function getAllTierData(): Promise<
  Record<string, TierData | null>
> {
  const tiers = ["top", "middle", "lower", "lowest"] as const;
  const result: Record<string, TierData | null> = {};

  for (const tier of tiers) {
    result[tier] = await getTierData(tier);
  }

  return result;
}

export async function getCompanyFromTiers(
  companyId: string,
): Promise<{ company: Company; tier: string } | null> {
  const tiers = ["top", "middle", "lower", "lowest"] as const;

  for (const tier of tiers) {
    const data = await getTierData(tier);
    if (data) {
      const company = data.companies.find((c) => c.id === companyId);
      if (company) {
        return { company, tier };
      }
    }
  }

  return null;
}

export async function updateCompanyInTier(
  companyId: string,
  updates: Partial<Company>,
): Promise<{ company: Company; tier: string } | null> {
  const tiers = ["top", "middle", "lower", "lowest"] as const;

  for (const tier of tiers) {
    const data = await getTierData(tier);
    if (data) {
      const index = data.companies.findIndex((c) => c.id === companyId);
      if (index !== -1) {
        const existingCompany = data.companies[index];
        if (existingCompany) {
          const updatedCompany: Company = { ...existingCompany, ...updates };
          data.companies[index] = updatedCompany;
          await setTierData(tier, data);
          return { company: updatedCompany, tier };
        }
      }
    }
  }

  return null;
}

// ============== JOBS ==============

export async function getJobs(): Promise<JobsData | null> {
  const redis = getRedis();

  try {
    const data = await redis.get<JobsData>(KEYS.JOBS);
    return data;
  } catch (error) {
    console.error("Failed to get jobs from Redis:", error);
    throw error;
  }
}

export async function setJobs(data: JobsData): Promise<boolean> {
  const redis = getRedis();

  try {
    await redis.set(KEYS.JOBS, data);
    return true;
  } catch (error) {
    console.error("Failed to save jobs to Redis:", error);
    throw error;
  }
}

export async function addJobs(newJobs: Job[]): Promise<boolean> {
  const existing = await getJobs();
  const existingJobs = existing?.jobs || [];

  // Merge jobs, avoiding duplicates by ID
  const jobMap = new Map<string, Job>();
  for (const job of existingJobs) {
    jobMap.set(job.id, job);
  }
  for (const job of newJobs) {
    jobMap.set(job.id, job);
  }

  const mergedJobs = Array.from(jobMap.values());

  return setJobs({
    lastScraped: new Date().toISOString(),
    totalJobs: mergedJobs.length,
    jobs: mergedJobs,
  });
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const data = await getJobs();
  if (!data) return false;

  data.jobs = data.jobs.filter((j) => j.id !== jobId);
  data.totalJobs = data.jobs.length;

  return setJobs(data);
}

// ============== QUEUE ==============

export async function getQueue(passcode?: string | null): Promise<QueuedJob[]> {
  const redis = getRedis();
  try {
    const key = getUserKey(KEYS.QUEUE, passcode);
    const queue = await redis.get<QueuedJob[]>(key);
    return queue || [];
  } catch (error) {
    console.error("Failed to get queue from Redis:", error);
    return [];
  }
}

export async function setQueue(
  queue: QueuedJob[],
  passcode?: string | null,
): Promise<boolean> {
  const redis = getRedis();
  try {
    const key = getUserKey(KEYS.QUEUE, passcode);
    await redis.set(key, queue);
    return true;
  } catch (error) {
    console.error("Failed to save queue to Redis:", error);
    return false;
  }
}

export async function addJobToQueue(
  job: QueuedJob,
  passcode?: string | null,
): Promise<boolean> {
  const queue = await getQueue(passcode);
  // Check for duplicates
  if (queue.some((j) => j.id === job.id)) return false;

  queue.push(job);
  return setQueue(queue, passcode);
}

export async function updateJobInQueue(
  jobId: string,
  updates: Partial<QueuedJob>,
  passcode?: string | null,
): Promise<QueuedJob | null> {
  const queue = await getQueue(passcode);
  const index = queue.findIndex((j) => j.id === jobId);

  if (index === -1) return null;

  const updatedJob = { ...queue[index], ...updates } as QueuedJob;
  queue[index] = updatedJob;

  await setQueue(queue, passcode);
  return updatedJob;
}

export async function removeJobFromQueue(
  jobId: string,
  passcode?: string | null,
): Promise<boolean> {
  const queue = await getQueue(passcode);
  const newQueue = queue.filter((j) => j.id !== jobId);

  if (newQueue.length === queue.length) return false;

  return setQueue(newQueue, passcode);
}

// ============== PROFILES ==============

// We define a simple Profile interface here to avoid circular deps with storage.ts if needed,
// but for now we can treat them as 'any' or define a minimal interface.
// Ideally shared types should be in a separate file.
export interface SavedProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  color: string;
  avatarText?: string;
}

export async function getProfiles(
  passcode?: string | null,
): Promise<SavedProfile[]> {
  const redis = getRedis();
  try {
    const key = getUserKey(KEYS.PROFILES, passcode);
    const profiles = await redis.get<SavedProfile[]>(key);
    return profiles || [];
  } catch (error) {
    console.error("Failed to get profiles from Redis:", error);
    return [];
  }
}

export async function setProfiles(
  profiles: SavedProfile[],
  passcode?: string | null,
): Promise<boolean> {
  const redis = getRedis();
  try {
    const key = getUserKey(KEYS.PROFILES, passcode);
    await redis.set(key, profiles);
    return true;
  } catch (error) {
    console.error("Failed to save profiles to Redis:", error);
    return false;
  }
}

// ============== COMPANY CAREER URLS ==============

export async function getCompanyCareerUrls(
  companyId: string,
): Promise<string[]> {
  const result = await getCompanyFromTiers(companyId);
  if (!result) return [];
  return result.company.careerUrls || [];
}

export async function addCompanyCareerUrl(
  companyId: string,
  url: string,
): Promise<{ success: boolean; urls: string[] }> {
  const result = await getCompanyFromTiers(companyId);
  if (!result) {
    return { success: false, urls: [] };
  }

  const { company } = result;
  const currentUrls = company.careerUrls || [];

  // Don't add duplicates
  if (currentUrls.includes(url)) {
    return { success: true, urls: currentUrls };
  }

  const updatedUrls = [...currentUrls, url];
  const updated = await updateCompanyInTier(companyId, {
    careerUrls: updatedUrls,
  });

  return {
    success: updated !== null,
    urls: updated?.company.careerUrls || currentUrls,
  };
}

export async function removeCompanyCareerUrl(
  companyId: string,
  url: string,
): Promise<{ success: boolean; urls: string[] }> {
  const result = await getCompanyFromTiers(companyId);
  if (!result) {
    return { success: false, urls: [] };
  }

  const { company } = result;
  const currentUrls = company.careerUrls || [];
  const updatedUrls = currentUrls.filter((u) => u !== url);

  const updated = await updateCompanyInTier(companyId, {
    careerUrls: updatedUrls,
  });

  return {
    success: updated !== null,
    urls: updated?.company.careerUrls || currentUrls,
  };
}

export async function setCompanyCareerUrls(
  companyId: string,
  urls: string[],
): Promise<{ success: boolean; urls: string[] }> {
  const updated = await updateCompanyInTier(companyId, { careerUrls: urls });

  return {
    success: updated !== null,
    urls: updated?.company.careerUrls || [],
  };
}

// ============== UTILITY FUNCTIONS ==============

export function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Bulk operations for seeding
export async function seedAllData(data: {
  tiers?: {
    top?: TierData;
    middle?: TierData;
    lower?: TierData;
    lowest?: TierData;
  };
  jobs?: JobsData;
}): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (data.tiers) {
    for (const [tier, tierData] of Object.entries(data.tiers)) {
      if (tierData) {
        const success = await setTierData(
          tier as "top" | "middle" | "lower" | "lowest",
          tierData,
        );
        if (!success) errors.push(`Failed to seed ${tier}-tier`);
      }
    }
  }

  if (data.jobs) {
    const success = await setJobs(data.jobs);
    if (!success) errors.push("Failed to seed jobs");
  }

  return { success: errors.length === 0, errors };
}

// Clear all data (use with caution!)
export async function clearAllData(): Promise<boolean> {
  const redis = getRedis();

  try {
    const keys = [
      KEYS.JOBS,
      KEYS.TIER_TOP,
      KEYS.TIER_MIDDLE,
      KEYS.TIER_LOWER,
      KEYS.TIER_LOWEST,
    ];

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return true;
  } catch (error) {
    console.error("Failed to clear all data:", error);
    throw error;
  }
}

// Clean up unused Redis keys
export async function cleanupUnusedKeys(): Promise<{
  deleted: string[];
  errors: string[];
}> {
  const redis = getRedis();
  const deleted: string[] = [];
  const errors: string[] = [];

  try {
    // Delete old company-links:* keys
    const customLinkKeys = await redis.keys("company-links:*");
    for (const key of customLinkKeys) {
      try {
        await redis.del(key);
        deleted.push(key);
      } catch (e) {
        errors.push(`Failed to delete ${key}`);
      }
    }

    // Delete empty data:companies key
    try {
      await redis.del("data:companies");
      deleted.push("data:companies");
    } catch (e) {
      errors.push("Failed to delete data:companies");
    }

    return { deleted, errors };
  } catch (error) {
    console.error("Failed to cleanup unused keys:", error);
    throw error;
  }
}

// Get stats about stored data
export async function getDataStats(): Promise<{
  hasJobs: boolean;
  hasTiers: Record<string, boolean>;
  tierCounts: Record<string, number>;
  jobsCount: number;
  totalCompanies: number;
}> {
  const jobs = await getJobs();

  const tiers = ["top", "middle", "lower", "lowest"] as const;
  const hasTiers: Record<string, boolean> = {};
  const tierCounts: Record<string, number> = {};
  let totalCompanies = 0;

  for (const tier of tiers) {
    const tierData = await getTierData(tier);
    hasTiers[tier] = tierData !== null;
    tierCounts[tier] = tierData?.count || 0;
    totalCompanies += tierCounts[tier];
  }

  return {
    hasJobs: jobs !== null,
    hasTiers,
    tierCounts,
    jobsCount: jobs?.totalJobs || 0,
    totalCompanies,
  };
}
