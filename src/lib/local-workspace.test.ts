import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { apiJSON } from "./client-api";
import { claimJob, setQueue, setQueuePaused, updateJobInQueue, getQueue } from "./browser-queue";
import { job } from "./__tests__/job";
import {
  getResumeTemplates,
  saveResumeTemplates,
  saveMasterContext,
  getMasterContext,
} from "./storage";

let close: () => void;
const input = (id = "one") => ({
  id,
  companyName: "Example",
  positionTitle: "Engineer",
  companyUrl: "https://example.com/job",
  jobDescription: "Build software",
  personalDetails: "",
});
const send = <T = Record<string, unknown>>(method: string, body?: unknown, query = "") =>
  apiJSON<T>("/api/queue" + query, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
beforeEach(() => {
  close = openBrowser().close;
});
afterEach(() => close());

describe("browser-only workspace", () => {
  it("saves templates and master context without network access", async () => {
    const templates = [
      { id: "resume", name: "My resume", content: "latex", createdAt: 1, updatedAt: 1 },
    ];
    await saveResumeTemplates(templates);
    await saveMasterContext("My background");
    expect(await getResumeTemplates()).toEqual(templates);
    expect(await getMasterContext()).toBe("My background");
  });
  it("starts with an empty paused queue", async () => {
    expect(await send<{ jobs: unknown[]; paused: boolean }>("GET", undefined, "?state=1")).toEqual({
      jobs: [],
      paused: true,
    });
  });
  it("persists concurrent additions and survives a new reader", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => send("POST", input(String(i)))));
    expect(await send<unknown[]>("GET")).toHaveLength(20);
    expect(localStorage.getItem("fd_queue_state")).toContain("Engineer");
  });
  it("acknowledges a retried submission without adding duplicates", async () => {
    await send("POST", input());
    expect((await send("POST", input())).duplicate).toBe(true);
    await expect(send("POST", { ...input(), companyName: "Changed" })).rejects.toThrow(
      "different details",
    );
    expect(await send<unknown[]>("GET")).toHaveLength(1);
  });
  it("rejects incomplete bulk imports and keeps duplicate IDs unique", async () => {
    await expect(send("PUT", { jobs: [input(), input(), {}, input("two")] })).rejects.toThrow(
      "Every job must be valid",
    );
    expect(await send<unknown[]>("GET")).toHaveLength(0);
    const result = await send("PUT", { jobs: [input(), input(), input("two")] });
    expect(result.added).toBe(2);
    expect(result.duplicates).toBe(1);
  });
  it("rejects malformed requests and unsafe delete filters", async () => {
    await send("POST", input());
    await expect(send("DELETE", undefined, "?status=failed")).rejects.toThrow(
      "Invalid delete filter",
    );
    await expect(send("POST", {})).rejects.toThrow("required fields");
    await expect(send("PATCH", { id: "one", updates: { progress: 101 } })).rejects.toThrow(
      "Invalid update",
    );
    expect(await send<unknown[]>("GET")).toHaveLength(1);
  });
  it("persists pause and controls retries, cancellation, edits and deletion", async () => {
    await send("POST", input());
    await send("PATCH", { action: "resume" });
    expect((await send("GET", undefined, "?state=1")).paused).toBe(false);
    await send("PATCH", { id: "one", action: "cancel", updates: {} });
    expect((await send<Array<{ status: string }>>("GET"))[0]?.status).toBe("cancelled");
    await send("PATCH", { id: "one", action: "retry", updates: {} });
    expect((await send<Array<{ retryCount: number }>>("GET"))[0]?.retryCount).toBe(1);
    await send("PATCH", { id: "one", action: "edit", updates: { companyName: "Edited" } });
    expect((await send("GET", undefined, "?state=1")).paused).toBe(true);
    await send("DELETE", undefined, "?id=one");
    expect(await send<unknown[]>("GET")).toEqual([]);
  });
  it("does not erase corrupt queue data or report a quota failure as saved", async () => {
    localStorage.setItem("fd_queue_state", "invalid-json");
    await expect(send("POST", input())).rejects.toThrow("Queue storage");
    expect(localStorage.getItem("fd_queue_state")).toBe("invalid-json");
  });
  it("prevents a stale results editor from overwriting a newer edit", async () => {
    await send("POST", input());
    await send("PATCH", {
      id: "one",
      updates: { status: "completed", tailoredResume: "initial", completedAt: 10 },
    });
    const result = await send<{ job: { completedAt: number } }>("PATCH", {
      id: "one",
      expectedCompletedAt: 10,
      updates: { tailoredResume: "newer" },
    });
    expect(result.job.completedAt).toBeGreaterThan(10);
    await expect(
      send("PATCH", { id: "one", expectedCompletedAt: 10, updates: { tailoredResume: "stale" } }),
    ).rejects.toThrow("results changed");
  });
  it("rejects conflicting bulk IDs without partially writing the batch", async () => {
    await send("POST", input());
    await expect(
      send("PUT", { jobs: [input("two"), { ...input(), companyName: "Conflicting" }] }),
    ).rejects.toThrow("different details");
    expect(await send<unknown[]>("GET")).toHaveLength(1);
  });
  it("fences old claims after cancellation and retry", async () => {
    await setQueue([job()]);
    await setQueuePaused(false);
    const claimed = await claimJob();
    await updateJobInQueue("job", { status: "cancelled" });
    await updateJobInQueue("job", { status: "pending" }, undefined, false, true);
    expect(
      await updateJobInQueue(
        "job",
        { status: "completed", tailoredResume: "late" },
        claimed?.runId,
      ),
    ).toBeNull();
    expect((await getQueue())[0]?.status).toBe("pending");
  });
  it("does not change pause or job data if editing exceeds the browser quota", async () => {
    await send("POST", input());
    await send("PATCH", { action: "resume" });
    const original = localStorage.getItem("fd_queue_state");
    const storage = localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: storage.getItem.bind(storage),
        setItem: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
      },
    });
    await expect(
      send("PATCH", { id: "one", action: "edit", updates: { companyName: "Changed" } }),
    ).rejects.toThrow("Quota exceeded");
    expect(localStorage.getItem("fd_queue_state")).toBe(original);
  });
});
