import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { job } from "./__tests__/job";
import {
  getQueue,
  readState,
  setQueue,
  setQueuePaused,
  updateJobInQueue,
  clearQueue,
} from "./browser-queue";
import {
  saveResumeTemplates,
  saveCoverLetterTemplates,
  saveMasterContext,
  saveProfiles,
} from "./storage";
import { processLocalQueue } from "./process-local-queue";

let close: () => void;
const template = (id: string) => [
  { id, name: id, content: `${id} latex`, createdAt: 1, updatedAt: 1 },
];
beforeEach(async () => {
  close = openBrowser().close;
  await saveResumeTemplates(template("resume"));
  await saveCoverLetterTemplates(template("cover"));
  await saveMasterContext("My background");
  await setQueue([job()]);
  await setQueuePaused(false);
});
afterEach(() => close());
function ai(
  respond: (url: string, body: Record<string, unknown>) => Response = () =>
    Response.json({ tailoredResume: "new resume", tailoredCoverLetter: "new cover" }),
) {
  const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body, headers: new Headers(init.headers) });
    return respond(url, body);
  }) as typeof fetch;
  return calls;
}
const hold = () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    entered();
    return await new Promise<Response>((_resolve, reject) => {
      const abort = () => reject(init.signal?.reason);
      if (init.signal?.aborted) abort();
      else init.signal?.addEventListener("abort", abort, { once: true });
    });
  }) as typeof fetch;
  return started;
};
describe("browser queue processing", () => {
  it("uses browser templates, background and the selected AI key", async () => {
    localStorage.setItem("fd_ai_provider", "openai");
    localStorage.setItem("fd_openai_api_key", "fixture");
    const calls = ai();
    expect(await processLocalQueue()).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.masterContext).toBe("My background");
    expect(calls[0]?.body.resumeLatex).toBe("resume latex");
    expect(calls[0]?.headers.get("x-openai-api-key")).toBe("fixture");
    expect((await getQueue())[0]).toMatchObject({
      status: "completed",
      progress: 100,
      tailoredResume: "new resume",
    });
  });
  it("never calls AI while paused or when required templates are missing", async () => {
    const calls = ai();
    await setQueuePaused(true);
    expect(await processLocalQueue()).toBe(false);
    await setQueuePaused(false);
    await saveCoverLetterTemplates([]);
    await setQueue([job("job", { includeCoverLetter: true })]);
    await processLocalQueue();
    expect(calls).toHaveLength(0);
    expect((await getQueue())[0]?.error).toContain("cover letter template");
  });
  it("uses default templates for a profile created before templates were added", async () => {
    await saveProfiles([
      {
        id: "me",
        name: "Me",
        firstName: "Test",
        lastName: "User",
        color: "blue",
        defaultResumeId: null,
        defaultCoverLetterId: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await setQueue([job("job", { profileId: "me" })]);
    const calls = ai();
    await processLocalQueue();
    expect(calls).toHaveLength(1);
    expect((await getQueue())[0]?.status).toBe("completed");
  });
  it("only lets one open tab own a job", async () => {
    const started = hold();
    const controller = new AbortController();
    const processing = processLocalQueue(controller.signal);
    await started;
    expect(await processLocalQueue()).toBe(false);
    controller.abort();
    expect(await processing).toBe(false);
  });
  it("cancels or deletes a running job without accepting late results", async () => {
    for (const remove of [false, true]) {
      await setQueue([job()]);
      const started = hold();
      const processing = processLocalQueue();
      await started;
      if (remove) await clearQueue();
      else await updateJobInQueue("job", { status: "cancelled" });
      expect(await processing).toBe(false);
      expect(remove ? (await getQueue()).length : (await getQueue())[0]?.status).toBe(
        remove ? 0 : "cancelled",
      );
    }
  });
  it("recovers an interrupted cover letter without repeating the resume request", async () => {
    await setQueue([
      job("job", {
        includeCoverLetter: true,
        status: "tailoring-cover-letter",
        runId: "old",
        leaseExpiresAt: Date.now() + 600000,
        tailoredResume: "saved resume",
        resumeLatex: "saved source",
        coverLetterLatex: "saved cover",
      }),
    ]);
    const calls = ai();
    await processLocalQueue();
    expect(calls.map((call) => call.url)).toEqual(["/api/tailor-cover-letter"]);
    expect(calls[0]?.body.tailoredResume).toBe("saved resume");
    expect((await getQueue())[0]?.status).toBe("completed");
  });
  it("retains completed resume work when retrying a failed cover letter", async () => {
    await setQueue([job("job", { includeCoverLetter: true })]);
    const calls = ai((url) =>
      url.endsWith("cover-letter")
        ? Response.json({ error: "Temporary provider failure" }, { status: 500 })
        : Response.json({ tailoredResume: "saved resume" }),
    );
    await processLocalQueue();
    expect((await getQueue())[0]?.tailoredResume).toBe("saved resume");
    await updateJobInQueue("job", { status: "pending" }, undefined, false, true);
    ai();
    await processLocalQueue();
    expect(calls).toHaveLength(2);
    expect((await getQueue())[0]?.retryCount).toBe(1);
    expect((await getQueue())[0]?.tailoredResume).toBe("saved resume");
  });
  it("pauses on key or rate-limit errors without failing waiting jobs", async () => {
    await setQueue([job(), job("next")]);
    ai(() => Response.json({ error: "AI request limit exceeded" }, { status: 429 }));
    await expect(processLocalQueue()).rejects.toThrow("Queue paused");
    expect(readState().paused).toBe(true);
    expect((await getQueue())[1]?.status).toBe("pending");
  });
  it("rejects empty AI results", async () => {
    ai(() => Response.json({ tailoredResume: " " }));
    await processLocalQueue();
    expect((await getQueue())[0]).toMatchObject({
      status: "failed",
      error: "AI returned an empty resume. Retry this job.",
    });
  });
  it("does not falsely complete when browser storage is full", async () => {
    ai();
    const storage = localStorage;
    let writes = 0;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: storage.getItem.bind(storage),
        setItem: (key: string, value: string) => {
          if (++writes > 2) throw new DOMException("Quota exceeded", "QuotaExceededError");
          storage.setItem(key, value);
        },
      },
    });
    await expect(processLocalQueue()).rejects.toThrow("Quota exceeded");
    expect((await getQueue())[0]?.status).not.toBe("completed");
  });
});
