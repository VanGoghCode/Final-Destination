import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { exportWorkspace, restoreWorkspace } from "./workspace-backup";
import { job } from "./__tests__/job";
import { setQueue, setQueuePaused, readState } from "./browser-queue";
let close: () => void;
beforeEach(() => {
  close = openBrowser().close;
});
afterEach(() => close());
describe("browser workspace backups", () => {
  it("exports templates, background and queue without AI credentials", async () => {
    localStorage.setItem("fd_master_context", JSON.stringify("My background"));
    localStorage.setItem("fd_openai_api_key", "fixture-secret");
    await setQueue([job()]);
    const backup = await exportWorkspace();
    expect(backup).toContain("My background");
    expect(backup).not.toContain("fixture-secret");
    localStorage.removeItem("fd_master_context");
    await restoreWorkspace(backup);
    expect(localStorage.getItem("fd_master_context")).toBe(JSON.stringify("My background"));
    expect(readState().jobs).toHaveLength(1);
    expect(readState().paused).toBe(true);
  });
  it("refuses invalid backups and preserves existing data", async () => {
    await setQueue([job()]);
    const original = localStorage.getItem("fd_queue_state");
    await expect(
      restoreWorkspace('{"version":1,"data":{"fd_queue_state":"null"}}'),
    ).rejects.toThrow("Invalid");
    expect(localStorage.getItem("fd_queue_state")).toBe(original);
  });
  it("requires a paused queue and restores interrupted jobs ready to resume", async () => {
    await setQueue([
      job("job", { status: "tailoring-cover-letter", tailoredResume: "checkpoint", runId: "old" }),
    ]);
    const backup = await exportWorkspace();
    await setQueuePaused(false);
    await expect(restoreWorkspace(backup)).rejects.toThrow("Pause");
    await setQueuePaused(true);
    await restoreWorkspace(backup);
    expect(readState().jobs[0]).toMatchObject({ status: "pending", tailoredResume: "checkpoint" });
    expect(readState().jobs[0]?.runId).toBeUndefined();
  });
  it("rolls back a restore if the browser runs out of storage", async () => {
    await setQueue([job()]);
    localStorage.setItem("fd_master_context", JSON.stringify("original"));
    const original = localStorage.getItem("fd_queue_state"),
      backup = JSON.parse(await exportWorkspace());
    backup.data.fd_master_context = JSON.stringify("replacement");
    const storage = localStorage;
    let writes = 0;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: storage.getItem.bind(storage),
        removeItem: storage.removeItem.bind(storage),
        setItem: (key: string, value: string) => {
          if (++writes === 2) throw new DOMException("Quota exceeded", "QuotaExceededError");
          storage.setItem(key, value);
        },
      },
    });
    await expect(restoreWorkspace(JSON.stringify(backup))).rejects.toThrow("Quota exceeded");
    expect(localStorage.getItem("fd_master_context")).toBe(JSON.stringify("original"));
    expect(localStorage.getItem("fd_queue_state")).toBe(original);
  });
});
