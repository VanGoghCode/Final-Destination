import { parseQueueState, readState, withQueueLock } from "./browser-queue";
import { isActiveJob } from "./queue";
const keys = [
  "fd_queue_state",
  "fd_resume_templates",
  "fd_cover_letter_templates",
  "fd_default_resume_id",
  "fd_default_cover_letter_id",
  "fd_master_context",
  "fd_personal_details",
  "fd_profiles",
  "fd_active_profile_id",
  "fd_draft_application",
];
const snapshot = () => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
export const exportWorkspace = () =>
  withQueueLock(async () => JSON.stringify({ version: 1, data: snapshot() }, null, 2));

export async function restoreWorkspace(text: string) {
  const backup = JSON.parse(text);
  if (
    backup?.version !== 1 ||
    !backup.data ||
    typeof backup.data !== "object" ||
    Array.isArray(backup.data) ||
    Object.keys(backup.data).length !== keys.length ||
    Object.keys(backup.data).some((key) => !keys.includes(key))
  )
    throw new Error("Invalid workspace backup");
  const next = backup.data as Record<string, string | null>;
  for (const [key, raw] of Object.entries(next)) {
    if (raw === null) continue;
    if (typeof raw !== "string") throw new Error("Invalid workspace backup");
    const value = JSON.parse(raw);
    if (key === "fd_queue_state") {
      try {
        const state = parseQueueState(raw);
        next[key] = JSON.stringify({
          paused: true,
          jobs: state.jobs.map((job) =>
            isActiveJob(job)
              ? { ...job, status: "pending", runId: undefined, leaseExpiresAt: undefined }
              : job,
          ),
        });
      } catch {
        throw new Error("Invalid queue backup");
      }
    } else if (key.endsWith("templates") || key === "fd_profiles") {
      if (
        !Array.isArray(value) ||
        value.some(
          (item) =>
            !item ||
            typeof item.id !== "string" ||
            typeof item.name !== "string" ||
            (key.endsWith("templates")
              ? typeof item.content !== "string"
              : typeof item.firstName !== "string" || typeof item.lastName !== "string"),
        )
      )
        throw new Error("Invalid templates or background backup");
    } else if (key.endsWith("_id") || key === "fd_master_context") {
      if (typeof value !== "string") throw new Error("Invalid workspace backup");
    } else if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid workspace backup");
  }
  return navigator.locks.request("fd-queue-worker", { ifAvailable: true }, async (lock) => {
    if (!lock)
      throw new Error("Pause the queue and wait for the current job to finish before restoring.");
    return withQueueLock(async () => {
      let paused = true;
      try {
        paused = readState().paused;
      } catch {
        /* A valid backup can repair corrupt browser data. */
      }
      if (!paused) throw new Error("Pause the queue before restoring a backup.");
      const original = snapshot();
      const write = (data: Record<string, string | null>) => {
        keys.forEach((key) => localStorage.removeItem(key));
        for (const key of keys) if (data[key] != null) localStorage.setItem(key, data[key]!);
      };
      try {
        write(next);
      } catch (error) {
        write(original);
        throw error;
      }
      window.dispatchEvent(new window.Event("fd-queue"));
    });
  });
}
