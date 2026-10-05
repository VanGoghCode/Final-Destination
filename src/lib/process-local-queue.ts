import {
  claimJob,
  getQueue,
  isQueuePaused,
  setQueuePaused,
  updateJobInQueue,
  type QueuedJob,
} from "./browser-queue";
import {
  getProfiles,
  getResumeTemplates,
  getCoverLetterTemplates,
  getDefaultResumeId,
  getDefaultCoverLetterId,
  getMasterContext,
} from "./storage";
import { apiJSON, APIError } from "./client-api";

export async function processLocalQueue(signal?: AbortSignal) {
  if (!navigator.locks) throw new Error("Queue requires Web Locks on HTTPS or localhost.");
  return navigator.locks.request("fd-queue-worker", { ifAvailable: true }, async (lock) => {
    if (!lock || (await isQueuePaused()) || signal?.aborted) return false;
    const job = await claimJob(undefined, true);
    if (!job) return false;
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const monitor = async () => {
      try {
        if (!(await getQueue()).some((saved) => saved.id === job.id && saved.runId === job.runId))
          controller.abort(new Error("Job cancelled or changed"));
      } catch {
        controller.abort(new Error("Browser storage unavailable"));
      }
    };
    window.addEventListener("storage", monitor);
    window.addEventListener("fd-queue", monitor);
    const timer = setInterval(monitor, 1000);
    const update = async (value: Partial<QueuedJob>) => {
      if (!(await updateJobInQueue(job.id, value, job.runId)))
        throw new Error("Job was cancelled, removed, or restarted");
    };
    try {
      const profiles = await getProfiles();
      const profile = job.profileId
        ? profiles.find((profile) => profile.id === job.profileId)
        : undefined;
      if (job.profileId && !profile)
        throw new Error("Profile no longer exists. Edit this job to use your default templates.");
      const template = async (cover: boolean) => {
        const templates = await (cover ? getCoverLetterTemplates() : getResumeTemplates());
        const profileTemplate =
          profile && (cover ? profile.defaultCoverLetterId : profile.defaultResumeId);
        const selected =
          profileTemplate || (await (cover ? getDefaultCoverLetterId() : getDefaultResumeId()));
        return (
          templates.find((template) => template.id === selected)?.content ||
          (!profileTemplate ? templates[0]?.content : undefined)
        );
      };
      const resume = job.resumeLatex || (await template(false));
      const cover = job.includeCoverLetter
        ? job.coverLetterLatex || (await template(true))
        : undefined;
      if (!resume) throw new Error("Choose a resume template before processing this job.");
      if (job.includeCoverLetter && !cover)
        throw new Error("Choose a cover letter template before processing this job.");
      await update({ resumeLatex: resume, ...(cover ? { coverLetterLatex: cover } : {}) });
      const context = (await getMasterContext()) || "";
      const post = <T>(url: string, body: object) =>
        apiJSON<T>(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300_000)]),
        });
      if (!job.tailoredResume) {
        const result = await post<{
          tailoredResume: string;
          jobCountry?: string;
          jobWorkMode?: QueuedJob["jobWorkMode"];
        }>("/api/tailor", {
          resumeLatex: resume,
          jobDescription: job.jobDescription,
          companyName: job.companyName,
          personalDetails: job.personalDetails,
          masterContext: context,
        });
        if (!result.tailoredResume?.trim())
          throw new Error("AI returned an empty resume. Retry this job.");
        await update({
          progress: 60,
          tailoredResume: result.tailoredResume,
          resumeLatex: resume,
          ...(result.jobCountry ? { jobCountry: result.jobCountry } : {}),
          ...(result.jobWorkMode ? { jobWorkMode: result.jobWorkMode } : {}),
        });
        job.tailoredResume = result.tailoredResume;
      }
      if (cover && !job.tailoredCoverLetter) {
        await update({ status: "tailoring-cover-letter", progress: 70 });
        const result = await post<{ tailoredCoverLetter: string }>("/api/tailor-cover-letter", {
          coverLetterLatex: cover,
          jobDescription: job.jobDescription,
          personalDetails: job.personalDetails,
          masterContext: context,
          tailoredResume: job.tailoredResume,
        });
        if (!result.tailoredCoverLetter?.trim())
          throw new Error("AI returned an empty cover letter. Retry this job.");
        await update({ tailoredCoverLetter: result.tailoredCoverLetter, coverLetterLatex: cover });
      }
      await update({ status: "completed", progress: 100, completedAt: Date.now() });
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      await update({
        status: "failed",
        error: error instanceof Error ? error.message : "Processing failed",
        completedAt: Date.now(),
      });
      if (
        error instanceof TypeError ||
        (error instanceof APIError && [401, 403, 429, 503].includes(error.status))
      ) {
        await setQueuePaused(true);
        throw new Error(
          `Queue paused: ${error.message}. Check your AI settings or connection, retry the failed job, then resume.`,
        );
      }
      return true;
    } finally {
      clearInterval(timer);
      signal?.removeEventListener("abort", abort);
      window.removeEventListener("storage", monitor);
      window.removeEventListener("fd-queue", monitor);
    }
  });
}
