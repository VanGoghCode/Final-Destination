import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JobQueueProvider, useJobQueue } from "../JobQueueContext";
import { fakeRedis, job } from "@/lib/__tests__/redis";
import { setRedisInstance, getQueue } from "@/lib/db";
import * as routes from "@/app/api/queue/route";
import { POST as processQueue } from "@/app/api/process-queue/route";
import * as keys from "@/lib/api-key";
import * as ai from "@/lib/ai";

let root: Root, api: ReturnType<typeof useJobQueue>, fixture: ReturnType<typeof fakeRedis>;
let requests: Array<{ url: string; init?: RequestInit }>, fail: boolean;
const spies: Array<ReturnType<typeof spyOn>> = [];
const globals = [
  "window",
  "document",
  "localStorage",
  "HTMLElement",
  "IS_REACT_ACT_ENVIRONMENT",
  "fetch",
] as const;
let original: Array<PropertyDescriptor | undefined>;
function Probe() {
  const context = useJobQueue();
  useEffect(() => {
    api = context;
  }, [context]);
  return null;
}
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
beforeEach(async () => {
  fixture = fakeRedis();
  fixture.store.set("data:queue:paused", true);
  fixture.store.set("data:queue", [
    job("done", {
      status: "completed",
      retryCount: 2,
      resumeLatex: "old",
      tailoredResume: "old",
      startedAt: 1,
      completedAt: 2,
    }),
  ]);
  original = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const browser = new Window({ url: "http://localhost:3000" });
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    HTMLElement: browser.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  localStorage.setItem("fd_admin_key", "owner");
  requests = [];
  fail = false;
  spies.push(
    spyOn(keys, "getApiKey").mockResolvedValue("fixture"),
    spyOn(keys, "getAISelection").mockResolvedValue({ provider: "openai", modelId: "gpt-6-luna" }),
    spyOn(ai, "tailorResume").mockResolvedValue("tailored"),
    spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "US", workMode: "Remote" }),
  );
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    requests.push({ url: input, init });
    if (fail) return Response.json({ error: "Unavailable" }, { status: 503 });
    const request = new Request("http://localhost" + input, init);
    if (input.includes("process-queue")) return processQueue(request);
    switch (init?.method) {
      case "POST":
        return routes.POST(request);
      case "PUT":
        return routes.PUT(request);
      case "PATCH":
        return routes.PATCH(request);
      case "DELETE":
        return routes.DELETE(request);
      default:
        return routes.GET(request);
    }
  }) as typeof fetch;
  root = createRoot(document.createElement("div"));
  await act(() => root.render(createElement(JobQueueProvider, null, createElement(Probe))));
  await act(() => api.setPollingEnabled(true));
  await flush();
  requests = [];
});
afterEach(async () => {
  await act(() => root.unmount());
  spies.splice(0).forEach((spy) => spy.mockRestore());
  setRedisInstance(null);
  globals.forEach((key, i) => {
    if (original[i]) Object.defineProperty(globalThis, key, original[i]!);
    else Reflect.deleteProperty(globalThis, key);
  });
});
describe("queue UI connected to real queue routes", () => {
  it.each([false, true])(
    "retries an unacknowledged submission without duplicates (batch=%s)",
    async (batch) => {
      const fetch = globalThis.fetch;
      let loseResponse = true;
      globalThis.fetch = (async (input: string, init?: RequestInit) => {
        const response = await fetch(input, init);
        if (loseResponse && init?.method === (batch ? "PUT" : "POST")) {
          loseResponse = false;
          throw new Error("Response lost after save");
        }
        return response;
      }) as typeof fetch;
      await act(async () => {
        if (batch) {
          await api.addJobs([job("new")]);
          await api.addJobs([job("new")]);
        } else {
          await api.addJob(job("new"));
          await api.addJob(job("new"));
        }
      });
      expect((await getQueue()).filter((job) => job.status === "pending")).toHaveLength(1);
    },
  );
  it("authenticates reads and every mutation", async () => {
    await act(async () => {
      await api.removeJob("done");
    });
    expect(requests.every((r) => new Headers(r.init?.headers).get("x-api-key") === "owner")).toBe(
      true,
    );
  });
  it("shows only additions that the server accepted", async () => {
    let id: string | null = null;
    await act(async () => {
      id = await api.addJob(job("new"));
    });
    expect(api.queue.some((j) => j.id === id)).toBe(true);
    expect(api.pendingCount).toBe(1);
    expect(api.processingPaused).toBe(true);
  });
  it("keeps jobs and exposes an error when removal fails", async () => {
    fail = true;
    await act(async () => {
      expect(await api.removeJob("done")).toBe(false);
    });
    expect(api.queue).toHaveLength(1);
    expect(api.queueError).toBe("Unavailable");
  });
  it("does not report failed additions or resets as saved", async () => {
    fail = true;
    await act(async () => {
      expect(await api.addJob(job("new"))).toBeNull();
      expect(await api.updateJob("done", { companyName: "new" })).toBe(false);
    });
    expect(api.queue[0]?.companyName).toBe("Acme");
    expect(api.totalCount).toBe(1);
  });
  it("serializes retries and uses server retry counts", async () => {
    await act(async () => {
      await Promise.all([api.retryJob("done"), api.retryJob("done")]);
    });
    expect(api.queue[0]?.retryCount).toBe(4);
    expect(api.queue[0]?.startedAt).toBeUndefined();
    expect(api.queue[0]?.tailoredResume).toBeUndefined();
  });
  it("resets edited results, clears a removed profile, and preserves imported templates", async () => {
    await act(async () => {
      await api.updateJob("done", { jobDescription: "Changed" });
    });
    expect(api.queue[0]).toMatchObject({
      status: "pending",
      resumeLatex: "old",
      jobDescription: "Changed",
    });
    expect(api.queue[0]?.tailoredResume).toBeUndefined();
    await act(async () => {
      await api.updateJob("done", { profileId: "new" });
    });
    expect(api.queue[0]?.resumeLatex).toBeUndefined();
    await act(async () => {
      await api.updateJob("done", { profileId: "", profileName: "" });
    });
    expect(api.queue[0]?.profileId).toBe("");
  });
  it("cancels, removes and clears jobs using saved state", async () => {
    await act(async () => {
      await api.cancelJob("done");
    });
    expect(api.cancelledCount).toBe(1);
    await act(async () => {
      await api.clearCompleted();
    });
    expect(api.totalCount).toBe(1);
    await act(async () => {
      await api.clearQueue();
    });
    expect(api.totalCount).toBe(0);
  });
  it("keeps a paused queue paused when extension jobs arrive", async () => {
    await routes.POST(
      new Request("http://localhost/api/queue", {
        method: "POST",
        body: JSON.stringify(job("extension", { resumeLatex: "assigned" })),
      }),
    );
    await act(async () => {
      await api.refreshQueue();
    });
    expect(api.pendingCount).toBe(1);
    expect(api.processingPaused).toBe(true);
    expect(requests.some((r) => r.url.includes("process-queue"))).toBe(false);
  });
  it("processes extension jobs on the server without loading default templates", async () => {
    fixture.store.set("data:queue", [job("extension", { resumeLatex: "assigned" })]);
    fixture.store.set("data:queue:paused", false);
    await act(() => api.setPollingEnabled(false));
    await act(() => api.setPollingEnabled(true));
    await flush();
    expect((await getQueue())[0]?.status).toBe("completed");
    expect(requests.find((r) => r.url.includes("process-queue"))?.init?.body).toBe(
      JSON.stringify({ id: "extension" }),
    );
  });
  it("does not let stale polling resurrect a removed job", async () => {
    const fetch = globalThis.fetch;
    let release = () => {},
      captured = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (!init?.method && !captured) {
        captured = true;
        await gate;
      }
      return response;
    }) as typeof fetch;
    let refresh: Promise<void>;
    await act(async () => {
      refresh = api.refreshQueue();
      await new Promise((resolve) => setTimeout(resolve, 1));
      await api.removeJob("done");
    });
    await act(async () => {
      release();
      await refresh!;
    });
    expect(api.queue).toHaveLength(0);
  });
});
