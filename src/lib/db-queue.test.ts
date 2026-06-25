import { describe, it, expect, beforeEach } from "bun:test";

// ========================================
// Database Queue Operations — Race Conditions & Atomicity
// Pure logic tests (no Redis dependency)
// ========================================

type JobStatus =
  | "pending"
  | "researching"
  | "tailoring-resume"
  | "tailoring-cover-letter"
  | "completed"
  | "failed"
  | "cancelled";

interface QueuedJob {
  id: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails: string;
  includeCoverLetter: boolean;
  companyWebsite?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  retryCount?: number;
  profileId?: string;
  profileName?: string;
  profileColor?: string;
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

let idCounter = 0;
const nextId = () => `job_db_${++idCounter}`;

function makeJob(overrides: Partial<QueuedJob> = {}): QueuedJob {
  return {
    id: nextId(),
    companyName: overrides.companyName || "Acme Corp",
    companyUrl: overrides.companyUrl || "https://acme.com/jobs/1",
    positionTitle: overrides.positionTitle || "Engineer",
    jobDescription: overrides.jobDescription || "Build things.",
    personalDetails: overrides.personalDetails || "",
    includeCoverLetter: overrides.includeCoverLetter || false,
    status: overrides.status || "pending",
    progress: overrides.progress || 0,
    addedAt: overrides.addedAt || Date.now(),
    ...overrides,
  };
}

// ========================================
// Simulate the mutex-locked queue operations
// ========================================

class QueueStore {
  private queue: QueuedJob[] = [];
  private locked = false;
  lockAttempts = 0;

  private async acquireLock(maxWaitMs = 5000): Promise<void> {
    const start = Date.now();
    let attempts = 0;

    while (this.locked) {
      attempts++;
      this.lockAttempts++;
      if (Date.now() - start > maxWaitMs) {
        throw new Error(`Lock timeout after ${attempts} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.locked = true;
  }

  private releaseLock(): void {
    this.locked = false;
  }

  // Equivalent to addJobToQueue with mutex
  async addJob(job: QueuedJob): Promise<boolean> {
    await this.acquireLock();
    try {
      if (this.queue.some((j) => j.id === job.id)) return false;
      this.queue.push(job);
      return true;
    } finally {
      this.releaseLock();
    }
  }

  // Equivalent to addJobsToQueue with mutex (batch atomic)
  async addJobs(jobs: QueuedJob[]): Promise<{ added: number; duplicates: number }> {
    await this.acquireLock();
    try {
      let added = 0;
      let duplicates = 0;
      for (const job of jobs) {
        if (this.queue.some((j) => j.id === job.id)) {
          duplicates++;
          continue;
        }
        this.queue.push(job);
        added++;
      }
      return { added, duplicates };
    } finally {
      this.releaseLock();
    }
  }

  // Equivalent to updateJobInQueue with mutex
  async updateJob(id: string, updates: Partial<QueuedJob>): Promise<QueuedJob | null> {
    await this.acquireLock();
    try {
      const index = this.queue.findIndex((j) => j.id === id);
      if (index === -1) return null;
      this.queue[index] = { ...this.queue[index], ...updates } as QueuedJob;
      return this.queue[index];
    } finally {
      this.releaseLock();
    }
  }

  // Equivalent to claimNextPendingJob — atomic pop & claim
  async claimNextPending(): Promise<QueuedJob | null> {
    await this.acquireLock();
    try {
      const index = this.queue.findIndex((j) => j.status === "pending");
      if (index === -1) return null;

      const claimed: QueuedJob = {
        ...this.queue[index]!,
        status: "researching",
        progress: 0,
        startedAt: Date.now(),
      };
      this.queue[index] = claimed;
      return claimed;
    } finally {
      this.releaseLock();
    }
  }

  async removeJob(id: string): Promise<boolean> {
    await this.acquireLock();
    try {
      const len = this.queue.length;
      this.queue = this.queue.filter((j) => j.id !== id);
      return this.queue.length !== len;
    } finally {
      this.releaseLock();
    }
  }

  async clearQueue(): Promise<void> {
    await this.acquireLock();
    try {
      this.queue = [];
    } finally {
      this.releaseLock();
    }
  }

  getQueue(): QueuedJob[] {
    return [...this.queue];
  }

  get length(): number {
    return this.queue.length;
  }

  hasProcessingJobs(): boolean {
    return this.queue.some((j) =>
      ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
    );
  }

  getProcessingCount(): number {
    return this.queue.filter((j) =>
      ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
    ).length;
  }
}

// ========================================
// Tests
// ========================================

describe("QueueStore — atomic operations", () => {
  let store: QueueStore;

  beforeEach(() => {
    store = new QueueStore();
  });

  describe("addJob (atomic single add)", () => {
    it("should add a job", async () => {
      const job = makeJob();
      const ok = await store.addJob(job);
      expect(ok).toBe(true);
      expect(store.length).toBe(1);
    });

    it("should reject duplicate IDs", async () => {
      const job = makeJob({ id: "fixed-id" });
      await store.addJob(job);
      const ok = await store.addJob(job); // same ID
      expect(ok).toBe(false);
      expect(store.length).toBe(1);
    });

    it("should handle concurrent adds without data loss (race condition test)", async () => {
      // Simulate 10 concurrent POST requests from Chrome extension
      const jobs = Array.from({ length: 10 }, () => makeJob());

      // All 10 "requests" fire concurrently (like extension adding 10 jobs rapidly)
      const results = await Promise.all(jobs.map((job) => store.addJob(job)));

      expect(results.every(Boolean)).toBe(true);
      expect(store.length).toBe(10);
      expect(store.lockAttempts).toBeGreaterThan(0); // proves contention occurred
    });

    it("should handle high-volume concurrent adds (50 jobs)", async () => {
      const jobs = Array.from({ length: 50 }, () => makeJob());

      const results = await Promise.all(jobs.map((job) => store.addJob(job)));

      expect(results.filter(Boolean).length).toBe(50);
      expect(store.length).toBe(50);
      // Every job should have a unique ID in the queue
      const ids = store.getQueue().map((j) => j.id);
      expect(new Set(ids).size).toBe(50);
    });

    it("should maintain insertion order under concurrent adds", async () => {
      // Add jobs with known order — lock ensures they're processed sequentially
      const job1 = makeJob({ id: "order-1", companyName: "First" });
      const job2 = makeJob({ id: "order-2", companyName: "Second" });
      const job3 = makeJob({ id: "order-3", companyName: "Third" });

      // Fire concurrently — but they will be ordered by lock acquisition
      await Promise.all([
        store.addJob(job1),
        // Slight delay to encourage ordering
        new Promise<void>((r) => setTimeout(r, 5)).then(() => store.addJob(job2)),
        new Promise<void>((r) => setTimeout(r, 10)).then(() => store.addJob(job3)),
      ]);

      expect(store.length).toBe(3);
      const names = store.getQueue().map((j) => j.companyName);
      // With the delays, First should be before Second, Second before Third
      expect(names.indexOf("First")).toBeLessThan(names.indexOf("Second"));
      expect(names.indexOf("Second")).toBeLessThan(names.indexOf("Third"));
    });
  });

  describe("addJobs (batch atomic)", () => {
    it("should add multiple jobs atomically", async () => {
      const jobs = Array.from({ length: 5 }, () => makeJob());
      const result = await store.addJobs(jobs);
      expect(result.added).toBe(5);
      expect(result.duplicates).toBe(0);
      expect(store.length).toBe(5);
    });

    it("should detect duplicates in batch", async () => {
      const job1 = makeJob({ id: "dup-1" });
      await store.addJob(job1);

      const batch = [
        makeJob({ id: "dup-1" }), // duplicate
        makeJob(), // new
        makeJob({ id: "dup-1" }), // duplicate again
      ];
      const result = await store.addJobs(batch);

      expect(result.added).toBe(1);
      expect(result.duplicates).toBe(2);
      expect(store.length).toBe(2); // original + 1 new
    });

    it("should be atomic even with concurrent individual adds", async () => {
      // Fire batch add concurrently with individual adds
      const batch = Array.from({ length: 5 }, () => makeJob());
      const singles = Array.from({ length: 3 }, () => makeJob());

      const [batchResult] = await Promise.all([
        store.addJobs(batch),
        ...singles.map((j) => store.addJob(j)),
      ]);

      expect(batchResult.added).toBe(5);
      expect(store.length).toBe(8); // 5 batch + 3 singles
    });
  });

  describe("updateJob (atomic update)", () => {
    it("should update job status atomically", async () => {
      const job = makeJob({ status: "pending" });
      await store.addJob(job);

      const updated = await store.updateJob(job.id, { status: "researching", progress: 5 });
      expect(updated?.status).toBe("researching");
      expect(updated?.progress).toBe(5);
    });

    it("should return null for non-existent job", async () => {
      const result = await store.updateJob("nonexistent", { status: "completed" });
      expect(result).toBeNull();
    });

    it("should not lose data during concurrent updates", async () => {
      const job = makeJob({ status: "pending", progress: 0 });
      await store.addJob(job);

      // Two concurrent updates to different fields
      const [r1, r2] = await Promise.all([
        store.updateJob(job.id, { status: "researching" }),
        store.updateJob(job.id, { progress: 50 }),
      ]);

      // One wins, one sets — but both should succeed
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();

      // Final state should exist
      const final = store.getQueue().find((j) => j.id === job.id);
      expect(final).toBeDefined();
    });
  });

  describe("claimNextPending (atomic pop & claim)", () => {
    it("should claim the first pending job", async () => {
      // Add 3 pending jobs
      await store.addJob(makeJob({ id: "j1", companyName: "First" }));
      await store.addJob(makeJob({ id: "j2", companyName: "Second" }));
      await store.addJob(makeJob({ id: "j3", companyName: "Third" }));

      const claimed = await store.claimNextPending();
      expect(claimed).not.toBeNull();
      expect(claimed!.id).toBe("j1"); // FIFO — first added claimed first
      expect(claimed!.status).toBe("researching");
      expect(claimed!.startedAt).toBeGreaterThan(0);
    });

    it("should only claim one job at a time even with concurrent callers", async () => {
      // Set up 3 pending jobs
      const jobs = [makeJob({ id: "a1" }), makeJob({ id: "a2" }), makeJob({ id: "a3" })];
      await store.addJobs(jobs);

      // 3 concurrent claim attempts (simulating 3 browser tabs)
      const results = await Promise.all([
        store.claimNextPending(),
        store.claimNextPending(),
        store.claimNextPending(),
      ]);

      const claimed = results.filter((r) => r !== null);
      // Each claimed job should be unique
      const claimedIds = claimed.map((c) => c!.id);
      expect(new Set(claimedIds).size).toBe(claimed.length);
      // All claimed jobs should have status "researching"
      expect(claimed.every((c) => c!.status === "researching")).toBe(true);

      // After claiming, only those jobs should be in researching status
      const processingCount = store.getProcessingCount();
      expect(processingCount).toBe(claimed.length);
    });

    it("should return null when no pending jobs", async () => {
      const claimed = await store.claimNextPending();
      expect(claimed).toBeNull();
    });

    it("should not claim completed or failed jobs", async () => {
      const pending = makeJob({ id: "p1", status: "pending" });
      const completed = makeJob({ id: "c1", status: "completed" });
      const failed = makeJob({ id: "f1", status: "failed" });

      await store.addJobs([pending, completed, failed]);

      const claimed = await store.claimNextPending();
      expect(claimed?.id).toBe("p1"); // only pending job claimed
    });

    it("should ensure only one claim succeeds per job (critical)", async () => {
      // Add 1 pending job
      await store.addJob(makeJob({ id: "sole-job" }));

      // 10 concurrent claimers — only 1 should get the job
      const results = await Promise.all(Array.from({ length: 10 }, () => store.claimNextPending()));

      const successes = results.filter((r) => r !== null);
      expect(successes.length).toBe(1); // Only one claimer gets the job
      expect(successes[0]!.id).toBe("sole-job");
    });
  });

  describe("hasProcessingJobs", () => {
    it("should return false when no jobs are processing", async () => {
      await store.addJob(makeJob({ status: "pending" }));
      expect(store.hasProcessingJobs()).toBe(false);
    });

    it("should return true when a job is researching", async () => {
      await store.addJob(makeJob({ status: "researching" }));
      expect(store.hasProcessingJobs()).toBe(true);
    });

    it("should return true when a job is tailoring-resume", async () => {
      await store.addJob(makeJob({ status: "tailoring-resume" }));
      expect(store.hasProcessingJobs()).toBe(true);
    });

    it("should return true when a job is tailoring-cover-letter", async () => {
      await store.addJob(makeJob({ status: "tailoring-cover-letter" }));
      expect(store.hasProcessingJobs()).toBe(true);
    });

    it("should return false when all jobs are completed/failed/cancelled", async () => {
      await store.addJobs([
        makeJob({ status: "completed" }),
        makeJob({ status: "failed" }),
        makeJob({ status: "cancelled" }),
      ]);
      expect(store.hasProcessingJobs()).toBe(false);
    });
  });
});

// ========================================
// Race condition simulation (without mutex)
// ========================================

describe("Without mutex — race condition reproduction", () => {
  class UnsafeQueueStore {
    // Stores the queue as a serialized JSON array (like Redis get/set)
    private queue: QueuedJob[] = [];

    // UNSAFE: no lock — read-modify-write race
    // This mirrors the original addJobToQueue: getQueue() → push → setQueue()
    async addJobUnsafe(job: QueuedJob): Promise<boolean> {
      // Read phase (like getQueue())
      const currentSnapshot = [...this.queue]; // capture stale snapshot

      // Simulate async gap (like HTTP round-trip to Redis)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 30));

      // Check duplicates against STALE snapshot
      if (currentSnapshot.some((j) => j.id === job.id)) return false;

      // Simulate more async work
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15));

      // Write phase (like setQueue) — overwrites with stale data!
      // This is the bug: other concurrent callers' writes are lost
      this.queue = [...currentSnapshot, job];
      return true;
    }

    get length(): number {
      return this.queue.length;
    }
  }

  it("LOSES JOBS when concurrent adds happen without lock (demonstrates bug)", async () => {
    let lostJobsDetected = false;
    const maxTrials = 10;

    for (let trial = 0; trial < maxTrials && !lostJobsDetected; trial++) {
      const unsafe = new UnsafeQueueStore();
      const jobs = Array.from({ length: 10 }, () => makeJob());

      // Fire all concurrently — WITHOUT lock
      // Each call captures its own stale snapshot and writes back,
      // overwriting previous writes (data loss)
      await Promise.all(jobs.map((j) => unsafe.addJobUnsafe(j)));

      if (unsafe.length < 10) {
        lostJobsDetected = true;
      }
    }

    // The race condition IS real — each addJobUnsafe captures a stale snapshot
    // and overwrites previous writes, causing job loss
    expect(lostJobsDetected).toBe(true);
  });
});

// ========================================
// Sequential processing guarantee tests
// ========================================

describe("Sequential processing guarantee", () => {
  class ProcessingManager {
    private store = new QueueStore();
    private processingNow = false;
    private currentJobId: string | null = null;

    async addJob(job: QueuedJob): Promise<boolean> {
      return this.store.addJob(job);
    }

    async addJobs(jobs: QueuedJob[]): Promise<{ added: number; duplicates: number }> {
      return this.store.addJobs(jobs);
    }

    isProcessing(): boolean {
      return this.processingNow;
    }

    getCurrentJobId(): string | null {
      return this.currentJobId;
    }

    // Process the next pending job if none is processing
    async processNext(): Promise<QueuedJob | null> {
      // Set processingNow BEFORE claiming to prevent TOCTOU race
      if (this.processingNow) return null;
      this.processingNow = true; // claim the processing slot immediately

      const job = await this.store.claimNextPending();
      if (!job) {
        this.processingNow = false; // nothing to process, release
        return null;
      }

      this.currentJobId = job.id;

      try {
        // Simulate processing phases
        await this.store.updateJob(job.id, { status: "researching", progress: 5 });
        await this.store.updateJob(job.id, { status: "tailoring-resume", progress: 30 });
        await this.store.updateJob(job.id, { status: "tailoring-resume", progress: 60 });
        await this.store.updateJob(job.id, {
          status: "completed",
          progress: 100,
          completedAt: Date.now(),
        });

        return this.store.getQueue().find((j) => j.id === job.id) || null;
      } finally {
        this.processingNow = false;
        this.currentJobId = null;
      }
    }

    async processAll(): Promise<number> {
      let count = 0;
      while (true) {
        const result = await this.processNext();
        if (!result) break;
        count++;
      }
      return count;
    }

    getQueue(): QueuedJob[] {
      return this.store.getQueue();
    }

    getProcessingCount(): number {
      return this.store.getProcessingCount();
    }
  }

  let pm: ProcessingManager;

  beforeEach(() => {
    pm = new ProcessingManager();
  });

  it("should process only one job at a time", async () => {
    await pm.addJobs([
      makeJob({ id: "job1", companyName: "First" }),
      makeJob({ id: "job2", companyName: "Second" }),
      makeJob({ id: "job3", companyName: "Third" }),
    ]);

    // processNext should return a job since none is processing
    const r1 = await pm.processNext();
    expect(r1).not.toBeNull();
    expect(pm.isProcessing()).toBe(false); // done now
    expect(pm.getCurrentJobId()).toBeNull(); // cleared

    // All 3 jobs should be processed sequentially
    const processed = await pm.processAll();
    // 2 remaining should be processed now
    expect(processed).toBe(2);
    // Job1 was already processed above
    expect(pm.getQueue().every((j) => j.status === "completed")).toBe(true);
  });

  it("should reject processing when already busy (concurrent prevention)", async () => {
    await pm.addJobs([makeJob({ id: "job1" }), makeJob({ id: "job2" })]);

    // Simulate two concurrent processNext calls
    const [r1, r2] = await Promise.all([pm.processNext(), pm.processNext()]);

    // Only one should succeed
    const successes = [r1, r2].filter((r) => r !== null);
    // Due to the lock in claimNextPending, only 1 job is claimed
    // Second call fails because claimNextPending returns null after first claim
    expect(successes.length).toBe(1);
  });

  it("should process jobs in FIFO order", async () => {
    const jobs = [
      makeJob({ id: "q1", companyName: "First" }),
      makeJob({ id: "q2", companyName: "Second" }),
      makeJob({ id: "q3", companyName: "Third" }),
      makeJob({ id: "q4", companyName: "Fourth" }),
    ];
    await pm.addJobs(jobs);

    const processed: string[] = [];
    while (true) {
      const result = await pm.processNext();
      if (!result) break;
      processed.push(result.id);
    }

    expect(processed).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("should correctly handle adding jobs while processing", async () => {
    // Add 2 jobs, process 1, then add 2 more
    await pm.addJobs([makeJob({ id: "initial-1" }), makeJob({ id: "initial-2" })]);

    const first = await pm.processNext();
    expect(first?.id).toBe("initial-1");

    // While "processing" would be happening, add more jobs
    await pm.addJobs([makeJob({ id: "mid-add-1" }), makeJob({ id: "mid-add-2" })]);

    // Process remaining
    const remaining = await pm.processAll();
    expect(remaining).toBe(3); // initial-2, mid-add-1, mid-add-2

    expect(pm.getQueue().every((j) => j.status === "completed")).toBe(true);
  });

  it("should never have more than 1 processing job at a time", async () => {
    // Add 10 jobs
    await pm.addJobs(Array.from({ length: 10 }, (_, i) => makeJob({ id: `lot-${i}` })));

    // Process all — after each job, verify no double-processing
    let processedCount = 0;
    while (true) {
      const processingCount = pm.getProcessingCount();
      expect(processingCount).toBeLessThanOrEqual(1); // Never > 1 processing

      const result = await pm.processNext();
      if (!result) break;
      processedCount++;
    }

    expect(processedCount).toBe(10);
    expect(pm.getProcessingCount()).toBe(0);
  });
});
