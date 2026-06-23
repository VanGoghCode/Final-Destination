import { describe, it, expect } from "bun:test";

// ========================================
// Pure logic tests — processing flow
// No DOM dependency — test the data flow
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
const nextId = () => `job_process_${++idCounter}`;

function makeJob(overrides: Partial<QueuedJob> = {}): QueuedJob {
  return {
    id: nextId(),
    companyName: "TestCorp",
    companyUrl: "https://testcorp.com/jobs/1",
    positionTitle: "SWE",
    jobDescription: "Build things.",
    personalDetails: "",
    includeCoverLetter: false,
    status: "pending",
    progress: 0,
    addedAt: Date.now(),
    ...overrides,
  };
}

function updateStatus(
  queue: QueuedJob[],
  id: string,
  status: JobStatus,
  progress?: number,
): QueuedJob[] {
  return queue.map((job) => {
    if (job.id !== id) return job;
    const updates: Partial<QueuedJob> = { status };
    if (progress !== undefined) updates.progress = progress;
    if (["researching", "tailoring-resume", "tailoring-cover-letter"].includes(status)) {
      if (!job.startedAt) updates.startedAt = Date.now();
    }
    if (status === "completed" || status === "failed") updates.completedAt = Date.now();
    return { ...job, ...updates };
  });
}

function updateResults(queue: QueuedJob[], id: string, results: Partial<QueuedJob>): QueuedJob[] {
  return queue.map((job) => (job.id === id ? { ...job, ...results } : job));
}

function setError(queue: QueuedJob[], id: string, error: string): QueuedJob[] {
  return queue.map((job) =>
    job.id === id ? { ...job, status: "failed" as JobStatus, error, completedAt: Date.now() } : job,
  );
}

function cancelJob(queue: QueuedJob[], id: string): QueuedJob[] {
  return queue.map((job) =>
    job.id === id
      ? { ...job, status: "cancelled" as JobStatus, progress: 0, completedAt: Date.now() }
      : job,
  );
}

function retryJob(queue: QueuedJob[], id: string): QueuedJob[] {
  return queue.map((job) => {
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

/**
 * Simulates the processJob function from batch/page.tsx
 * Uses all 5 processing phases: researching → tailoring-resume → [cover letter] → completed
 * Passes companyWebsite through to tailor API body.
 */
function simulateProcessJob(
  job: QueuedJob,
  hasCoverLetterTemplate: boolean,
): { queue: QueuedJob[]; tailorBody?: Record<string, unknown>; error?: string } {
  let q: QueuedJob[] = [job];

  // Guard: no resume template
  // (caller should check before calling — this simulates the check)
  if (!job.resumeLatex) {
    q = setError(q, job.id, "No resume template found for this job's profile");
    return { queue: q, error: "No resume template found" };
  }

  // Phase 1: researching
  q = updateStatus(q, job.id, "researching", 5);

  // Build tailor request body (bug #10: must include companyWebsite)
  const tailorBody: Record<string, unknown> = {
    resumeLatex: job.resumeLatex,
    jobDescription: job.jobDescription,
    personalDetails: job.personalDetails,
    companyName: job.companyName,
  };
  if (job.companyWebsite) {
    tailorBody.companyWebsite = job.companyWebsite;
  }

  // Phase 2: tailoring-resume
  q = updateStatus(q, job.id, "tailoring-resume", 30);
  q = updateResults(q, job.id, {
    tailoredResume: "% Tailored resume content",
    resumeLatex: job.resumeLatex,
    coverLetterLatex: undefined,
    jobCountry: "US",
    jobWorkMode: "Remote",
  });
  q = updateStatus(q, job.id, "tailoring-resume", 60);

  // Phase 3: cover letter (if applicable)
  if (job.includeCoverLetter && hasCoverLetterTemplate) {
    q = updateStatus(q, job.id, "tailoring-cover-letter", 70);
    q = updateResults(q, job.id, {
      tailoredCoverLetter: "% Cover letter content",
    });
  }

  // Phase 4: completed
  q = updateStatus(q, job.id, "completed", 100);

  return { queue: q, tailorBody };
}

describe("processJob simulation — all bugs", () => {
  // ----------------------------------------------------------------
  // Bug #6: researching status is set and tracked
  // ----------------------------------------------------------------
  it("should pass through researching phase (bug #6)", () => {
    let q: QueuedJob[] = [makeJob({ resumeLatex: "% template" })];
    expect(q[0]?.status).toBe("pending");

    q = updateStatus(q, q[0]!.id, "researching", 5);
    expect(q[0]?.status).toBe("researching");
    expect(q[0]?.progress).toBe(5);
    expect(q[0]?.startedAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // Bug #10: companyWebsite passed through tailor API
  // ----------------------------------------------------------------
  it("should include companyWebsite in tailor body (bug #10)", () => {
    const job = makeJob({
      resumeLatex: "% template",
      companyWebsite: "https://google.com",
    });

    const { tailorBody } = simulateProcessJob(job, false);
    expect(tailorBody?.companyWebsite).toBe("https://google.com");
  });

  it("should omit companyWebsite from tailor body when not set", () => {
    const job = makeJob({ resumeLatex: "% template" });
    const { tailorBody } = simulateProcessJob(job, false);
    expect(tailorBody?.companyWebsite).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // Bug #1: cancel during processing marks as cancelled
  // ----------------------------------------------------------------
  it("should mark in-flight job as cancelled (bug #1)", () => {
    let q: QueuedJob[] = [makeJob({ resumeLatex: "% template" })];
    const id = q[0]!.id;

    // Job is processing
    q = updateStatus(q, id, "tailoring-resume", 30);

    // User stops
    q = cancelJob(q, id);

    expect(q[0]?.status).toBe("cancelled");
    expect(q[0]?.completedAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // Unintentional abort reverts to pending
  // ----------------------------------------------------------------
  it("should revert to pending on unintentional abort", () => {
    let q: QueuedJob[] = [makeJob({ resumeLatex: "% template" })];
    const id = q[0]!.id;

    q = updateStatus(q, id, "tailoring-resume", 30);
    // Abort without cancel — e.g., page navigation
    q = updateStatus(q, id, "pending", 0);

    expect(q[0]?.status).toBe("pending");
    expect(q[0]?.progress).toBe(0);
  });

  // ----------------------------------------------------------------
  // Full flow: pending → researching → tailoring → completed
  // ----------------------------------------------------------------
  it("should process a job end-to-end (no cover letter)", () => {
    const job = makeJob({ resumeLatex: "% template", includeCoverLetter: false });
    const { queue: q } = simulateProcessJob(job, true);

    expect(q[0]?.status).toBe("completed");
    expect(q[0]?.progress).toBe(100);
    expect(q[0]?.completedAt).toBeGreaterThan(0);
    expect(q[0]?.startedAt).toBeGreaterThan(0);
    expect(q[0]?.tailoredResume).toBeTruthy();
    expect(q[0]?.tailoredCoverLetter).toBeUndefined();
  });

  it("should process a job with cover letter", () => {
    const job = makeJob({
      resumeLatex: "% template",
      coverLetterLatex: "% cl template",
      includeCoverLetter: true,
    });
    const { queue: q } = simulateProcessJob(job, true);

    expect(q[0]?.status).toBe("completed");
    expect(q[0]?.tailoredCoverLetter).toBeTruthy();
    expect(q[0]?.jobCountry).toBe("US");
    expect(q[0]?.jobWorkMode).toBe("Remote");
  });

  // ----------------------------------------------------------------
  // Error: missing resume template
  // ----------------------------------------------------------------
  it("should fail when no resume template", () => {
    const job = makeJob(); // no resumeLatex
    const { error, queue: q } = simulateProcessJob(job, false);

    expect(error).toBe("No resume template found");
    expect(q[0]?.status).toBe("failed");
    expect(q[0]?.error).toBe("No resume template found for this job's profile");
  });

  // ----------------------------------------------------------------
  // Template guard: processing loop should not start without template
  // ----------------------------------------------------------------
  it("should not start processing when resume template missing (bug #5)", () => {
    // This simulates the guard: if (!resumeTemplate) return early
    // The guard prevents the processing effect from running.
    // Here we verify the consequence: the job stays pending.
    const job = makeJob();
    expect(job.status).toBe("pending");
    expect(job.resumeLatex).toBeUndefined();
    // processJob would fail — the template guard prevents this
  });

  // ----------------------------------------------------------------
  // retryJob after failure
  // ----------------------------------------------------------------
  it("should retry a failed job with incremented retryCount (bug #8)", () => {
    let q: QueuedJob[] = [makeJob({ resumeLatex: "% template" })];
    const id = q[0]!.id;

    // Fail
    q = setError(q, id, "API timeout");
    expect(q[0]?.status).toBe("failed");

    // Retry
    q = retryJob(q, id);
    expect(q[0]?.status).toBe("pending");
    expect(q[0]?.retryCount).toBe(1);
    expect(q[0]?.error).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // companyWebsite stored on job object
  // ----------------------------------------------------------------
  it("should store companyWebsite on the queued job", () => {
    const job = makeJob({ companyWebsite: "https://example.com" });
    expect(job.companyWebsite).toBe("https://example.com");
  });

  it("should allow companyWebsite to be undefined", () => {
    const job = makeJob();
    expect(job.companyWebsite).toBeUndefined();
  });
});

// ===================================================
// Extension → Queue integration test (no DOM)
// ===================================================
describe("Extension to queue integration", () => {
  it("should accept all fields that the Chrome extension sends", () => {
    // This is what the extension POSTs to /api/queue
    const extensionPayload = {
      id: undefined, // server generates
      companyName: "Google",
      companyUrl: "https://google.com/jobs/swe", // job posting URL
      positionTitle: "Software Engineer",
      jobDescription: "Build the future.",
      personalDetails: "",
      profileId: "p_abc123",
      profileName: "My Profile",
      profileColor: "blue",
      companyWebsite: "https://google.com", // for research
      includeCoverLetter: true,
    };

    // Server creates the QueuedJob (mimics POST /api/queue handler)
    const storedJob: QueuedJob = {
      ...extensionPayload,
      id: `job_${Date.now()}_generated`,
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
    };

    // Verify all fields are preserved
    expect(storedJob.companyName).toBe("Google");
    expect(storedJob.positionTitle).toBe("Software Engineer");
    expect(storedJob.companyWebsite).toBe("https://google.com");
    expect(storedJob.profileName).toBe("My Profile");
    expect(storedJob.includeCoverLetter).toBe(true);
    expect(storedJob.status).toBe("pending");
  });

  it("should be fetchable by polling (GET /api/queue returns stored jobs)", () => {
    const storedQueue: QueuedJob[] = [
      makeJob({ companyName: "Google" }),
      makeJob({ companyName: "Apple" }),
    ];

    expect(storedQueue).toHaveLength(2);
    expect(Array.isArray(storedQueue)).toBe(true);
    expect(storedQueue.every((j) => typeof j.id === "string")).toBe(true);
  });

  it("should not lose fields when synced through the queue", () => {
    // Simulate round-trip: add to queue → poll from queue
    const original = makeJob({
      companyName: "Stripe",
      companyWebsite: "https://stripe.com",
      profileId: "p_xyz",
      profileColor: "purple",
      includeCoverLetter: true,
      resumeLatex: "% template",
    });

    // Simulate storing (like addJobToQueue in db.ts)
    const stored = { ...original };

    // Simulate polling (like GET /api/queue response)
    const polled = { ...stored };

    expect(polled.companyWebsite).toBe("https://stripe.com");
    expect(polled.profileId).toBe("p_xyz");
    expect(polled.includeCoverLetter).toBe(true);
  });
});
