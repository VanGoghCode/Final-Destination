import { apiJSON } from "./client-api";
import type { QueuedJob, SavedProfile } from "./browser-queue";
import { coverTemplate, masterContext, personalProfile } from "./personal-workspace";
export async function readQueueResult(id: string) {
  const [jobs, context, profiles] = await Promise.all([
    apiJSON<QueuedJob[]>("/api/queue"),
    apiJSON<{ content: string | null }>("/api/master-context").catch(() => ({ content: null })),
    apiJSON<SavedProfile[]>("/api/profiles").catch(() => []),
  ]);
  const job = jobs.find((job) => job.id === id);
  if (!job) throw new Error("This job was removed from the queue.");
  if (!job.tailoredResume && !job.tailoredCoverLetter)
    throw new Error("This job has no saved results yet. Return to the queue to process it.");
  const profile = profiles.find((profile) => profile.id === job.profileId);
  return {
    ...job,
    masterContext: context.content || "",
    profileFirstName: profile?.firstName || personalProfile.firstName,
    profileLastName: profile?.lastName || personalProfile.lastName,
  };
}
export async function generateQueueCoverLetter(
  id: string,
  tailoredResume: string,
  expectedCompletedAt?: number,
) {
  const job = await readQueueResult(id);
  if (job.completedAt !== expectedCompletedAt)
    throw new Error("Results changed. Refresh before generating a cover letter.");
  const { tailoredCoverLetter } = await apiJSON<{ tailoredCoverLetter: string }>(
    "/api/tailor-cover-letter",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coverLetterLatex: coverTemplate.content,
        masterContext,
        jobDescription: job.jobDescription,
        companyName: job.companyName,
        positionTitle: job.positionTitle,
        personalDetails: job.personalDetails,
        tailoredResume,
      }),
      signal: AbortSignal.timeout(300_000),
    },
  );
  if (!tailoredCoverLetter?.trim())
    throw new Error("AI returned an empty cover letter. Try again.");
  return (
    await saveQueueResult(
      id,
      {
        tailoredResume,
        tailoredCoverLetter,
        coverLetterLatex: coverTemplate.content,
        includeCoverLetter: true,
      },
      expectedCompletedAt,
    )
  ).job;
}
export async function saveQueueResult(
  id: string,
  updates: Partial<QueuedJob>,
  expectedCompletedAt?: number,
) {
  return apiJSON<{ job: QueuedJob }>("/api/queue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updates, expectedCompletedAt }),
  });
}
export async function regenerateQueueResult(
  id: string,
  input: Record<string, unknown>,
  expectedCompletedAt?: number,
) {
  const { regeneratedContent } = await apiJSON<{ regeneratedContent: string }>("/api/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!regeneratedContent?.trim()) throw new Error("AI returned an empty document");
  const { job } = await saveQueueResult(
    id,
    input.type === "resume"
      ? { tailoredResume: regeneratedContent }
      : { tailoredCoverLetter: regeneratedContent },
    expectedCompletedAt,
  );
  return { content: regeneratedContent, completedAt: job.completedAt };
}
