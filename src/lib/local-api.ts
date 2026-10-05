import { personalProfile, masterContext } from "./personal-workspace";
import * as browserQueue from "./browser-queue";
import type { QueuedJob } from "./browser-queue";
import { parseQueueState } from "./browser-queue";
import { isActiveJob } from "./queue";

const response = (data: unknown, status = 200) => Response.json(data, { status });
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
async function newJob(value: unknown): Promise<QueuedJob | null> {
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
  try {
    const url = new URL(body.companyUrl as string);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  } catch {
    return null;
  }
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
    inputHash: Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            JSON.stringify({
              ...Object.fromEntries(
                [...required, ...optional].map((key) => [key, fields[key] || ""]),
              ),
              includeCoverLetter: body.includeCoverLetter === true,
            }),
          ),
        ),
      ),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
    id: typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
    personalDetails: fields.personalDetails || "",
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
    const message = error instanceof Error ? error.message : "Browser storage unavailable or full";
    return response(
      { error: `Queue storage: ${message}` },
      message.includes("different details") ? 409 : 503,
    );
  }
}
export function createQueueHandler(queue: ReturnType<typeof browserQueue.createQueueStore>) {
  const {
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
  } = queue;
  const GET = (request?: Request) =>
    handle(async () =>
      response(
        request && new URL(request.url).searchParams.has("state")
          ? await getQueueState()
          : await getQueue(),
      ),
    );
  const POST = (request: Request) =>
    handle(async () => {
      const job = await newJob(await request.json());
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
  const PUT = (request: Request) =>
    handle(async () => {
      const { jobs: input, startQueue, restore } = await request.json();
      if (restore !== undefined) {
        const next = parseQueueState(JSON.stringify(restore));
        const current = await queue.getQueueState();
        if (!current.paused || current.jobs.some(isActiveJob))
          return response(
            { error: "Pause the queue and wait for the current job to finish before restoring." },
            409,
          );
        await queue.setQueue(
          next.jobs.map((job) =>
            isActiveJob(job)
              ? { ...job, status: "pending", runId: undefined, leaseExpiresAt: undefined }
              : job,
          ),
        );
        await queue.setQueuePaused(true);
        return response({ success: true });
      }
      if (
        !Array.isArray(input) ||
        !input.length ||
        input.length > 15 ||
        (startQueue !== undefined && typeof startQueue !== "boolean")
      )
        return response({ error: "Expected 1–15 jobs" }, 400);
      const jobs: QueuedJob[] = [],
        errors: Array<{ index: number; error: string }> = [];
      const parsed = await Promise.all(input.map(newJob));
      parsed.forEach((job, index) => {
        if (job) jobs.push(job);
        else errors.push({ index, error: "Missing or invalid required fields" });
      });
      if (errors.length)
        return response(
          { error: "Every job must be valid. No jobs were saved.", details: errors },
          400,
        );
      return response(await addJobsToQueue(jobs, startQueue === true));
    });
  const PATCH = (request: Request) =>
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
        const job = await claimJob(id === "next" ? undefined : id);
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
            {
              error: "Job unavailable, already processing, or results changed. Refresh the queue.",
            },
            runId || expectedCompletedAt !== undefined || action === "edit" ? 409 : 404,
          );
    });
  const DELETE = (request: Request) =>
    handle(async () => {
      const params = new URL(request.url).searchParams;
      const id = params.get("id");
      if (
        (params.has("id") && !id) ||
        (params.has("status") && params.get("status") !== "completed")
      )
        return response({ error: "Invalid delete filter" }, 400);
      const success = id
        ? await removeJobFromQueue(id)
        : params.get("status") === "completed"
          ? await clearCompletedJobs()
          : await clearQueue();
      return response({ success });
    });

  return async (request: Request) => {
    const handler = { GET, POST, PUT, PATCH, DELETE }[request.method as "GET"];
    return handler ? handler(request) : response({ error: "Method not allowed" }, 405);
  };
}

export async function localRequest(
  input: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  if (!["/api/queue", "/api/profiles", "/api/master-context"].includes(url.pathname)) return null;
  if (init.signal?.aborted) throw init.signal.reason;
  const request = new Request(url, init);
  if (url.pathname === "/api/queue") {
    return createQueueHandler(browserQueue)(request);
  }
  if (request.method !== "GET")
    return response({ error: "Personal templates and background are managed in code." }, 405);
  return response(
    url.pathname.endsWith("profiles") ? [personalProfile] : { content: masterContext },
  );
}
