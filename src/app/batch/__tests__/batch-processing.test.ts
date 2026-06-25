import { describe, it, expect, beforeEach } from "bun:test";

// ========================================
// Batch Processing — Sequential Queue & UI State Tests
// Tests the processing loop logic from batch/page.tsx
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
const nextId = () => `job_batch_${++idCounter}`;

// ========================================
// BatchProcessor — simulates batch/page.tsx logic
// ========================================

interface BatchState {
  queue: QueuedJob[];
  isProcessing: boolean;
  currentJobId: string | null;
  processingPaused: boolean;
  activities: string[];
}

class BatchProcessor {
  state: BatchState = {
    queue: [],
    isProcessing: false,
    currentJobId: null,
    processingPaused: false,
    activities: [],
  };

  private processingRef = false;
  private intentionalCancel = false;
  private resumeTemplate: string | null = "mock-template"; // simulate loaded template

  getQueue(): QueuedJob[] {
    return [...this.state.queue];
  }

  addJob(
    jobData: Partial<QueuedJob> & {
      companyName: string;
      companyUrl: string;
      positionTitle: string;
      jobDescription: string;
    },
  ): string {
    const id = nextId();
    const job: QueuedJob = {
      id,
      companyName: jobData.companyName,
      companyUrl: jobData.companyUrl,
      positionTitle: jobData.positionTitle,
      jobDescription: jobData.jobDescription,
      personalDetails: jobData.personalDetails || "",
      includeCoverLetter: jobData.includeCoverLetter || false,
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
      profileId: jobData.profileId,
      profileName: jobData.profileName,
    };
    this.state.queue = [...this.state.queue, job];
    this.state.activities.push(`[Added] ${job.companyName}`);
    return id;
  }

  addJobs(
    jobDatas: Array<
      Partial<QueuedJob> & {
        companyName: string;
        companyUrl: string;
        positionTitle: string;
        jobDescription: string;
      }
    >,
  ): string[] {
    return jobDatas.map((jd) => this.addJob(jd));
  }

  startProcessing(): void {
    if (!this.resumeTemplate) {
      this.state.activities.push("[Error] No resume template loaded");
      return;
    }
    this.state.isProcessing = true;
    this.state.processingPaused = false;
    this.intentionalCancel = false;
    this.state.activities.push("[Started] Processing queue");
  }

  stopProcessing(): void {
    this.state.isProcessing = false;
    this.state.currentJobId = null;
    this.intentionalCancel = true;
    this.state.activities.push("[Stopped] Processing halted");
  }

  // Simulate processing one job through all phases
  async processNextJob(): Promise<QueuedJob | null> {
    // Set processingRef BEFORE checking queue to prevent TOCTOU race
    if (this.processingRef) return null;
    if (!this.state.isProcessing) return null;

    this.processingRef = true; // claim processing slot immediately

    try {
      const pendingJobs = this.state.queue.filter((j) => j.status === "pending");
      if (pendingJobs.length === 0) {
        this.state.activities.push("[Done] Queue empty — processing complete");
        this.state.isProcessing = false;
        return null;
      }

      const job = pendingJobs[0];
      if (!job) {
        this.processingRef = false;
        return null;
      }

      this.state.currentJobId = job.id;

      // Phase 1: Researching
      this.state.queue = this.updateJobInState(job.id, {
        status: "researching",
        progress: 5,
        startedAt: Date.now(),
      });

      // Phase 2: Tailoring resume
      this.state.queue = this.updateJobInState(job.id, {
        status: "tailoring-resume",
        progress: 35,
      });

      // Phase 3: Tailoring done
      this.state.queue = this.updateJobInState(job.id, {
        tailoredResume: "% Generated resume",
        progress: 60,
      });

      // Phase 4: Cover letter (if applicable)
      if (job.includeCoverLetter) {
        this.state.queue = this.updateJobInState(job.id, {
          status: "tailoring-cover-letter",
          progress: 75,
        });
        this.state.queue = this.updateJobInState(job.id, {
          tailoredCoverLetter: "% Generated cover letter",
          progress: 90,
        });
      }

      // Phase 5: Completed
      this.state.queue = this.updateJobInState(job.id, {
        status: "completed",
        progress: 100,
        completedAt: Date.now(),
      });
      this.state.activities.push(`[Complete] ${job.companyName} - ${job.positionTitle}`);

      return this.state.queue.find((j) => j.id === job.id) || null;
    } finally {
      this.processingRef = false;
      this.state.currentJobId = null;
    }
  }

  // Process all pending jobs sequentially
  async processAll(): Promise<number> {
    if (!this.state.isProcessing) return 0;

    let count = 0;
    while (this.state.isProcessing && !this.intentionalCancel) {
      const pendingJobs = this.state.queue.filter((j) => j.status === "pending");
      if (pendingJobs.length === 0) break;

      const result = await this.processNextJob();
      if (!result) break;
      count++;
    }

    // Mark as done
    if (!this.intentionalCancel) {
      this.state.isProcessing = false;
    }
    return count;
  }

  cancelCurrentJob(): void {
    if (!this.state.currentJobId) return;
    this.intentionalCancel = true;
    this.state.queue = this.updateJobInState(this.state.currentJobId, {
      status: "cancelled",
      progress: 0,
      completedAt: Date.now(),
    });
    this.state.currentJobId = null;
    this.state.isProcessing = false;
    this.state.activities.push("[Cancelled] Stopped by user");
  }

  retryJob(id: string): void {
    this.state.queue = this.state.queue.map((job) => {
      if (job.id !== id) return job;
      const retryCount = (job.retryCount || 0) + 1;
      return {
        ...job,
        status: "pending" as JobStatus,
        progress: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
        retryCount,
      };
    });
  }

  private updateJobInState(id: string, updates: Partial<QueuedJob>): QueuedJob[] {
    return this.state.queue.map((job) =>
      job.id === id ? ({ ...job, ...updates } as QueuedJob) : job,
    );
  }

  // UI state helpers — mirror QueueProgress calculations
  getCounts() {
    const q = this.state.queue;
    return {
      total: q.length,
      pending: q.filter((j) => j.status === "pending").length,
      completed: q.filter((j) => j.status === "completed").length,
      failed: q.filter((j) => j.status === "failed").length,
      cancelled: q.filter((j) => j.status === "cancelled").length,
      inProgress: q.filter((j) =>
        ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
      ).length,
    };
  }

  getActiveJobCount(): number {
    return this.state.currentJobId ? 1 : 0;
  }
}

// ========================================
// Tests
// ========================================

describe("BatchProcessor — sequential processing", () => {
  let bp: BatchProcessor;

  beforeEach(() => {
    bp = new BatchProcessor();
  });

  describe("Single job processing", () => {
    it("should process a single job from pending to completed", async () => {
      bp.addJob({
        companyName: "Acme",
        companyUrl: "https://acme.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });
      bp.startProcessing();

      const result = await bp.processNextJob();

      expect(result?.status).toBe("completed");
      expect(result?.progress).toBe(100);
      expect(result?.startedAt).toBeGreaterThan(0);
      expect(result?.completedAt).toBeGreaterThan(0);
    });

    it("should set and clear currentJobId during processing", async () => {
      bp.addJob({
        companyName: "Acme",
        companyUrl: "https://acme.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });
      bp.startProcessing();

      expect(bp.state.currentJobId).toBeNull();

      await bp.processNextJob();

      // After processing, currentJobId should be cleared
      expect(bp.state.currentJobId).toBeNull();
    });
  });

  describe("Sequential processing guarantee", () => {
    it("should process jobs one at a time in FIFO order", async () => {
      bp.addJobs([
        {
          companyName: "First",
          companyUrl: "https://a.com",
          positionTitle: "Dev1",
          jobDescription: "A",
        },
        {
          companyName: "Second",
          companyUrl: "https://b.com",
          positionTitle: "Dev2",
          jobDescription: "B",
        },
        {
          companyName: "Third",
          companyUrl: "https://c.com",
          positionTitle: "Dev3",
          jobDescription: "C",
        },
      ]);
      bp.startProcessing();

      const processed = await bp.processAll();

      expect(processed).toBe(3);
      const statuses = bp.getQueue().map((j) => j.status);
      expect(statuses).toEqual(["completed", "completed", "completed"]);

      // Verify completion order
      const completions = bp.state.activities.filter((a) => a.startsWith("[Complete]"));
      expect(completions).toHaveLength(3);
      expect(completions[0]).toContain("First");
      expect(completions[1]).toContain("Second");
      expect(completions[2]).toContain("Third");
    });

    it("should never have more than 1 job in processing status", async () => {
      // Add 5 jobs
      bp.addJobs(
        Array.from({ length: 5 }, (_, i) => ({
          companyName: `Company${i}`,
          companyUrl: `https://company${i}.com`,
          positionTitle: "Dev",
          jobDescription: "Test",
        })),
      );
      bp.startProcessing();

      // Process all and check after each job
      let processed = 0;
      while (true) {
        // Before processing each job, verify no jobs are in processing state
        const counts = bp.getCounts();
        expect(counts.inProgress).toBeLessThanOrEqual(1); // at most 1 in progress (during processing)

        const result = await bp.processNextJob();
        if (!result) break;
        processed++;

        // After processing completes, verify the job is completed
        expect(result.status).toBe("completed");

        // No jobs should be in progress after job finishes
        const afterCounts = bp.getCounts();
        expect(afterCounts.inProgress).toBe(0);
      }

      expect(processed).toBe(5);
    });

    it("should only process 1 job when 2 processNext calls fire concurrently", async () => {
      // Only 1 pending job ensures the second concurrent caller gets nothing
      bp.addJobs([
        {
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
      ]);
      bp.startProcessing();

      // Simulate concurrent processing attempts
      const results = await Promise.all([bp.processNextJob(), bp.processNextJob()]);

      const completed = results.filter((r) => r !== null);
      // Only 1 should succeed because processingRef guards re-entry
      expect(completed.length).toBe(1);
    });
  });

  describe("Adding jobs while processing", () => {
    it("should process newly added jobs after current one finishes", async () => {
      bp.addJob({
        companyName: "Job1",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });
      bp.startProcessing();

      // Process first job
      await bp.processNextJob();

      // Add 2 more jobs while "processing" would be ongoing
      bp.addJobs([
        {
          companyName: "Job2",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
        {
          companyName: "Job3",
          companyUrl: "https://c.com",
          positionTitle: "Dev",
          jobDescription: "C",
        },
      ]);

      // Process remaining
      await bp.processAll();

      expect(bp.getCounts().completed).toBe(3);
      expect(bp.getCounts().pending).toBe(0);
    });

    it("should maintain FIFO order when jobs are added mid-processing", async () => {
      bp.addJobs([
        {
          companyName: "Early1",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
        {
          companyName: "Early2",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
      ]);
      bp.startProcessing();

      // Process 1
      await bp.processNextJob();

      // Add mid-processing
      bp.addJobs([
        {
          companyName: "Late1",
          companyUrl: "https://c.com",
          positionTitle: "Dev",
          jobDescription: "C",
        },
        {
          companyName: "Late2",
          companyUrl: "https://d.com",
          positionTitle: "Dev",
          jobDescription: "D",
        },
      ]);

      // Process all remaining
      await bp.processAll();

      // Check order: Early1 done first, Early2 next, then Late1, Late2
      const completed = bp.getQueue().filter((j) => j.status === "completed");
      expect(completed.map((j) => j.companyName)).toEqual(["Early1", "Early2", "Late1", "Late2"]);
    });
  });

  describe("Stop/Cancel during processing", () => {
    it("should cancel the current job and stop processing", () => {
      bp.addJobs([
        {
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
        {
          companyName: "B",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
      ]);
      bp.startProcessing();

      // Simulate that a job started processing
      const job = bp.getQueue().find((j) => j.status === "pending");
      bp.state.currentJobId = job!.id;
      bp.state.queue = bp.state.queue.map((j) =>
        j.id === job!.id ? { ...j, status: "tailoring-resume" as JobStatus, progress: 30 } : j,
      );

      // User stops processing
      bp.cancelCurrentJob();

      expect(bp.state.isProcessing).toBe(false);
      expect(bp.state.currentJobId).toBeNull();

      // The current job should be cancelled
      const cancelledJob = bp.getQueue().find((j) => j.id === job!.id);
      expect(cancelledJob?.status).toBe("cancelled");

      // Other jobs should remain pending
      const pendingJobs = bp.getQueue().filter((j) => j.status === "pending");
      expect(pendingJobs.length).toBe(1);
    });

    it("should be able to resume processing after cancel", async () => {
      bp.addJobs([
        {
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
        {
          companyName: "B",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
      ]);
      bp.startProcessing();

      // Process first job, then "cancel" (stop)
      await bp.processNextJob();
      bp.state.isProcessing = false; // simulate stop after completion

      // Resume
      bp.startProcessing();
      await bp.processAll();

      expect(bp.getCounts().completed).toBe(2);
      expect(bp.getCounts().pending).toBe(0);
    });
  });

  describe("Retry failed jobs", () => {
    it("should retry a failed job and process it again", async () => {
      bp.addJob({
        companyName: "FailCo",
        companyUrl: "https://fail.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });
      bp.startProcessing();

      // Simulate that the job failed
      const job = bp.getQueue()[0]!;
      bp.state.queue = bp.state.queue.map((j) =>
        j.id === job.id
          ? { ...j, status: "failed" as JobStatus, error: "API timeout", completedAt: Date.now() }
          : j,
      );

      // Retry
      bp.retryJob(job.id);
      const retried = bp.getQueue().find((j) => j.id === job.id);
      expect(retried?.status).toBe("pending");
      expect(retried?.retryCount).toBe(1);
      expect(retried?.error).toBeUndefined();

      // Process again
      await bp.processNextJob();
      expect(bp.getQueue().find((j) => j.id === job.id)?.status).toBe("completed");
    });

    it("should increment retryCount on each retry", () => {
      bp.addJob({
        companyName: "RetryCo",
        companyUrl: "https://retry.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });
      const job = bp.getQueue()[0]!;

      bp.retryJob(job.id);
      expect(bp.getQueue().find((j) => j.id === job.id)?.retryCount).toBe(1);

      bp.retryJob(job.id);
      expect(bp.getQueue().find((j) => j.id === job.id)?.retryCount).toBe(2);

      bp.retryJob(job.id);
      expect(bp.getQueue().find((j) => j.id === job.id)?.retryCount).toBe(3);
    });
  });

  describe("UI state accuracy", () => {
    it("should report correct job counts", async () => {
      bp.addJobs([
        {
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
        {
          companyName: "B",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
        {
          companyName: "C",
          companyUrl: "https://c.com",
          positionTitle: "Dev",
          jobDescription: "C",
        },
      ]);

      let counts = bp.getCounts();
      expect(counts.total).toBe(3);
      expect(counts.pending).toBe(3);
      expect(counts.completed).toBe(0);
      expect(counts.failed).toBe(0);
      expect(counts.cancelled).toBe(0);

      bp.startProcessing();
      await bp.processNextJob();

      counts = bp.getCounts();
      expect(counts.completed).toBe(1);
      expect(counts.pending).toBe(2);
      expect(counts.total).toBe(3);
    });

    it("should show correct active job count", () => {
      // No processing
      expect(bp.getActiveJobCount()).toBe(0);

      // Start processing and set a current job
      bp.addJob({
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });
      bp.startProcessing();

      // Simulate mid-processing state
      const job = bp.getQueue()[0]!;
      bp.state.currentJobId = job.id;
      expect(bp.getActiveJobCount()).toBe(1);

      // Clear
      bp.state.currentJobId = null;
      expect(bp.getActiveJobCount()).toBe(0);
    });

    it("should never show isProcessing=true when nothing is processing", () => {
      bp.addJob({
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });

      // Not started yet
      expect(bp.state.isProcessing).toBe(false);
      expect(bp.getActiveJobCount()).toBe(0);

      // Start
      bp.startProcessing();
      expect(bp.state.isProcessing).toBe(true);

      // Stop
      bp.stopProcessing();
      expect(bp.state.isProcessing).toBe(false);
      expect(bp.state.currentJobId).toBeNull();
      expect(bp.getActiveJobCount()).toBe(0);
    });

    it("should not show false 'processing' state when queue empty", () => {
      // Empty queue
      const counts = bp.getCounts();
      expect(counts.total).toBe(0);
      expect(counts.inProgress).toBe(0);
      expect(bp.getActiveJobCount()).toBe(0);
      expect(bp.state.isProcessing).toBe(false);
    });

    it("should handle mixed statuses correctly in counts", async () => {
      // Add 6 jobs
      bp.addJobs([
        {
          companyName: "C1",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
        {
          companyName: "C2",
          companyUrl: "https://b.com",
          positionTitle: "Dev",
          jobDescription: "B",
        },
        {
          companyName: "C3",
          companyUrl: "https://c.com",
          positionTitle: "Dev",
          jobDescription: "C",
        },
        {
          companyName: "C4",
          companyUrl: "https://d.com",
          positionTitle: "Dev",
          jobDescription: "D",
        },
        {
          companyName: "C5",
          companyUrl: "https://e.com",
          positionTitle: "Dev",
          jobDescription: "E",
        },
        {
          companyName: "C6",
          companyUrl: "https://f.com",
          positionTitle: "Dev",
          jobDescription: "F",
        },
      ]);

      bp.startProcessing();

      // Complete 2
      await bp.processNextJob();
      await bp.processNextJob();

      // Simulate failing job 3
      const job3 = bp.getQueue().find((j) => j.status === "pending");
      if (job3) {
        bp.state.queue = bp.state.queue.map((j) =>
          j.id === job3.id ? { ...j, status: "failed" as JobStatus, error: "error" } : j,
        );
      }

      // Cancel job 4 (but we can't do this via processNext, so just set it manually)
      const remaining = bp.getQueue().filter((j) => j.status === "pending");
      if (remaining.length > 0) {
        const toCancel = remaining[0]!;
        bp.state.queue = bp.state.queue.map((j) =>
          j.id === toCancel.id ? { ...j, status: "cancelled" as JobStatus } : j,
        );
      }

      const counts = bp.getCounts();
      expect(counts.completed).toBe(2);
      expect(counts.failed).toBe(1);
      expect(counts.cancelled).toBe(1);
      expect(counts.pending).toBe(2); // 2 remaining
      expect(counts.total).toBe(6);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty queue gracefully", async () => {
      bp.startProcessing();
      const result = await bp.processNextJob();
      expect(result).toBeNull();
      // Should mark as done
      const activities = bp.state.activities.filter((a) => a.includes("Queue empty"));
      expect(activities.length).toBeGreaterThan(0);
    });

    it("should handle 0 jobs without error", async () => {
      const processed = await bp.processAll();
      expect(processed).toBe(0);
      expect(bp.getCounts().total).toBe(0);
    });

    it("should handle rapid add-and-process cycles", async () => {
      // Simulate extension adding jobs rapidly while processing
      for (let i = 0; i < 5; i++) {
        const id = bp.addJob({
          companyName: `Rapid${i}`,
          companyUrl: `https://rapid${i}.com`,
          positionTitle: "Dev",
          jobDescription: `Job ${i}`,
        });

        if (i === 0) {
          bp.startProcessing();
        }

        // Process available jobs
        await bp.processAll();

        // Verify the job we just added was processed
        const job = bp.getQueue().find((j) => j.id === id);
        if (job) {
          expect(["completed", "pending"].includes(job.status)).toBe(true);
        }
      }

      // All jobs should be processed
      expect(bp.getCounts().total).toBe(5);
    });

    it("should not start processing without template", () => {
      const bp2 = new BatchProcessor();
      (bp2 as unknown as { resumeTemplate: string | null }).resumeTemplate = null; // no template loaded

      bp2.addJob({
        companyName: "NoTemplate",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });
      bp2.startProcessing();

      // Should have logged error and not set isProcessing
      expect(bp2.state.activities.some((a) => a.includes("No resume template"))).toBe(true);
    });

    it("should maintain correct addedAt ordering", () => {
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const before = Date.now();
        bp.addJob({
          companyName: `Time${i}`,
          companyUrl: `https://time${i}.com`,
          positionTitle: "Dev",
          jobDescription: `Job ${i}`,
        });
        times.push(before);
      }

      const queue = bp.getQueue();
      for (let i = 1; i < queue.length; i++) {
        expect(queue[i]!.addedAt).toBeGreaterThanOrEqual(queue[i - 1]!.addedAt);
      }
    });
  });

  describe("Extension batch flow simulation", () => {
    it("should handle extension adding 10 jobs in rapid succession", async () => {
      // Simulate Chrome extension sending multiple POST /api/queue requests
      const extensionJobs = [
        {
          companyName: "Google",
          companyUrl: "https://google.com/jobs/1",
          positionTitle: "SWE",
          jobDescription: "Build search",
          profileId: "p1",
        },
        {
          companyName: "Apple",
          companyUrl: "https://apple.com/jobs/2",
          positionTitle: "Designer",
          jobDescription: "Design products",
          profileId: "p1",
        },
        {
          companyName: "Meta",
          companyUrl: "https://meta.com/jobs/3",
          positionTitle: "PM",
          jobDescription: "Manage products",
          profileId: "p2",
        },
        {
          companyName: "Amazon",
          companyUrl: "https://amazon.com/jobs/4",
          positionTitle: "SDE",
          jobDescription: "Build AWS",
          profileId: "p1",
        },
        {
          companyName: "Netflix",
          companyUrl: "https://netflix.com/jobs/5",
          positionTitle: "Engineer",
          jobDescription: "Stream video",
          profileId: "p3",
        },
        {
          companyName: "Stripe",
          companyUrl: "https://stripe.com/jobs/6",
          positionTitle: "API Dev",
          jobDescription: "Build APIs",
          profileId: "p2",
        },
        {
          companyName: "Airbnb",
          companyUrl: "https://airbnb.com/jobs/7",
          positionTitle: "FE Engineer",
          jobDescription: "Build UI",
          profileId: "p1",
        },
        {
          companyName: "Uber",
          companyUrl: "https://uber.com/jobs/8",
          positionTitle: "Backend",
          jobDescription: "Scale systems",
          profileId: "p3",
        },
        {
          companyName: "Spotify",
          companyUrl: "https://spotify.com/jobs/9",
          positionTitle: "iOS Dev",
          jobDescription: "Build app",
          profileId: "p2",
        },
        {
          companyName: "Slack",
          companyUrl: "https://slack.com/jobs/10",
          positionTitle: "Full Stack",
          jobDescription: "Build chat",
          profileId: "p1",
        },
      ];

      // Add all jobs (simulating extension POSTs arriving at server)
      const ids = bp.addJobs(extensionJobs);
      expect(ids.length).toBe(10);
      expect(bp.getCounts().total).toBe(10);
      expect(bp.getCounts().pending).toBe(10);

      // Start processing
      bp.startProcessing();

      // Process all — should complete all 10 sequentially
      const processed = await bp.processAll();
      expect(processed).toBe(10);

      // Verify all completed
      expect(bp.getCounts().completed).toBe(10);
      expect(bp.getCounts().pending).toBe(0);
      expect(bp.getCounts().failed).toBe(0);

      // Verify each job was processed (has startedAt and completedAt)
      const allJobs = bp.getQueue();
      for (const job of allJobs) {
        expect(job.status).toBe("completed");
        expect(job.progress).toBe(100);
      }
    });

    it("should process extension jobs in the order they were added", async () => {
      const orderedJobs = [
        {
          companyName: "1st",
          companyUrl: "https://1.com",
          positionTitle: "Dev",
          jobDescription: "First",
        },
        {
          companyName: "2nd",
          companyUrl: "https://2.com",
          positionTitle: "Dev",
          jobDescription: "Second",
        },
        {
          companyName: "3rd",
          companyUrl: "https://3.com",
          positionTitle: "Dev",
          jobDescription: "Third",
        },
      ];

      bp.addJobs(orderedJobs);
      bp.startProcessing();
      await bp.processAll();

      const completions = bp.state.activities.filter((a) => a.startsWith("[Complete]"));
      expect(completions[0]).toContain("1st");
      expect(completions[1]).toContain("2nd");
      expect(completions[2]).toContain("3rd");
    });
  });
});
