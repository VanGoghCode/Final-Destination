import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  addJobToQueue,
  claimJob,
  getQueue,
  resetJob,
  setRedisInstance,
  updateJobInQueue,
} from "./db";
import { fakeRedis, job } from "./__tests__/redis";

let fixture: ReturnType<typeof fakeRedis>;
beforeEach(() => {
  fixture = fakeRedis();
  fixture.store.set("data:queue", [job()]);
});
afterEach(() => setRedisInstance(null));
describe("queue persistence and claims", () => {
  it("does not overwrite jobs after failed reads", async () => {
    fixture.faults.read = true;
    await expect(addJobToQueue(job("new"))).rejects.toThrow("Redis read failed");
    expect(fixture.store.get("data:queue")).toEqual([job()]);
  });
  it("does not report failed writes as successful updates", async () => {
    fixture.faults.write = true;
    await expect(updateJobInQueue("job", { status: "completed" })).rejects.toThrow();
    expect((await getQueue())[0]?.status).toBe("pending");
  });
  it("allows only one concurrent claimant", async () => {
    const results = await Promise.all([claimJob("job"), claimJob("job")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)?.runId).toBeTruthy();
  });
  it("rejects stale workers after a reset and a new claim", async () => {
    const first = await claimJob("job");
    await updateJobInQueue("job", resetJob(job()));
    const second = await claimJob("job");
    expect(second?.runId).not.toBe(first?.runId);
    expect(await updateJobInQueue("job", { tailoredResume: "old" }, first!.runId)).toBeNull();
    expect((await getQueue())[0]?.tailoredResume).toBeUndefined();
  });
  it("reclaims expired jobs during the same invocation", async () => {
    fixture.store.set("data:queue", [job("job", { status: "tailoring-resume", startedAt: 1 })]);
    expect((await claimJob())?.id).toBe("job");
  });
  it("removes old templates and results when changing profiles", () => {
    const reset = resetJob(
      job("job", { resumeLatex: "old", tailoredResume: "old", error: "old", runId: "old" }),
    );
    expect(reset).not.toHaveProperty("resumeLatex");
    expect(reset).not.toHaveProperty("tailoredResume");
    expect(reset).not.toHaveProperty("runId");
    expect(reset.status).toBe("pending");
  });
});
