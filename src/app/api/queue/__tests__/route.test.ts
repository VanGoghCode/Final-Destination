import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { GET, POST, PUT, PATCH, DELETE } from "../route";
import { getQueue, setRedisInstance } from "@/lib/db";
import { fakeRedis, job } from "@/lib/__tests__/redis";
let fixture: ReturnType<typeof fakeRedis>;
const request = (method: string, body?: unknown, query = "") =>
  new Request("http://localhost/api/queue" + query, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": "owner" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
beforeEach(() => {
  fixture = fakeRedis();
  fixture.store.set("data:queue", [job()]);
});
afterEach(() => setRedisInstance(null));
describe("actual queue routes", () => {
  it("reads saved jobs", async () => {
    expect(await (await GET()).json()).toEqual([job()]);
  });
  it("validates required fields", async () => {
    expect((await POST(request("POST", {}))).status).toBe(400);
  });
  it("adds a pending job, acknowledges retries and rejects conflicting IDs", async () => {
    const input = job("new", { status: "completed" });
    expect((await POST(request("POST", input))).status).toBe(200);
    expect((await getQueue()).find((j) => j.id === "new")?.status).toBe("pending");
    expect((await POST(request("POST", input))).status).toBe(200);
    expect((await POST(request("POST", { ...input, companyName: "Different" }))).status).toBe(409);
  });
  it("returns only added jobs when batches contain duplicates", async () => {
    const response = await PUT(request("PUT", { jobs: [job(), job("new")] }));
    expect(await response.json()).toMatchObject({ added: 1, duplicates: 1, jobs: [{ id: "new" }] });
  });
  it("reports invalid batch entries without dropping valid entries", async () => {
    expect(await (await PUT(request("PUT", { jobs: [{}, job("new")] }))).json()).toMatchObject({
      added: 1,
      errors: [{ index: 0 }],
    });
    expect((await PUT(request("PUT", { jobs: [{}] }))).status).toBe(400);
  });
  it("claims one job and refuses a second claim", async () => {
    const first = await PATCH(request("PATCH", { id: "job", action: "claim" }));
    expect((await first.json()).job.runId).toBeTruthy();
    expect((await PATCH(request("PATCH", { id: "job", action: "claim" }))).status).toBe(409);
  });
  it("resets profile templates and old results on the server", async () => {
    fixture.store.set("data:queue", [
      job("job", {
        resumeLatex: "old",
        coverLetterLatex: "old",
        tailoredResume: "old",
        error: "old",
        completedAt: 1,
      }),
    ]);
    const response = await PATCH(
      request("PATCH", { id: "job", action: "reset", updates: { profileId: "new" } }),
    );
    expect(response.status).toBe(200);
    expect((await getQueue())[0]).not.toHaveProperty("resumeLatex");
    expect((await getQueue())[0]).not.toHaveProperty("completedAt");
    expect((await getQueue())[0]?.profileId).toBe("new");
  });
  it("rejects stale claim tokens", async () => {
    fixture.store.set("data:queue", [job("job", { runId: "new" })]);
    expect(
      (
        await PATCH(
          request("PATCH", { id: "job", runId: "old", updates: { tailoredResume: "stale" } }),
        )
      ).status,
    ).toBe(409);
  });
  it("returns errors on persistence failures", async () => {
    fixture.faults.write = true;
    expect((await PATCH(request("PATCH", { id: "job", updates: { progress: 10 } }))).status).toBe(
      500,
    );
    expect((await PUT(request("PUT", { jobs: [job("new")] }))).status).toBe(500);
  });
  it("deletes only completed jobs or a selected job", async () => {
    fixture.store.set("data:queue", [job(), job("done", { status: "completed" })]);
    await DELETE(request("DELETE", undefined, "?status=completed"));
    expect((await getQueue()).map((j) => j.id)).toEqual(["job"]);
    await DELETE(request("DELETE", undefined, "?id=job"));
    expect(await getQueue()).toEqual([]);
  });
  it("clears the queue and reports failed reads", async () => {
    await DELETE(request("DELETE"));
    expect(await getQueue()).toEqual([]);
    fixture.faults.read = true;
    expect((await GET()).status).toBe(500);
  });
});
