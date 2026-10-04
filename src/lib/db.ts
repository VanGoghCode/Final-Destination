import { Redis } from "@upstash/redis";
import { AsyncLocalStorage } from "node:async_hooks";
import { resetJob, isClaimable, isActiveJob } from "./queue";
export { resetJob } from "./queue";

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
  inputHash?: string;
  runId?: string;
  leaseExpiresAt?: number;
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
  resumeLatex?: string;
  coverLetterLatex?: string;
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

// Singleton Redis instance
let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error(
      "Redis is not configured. Please set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.",
    );
  }

  redisInstance = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  return redisInstance;
}

// For testing purposes only
export function setRedisInstance(redis: Redis | null) {
  redisInstance = redis;
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
  const key = TIER_KEY_MAP[tier];
  return key ? getRedis().get<TierData>(key) : null;
}

export async function setTierData(
  tier: "top" | "middle" | "lower" | "lowest",
  data: TierData,
): Promise<boolean> {
  const key = TIER_KEY_MAP[tier];
  if (!key) return false;
  await getRedis().set(key, data);
  return true;
}

export async function getAllTierData(): Promise<Record<string, TierData | null>> {
  const tiers = Object.keys(TIER_KEY_MAP);
  const results = await getRedis().mget<Array<TierData | null>>(...Object.values(TIER_KEY_MAP));
  return Object.fromEntries(tiers.map((tier, index) => [tier, results[index] ?? null]));
}

export async function getCompanyFromTiers(
  companyId: string,
): Promise<{ company: Company; tier: string } | null> {
  for (const [tier, data] of Object.entries(await getAllTierData())) {
    const company = data?.companies.find((c) => c.id === companyId);
    if (company) return { company, tier };
  }

  return null;
}

export async function updateCompanyInTier(
  companyId: string,
  updates: Partial<Company>,
): Promise<{ company: Company; tier: string } | null> {
  for (const [tier, data] of Object.entries(await getAllTierData())) {
    const index = data?.companies.findIndex((c) => c.id === companyId) ?? -1;
    if (!data || index < 0) continue;
    const company = { ...data.companies[index]!, ...updates };
    data.companies[index] = company;
    await setTierData(tier as "top" | "middle" | "lower" | "lowest", data);
    return { company, tier };
  }

  return null;
}

// ============== JOBS ==============

export async function getJobs(): Promise<JobsData | null> {
  return getRedis().get<JobsData>(KEYS.JOBS);
}

export async function setJobs(data: JobsData): Promise<boolean> {
  await getRedis().set(KEYS.JOBS, data);
  return true;
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

const QUEUE_LOCK_KEY = "lock:queue";
const QUEUE_LOCK_TTL = 10; // seconds — max time a queue operation can hold the lock
const queueLock = new AsyncLocalStorage<string>();
const PAUSED_KEY = "data:queue:paused";

/**
 * Acquire a distributed mutex lock around queue operations.
 * Uses Redis SETNX with TTL to prevent deadlocks.
 * Retries with exponential backoff up to maxWaitMs.
 */
async function withQueueLock<T>(fn: () => Promise<T>, maxWaitMs = 5000): Promise<T> {
  const redis = getRedis();
  const lockValue = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const start = Date.now();
  let attempts = 0;

  while (true) {
    attempts++;
    // Try to acquire lock
    const acquired = await redis.set(QUEUE_LOCK_KEY, lockValue, {
      nx: true,
      ex: QUEUE_LOCK_TTL,
    });

    if (acquired === "OK") {
      try {
        return await queueLock.run(lockValue, fn);
      } finally {
        // Release lock only if we still hold it (compare value)
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        try {
          await redis.eval(luaScript, [QUEUE_LOCK_KEY], [lockValue]);
        } catch {
          // Lock will expire on its own — safe to ignore
        }
      }
    }

    // Check timeout
    if (Date.now() - start > maxWaitMs) {
      throw new Error(`Queue lock timeout after ${attempts} attempts (${maxWaitMs}ms)`);
    }

    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, ...
    const delay = Math.min(50 * Math.pow(2, attempts - 1), 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function getQueue(): Promise<QueuedJob[]> {
  const queue = (await getRedis().get<QueuedJob[]>(KEYS.QUEUE)) ?? [];
  if (!Array.isArray(queue)) throw new Error("Queue storage is invalid");
  return queue;
}

async function setQueueValue(key: string, value: unknown): Promise<boolean> {
  const lock = queueLock.getStore();
  if (lock) {
    const saved = await getRedis().eval(
      `if redis.call("get", KEYS[1]) ~= ARGV[1] then return 0 end
       redis.call("set", KEYS[2], ARGV[2]); return 1`,
      [QUEUE_LOCK_KEY, key],
      [lock, JSON.stringify(value)],
    );
    if (saved !== 1) throw new Error("Queue lock expired. Please retry the action.");
  } else await getRedis().set(key, value);
  return true;
}

export const setQueue = (queue: QueuedJob[]) => setQueueValue(KEYS.QUEUE, queue);

export const isQueuePaused = async () => (await getRedis().get<boolean>(PAUSED_KEY)) === true;
export const setQueuePaused = (paused: boolean) =>
  withQueueLock(async () => {
    await setQueueValue(PAUSED_KEY, paused);
    return paused;
  });
export const getQueueState = () =>
  withQueueLock(async () => ({ jobs: await getQueue(), paused: await isQueuePaused() }));

export async function claimJob(jobId?: string): Promise<QueuedJob | null> {
  return withQueueLock(async () => {
    if (await isQueuePaused()) return null;
    const now = Date.now();
    const queue = (await getQueue()).map((job) =>
      job.status !== "pending" && isClaimable(job, now) ? resetJob(job, false) : job,
    );
    if (queue.some(isActiveJob)) return null;
    const index = queue.findIndex(
      (job) => job.status === "pending" && (!jobId || job.id === jobId),
    );
    if (index < 0) return null;
    const claimed = {
      ...queue[index]!,
      status: "tailoring-resume" as const,
      progress: 5,
      startedAt: now,
      runId: crypto.randomUUID(),
      leaseExpiresAt: now + 600_000,
    };
    queue[index] = claimed;
    await setQueue(queue);
    return claimed;
  });
}

/**
 * Atomically add a single job to the queue.
 * Uses a distributed lock to prevent race conditions when
 * multiple requests (e.g., from Chrome extension) add jobs concurrently.
 */
export async function addJobToQueue(job: QueuedJob): Promise<boolean> {
  return withQueueLock(async () => {
    const queue = await getQueue();
    // Check for duplicates
    if (queue.some((j) => j.id === job.id)) return false;

    queue.push(job);
    return setQueue(queue);
  });
}

/**
 * Atomically add multiple jobs to the queue in a single transaction.
 * Extension batch mode should use this to avoid race conditions
 * from individual concurrent POSTs.
 */
export async function addJobsToQueue(jobs: QueuedJob[]): Promise<{
  success: boolean;
  added: number;
  duplicates: number;
  jobs: QueuedJob[];
}> {
  return withQueueLock(async () => {
    const queue = await getQueue();
    const existingIds = new Set(queue.map((job) => job.id));
    let added = 0;
    let duplicates = 0;
    const addedJobs: QueuedJob[] = [];

    for (const job of jobs) {
      if (existingIds.has(job.id)) {
        duplicates++;
        continue;
      }
      queue.push(job);
      addedJobs.push(job);
      existingIds.add(job.id);
      added++;
    }

    const ok = await setQueue(queue);
    return { success: ok, added, duplicates, jobs: addedJobs };
  });
}

export async function updateJobInQueue(
  jobId: string,
  updates: Partial<QueuedJob>,
  runId?: string,
  resetTemplates = false,
  retry = false,
  edit = false,
  expectedCompletedAt?: number,
): Promise<QueuedJob | null> {
  return withQueueLock(async () => {
    const queue = await getQueue();
    const index = queue.findIndex((j) => j.id === jobId);

    if (
      index === -1 ||
      (runId &&
        (queue[index]?.runId !== runId || (queue[index]?.leaseExpiresAt ?? Infinity) <= Date.now()))
    )
      return null;

    const current = queue[index]!;
    if (expectedCompletedAt !== undefined && current.completedAt !== expectedCompletedAt)
      return null;
    if (
      !runId &&
      isActiveJob(current) &&
      (updates.tailoredResume !== undefined || updates.tailoredCoverLetter !== undefined)
    )
      return null;
    if (edit && isActiveJob(current)) return null;
    const base =
      updates.status === "pending"
        ? resetJob(
            current,
            resetTemplates ||
              (updates.profileId !== undefined && updates.profileId !== current.profileId),
          )
        : current;
    const updatedJob = { ...base, ...updates } as QueuedJob;
    if (retry) updatedJob.retryCount = (current.retryCount || 0) + 1;
    if (["completed", "failed", "cancelled"].includes(updatedJob.status)) {
      delete updatedJob.runId;
      delete updatedJob.leaseExpiresAt;
    }
    queue[index] = updatedJob;

    await setQueue(queue);
    return updatedJob;
  });
}

export async function removeJobFromQueue(jobId: string): Promise<boolean> {
  return withQueueLock(async () => {
    const queue = await getQueue();
    const newQueue = queue.filter((j) => j.id !== jobId);

    if (newQueue.length === queue.length) return false;

    return setQueue(newQueue);
  });
}

// Clear under the same lock as submissions and worker updates.
export const clearQueue = () => withQueueLock(() => setQueue([]));

export async function clearCompletedJobs(): Promise<boolean> {
  return withQueueLock(async () =>
    setQueue((await getQueue()).filter((job) => job.status !== "completed")),
  );
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
  defaultResumeId?: string | null;
  defaultCoverLetterId?: string | null;
}

export async function getProfiles(): Promise<SavedProfile[]> {
  const redis = getRedis();
  return (
    (await redis.get<SavedProfile[]>("fd:fd_profiles")) ??
    (await redis.get<SavedProfile[]>(KEYS.PROFILES)) ??
    []
  );
}

export async function setProfiles(profiles: SavedProfile[]): Promise<boolean> {
  const redis = getRedis();
  try {
    await redis.set("fd:fd_profiles", profiles);
    return true;
  } catch (error) {
    console.error("Failed to save profiles to Redis:", error);
    return false;
  }
}

// ============== COMPANY CAREER URLS ==============

export async function getCompanyCareerUrls(companyId: string): Promise<string[]> {
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
        const success = await setTierData(tier as "top" | "middle" | "lower" | "lowest", tierData);
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
    const keys = [KEYS.JOBS, KEYS.TIER_TOP, KEYS.TIER_MIDDLE, KEYS.TIER_LOWER, KEYS.TIER_LOWEST];

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
      } catch {
        errors.push(`Failed to delete ${key}`);
      }
    }

    // Delete empty data:companies key
    try {
      await redis.del("data:companies");
      deleted.push("data:companies");
    } catch {
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

  const tierDataPromises = tiers.map((tier) => getTierData(tier));
  const tierDataResults = await Promise.all(tierDataPromises);

  tiers.forEach((tier, index) => {
    const tierData = tierDataResults[index];
    hasTiers[tier] = tierData !== null;
    tierCounts[tier] = tierData?.count || 0;
    totalCompanies += tierCounts[tier];
  });

  return {
    hasJobs: jobs !== null,
    hasTiers,
    tierCounts,
    jobsCount: jobs?.totalJobs || 0,
    totalCompanies,
  };
}
