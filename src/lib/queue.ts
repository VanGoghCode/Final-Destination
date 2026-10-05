import type { QueuedJob } from "./browser-queue";
export const isActiveJob = (job: QueuedJob) =>
  ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(job.status);

export function isClaimable(job: QueuedJob, now = Date.now()) {
  return (
    job.status === "pending" ||
    (isActiveJob(job) && (job.leaseExpiresAt ?? (job.startedAt || job.addedAt) + 600_000) <= now)
  );
}

export function resetJob(job: QueuedJob, clearTemplates = true): QueuedJob {
  const reset = { ...job, status: "pending" as const, progress: 0 };
  const fields: Array<keyof QueuedJob> = [
    "error",
    "startedAt",
    "completedAt",
    "companyResearch",
    "tailoredResume",
    "tailoredCoverLetter",
    "jobCountry",
    "jobWorkMode",
    "runId",
    "leaseExpiresAt",
  ];
  if (clearTemplates) fields.push("resumeLatex", "coverLetterLatex");
  for (const field of fields) delete reset[field];
  return reset;
}
