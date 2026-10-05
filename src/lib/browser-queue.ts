import { resetJob, isClaimable, isActiveJob } from "./queue";
export { resetJob } from "./queue";
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

export function readState(): { jobs: QueuedJob[]; paused: boolean } {
  const raw = localStorage.getItem("fd_queue_state");
  if (!raw) return { jobs: [], paused: true };
  return parseQueueState(raw);
}
export function parseQueueState(raw: string): { jobs: QueuedJob[]; paused: boolean } {
  try {
    const state = JSON.parse(raw);
    if (
      !Array.isArray(state.jobs) ||
      typeof state.paused !== "boolean" ||
      state.jobs.some(
        (job: QueuedJob) =>
          !job ||
          typeof job.id !== "string" ||
          !job.id ||
          !["companyName", "positionTitle", "companyUrl", "jobDescription"].every(
            (key) => typeof job[key as keyof QueuedJob] === "string",
          ) ||
          typeof job.includeCoverLetter !== "boolean" ||
          !Number.isFinite(job.progress) ||
          job.progress < 0 ||
          job.progress > 100 ||
          typeof job.jobDescription !== "string" ||
          ![
            "pending",
            "researching",
            "tailoring-resume",
            "tailoring-cover-letter",
            "completed",
            "failed",
            "cancelled",
          ].includes(job.status),
      )
    )
      throw new Error();
    if (new Set(state.jobs.map((job: QueuedJob) => job.id)).size !== state.jobs.length)
      throw new Error();
    return state;
  } catch {
    throw new Error(
      "Queue storage is invalid. Export or restore your browser data before resetting it.",
    );
  }
}
export function createQueueStore(adapter: {
  read: typeof readState;
  save(state: ReturnType<typeof readState>): void;
  lock<T>(action: () => Promise<T>): Promise<T>;
}) {
  const readState = adapter.read;
  async function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
    return adapter.lock(fn);
  }
  async function getQueue(): Promise<QueuedJob[]> {
    return readState().jobs;
  }

  async function saveState(updates: Partial<ReturnType<typeof readState>>): Promise<boolean> {
    adapter.save({ ...readState(), ...updates });
    return true;
  }
  const setQueue = (jobs: QueuedJob[]) => saveState({ jobs });
  const isQueuePaused = async () => readState().paused;
  const setQueuePaused = (paused: boolean) =>
    withQueueLock(async () => {
      await saveState({ paused });
      return paused;
    });
  const getQueueState = () => withQueueLock(async () => readState());

  async function claimJob(jobId?: string, recoverInterrupted = false): Promise<QueuedJob | null> {
    return withQueueLock(async () => {
      if (await isQueuePaused()) return null;
      const now = Date.now();
      const queue = (await getQueue()).map((job) =>
        (recoverInterrupted || isClaimable(job, now)) && isActiveJob(job) && isClaimable(job, now)
          ? { ...job, status: "pending" as const }
          : job.status !== "pending" && isClaimable(job, now)
            ? resetJob(job, false)
            : job,
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

  async function addJobToQueue(job: QueuedJob): Promise<boolean> {
    return withQueueLock(async () => {
      const queue = await getQueue();
      // Check for duplicates
      if (queue.some((j) => j.id === job.id)) return false;

      queue.push(job);
      return setQueue(queue);
    });
  }

  async function addJobsToQueue(
    jobs: QueuedJob[],
    startQueue = false,
  ): Promise<{
    success: boolean;
    added: number;
    duplicates: number;
    jobs: QueuedJob[];
  }> {
    return withQueueLock(async () => {
      const queue = await getQueue();
      const existingIds = new Map(queue.map((job) => [job.id, job]));
      let added = 0;
      let duplicates = 0;
      const addedJobs: QueuedJob[] = [];

      for (const job of jobs) {
        if (existingIds.has(job.id)) {
          if (existingIds.get(job.id)?.inputHash !== job.inputHash)
            throw new Error("Job ID already exists with different details");
          duplicates++;
          continue;
        }
        queue.push(job);
        addedJobs.push(job);
        existingIds.set(job.id, job);
        added++;
      }

      const ok = await saveState({
        jobs: queue,
        ...(startQueue && added ? { paused: false } : {}),
      });
      return { success: ok, added, duplicates, jobs: addedJobs };
    });
  }

  async function updateJobInQueue(
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
          (queue[index]?.runId !== runId ||
            (queue[index]?.leaseExpiresAt ?? Infinity) <= Date.now()))
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
      if (retry) {
        if (current.tailoredResume) updatedJob.tailoredResume = current.tailoredResume;
        if (current.tailoredCoverLetter)
          updatedJob.tailoredCoverLetter = current.tailoredCoverLetter;
      }
      if (runId) updatedJob.leaseExpiresAt = Date.now() + 600_000;
      if (retry) updatedJob.retryCount = (current.retryCount || 0) + 1;
      if (
        !runId &&
        expectedCompletedAt !== undefined &&
        (updates.tailoredResume !== undefined || updates.tailoredCoverLetter !== undefined)
      )
        updatedJob.completedAt = Math.max(Date.now(), expectedCompletedAt + 1);
      if (["pending", "completed", "failed", "cancelled"].includes(updatedJob.status)) {
        delete updatedJob.runId;
        delete updatedJob.leaseExpiresAt;
      }
      queue[index] = updatedJob;

      await saveState({ jobs: queue, ...(edit ? { paused: true } : {}) });
      return updatedJob;
    });
  }

  async function removeJobFromQueue(jobId: string): Promise<boolean> {
    return withQueueLock(async () => {
      const queue = await getQueue();
      const newQueue = queue.filter((j) => j.id !== jobId);

      if (newQueue.length === queue.length) return false;

      return setQueue(newQueue);
    });
  }

  // Clear under the same lock as submissions and worker updates.
  const clearQueue = () => withQueueLock(() => setQueue([]));

  async function clearCompletedJobs(): Promise<boolean> {
    return withQueueLock(async () =>
      setQueue((await getQueue()).filter((job) => job.status !== "completed")),
    );
  }

  return {
    getQueue,
    setQueue,
    isQueuePaused,
    setQueuePaused,
    getQueueState,
    claimJob,
    addJobToQueue,
    addJobsToQueue,
    updateJobInQueue,
    removeJobFromQueue,
    clearQueue,
    clearCompletedJobs,
  };
}
export const {
  getQueue,
  setQueue,
  isQueuePaused,
  setQueuePaused,
  getQueueState,
  claimJob,
  addJobToQueue,
  addJobsToQueue,
  updateJobInQueue,
  removeJobFromQueue,
  clearQueue,
  clearCompletedJobs,
} = createQueueStore({
  read: readState,
  save: (state) => {
    localStorage.setItem("fd_queue_state", JSON.stringify(state));
    window.dispatchEvent(new window.Event("fd-queue"));
  },
  lock: withQueueLock,
});
export async function withQueueLock<T>(action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("Queue requires Web Locks on HTTPS or localhost.");
  return navigator.locks.request("fd-queue-write", action);
}
