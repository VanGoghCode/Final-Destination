import { expect, test } from "bun:test";
import { createQueueStore } from "./browser-queue";
import { createQueueHandler } from "./local-api";
import { transactQueue } from "./github-queue";
import { job } from "./__tests__/job";
test("two computers can claim only one shared job", async () => {
  let state = { jobs: [job(), job("two")], paused: false },
    revision = 0;
  const file = {
    read: async () => ({ state: structuredClone(state), sha: String(revision) }),
    write: async (next: typeof state, sha: string) => {
      if (sha !== String(revision)) return false;
      state = next;
      revision++;
      return true;
    },
  };
  const claim = () =>
    transactQueue(
      async (draft) =>
        createQueueStore({
          read: () => structuredClone(draft),
          save: (next) => Object.assign(draft, next),
          lock: (action) => action(),
        }).claimJob(),
      file,
    );
  const results = await Promise.all([claim(), claim()]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(state.jobs.filter((j) => j.status === "tailoring-resume")).toHaveLength(1);
});
test("interrupted recovery cannot steal a valid claim from another computer", async () => {
  let state = {
    jobs: [
      job("active", {
        status: "tailoring-cover-letter",
        runId: "owner",
        leaseExpiresAt: Date.now() + 600_000,
      }),
    ],
    paused: false,
  };
  const store = createQueueStore({
    read: () => structuredClone(state),
    save: (next) => {
      state = next;
    },
    lock: (action) => action(),
  });
  expect(await store.claimJob(undefined, true)).toBeNull();
  expect(state.jobs[0]?.runId).toBe("owner");
});
test("failed bulk validation commits none of the partially constructed jobs", async () => {
  let state = { jobs: [job("existing", { inputHash: "other" })], paused: true };
  const store = createQueueStore({
    read: () => structuredClone(state),
    save: (next) => {
      state = next;
    },
    lock: (action) => action(),
  });
  const result = await createQueueHandler(store)(
    new Request("https://example.test/api/queue", {
      method: "PUT",
      body: JSON.stringify({ jobs: [job("new"), job("existing")] }),
    }),
  );
  expect(result.status).toBe(409);
  expect(state.jobs.map((j) => j.id)).toEqual(["existing"]);
});
