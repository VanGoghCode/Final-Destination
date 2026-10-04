import { apiJSON } from "./client-api";
import type { QueuedJob, SavedProfile } from "./db";
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
    profileFirstName: profile?.firstName || "",
    profileLastName: profile?.lastName || "",
  };
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
  await saveQueueResult(
    id,
    input.type === "resume"
      ? { tailoredResume: regeneratedContent }
      : { tailoredCoverLetter: regeneratedContent },
    expectedCompletedAt,
  );
  return regeneratedContent;
}
