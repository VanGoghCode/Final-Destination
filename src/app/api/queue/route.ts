import { NextResponse } from "next/server";
import { getQueue, addJobToQueue, addJobsToQueue, QueuedJob } from "@/lib/db";
import { corsHeaders } from "@/lib/cors";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

function h() {
  return corsHeaders("GET, POST, PUT, DELETE, PATCH, OPTIONS");
}

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
  resumeLatex?: string;
  coverLetterLatex?: string;
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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: h() });
}

export async function GET() {
  try {
    const queue = await getQueue();
    return NextResponse.json(queue, { headers: h() });
  } catch (error) {
    console.error("Queue GET error:", error);
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500, headers: h() });
  }
}

async function triggerProcessing(request: Request) {
  try {
    const baseUrl = new URL(request.url).origin;
    await fetch(`${baseUrl}/api/process-queue`, { method: "POST" });
  } catch (err) {
    console.error("[queue] Processing chain error:", err);
  }
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`queue_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await request.json();

    if (!validJobBody(body)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: h() });
    }

    const newJob: QueuedJob = {
      id: body.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyName: body.companyName,
      companyUrl: body.companyUrl,
      positionTitle: body.positionTitle,
      jobDescription: body.jobDescription,
      personalDetails: body.personalDetails || "",
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
      profileId: body.profileId,
      profileName: body.profileName,
      profileColor: body.profileColor,
      companyWebsite: body.companyWebsite,
      includeCoverLetter: body.includeCoverLetter || false,
    };

    const success = await addJobToQueue(newJob);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to add job (duplicate ID?)" },
        { status: 500, headers: h() },
      );
    }

    // Kick off processing immediately (fire-and-forget chain)
    triggerProcessing(request).catch((err) =>
      console.error("[queue] Processing chain failed:", err),
    );

    return NextResponse.json({ success: true, job: newJob }, { headers: h() });
  } catch (error) {
    console.error("Queue POST error:", error);
    return NextResponse.json({ error: "Failed to add job" }, { status: 500, headers: h() });
  }
}

/**
 * PUT /api/queue — atomic batch add
 * Accepts { jobs: [...] } with an array of job payloads.
 * All jobs are added in a single atomic transaction — no race conditions.
 */
export async function PUT(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`queue_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await request.json();

    if (!body.jobs || !Array.isArray(body.jobs) || body.jobs.length === 0) {
      return NextResponse.json(
        { error: "Expected { jobs: [...] } with at least one job" },
        { status: 400, headers: h() },
      );
    }

    const newJobs: QueuedJob[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < body.jobs.length; i++) {
      const jobData = body.jobs[i];
      if (!validJobBody(jobData)) {
        errors.push({ index: i, error: "Missing required fields" });
        continue;
      }
      newJobs.push({
        id: jobData.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`,
        companyName: jobData.companyName,
        companyUrl: jobData.companyUrl,
        positionTitle: jobData.positionTitle,
        jobDescription: jobData.jobDescription,
        personalDetails: jobData.personalDetails || "",
        status: "pending",
        progress: 0,
        addedAt: Date.now(),
        profileId: jobData.profileId,
        profileName: jobData.profileName,
        profileColor: jobData.profileColor,
        companyWebsite: jobData.companyWebsite,
        includeCoverLetter: jobData.includeCoverLetter || false,
        resumeLatex: jobData.resumeLatex,
        coverLetterLatex: jobData.coverLetterLatex,
      });
    }

    if (newJobs.length === 0) {
      return NextResponse.json(
        { error: "No valid jobs in batch", details: errors },
        { status: 400, headers: h() },
      );
    }

    const result = await addJobsToQueue(newJobs);

    return NextResponse.json(
      {
        success: result.success,
        added: result.added,
        duplicates: result.duplicates,
        errors: errors.length > 0 ? errors : undefined,
        jobs: newJobs.slice(0, result.added),
      },
      { headers: h() },
    );
  } catch (error) {
    console.error("Queue PUT (batch) error:", error);
    return NextResponse.json({ error: "Failed to add batch jobs" }, { status: 500, headers: h() });
  }
}

export async function DELETE(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`queue_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const { removeJobFromQueue } = await import("@/lib/db");
      const removed = await removeJobFromQueue(id);
      return NextResponse.json({ success: removed }, { headers: h() });
    } else {
      const { clearQueue } = await import("@/lib/db");
      await clearQueue();
      return NextResponse.json({ success: true }, { headers: h() });
    }
  } catch (error) {
    console.error("Queue DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete job(s)" }, { status: 500, headers: h() });
  }
}

export async function PATCH(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`queue_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ error: "Missing id or updates" }, { status: 400, headers: h() });
    }

    const { updateJobInQueue } = await import("@/lib/db");
    const updatedJob = await updateJobInQueue(id, updates);

    if (!updatedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: h() });
    }

    return NextResponse.json({ success: true, job: updatedJob }, { headers: h() });
  } catch (error) {
    console.error("Queue PATCH error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500, headers: h() });
  }
}
