import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  getQueue,
  addJobToQueue,
  addJobsToQueue,
  claimJob,
  updateJobInQueue,
  removeJobFromQueue,
  clearQueue,
  clearCompletedJobs,
  getQueueState,
  setQueuePaused,
  type QueuedJob,
} from "@/lib/db";
import { corsHeaders, handleOptions } from "@/lib/cors";

const headers = () => corsHeaders();
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: headers() });
const required = ["companyName", "companyUrl", "positionTitle", "jobDescription"] as const;
const optional = [
  "personalDetails",
  "profileId",
  "profileName",
  "profileColor",
  "companyWebsite",
  "resumeLatex",
  "coverLetterLatex",
] as const;
function newJob(value: unknown): QueuedJob | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    !required.every((key) => typeof body[key] === "string" && (body[key] as string).trim()) ||
    !optional.every((key) => body[key] === undefined || typeof body[key] === "string") ||
    (body.includeCoverLetter !== undefined && typeof body.includeCoverLetter !== "boolean")
  )
    return null;
  if (
    [...required, ...optional].some(
      (key) => typeof body[key] === "string" && (body[key] as string).length > 200_000,
    ) ||
    (body.id !== undefined && (typeof body.id !== "string" || !body.id || body.id.length > 200))
  )
    return null;
  const fields = Object.fromEntries(
    [...required, ...optional]
      .filter((key) => body[key] !== undefined)
      .map((key) => [
        key,
        typeof body[key] === "string" ? (body[key] as string).trim() : body[key],
      ]),
  );
  return {
    ...fields,
    inputHash: createHash("sha256")
      .update(
        JSON.stringify({
          ...fields,
          personalDetails: body.personalDetails || "",
          includeCoverLetter: body.includeCoverLetter === true,
        }),
      )
      .digest("hex"),
    id: typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
    personalDetails: body.personalDetails || "",
    includeCoverLetter: body.includeCoverLetter === true,
    status: "pending",
    progress: 0,
    addedAt: Date.now(),
  } as QueuedJob;
}
async function handle(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError)
      return response({ error: "Invalid request body" }, 400);
    console.error("Queue request failed", error);
    return response({ error: "Queue storage operation failed" }, 500);
  }
}
export const OPTIONS = () => handleOptions();
export const GET = (request?: Request) =>
  handle(async () =>
    response(
      request && new URL(request.url).searchParams.has("state")
        ? await getQueueState()
        : await getQueue(),
    ),
  );
export const POST = (request: Request) =>
  handle(async () => {
    const job = newJob(await request.json());
    if (!job) return response({ error: "Missing or invalid required fields" }, 400);
    if (await addJobToQueue(job)) return response({ success: true, job });
    const existing = (await getQueue()).find((saved) => saved.id === job.id);
    return existing &&
      (existing.inputHash
        ? existing.inputHash === job.inputHash
        : [...required, ...optional, "includeCoverLetter" as const].every(
            (key) => (existing[key] || "") === (job[key] || ""),
          ))
      ? response({ success: true, duplicate: true, job: existing })
      : response({ error: "Job ID already exists with different details" }, 409);
  });
export const PUT = (request: Request) =>
  handle(async () => {
    const { jobs: input } = await request.json();
    if (!Array.isArray(input) || !input.length || input.length > 50)
      return response({ error: "Expected 1–50 jobs" }, 400);
    const jobs: QueuedJob[] = [],
      errors: Array<{ index: number; error: string }> = [];
    input.forEach((value, index) => {
      const job = newJob(value);
      if (job) jobs.push(job);
      else errors.push({ index, error: "Missing or invalid required fields" });
    });
    if (!jobs.length) return response({ error: "No valid jobs", details: errors }, 400);
    return response({
      ...(await addJobsToQueue(jobs)),
      errors: errors.length ? errors : undefined,
    });
  });
export const PATCH = (request: Request) =>
  handle(async () => {
    const { id, updates, action, runId, expectedCompletedAt } = await request.json();
    if (
      expectedCompletedAt !== undefined &&
      (typeof expectedCompletedAt !== "number" || !Number.isFinite(expectedCompletedAt))
    )
      return response({ error: "Invalid results version" }, 400);
    if (action === "pause" || action === "resume")
      return response({ paused: await setQueuePaused(action === "pause") });
    if (typeof id !== "string" || !id || (runId !== undefined && typeof runId !== "string"))
      return response({ error: "Invalid job ID or claim" }, 400);
    if (action === "claim") {
      const job = await claimJob(id);
      return job
        ? response({ job })
        : response({ error: "Job is already claimed or unavailable" }, 409);
    }
    if (
      !updates ||
      typeof updates !== "object" ||
      Array.isArray(updates) ||
      (action && !["reset", "retry", "cancel", "edit"].includes(action))
    )
      return response({ error: "Invalid updates" }, 400);
    const strings = [
      ...required,
      ...optional,
      "error",
      "tailoredResume",
      "tailoredCoverLetter",
      "companyResearch",
      "jobCountry",
      "jobWorkMode",
    ];
    const numbers = ["progress", "retryCount", "startedAt", "completedAt"];
    if (
      Object.entries(updates).some(([key, value]) =>
        strings.includes(key)
          ? typeof value !== "string" ||
            value.length > 200_000 ||
            (required.includes(key as (typeof required)[number]) && !value.trim())
          : numbers.includes(key)
            ? typeof value !== "number" || !Number.isFinite(value) || value < 0
            : key === "includeCoverLetter"
              ? typeof value !== "boolean"
              : key === "status"
                ? ![
                    "pending",
                    "researching",
                    "tailoring-resume",
                    "tailoring-cover-letter",
                    "completed",
                    "failed",
                    "cancelled",
                  ].includes(value as string)
                : true,
      ) ||
      (updates.progress !== undefined && updates.progress > 100)
    )
      return response({ error: "Invalid update fields or values" }, 400);
    const safe = { ...updates } as Partial<QueuedJob>;
    if (action === "cancel") {
      safe.status = "cancelled";
      safe.completedAt = Date.now();
    } else if (action) {
      safe.status = "pending";
      safe.progress = 0;
    }
    const job = await updateJobInQueue(
      id,
      safe,
      runId,
      action === "reset",
      action === "retry",
      action === "edit",
      expectedCompletedAt,
    );
    return job
      ? response({ success: true, job })
      : response(
          { error: "Job unavailable, already processing, or results changed. Refresh the queue." },
          runId || expectedCompletedAt !== undefined || action === "edit" ? 409 : 404,
        );
  });
export const DELETE = (request: Request) =>
  handle(async () => {
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if ((params.has("id") && !id) || (params.has("status") && params.get("status") !== "completed"))
      return response({ error: "Invalid delete filter" }, 400);
    const success = id
      ? await removeJobFromQueue(id)
      : params.get("status") === "completed"
        ? await clearCompletedJobs()
        : await clearQueue();
    return response({ success });
  });
