import { NextResponse } from "next/server";
import {
  claimJob,
  getQueue,
  getRedis,
  getProfiles,
  updateJobInQueue,
  isQueuePaused,
  type QueuedJob,
} from "@/lib/db";
import { tailorResume, tailorCoverLetter, extractJobLocationInfo } from "@/lib/ai";
import { getApiKey, getAISelection } from "@/lib/api-key";
import { withAIBudget } from "@/lib/ai-providers/http";

interface Template {
  id: string;
  content: string;
}
async function template(kind: "resume" | "cover_letter", id?: string | null, strict = false) {
  const redis = getRedis();
  const templates = (await redis.get<Template[]>(`fd:fd_${kind}_templates`)) ?? [];
  const selected = id || (!strict && (await redis.get<string>(`fd:fd_default_${kind}_id`)));
  return (
    templates.find((t) => t.id === selected)?.content || (!strict && templates[0]?.content) || null
  );
}
export const maxDuration = 300;
export async function POST(request?: Request) {
  let id: string | undefined;
  if (request?.body) {
    try {
      const body = await request.json();
      if (
        !body ||
        typeof body !== "object" ||
        (body.id !== undefined && (typeof body.id !== "string" || !body.id))
      )
        throw new Error();
      id = body.id;
    } catch {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }
  }
  const controller = new AbortController();
  return withAIBudget(285_000, () => processQueue(id, controller), controller.signal);
}
async function processQueue(id: string | undefined, controller: AbortController) {
  let job: QueuedJob | null = null;
  let monitor: ReturnType<typeof setInterval> | undefined;
  const workerKey = "lock:queue:worker",
    workerId = crypto.randomUUID();
  let ownsWorker = false;
  try {
    if (await isQueuePaused()) return NextResponse.json({ processed: false, reason: "paused" });
    const { provider } = await getAISelection();
    if (!(await getApiKey(provider)))
      return NextResponse.json(
        { processed: false, error: "Configure an AI API key in the sidebar before processing." },
        { status: 503 },
      );
    ownsWorker = (await getRedis().set(workerKey, workerId, { nx: true, ex: 300 })) === "OK";
    if (!ownsWorker) return NextResponse.json({ processed: false, reason: "worker_busy" });
    job = await claimJob(id);
    if (!job) return NextResponse.json({ processed: false, reason: "no_pending" });
    const claimed = job;
    let checking = false;
    monitor = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        if (
          !(await getQueue()).some(
            (saved) => saved.id === claimed.id && saved.runId === claimed.runId,
          )
        )
          controller.abort(new Error("Job cancelled, removed, or restarted"));
      } catch {
        controller.abort(new Error("Queue storage unavailable"));
      } finally {
        checking = false;
      }
    }, 2000);
    const update = async (updates: Partial<QueuedJob>) => {
      if (!(await updateJobInQueue(claimed.id, updates, claimed.runId)))
        throw new Error("Job claim expired");
    };
    const profile = job.profileId
      ? (await getProfiles()).find((p) => p.id === job!.profileId)
      : undefined;
    if (job.profileId && !profile) throw new Error("Profile not found. Select another profile.");
    const resume =
      job.resumeLatex || (await template("resume", profile?.defaultResumeId, !!profile));
    if (!resume)
      throw new Error("No resume template assigned. Select a template in profile settings.");
    const cover = job.includeCoverLetter
      ? job.coverLetterLatex ||
        (await template("cover_letter", profile?.defaultCoverLetterId, !!profile))
      : null;
    if (job.includeCoverLetter && !cover) throw new Error("No cover letter template assigned.");
    const context = (await getRedis().get<string>("fd:fd_master_context")) || "";
    const details = job.personalDetails || "";
    const [tailoredResume, location] = await Promise.all([
      tailorResume(resume, job.jobDescription, details, context),
      extractJobLocationInfo(job.jobDescription, job.companyName),
    ]);
    if (!tailoredResume?.trim()) throw new Error("AI returned an empty resume. Retry this job.");
    await update({
      progress: 60,
      tailoredResume,
      resumeLatex: resume,
      jobCountry: location.country || undefined,
      jobWorkMode: location.workMode as QueuedJob["jobWorkMode"],
    });
    if (cover) {
      await update({ status: "tailoring-cover-letter", progress: 70 });
      const tailoredCoverLetter = await tailorCoverLetter(
        cover,
        job.jobDescription,
        details,
        context,
        undefined,
        tailoredResume,
      );
      if (!tailoredCoverLetter?.trim())
        throw new Error("AI returned an empty cover letter. Retry this job.");
      await update({ tailoredCoverLetter, coverLetterLatex: cover });
    }
    await update({ status: "completed", progress: 100, completedAt: Date.now() });
    const remainingCount = (await getQueue()).filter((j) => j.status === "pending").length;
    return NextResponse.json({
      processed: true,
      morePending: remainingCount > 0,
      remainingCount,
      jobId: job.id,
      companyName: job.companyName,
      positionTitle: job.positionTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    if (job) {
      try {
        await updateJobInQueue(
          job.id,
          { status: "failed", error: message, completedAt: Date.now() },
          job.runId,
        );
      } catch (writeError) {
        console.error("Failed to persist processing failure", writeError);
      }
    }
    return NextResponse.json({ processed: false, error: message, jobId: job?.id }, { status: 500 });
  } finally {
    if (monitor) clearInterval(monitor);
    if (ownsWorker) {
      try {
        await getRedis().eval(
          `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
          [workerKey],
          [workerId],
        );
      } catch (error) {
        console.error("Worker lease release failed", error);
      }
    }
  }
}
