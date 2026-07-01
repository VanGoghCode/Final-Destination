import { NextResponse } from "next/server";
import { getQueue, updateJobInQueue, getProfiles } from "@/lib/db";
import { tailorResume, tailorCoverLetter, extractJobLocationInfo } from "@/lib/ai";
import { getDeepSeekApiKey } from "@/lib/api-key";
import { Redis } from "@upstash/redis";

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — reset stuck jobs

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

interface StoredTemplate {
  id: string;
  name: string;
  content: string;
}

async function getDefaultTemplate(
  templatesKey: string,
  defaultIdKey: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const templates = await redis.get<StoredTemplate[]>(templatesKey);
    if (!templates || templates.length === 0) return null;

    const defaultId = await redis.get<string>(defaultIdKey);
    if (defaultId) {
      const t = templates.find((t) => t.id === defaultId);
      if (t?.content) return t.content;
    }

    return templates[0]?.content || null;
  } catch {
    return null;
  }
}

async function getMasterContext(): Promise<string> {
  const redis = getRedis();
  if (!redis) return "";

  try {
    const ctx = await redis.get<string>("fd:fd_master_context");
    return ctx || "";
  } catch {
    return "";
  }
}

/**
 * POST /api/process-queue
 *
 * Server-side queue processor. Processes ONE pending job per invocation.
 * Reads templates from Redis (or uses job's baked-in resumeLatex/coverLetterLatex).
 * Updates queue status after each step.
 *
 * Designed to be called by:
 *   - Vercel Cron Job (/api/cron/process-queue)
 *   - Client-side after batch import
 *   - External cron services
 */
export async function POST() {
  const queue = await getQueue().catch((error) => {
    console.error("[process-queue] Failed to read queue:", error);
    return null;
  });

  if (!queue || !Array.isArray(queue) || queue.length === 0) {
    return NextResponse.json({ processed: false, reason: "empty_queue" });
  }

  // Reset jobs stuck in processing state beyond timeout
  const now = Date.now();
  for (const job of queue) {
    if (
      job.status !== "pending" &&
      job.status !== "completed" &&
      job.status !== "failed" &&
      job.status !== "cancelled" &&
      job.startedAt &&
      now - job.startedAt > PROCESSING_TIMEOUT_MS
    ) {
      console.log(
        `[process-queue] Resetting stuck job ${job.id} (${job.companyName}) from ${job.status}`,
      );
      await updateJobInQueue(job.id, {
        status: "pending",
        progress: 0,
        error: undefined,
        startedAt: undefined,
      });
    }
  }

  // Find first truly pending job (after possible reset above)
  const pendingJob = queue.find((j) => j.status === "pending");
  if (!pendingJob) {
    return NextResponse.json({ processed: false, reason: "no_pending" });
  }

  // Check if API key is available server-side.
  // If only cookie-based (browser-only), skip so the client-side batch page can handle it.
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) {
    return NextResponse.json({
      processed: false,
      reason: "api_key_unavailable",
      message:
        "DeepSeek API key not available server-side. Set DEEPSEEK_API_KEY env var for server-side processing, " +
        "or use the client-side batch page which sends the key from your browser.",
    });
  }

  // Resolve resume template — priority: baked-in > profile > default
  let resumeLatex = pendingJob.resumeLatex;

  // Resolve from profile if no baked-in template
  if (!resumeLatex && pendingJob.profileId) {
    const redis = getRedis();
    const allProfiles = await getProfiles().catch(() => []);
    const profile = allProfiles.find((p) => p.id === pendingJob.profileId);

    if (!profile) {
      await updateJobInQueue(pendingJob.id, {
        status: "failed",
        error: `Profile "${pendingJob.profileName || pendingJob.profileId}" not found. Edit the job and select a different profile.`,
        progress: 0,
        completedAt: Date.now(),
      });
      return NextResponse.json({
        processed: false,
        reason: "profile_not_found",
        jobId: pendingJob.id,
      });
    }

    if (profile.defaultResumeId && redis) {
      const templates = await redis.get<StoredTemplate[]>("fd:fd_resume_templates");
      const tmpl = (templates || []).find((t) => t.id === profile.defaultResumeId);
      if (tmpl?.content) resumeLatex = tmpl.content;
    }

    if (!resumeLatex) {
      await updateJobInQueue(pendingJob.id, {
        status: "failed",
        error: `Profile "${profile.name}" has no resume template assigned. Select a template in profile settings.`,
        progress: 0,
        completedAt: Date.now(),
      });
      return NextResponse.json({
        processed: false,
        reason: "profile_no_template",
        jobId: pendingJob.id,
      });
    }

    // Also resolve cover letter from profile if needed
    if (
      pendingJob.includeCoverLetter &&
      !pendingJob.coverLetterLatex &&
      profile.defaultCoverLetterId &&
      redis
    ) {
      const clTemplates = await redis.get<StoredTemplate[]>("fd:fd_cover_letter_templates");
      const clTmpl = (clTemplates || []).find((t) => t.id === profile.defaultCoverLetterId);
      if (clTmpl?.content) {
        pendingJob.coverLetterLatex = clTmpl.content;
      }
    }
  }

  if (!resumeLatex) {
    const tmpl = await getDefaultTemplate("fd:fd_resume_templates", "fd:fd_default_resume_id");
    if (tmpl) resumeLatex = tmpl;
  }

  if (!resumeLatex) {
    await updateJobInQueue(pendingJob.id, {
      status: "failed",
      error: "No resume template found. Save a resume template first.",
      progress: 0,
      completedAt: Date.now(),
    });
    return NextResponse.json({
      processed: false,
      reason: "no_template",
      jobId: pendingJob.id,
    });
  }

  const masterContext = await getMasterContext();

  try {
    // --- Step 1: Tailor Resume ---
    await updateJobInQueue(pendingJob.id, {
      status: "tailoring-resume",
      progress: 5,
      startedAt: Date.now(),
    });

    const [tailoredResume, locationInfo] = await Promise.all([
      tailorResume(
        resumeLatex,
        pendingJob.jobDescription,
        pendingJob.personalDetails || "",
        masterContext,
        undefined, // manualResearch — not available server-side
      ),
      extractJobLocationInfo(pendingJob.jobDescription, pendingJob.companyName),
    ]);

    await updateJobInQueue(pendingJob.id, {
      progress: 60,
      tailoredResume,
      resumeLatex, // persist the template used
      jobCountry: locationInfo.country || undefined,
      jobWorkMode: (locationInfo.workMode as "" | "Remote" | "Hybrid" | "On-site") || undefined,
    });

    // --- Step 2: Cover Letter (optional) ---
    if (pendingJob.includeCoverLetter) {
      let coverLetterLatex = pendingJob.coverLetterLatex;
      if (!coverLetterLatex) {
        const tmpl = await getDefaultTemplate(
          "fd:fd_cover_letter_templates",
          "fd:fd_default_cover_letter_id",
        );
        if (tmpl) coverLetterLatex = tmpl;
      }

      if (coverLetterLatex) {
        await updateJobInQueue(pendingJob.id, {
          status: "tailoring-cover-letter",
          progress: 70,
        });

        const tailoredCoverLetter = await tailorCoverLetter(
          coverLetterLatex,
          pendingJob.jobDescription,
          pendingJob.personalDetails || "",
          masterContext,
          undefined, // manualResearch
          tailoredResume,
        );

        await updateJobInQueue(pendingJob.id, {
          tailoredCoverLetter,
          coverLetterLatex,
        });
      }
    }

    // --- Done ---
    await updateJobInQueue(pendingJob.id, {
      status: "completed",
      progress: 100,
      completedAt: Date.now(),
    });

    // Check if more jobs remain
    const remaining = (await getQueue()).filter((j) => j.status === "pending");

    return NextResponse.json({
      processed: true,
      morePending: remaining.length > 0,
      remainingCount: remaining.length,
      jobId: pendingJob.id,
      companyName: pendingJob.companyName,
      positionTitle: pendingJob.positionTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error(`[process-queue] Failed job ${pendingJob.id}:`, message);

    await updateJobInQueue(pendingJob.id, {
      status: "failed",
      error: message,
      completedAt: Date.now(),
    });

    return NextResponse.json(
      { processed: false, error: message, jobId: pendingJob.id },
      { status: 200 }, // 200 so cron doesn't retry — error is recorded on the job
    );
  }
}
