import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  claimJob,
  getProfiles,
  getQueue,
  setRedisInstance,
  addJobToQueue,
  updateJobInQueue,
  setQueuePaused,
} from "./db";
import { fakeRedis, job } from "./__tests__/redis";
import { PATCH, POST, DELETE } from "@/app/api/queue/route";

let fixture: ReturnType<typeof fakeRedis>;
const request = (body: unknown, method = "PATCH", query = "") =>
  new Request("http://localhost/api/queue" + query, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
beforeEach(() => {
  fixture = fakeRedis();
  fixture.store.set("data:queue", [job(), job("second")]);
});
afterEach(() => setRedisInstance(null));
describe("queue reliability", () => {
  it("runs only one job across tabs and cron", async () => {
    const claims = await Promise.all([claimJob("job"), claimJob("second")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("persists pause and prevents claims without cancelling current work", async () => {
    const current = await claimJob("job");
    expect((await PATCH(request({ action: "pause" }))).status).toBe(200);
    expect(await claimJob("second")).toBeNull();
    expect((await getQueue())[0]?.runId).toBe(current?.runId);
    await PATCH(request({ action: "resume" }));
    expect(fixture.store.get("data:queue:paused")).toBe(false);
  });
  it("reads current profiles without needing the queue page to sync them", async () => {
    fixture.store.set("data:profiles", [{ id: "stale" }]);
    fixture.store.set("fd:fd_profiles", [{ id: "fresh", defaultResumeId: "resume" }]);
    expect((await getProfiles())[0]?.id).toBe("fresh");
  });
  it("returns client errors for malformed JSON and invalid update types", async () => {
    expect(
      (await POST(new Request("http://localhost/api/queue", { method: "POST", body: "{" }))).status,
    ).toBe(400);
    for (const updates of [
      { status: "unknown" },
      { progress: -1 },
      { companyName: 7 },
      { includeCoverLetter: "true" },
    ])
      expect((await PATCH(request({ id: "job", updates }))).status).toBe(400);
  });
  it("rejects ambiguous deletion filters instead of deleting everything", async () => {
    expect((await DELETE(request(undefined, "DELETE", "?status=failed"))).status).toBe(400);
    expect(await getQueue()).toHaveLength(2);
  });
  it("acknowledges repeated extension submissions without adding duplicates", async () => {
    const first = await POST(request(job("extension"), "POST"));
    const second = await POST(request(job("extension"), "POST"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true, job: { id: "extension" } });
    expect((await getQueue()).filter((j) => j.id === "extension")).toHaveLength(1);
    await updateJobInQueue("extension", {
      resumeLatex: "baked by processing",
      tailoredResume: "completed",
      status: "completed",
    });
    expect((await POST(request(job("extension"), "POST"))).status).toBe(200);
  });
  it("never overwrites the queue after losing the Redis lock", async () => {
    const get = fixture.redis.get.bind(fixture.redis);
    fixture.redis.get = (async (key: string) => {
      const value = await get(key);
      if (key === "data:queue") fixture.store.set("lock:queue", "another writer");
      return value;
    }) as typeof fixture.redis.get;
    await expect(addJobToQueue(job("third"))).rejects.toThrow("lock");
    expect(fixture.store.get("data:queue")).toHaveLength(2);
  });
  it("refuses edits to active jobs and rejects expired worker tokens", async () => {
    const claimed = await claimJob("job");
    expect(
      (await PATCH(request({ id: "job", action: "edit", updates: { companyName: "Changed" } })))
        .status,
    ).toBe(409);
    fixture.store.set("data:queue", [job("job", { ...claimed!, leaseExpiresAt: 1 })]);
    expect(await updateJobInQueue("job", { status: "completed" }, claimed!.runId)).toBeNull();
  });
  it("refuses a pause update after its Redis lock expires", async () => {
    const set = fixture.redis.set.bind(fixture.redis);
    fixture.redis.set = (async (...args: Parameters<typeof fixture.redis.set>) => {
      const result = await set(...args);
      if (args[0] === "lock:queue") fixture.store.set("lock:queue", "new owner");
      return result;
    }) as typeof fixture.redis.set;
    await expect(setQueuePaused(true)).rejects.toThrow("lock");
    expect(fixture.store.has("data:queue:paused")).toBe(false);
  });
});
