import { afterEach, beforeEach, expect, test } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { exportWorkspace, restoreWorkspace } from "./workspace-backup";
import { job } from "./__tests__/job";
import { setQueue, setQueuePaused, readState } from "./browser-queue";
let close: () => void;
beforeEach(() => {
  close = openBrowser().close;
});
afterEach(() => close());
test("exports the shared queue without credentials or obsolete browser templates", async () => {
  localStorage.setItem("fd_openai_api_key", "fixture-secret");
  localStorage.setItem("fd_master_context", JSON.stringify("obsolete background"));
  await setQueue([job()]);
  const backup = await exportWorkspace();
  expect(JSON.parse(backup).version).toBe(2);
  expect(backup).not.toContain("fixture-secret");
  expect(backup).not.toContain("obsolete background");
  await setQueue([]);
  await restoreWorkspace(backup);
  expect(readState().jobs).toHaveLength(1);
  expect(readState().paused).toBe(true);
});
test("refuses malformed backups without changing the queue", async () => {
  await setQueue([job()]);
  await expect(restoreWorkspace('{"version":2,"queue":null}')).rejects.toThrow("Invalid");
  expect(readState().jobs).toHaveLength(1);
});
test("restores interrupted checkpoints paused and refuses to replace an active queue", async () => {
  await setQueue([job()]);
  const backup = JSON.stringify({
    version: 2,
    queue: {
      jobs: [
        job("old", {
          status: "tailoring-cover-letter",
          tailoredResume: "checkpoint",
          runId: "old",
        }),
      ],
      paused: false,
    },
  });
  await setQueuePaused(false);
  await expect(restoreWorkspace(backup)).rejects.toThrow("Pause");
  await setQueuePaused(true);
  await restoreWorkspace(backup);
  expect(readState().jobs[0]).toMatchObject({ status: "pending", tailoredResume: "checkpoint" });
  expect(readState().jobs[0]?.runId).toBeUndefined();
});
