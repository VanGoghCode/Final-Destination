import { localRequest } from "@/lib/local-api";
import { beforeEach, afterEach, describe, it, expect } from "bun:test";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { openBrowser } from "@/lib/__tests__/browser";
import { job } from "@/lib/__tests__/job";
import { JobQueueProvider, useJobQueue } from "../JobQueueContext";
import { saveResumeTemplates } from "@/lib/__tests__/legacy-settings";
import { getQueue, setQueue } from "@/lib/browser-queue";

let root: Root, close: () => void, context: ReturnType<typeof useJobQueue>;
beforeEach(async () => {
  close = openBrowser().close;
  root = createRoot(document.createElement("div"));
  function Probe() {
    const value = useJobQueue();
    useEffect(() => {
      context = value;
    }, [value]);
    return null;
  }
  await act(async () => root.render(createElement(JobQueueProvider, null, createElement(Probe))));
});
afterEach(async () => {
  await act(() => root.unmount());
  close();
});
describe("browser queue controls", () => {
  it("adds, edits, retries, cancels and removes jobs while paused", async () => {
    let id: string | null = null;
    await act(async () => {
      id = await context.addJob(job());
    });
    expect(context.queue).toHaveLength(1);
    expect(context.processingPaused).toBe(true);
    await act(async () => {
      expect(await context.updateJob(id!, { companyName: "Edited" })).toBe(true);
    });
    expect(context.queue[0]?.companyName).toBe("Edited");
    await act(async () => {
      await context.cancelJob(id!);
    });
    expect(context.cancelledCount).toBe(1);
    await act(async () => {
      await context.retryJob(id!);
    });
    expect(context.pendingCount).toBe(1);
    expect(context.queue[0]?.retryCount).toBe(1);
    await act(async () => {
      await context.removeJob(id!);
    });
    expect(context.queue).toHaveLength(0);
    expect(context.busyIds).toEqual([]);
  });
  it("keeps completed results when clearing only completed jobs", async () => {
    await act(async () => {
      await setQueue([job("done", { status: "completed" }), job("waiting")]);
      await context.refreshQueue();
      await context.clearCompleted();
    });
    expect(context.queue.map((job) => job.id)).toEqual(["waiting"]);
    await act(async () => {
      await context.clearQueue();
    });
    expect(context.totalCount).toBe(0);
  });
  it("runs from any website page, then persists completion", async () => {
    await saveResumeTemplates([
      { id: "resume", name: "Resume", content: "latex", createdAt: 1, updatedAt: 1 },
    ]);
    let requests = 0;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/queue")) return (await localRequest(url, init))!;
      requests++;
      return Response.json({ tailoredResume: "tailored" });
    }) as unknown as typeof fetch;
    await act(async () => {
      await context.addJob(job());
      await context.startProcessing();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(requests).toBe(1);
    expect((await getQueue())[0]?.status).toBe("completed");
    expect(context.completedCount).toBe(1);
    await act(async () => {
      await context.stopProcessing();
    });
    expect(context.processingPaused).toBe(true);
  });
});
