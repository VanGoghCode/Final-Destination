import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { readQueueResult, regenerateQueueResult } from "./queue-results";
import { job, fakeRedis } from "./__tests__/redis";
import { setRedisInstance, updateJobInQueue } from "./db";
import { PATCH } from "@/app/api/queue/route";
import { saveResumeTemplates, getProfiles } from "./storage";
const spies: Array<ReturnType<typeof spyOn>> = [];
afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  setRedisInstance(null);
});
describe("saved queue results and template sync", () => {
  it("loads fresh results and profile names instead of stale session data", async () => {
    spies.push(
      spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) =>
        Response.json(
          String(input).includes("master-context")
            ? { content: "context" }
            : String(input).includes("profiles")
              ? [{ id: "me", firstName: "A", lastName: "B" }]
              : [job("job", { profileId: "me", tailoredResume: "fresh" })],
        )) as typeof fetch),
    );
    expect(await readQueueResult("job")).toMatchObject({
      tailoredResume: "fresh",
      masterContext: "context",
      profileFirstName: "A",
    });
    await expect(readQueueResult("removed")).rejects.toThrow("removed");
  });
  it("uses regeneratedContent and persists the regenerated document", async () => {
    const calls: RequestInit[] = [];
    spies.push(
      spyOn(globalThis, "fetch").mockImplementation((async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        calls.push(init!);
        return Response.json(
          String(input).includes("regenerate")
            ? { regeneratedContent: "new resume" }
            : { job: job() },
        );
      }) as typeof fetch),
    );
    expect(await regenerateQueueResult("job", { type: "resume" }, 2)).toBe("new resume");
    expect(JSON.parse(String(calls[1]?.body))).toMatchObject({
      id: "job",
      expectedCompletedAt: 2,
      updates: { tailoredResume: "new resume" },
    });
  });
  it("reports save failures instead of reporting unsaved regeneration as successful", async () => {
    spies.push(
      spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) =>
        String(input).includes("regenerate")
          ? Response.json({ regeneratedContent: "new" })
          : Response.json({ error: "Write failed" }, { status: 500 })) as typeof fetch),
    );
    await expect(regenerateQueueResult("job", { type: "resume" })).rejects.toThrow("Write failed");
  });
  it("rejects stale result edits after a queue retry", async () => {
    const fixture = fakeRedis();
    fixture.store.set("data:queue", [
      job("job", { status: "completed", completedAt: 2, tailoredResume: "old" }),
    ]);
    await updateJobInQueue("job", { status: "pending" });
    const response = await PATCH(
      new Request("http://localhost/api/queue", {
        method: "PATCH",
        body: JSON.stringify({
          id: "job",
          expectedCompletedAt: 2,
          updates: { tailoredResume: "stale" },
        }),
      }),
    );
    expect(response.status).toBe(409);
  });
  it("reports template synchronization failures", async () => {
    spies.push(
      spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ error: "Cloud sync failed" }, { status: 503 }),
      ),
    );
    await expect(saveResumeTemplates([])).rejects.toThrow("Cloud sync failed");
  });
  it("honors an empty cloud profile list rather than restoring deleted profiles", async () => {
    spies.push(spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [] })));
    expect(await getProfiles()).toEqual([]);
  });
});
