import { apiJSON, APIError } from "./client-api";
import type { QueuedJob } from "./browser-queue";
const queueSignal = () => AbortSignal.timeout(120_000);
export const getQueue = () => apiJSON<QueuedJob[]>("/api/queue", { signal: queueSignal() });
export const isQueuePaused = async () =>
  (await apiJSON<{ paused: boolean }>("/api/queue?state", { signal: queueSignal() })).paused;
const patch = <T>(body: object) =>
  apiJSON<T>("/api/queue", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: queueSignal(),
  });
export const setQueuePaused = (paused: boolean) => patch({ action: paused ? "pause" : "resume" });
export async function claimJob() {
  try {
    return (await patch<{ job: QueuedJob }>({ id: "next", action: "claim" })).job;
  } catch (error) {
    if (error instanceof APIError && error.status === 409) return null;
    throw error;
  }
}
export async function updateJobInQueue(id: string, updates: Partial<QueuedJob>, runId?: string) {
  try {
    return (await patch<{ job: QueuedJob }>({ id, updates, runId })).job;
  } catch (error) {
    if (error instanceof APIError && error.status === 409) return null;
    throw error;
  }
}
