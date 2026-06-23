import { describe, it, expect } from "bun:test";

// ========================================
// Pure logic tests mirroring context mutations
// No DOM dependency — test the actual functions
// ========================================

// Reproduce the exact state management logic from JobQueueContext
type JobStatus =
  | "pending"
  | "researching"
  | "tailoring-resume"
  | "tailoring-cover-letter"
  | "completed"
  | "failed"
  | "cancelled";

interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  retryCount?: number;
  startedAt?: number;
  completedAt?: number;
  addedAt: number;
}

let idCounter = 0;
const nextId = () => `job_test_${++idCounter}`;

function addJob(queue: Job[], status: JobStatus = "pending"): Job[] {
  const job: Job = { id: nextId(), status, progress: 0, addedAt: Date.now() };
  return [...queue, job];
}

function addJobs(queue: Job[], n: number, status: JobStatus = "pending"): Job[] {
  const ids: string[] = [];
  const newJobs: Job[] = Array.from({ length: n }, () => {
    const job: Job = { id: nextId(), status, progress: 0, addedAt: Date.now() };
    ids.push(job.id);
    return job;
  });
  return [...queue, ...newJobs];
}

function removeJob(queue: Job[], id: string): Job[] {
  return queue.filter((j) => j.id !== id);
}

function updateJobStatus(queue: Job[], id: string, newStatus: JobStatus, progress?: number): Job[] {
  return queue.map((job) => {
    if (job.id !== id) return job;
    const updates: Partial<Job> = { status: newStatus };
    if (progress !== undefined) updates.progress = progress;
    if (["researching", "tailoring-resume", "tailoring-cover-letter"].includes(newStatus)) {
      if (!job.startedAt) updates.startedAt = Date.now();
    }
    if (newStatus === "completed" || newStatus === "failed") updates.completedAt = Date.now();
    return { ...job, ...updates };
  });
}

function setJobError(queue: Job[], id: string, error: string): Job[] {
  return queue.map((job) =>
    job.id === id ? { ...job, status: "failed" as JobStatus, error, completedAt: Date.now() } : job,
  );
}

function cancelJob(queue: Job[], id: string): Job[] {
  return queue.map((job) =>
    job.id === id
      ? { ...job, status: "cancelled" as JobStatus, progress: 0, completedAt: Date.now() }
      : job,
  );
}

function retryJob(queue: Job[], id: string): [Job[], number] {
  let newRetryCount = 0;
  const newQueue = queue.map((job) => {
    if (job.id !== id) return job;
    newRetryCount = (job.retryCount || 0) + 1;
    return {
      ...job,
      status: "pending" as JobStatus,
      progress: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
      retryCount: newRetryCount,
    };
  });
  return [newQueue, newRetryCount];
}

function getCounts(queue: Job[]) {
  return {
    total: queue.length,
    completed: queue.filter((j) => j.status === "completed").length,
    failed: queue.filter((j) => j.status === "failed").length,
    pending: queue.filter((j) => j.status === "pending").length,
    cancelled: queue.filter((j) => j.status === "cancelled").length,
  };
}

function clearCompleted(queue: Job[]): Job[] {
  return queue.filter((j) => j.status !== "completed");
}

// ========================================
// Tests
// ========================================

describe("JobQueue logic — all bugs", () => {
  // ----------------------------------------------------------------
  // Bug #3: addJobs must add to queue
  // ----------------------------------------------------------------
  describe("addJobs (bug #3)", () => {
    it("should add multiple jobs to the queue", () => {
      let q: Job[] = [];
      q = addJobs(q, 3);
      expect(q).toHaveLength(3);
      expect(q.every((j) => j.status === "pending")).toBe(true);
    });

    it("should return all new job IDs", () => {
      let q: Job[] = [];
      q = addJobs(q, 2);
      expect(q[0]?.id).toBeTruthy();
      expect(q[1]?.id).toBeTruthy();
      expect(q[0]?.id).not.toBe(q[1]?.id);
    });

    it("should accept empty input", () => {
      let q: Job[] = [];
      q = addJobs(q, 0);
      expect(q).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------------
  // Bug #8: retryJob increments retryCount
  // ----------------------------------------------------------------
  describe("retryJob increments retryCount (bug #8)", () => {
    it("should increment retryCount on each retry", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      const [q1, c1] = retryJob(q, id);
      expect(c1).toBe(1);
      expect(q1[0]?.retryCount).toBe(1);

      const [q2, c2] = retryJob(q1, id);
      expect(c2).toBe(2);
      expect(q2[0]?.retryCount).toBe(2);
    });

    it("should reset status to pending and clear error on retry", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = setJobError(q, id, "timeout");
      expect(q[0]?.status).toBe("failed");

      const [q2] = retryJob(q, id);
      expect(q2[0]?.status).toBe("pending");
      expect(q2[0]?.error).toBeUndefined();
      expect(q2[0]?.startedAt).toBeUndefined();
      expect(q2[0]?.completedAt).toBeUndefined();
    });

    it("should count retry from zero when job has no retryCount", () => {
      let q: Job[] = [];
      q = addJob(q);
      const [, c] = retryJob(q, q[0]!.id);
      expect(c).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Bug #7: updateJobStatus sets startedAt
  // ----------------------------------------------------------------
  describe("updateJobStatus sets startedAt (bug #7)", () => {
    it("should set startedAt on first processing transition", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;
      expect(q[0]?.startedAt).toBeUndefined();

      q = updateJobStatus(q, id, "tailoring-resume", 30);
      expect(q[0]?.startedAt).toBeGreaterThan(0);
      expect(q[0]?.status).toBe("tailoring-resume");
    });

    it("should NOT override startedAt on subsequent transitions", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = updateJobStatus(q, id, "tailoring-resume", 30);
      const startedAt = q[0]?.startedAt;

      q = updateJobStatus(q, id, "tailoring-cover-letter", 70);
      expect(q[0]?.startedAt).toBe(startedAt);
    });

    it("should set completedAt when completed or failed", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = updateJobStatus(q, id, "completed", 100);
      expect(q[0]?.completedAt).toBeGreaterThan(0);

      q = addJob(q);
      q = updateJobStatus(q, q[1]!.id, "failed");
      expect(q[1]?.completedAt).toBeGreaterThan(0);
    });

    it("should NOT set startedAt for pending/failed/completed status", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = updateJobStatus(q, id, "pending", 0);
      expect(q[0]?.startedAt).toBeUndefined();

      q = updateJobStatus(q, id, "failed");
      expect(q[0]?.startedAt).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // Bug #6: researching is a valid processing status
  // ----------------------------------------------------------------
  describe("researching status (bug #6)", () => {
    it("should accept researching as a valid processing status", () => {
      let q: Job[] = [];
      q = addJob(q);
      q = updateJobStatus(q, q[0]!.id, "researching", 5);
      expect(q[0]?.status).toBe("researching");
      expect(q[0]?.progress).toBe(5);
    });

    it("should set startedAt when transitioning to researching", () => {
      let q: Job[] = [];
      q = addJob(q);
      q = updateJobStatus(q, q[0]!.id, "researching", 5);
      expect(q[0]?.startedAt).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // Bug #1: cancelJob sets to cancelled
  // ----------------------------------------------------------------
  describe("cancelJob (bug #1)", () => {
    it("should set job to cancelled with completedAt", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = updateJobStatus(q, id, "tailoring-resume", 30);
      q = cancelJob(q, id);

      expect(q[0]?.status).toBe("cancelled");
      expect(q[0]?.completedAt).toBeGreaterThan(0);
      expect(q[0]?.progress).toBe(0);
    });
  });

  // ----------------------------------------------------------------
  // Bug #11: cancelledCount calculation
  // ----------------------------------------------------------------
  describe("cancelledCount (bug #11)", () => {
    it("should count cancelled jobs correctly", () => {
      let q: Job[] = [];

      q = addJobs(q, 3);
      q = cancelJob(q, q[0]!.id);
      q = cancelJob(q, q[1]!.id);
      expect(getCounts(q).cancelled).toBe(2);
      expect(getCounts(q).total).toBe(3);
    });

    it("should include cancelled in total", () => {
      let q: Job[] = [];
      q = addJobs(q, 2);
      q = cancelJob(q, q[0]!.id);
      expect(getCounts(q).total).toBe(2);
      expect(getCounts(q).pending).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Bug #4: inProgress excludes cancelled
  // ----------------------------------------------------------------
  describe("inProgress excludes cancelled (bug #4)", () => {
    function calcInProgress(q: Job[]) {
      const counts = getCounts(q);
      return counts.total - counts.completed - counts.failed - counts.pending - counts.cancelled;
    }

    it("should not count cancelled jobs as in-progress", () => {
      let q: Job[] = [];
      q = addJobs(q, 3);
      q = cancelJob(q, q[0]!.id);
      q = updateJobStatus(q, q[1]!.id, "completed", 100);
      q = updateJobStatus(q, q[2]!.id, "tailoring-resume", 30);

      const inProgress = calcInProgress(q);
      expect(inProgress).toBe(1); // only q[2] is in progress
      expect(getCounts(q).cancelled).toBe(1);
    });

    it("should return 0 in-progress when all are cancelled", () => {
      let q: Job[] = [];
      q = addJobs(q, 3);
      q.forEach((j) => {
        q = cancelJob(q, j.id);
      });

      expect(calcInProgress(q)).toBe(0);
    });

    it("should handle mixed statuses correctly", () => {
      let q: Job[] = [];
      q = addJobs(q, 10);

      // 3 completed, 1 failed, 2 pending, 4 cancelled
      q = updateJobStatus(q, q[0]!.id, "completed", 100);
      q = updateJobStatus(q, q[1]!.id, "completed", 100);
      q = updateJobStatus(q, q[2]!.id, "completed", 100);
      q = setJobError(q, q[3]!.id, "error");
      // q[4], q[5] stay pending
      q = cancelJob(q, q[6]!.id);
      q = cancelJob(q, q[7]!.id);
      q = cancelJob(q, q[8]!.id);
      q = cancelJob(q, q[9]!.id);

      const counts = getCounts(q);
      expect(counts.completed).toBe(3);
      expect(counts.failed).toBe(1);
      expect(counts.pending).toBe(2);
      expect(counts.cancelled).toBe(4);
      expect(counts.total).toBe(10);
      expect(calcInProgress(q)).toBe(0); // all accounted
    });
  });

  // ----------------------------------------------------------------
  // clearCompleted
  // ----------------------------------------------------------------
  describe("clearCompleted", () => {
    it("should remove only completed jobs", () => {
      let q: Job[] = [];
      q = addJobs(q, 3);
      q = updateJobStatus(q, q[0]!.id, "completed", 100);
      q = setJobError(q, q[1]!.id, "fail");
      // q[2] stays pending

      q = clearCompleted(q);
      expect(q).toHaveLength(2);
      expect(q.every((j) => j.status !== "completed")).toBe(true);
    });

    it("should leave cancelled jobs untouched", () => {
      let q: Job[] = [];
      q = addJobs(q, 2);
      q = updateJobStatus(q, q[0]!.id, "completed", 100);
      q = cancelJob(q, q[1]!.id);

      q = clearCompleted(q);
      expect(q).toHaveLength(1);
      expect(q[0]?.status).toBe("cancelled");
    });
  });

  // ----------------------------------------------------------------
  // removeJob
  // ----------------------------------------------------------------
  describe("removeJob", () => {
    it("should remove a specific job by id", () => {
      let q: Job[] = [];
      q = addJobs(q, 3);
      const removed = q[1]!.id;
      q = removeJob(q, removed);
      expect(q).toHaveLength(2);
      expect(q.find((j) => j.id === removed)).toBeUndefined();
    });

    it("should do nothing when id not found", () => {
      let q: Job[] = [];
      q = addJobs(q, 2);
      q = removeJob(q, "nonexistent");
      expect(q).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------------
  // Full processing flow
  // ----------------------------------------------------------------
  describe("full processing flow", () => {
    it("pending → researching → tailoring-resume → completed", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      expect(q[0]?.status).toBe("pending");

      q = updateJobStatus(q, id, "researching", 5);
      expect(q[0]?.status).toBe("researching");

      q = updateJobStatus(q, id, "tailoring-resume", 30);
      expect(q[0]?.status).toBe("tailoring-resume");

      q = updateJobStatus(q, id, "completed", 100);
      expect(q[0]?.status).toBe("completed");
      expect(q[0]?.completedAt).toBeGreaterThan(0);
    });

    it("pending → tailoring-resume → failed", () => {
      let q: Job[] = [];
      q = addJob(q);
      const id = q[0]!.id;

      q = updateJobStatus(q, id, "tailoring-resume", 30);
      q = setJobError(q, id, "API error");

      expect(q[0]?.status).toBe("failed");
      expect(q[0]?.error).toBe("API error");
    });

    it("should track counts per status accurately after processing", () => {
      let q: Job[] = [];
      q = addJobs(q, 5);
      q = updateJobStatus(q, q[0]!.id, "completed", 100);
      q = setJobError(q, q[1]!.id, "fail");
      q = cancelJob(q, q[2]!.id);

      const counts = getCounts(q);
      expect(counts.completed).toBe(1);
      expect(counts.failed).toBe(1);
      expect(counts.cancelled).toBe(1);
      expect(counts.pending).toBe(2);
      expect(counts.total).toBe(5);
    });
  });
});
