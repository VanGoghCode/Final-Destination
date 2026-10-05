import { expect, test } from "bun:test";
import { transactQueue, githubQueueFile } from "./github-queue";

test("a conflicting write retries from fresh state without dropping another browser's job", async () => {
  let state = { jobs: [] as string[], paused: true },
    revision = 0,
    writes = 0;
  const result = await transactQueue(
    async (draft) => {
      draft.jobs.push("mine");
      return draft.jobs.length;
    },
    {
      read: async () => ({ state: structuredClone(state), sha: String(revision) }),
      write: async (draft, sha) => {
        if (!writes++) {
          state.jobs.push("theirs");
          revision++;
        }
        if (sha !== String(revision)) return false;
        state = draft;
        revision++;
        return true;
      },
    },
  );
  expect(result).toBe(2);
  expect(state.jobs).toEqual(["theirs", "mine"]);
});

test("read-only transactions never create commits", async () => {
  let writes = 0;
  expect(
    await transactQueue(async (state) => state.paused, {
      read: async () => ({ state: { jobs: [], paused: true }, sha: "one" }),
      write: async () => {
        writes++;
        return true;
      },
    }),
  ).toBe(true);
  expect(writes).toBe(0);
});

test("repeated conflicts fail visibly rather than claim an unsaved mutation succeeded", async () => {
  await expect(
    transactQueue(
      async (state) => {
        state.paused = false;
      },
      {
        read: async () => ({ state: { jobs: [], paused: true }, sha: "old" }),
        write: async () => false,
      },
    ),
  ).rejects.toThrow("changed");
});
test("large shared queues read the immutable blob, preserving the revision used for writes", async () => {
  const originalFetch = globalThis.fetch;
  const originalRepo = process.env.GITHUB_QUEUE_REPO,
    originalToken = process.env.GITHUB_QUEUE_TOKEN;
  process.env.GITHUB_QUEUE_REPO = "owner/private-queue";
  process.env.GITHUB_QUEUE_TOKEN = "fixture-token";
  const sha = "a".repeat(40);
  const requests: string[] = [];
  globalThis.fetch = (async (url: string) => {
    requests.push(url);
    return Response.json(
      url.endsWith(`/git/blobs/${sha}`)
        ? {
            sha,
            encoding: "base64",
            content: Buffer.from('{"jobs":[],"paused":true}').toString("base64"),
          }
        : { sha, encoding: "none", content: "" },
    );
  }) as typeof fetch;
  try {
    expect(await githubQueueFile().read()).toEqual({ sha, state: { jobs: [], paused: true } });
    expect(requests[1]).toContain(`/git/blobs/${sha}`);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRepo === undefined) delete process.env.GITHUB_QUEUE_REPO;
    else process.env.GITHUB_QUEUE_REPO = originalRepo;
    if (originalToken === undefined) delete process.env.GITHUB_QUEUE_TOKEN;
    else process.env.GITHUB_QUEUE_TOKEN = originalToken;
  }
});
