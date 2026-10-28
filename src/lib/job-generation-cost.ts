import { captureGenerationCost, type GenerationCost } from "./generation-cost";
import { githubQueueFile, transactQueue } from "./github-queue";
import type { QueuedJob } from "./browser-queue";

export function addJobGenerationCost(job: QueuedJob, summary: GenerationCost) {
  if (!summary.calls) return;
  // Historical drafts have no earlier usage; never present a partial sum as their total.
  const historical =
    job.generationCostUsd === undefined && !!(job.tailoredResume || job.tailoredCoverLetter);
  job.generationCostUsd = (job.generationCostUsd ?? 0) + summary.usd;
  job.generationCostIncomplete = !!job.generationCostIncomplete || historical || summary.incomplete;
}

export async function persistJobGenerationCost(
  id: string,
  summary: GenerationCost,
  file = githubQueueFile(),
) {
  await transactQueue(async (state) => {
    const job = state.jobs.find((job) => job.id === id);
    if (job) addJobGenerationCost(job, summary);
  }, file);
}

export async function withJobGenerationCost(
  request: Request,
  task: () => Promise<Response>,
  persist = persistJobGenerationCost,
) {
  const id = request.headers.get("x-job-id");
  if (!id) return task();
  const summary: GenerationCost = { calls: 0, usd: 0, incomplete: false };
  try {
    return await captureGenerationCost(task, summary);
  } finally {
    if (summary.calls) {
      try {
        await persist(id, summary);
      } catch (error) {
        // A cost-storage outage must not discard a generated document and force a paid retry.
        console.error("Could not persist job generation cost", error);
      }
    }
  }
}
