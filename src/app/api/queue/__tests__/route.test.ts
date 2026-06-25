import { describe, it, expect, beforeEach } from "bun:test";

// ========================================
// Queue API Route — Request Handling & Validation
// Pure logic tests for the route handlers
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
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  addedAt: number;
}

// ========================================
// Validation function (mirrors validJobBody from route.ts)
// ========================================
function validJobBody(body: unknown): body is {
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails?: string;
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  companyWebsite?: string;
  includeCoverLetter?: boolean;
  id?: string;
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.companyName === "string" &&
    b.companyName.length > 0 &&
    typeof b.companyUrl === "string" &&
    b.companyUrl.length > 0 &&
    typeof b.positionTitle === "string" &&
    b.positionTitle.length > 0 &&
    typeof b.jobDescription === "string" &&
    b.jobDescription.length > 0
  );
}

function createJob(body: Record<string, unknown>): QueuedJob {
  return {
    id: (body.id as string) || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyName: body.companyName as string,
    companyUrl: body.companyUrl as string,
    positionTitle: body.positionTitle as string,
    jobDescription: body.jobDescription as string,
    personalDetails: (body.personalDetails as string) || "",
    includeCoverLetter: (body.includeCoverLetter as boolean) || false,
    companyWebsite: body.companyWebsite as string | undefined,
    status: "pending",
    progress: 0,
    profileId: body.profileId as string | undefined,
    profileName: body.profileName as string | undefined,
    profileColor: body.profileColor as string | undefined,
    addedAt: Date.now(),
  };
}

// ========================================
// In-memory store (simulates Redis)
// ========================================
class QueueStore {
  private queue: QueuedJob[] = [];
  private locked = false;
  private lockWaiters: Array<() => void> = [];

  private async acquireLock(): Promise<void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.lockWaiters.push(resolve));
    }
    this.locked = true;
  }

  private releaseLock(): void {
    this.locked = false;
    const next = this.lockWaiters.shift();
    if (next) next();
  }

  async getQueue(): Promise<QueuedJob[]> {
    await this.acquireLock();
    try {
      return [...this.queue];
    } finally {
      this.releaseLock();
    }
  }

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

  get length(): number {
    return this.queue.length;
  }
}

// ========================================
// Simulated route handlers
// ========================================
async function handlePOST(store: QueueStore, body: unknown) {
  if (!validJobBody(body)) {
    return { status: 400, body: { error: "Missing required fields" } };
  }

  const newJob = createJob(body);
  const success = await store.addJob(newJob);

  if (!success) {
    return { status: 500, body: { error: "Failed to add job (duplicate ID?)" } };
  }

  return { status: 200, body: { success: true, job: newJob } };
}

async function handlePUT(store: QueueStore, body: unknown) {
  const b = body as Record<string, unknown>;

  if (!b.jobs || !Array.isArray(b.jobs) || (b.jobs as unknown[]).length === 0) {
    return { status: 400, body: { error: "Expected { jobs: [...] } with at least one job" } };
  }

  const jobsData = b.jobs as unknown[];
  const newJobs: QueuedJob[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < jobsData.length; i++) {
    const jobData = jobsData[i];
    if (!validJobBody(jobData)) {
      errors.push({ index: i, error: "Missing required fields" });
      continue;
    }
    newJobs.push(createJob(jobData as Record<string, unknown>));
  }

  if (newJobs.length === 0) {
    return { status: 400, body: { error: "No valid jobs in batch", details: errors } };
  }

  const result = await store.addJobs(newJobs);
  return {
    status: 200,
    body: {
      success: result.added > 0,
      added: result.added,
      duplicates: result.duplicates,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}

async function handleDELETE(store: QueueStore, id?: string | null) {
  if (id) {
    const removed = await store.removeJob(id);
    return { status: 200, body: { success: removed } };
  } else {
    await store.clearQueue();
    return { status: 200, body: { success: true } };
  }
}

async function handlePATCH(store: QueueStore, body: unknown) {
  const b = body as Record<string, unknown>;
  const id = b.id as string;
  const updates = b.updates as Partial<QueuedJob>;

  if (!id || !updates) {
    return { status: 400, body: { error: "Missing id or updates" } };
  }

  const updatedJob = await store.updateJob(id, updates);
  if (!updatedJob) {
    return { status: 404, body: { error: "Job not found" } };
  }

  return { status: 200, body: { success: true, job: updatedJob } };
}

// ========================================
// Tests
// ========================================

describe("Queue API POST /api/queue", () => {
  let store: QueueStore;

  beforeEach(() => {
    store = new QueueStore();
  });

  describe("Validation", () => {
    it("should reject missing companyName", async () => {
      const res = await handlePOST(store, {
        companyUrl: "https://test.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });
      expect(res.status).toBe(400);
    });

    it("should reject missing companyUrl", async () => {
      const res = await handlePOST(store, {
        companyName: "TestCo",
        positionTitle: "Dev",
        jobDescription: "Test",
      });
      expect(res.status).toBe(400);
    });

    it("should reject missing positionTitle", async () => {
      const res = await handlePOST(store, {
        companyName: "TestCo",
        companyUrl: "https://test.com",
        jobDescription: "Test",
      });
      expect(res.status).toBe(400);
    });

    it("should reject missing jobDescription", async () => {
      const res = await handlePOST(store, {
        companyName: "TestCo",
        companyUrl: "https://test.com",
        positionTitle: "Dev",
      });
      expect(res.status).toBe(400);
    });

    it("should reject empty companyName", async () => {
      const res = await handlePOST(store, {
        companyName: "",
        companyUrl: "https://test.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });
      expect(res.status).toBe(400);
    });

    it("should reject non-object body", async () => {
      const res = await handlePOST(store, "not-an-object");
      expect(res.status).toBe(400);
    });

    it("should reject null body", async () => {
      const res = await handlePOST(store, null);
      expect(res.status).toBe(400);
    });
  });

  describe("Successful addition", () => {
    it("should add a valid job and return success", async () => {
      const res = await handlePOST(store, {
        companyName: "Google",
        companyUrl: "https://google.com/jobs/1",
        positionTitle: "SWE",
        jobDescription: "Build search",
        personalDetails: "Kirtan",
        profileId: "p1",
        profileName: "Default",
        profileColor: "blue",
        companyWebsite: "https://google.com",
        includeCoverLetter: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.companyName).toBe("Google");
      expect(res.body.job.status).toBe("pending");
      expect(res.body.job.companyWebsite).toBe("https://google.com");
      expect(res.body.job.includeCoverLetter).toBe(true);
      expect(store.length).toBe(1);
    });

    it("should generate a unique ID if not provided", async () => {
      const res = await handlePOST(store, {
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });

      expect(res.body.job.id).toBeTruthy();
      expect(typeof res.body.job.id).toBe("string");
    });

    it("should use provided ID if given", async () => {
      const res = await handlePOST(store, {
        id: "custom-job-id",
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      });

      expect(res.body.job.id).toBe("custom-job-id");
    });

    it("should reject duplicate job IDs", async () => {
      await handlePOST(store, {
        id: "dup-id",
        companyName: "First",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "A",
      });

      const res = await handlePOST(store, {
        id: "dup-id",
        companyName: "Second",
        companyUrl: "https://b.com",
        positionTitle: "Dev",
        jobDescription: "B",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("duplicate");
      expect(store.length).toBe(1);
    });
  });

  describe("Concurrent POSTs (extension batch simulation)", () => {
    it("should not lose jobs when 10 concurrent POSTs arrive", async () => {
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        companyName: `Company${i}`,
        companyUrl: `https://company${i}.com`,
        positionTitle: `Dev${i}`,
        jobDescription: `Job ${i}`,
      }));

      const results = await Promise.all(jobs.map((job) => handlePOST(store, job)));

      const successes = results.filter((r) => r.status === 200);
      expect(successes.length).toBe(10);
      expect(store.length).toBe(10);

      // No duplicate IDs
      const allJobs = await store.getQueue();
      const ids = allJobs.map((j) => j.id);
      expect(new Set(ids).size).toBe(10);
    });
  });
});

describe("Queue API PUT /api/queue (batch)", () => {
  let store: QueueStore;

  beforeEach(() => {
    store = new QueueStore();
  });

  it("should add multiple jobs in a single request", async () => {
    const res = await handlePUT(store, {
      jobs: [
        {
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev1",
          jobDescription: "A",
        },
        {
          companyName: "B",
          companyUrl: "https://b.com",
          positionTitle: "Dev2",
          jobDescription: "B",
        },
        {
          companyName: "C",
          companyUrl: "https://c.com",
          positionTitle: "Dev3",
          jobDescription: "C",
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(3);
    expect(res.body.duplicates).toBe(0);
    expect(store.length).toBe(3);
  });

  it("should reject empty jobs array", async () => {
    const res = await handlePUT(store, { jobs: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one job");
  });

  it("should reject missing jobs field", async () => {
    const res = await handlePUT(store, {});
    expect(res.status).toBe(400);
  });

  it("should reject non-array jobs field", async () => {
    const res = await handlePUT(store, { jobs: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("should report invalid jobs in batch", async () => {
    const res = await handlePUT(store, {
      jobs: [
        {
          companyName: "Valid",
          companyUrl: "https://v.com",
          positionTitle: "Dev",
          jobDescription: "V",
        },
        { companyName: "", companyUrl: "https://i.com", positionTitle: "Dev", jobDescription: "I" }, // invalid — empty name
        {
          companyName: "Also Valid",
          companyUrl: "https://av.com",
          positionTitle: "Dev",
          jobDescription: "AV",
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].index).toBe(1);
  });

  it("should reject batch where ALL jobs are invalid", async () => {
    const res = await handlePUT(store, {
      jobs: [{ companyName: "", companyUrl: "", positionTitle: "", jobDescription: "" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No valid jobs");
  });

  it("should handle duplicates in batch", async () => {
    // First add a job
    await handlePUT(store, {
      jobs: [
        {
          id: "pre-existing",
          companyName: "A",
          companyUrl: "https://a.com",
          positionTitle: "Dev",
          jobDescription: "A",
        },
      ],
    });

    // Then try batch with duplicate
    const res = await handlePUT(store, {
      jobs: [
        {
          id: "pre-existing",
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
      ],
    });

    expect(res.body.added).toBe(1);
    expect(res.body.duplicates).toBe(1);
    expect(store.length).toBe(2);
  });

  it("should be atomic — all or nothing for valid jobs", async () => {
    // Concurrent batch and individual add
    const batchJobs = {
      jobs: Array.from({ length: 5 }, (_, i) => ({
        companyName: `Batch${i}`,
        companyUrl: `https://batch${i}.com`,
        positionTitle: "Dev",
        jobDescription: `Batch job ${i}`,
      })),
    };

    const singleJob = {
      companyName: "Single",
      companyUrl: "https://single.com",
      positionTitle: "Dev",
      jobDescription: "Single job",
    };

    const [batchResult, singleResult] = await Promise.all([
      handlePUT(store, batchJobs),
      handlePOST(store, singleJob),
    ]);

    expect(batchResult.status).toBe(200);
    expect(singleResult.status).toBe(200);
    expect(store.length).toBe(6); // 5 batch + 1 single
  });
});

describe("Queue API DELETE /api/queue", () => {
  let store: QueueStore;

  beforeEach(async () => {
    store = new QueueStore();
    // Add some test jobs
    await store.addJob({
      id: "job1",
      companyName: "A",
      companyUrl: "https://a.com",
      positionTitle: "Dev",
      jobDescription: "A",
      personalDetails: "",
      includeCoverLetter: false,
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
    });
    await store.addJob({
      id: "job2",
      companyName: "B",
      companyUrl: "https://b.com",
      positionTitle: "Dev",
      jobDescription: "B",
      personalDetails: "",
      includeCoverLetter: false,
      status: "completed",
      progress: 100,
      addedAt: Date.now(),
    });
  });

  it("should delete a specific job by ID", async () => {
    const res = await handleDELETE(store, "job1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(store.length).toBe(1);
  });

  it("should return success=false for non-existent job", async () => {
    const res = await handleDELETE(store, "nonexistent");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });

  it("should clear entire queue when no ID specified", async () => {
    const res = await handleDELETE(store, null);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(store.length).toBe(0);
  });
});

describe("Queue API PATCH /api/queue", () => {
  let store: QueueStore;

  beforeEach(async () => {
    store = new QueueStore();
    await store.addJob({
      id: "job1",
      companyName: "A",
      companyUrl: "https://a.com",
      positionTitle: "Dev",
      jobDescription: "A",
      personalDetails: "",
      includeCoverLetter: false,
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
    });
  });

  it("should update job status", async () => {
    const res = await handlePATCH(store, {
      id: "job1",
      updates: { status: "researching", progress: 5 },
    });

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe("researching");
    expect(res.body.job.progress).toBe(5);
  });

  it("should return 404 for non-existent job", async () => {
    const res = await handlePATCH(store, {
      id: "nonexistent",
      updates: { status: "completed" },
    });

    expect(res.status).toBe(404);
  });

  it("should return 400 when missing id or updates", async () => {
    const res1 = await handlePATCH(store, { updates: { status: "completed" } });
    expect(res1.status).toBe(400);

    const res2 = await handlePATCH(store, { id: "job1" });
    expect(res2.status).toBe(400);
  });

  it("should handle concurrent updates to the same job", async () => {
    const [r1, r2] = await Promise.all([
      handlePATCH(store, { id: "job1", updates: { status: "researching" } }),
      handlePATCH(store, { id: "job1", updates: { progress: 50 } }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Both should succeed, final state reflects last write
    const queue = await store.getQueue();
    const job = queue.find((j) => j.id === "job1");
    expect(job).toBeDefined();
  });
});

describe("completeJobBody validation edge cases", () => {
  it("should accept personalDetails as optional", () => {
    expect(
      validJobBody({
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      }),
    ).toBe(true);
  });

  it("should accept includeCoverLetter as optional (default false)", () => {
    expect(
      validJobBody({
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      }),
    ).toBe(true);
  });

  it("should accept profile fields as optional", () => {
    expect(
      validJobBody({
        companyName: "A",
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
        profileId: "p1",
        profileName: "Test",
        profileColor: "blue",
      }),
    ).toBe(true);
  });

  it("should reject boolean companyName", () => {
    expect(
      validJobBody({
        companyName: true,
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      }),
    ).toBe(false);
  });

  it("should reject number companyName", () => {
    expect(
      validJobBody({
        companyName: 123,
        companyUrl: "https://a.com",
        positionTitle: "Dev",
        jobDescription: "Test",
      }),
    ).toBe(false);
  });
});
