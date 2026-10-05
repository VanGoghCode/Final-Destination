import { apiJSON } from "./client-api";
import { parseQueueState } from "./browser-queue";
export async function exportWorkspace() {
  const queue = await apiJSON("/api/queue?state=1");
  return JSON.stringify({ version: 2, queue }, null, 2);
}
export async function restoreWorkspace(text: string) {
  const backup = JSON.parse(text);
  const value =
    backup?.version === 2
      ? backup.queue
      : backup?.version === 1 && backup.data?.fd_queue_state
        ? JSON.parse(backup.data.fd_queue_state)
        : null;
  if (!value) throw new Error("Invalid queue backup");
  const restore = parseQueueState(JSON.stringify(value));
  await apiJSON("/api/queue", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restore }),
  });
  window.dispatchEvent(new window.Event("fd-queue"));
}
