import { beforeEach, afterEach, expect, it } from "bun:test";
import { parseJobBatch, submitJobBatch } from "./job-import";
import { openBrowser } from "./__tests__/browser";
import { getQueue, readState, setQueuePaused } from "./browser-queue";
import { processLocalQueue } from "./process-local-queue";
import type { Profile } from "./storage";
import { localRequest } from "./local-api";
const profiles: Profile[] = [
  {
    id: "p",
    name: "SDE",
    firstName: "Test",
    lastName: "User",
    updatedAt: 1,
    color: "blue",
    defaultResumeId: "r",
    defaultCoverLetterId: null,
    createdAt: 1,
  },
  {
    id: "q",
    name: "Cloud",
    firstName: "Test",
    lastName: "User",
    updatedAt: 1,
    color: "green",
    defaultResumeId: "r",
    defaultCoverLetterId: null,
    createdAt: 1,
  },
];
const job = {
  companyName: "Company",
  positionTitle: "Engineer",
  jobDescription: "Full job description with responsibilities and required qualifications.",
  applicationUrl: "https://example.com/apply/engineer",
  profileName: "SDE",
};
const input = (jobs: unknown) => JSON.stringify({ jobs });
let close: () => void;
beforeEach(() => {
  close = openBrowser().close;
  localStorage.setItem("fd_profiles", JSON.stringify(profiles));
  localStorage.setItem(
    "fd_resume_templates",
    JSON.stringify([{ id: "r", name: "Resume", content: "resume", createdAt: 1, updatedAt: 1 }]),
  );
});
afterEach(() => close());

it("accepts 15 jobs with explicit profiles and application links", () => {
  const jobs = parseJobBatch(
    input(
      Array.from({ length: 15 }, (_, i) => ({
        ...job,
        applicationUrl: `${job.applicationUrl}/${i}`,
      })),
    ),
    profiles,
  );
  expect(jobs).toHaveLength(15);
  expect(jobs[0]?.profileId).toBe("kirtan");
  expect(jobs[0]?.companyUrl).toBe(`${job.applicationUrl}/0`);
});
it.each([
  [],
  Array(16).fill(job),
  [null],
  [{ ...job, jobDescription: " " }],
  [{ ...job, applicationUrl: "javascript:alert(1)" }],
  [{ ...job, applicationUrl: "https://u:password@example.com/apply" }],
  [{ ...job, jobDescription: undefined, jobDescriptionSummary: "summary" }],
])("rejects invalid batches without saving jobs", async (jobs) => {
  await expect(submitJobBatch(input(jobs))).rejects.toThrow();
  expect(await getQueue()).toEqual([]);
});
it("accepts an explicitly selected batch profile and per-job overrides", () => {
  const jobs = parseJobBatch(
    input([
      { ...job, profileName: undefined },
      { ...job, profileName: "Cloud" },
    ]),
    profiles,
    "p",
  );
  expect(jobs.map((j) => j.profileId)).toEqual(["kirtan", "kirtan"]);
});
it("ignores legacy profile choices and always uses the personal setup", () => {
  expect(parseJobBatch(input([{ ...job, profileId: "q" }]), profiles)[0]?.profileId).toBe("kirtan");
});
it("does not duplicate a successfully saved batch after lost acknowledgement or page reload", async () => {
  expect((await submitJobBatch(input([job]))).added).toBe(1);
  expect((await submitJobBatch(input([job]))).added).toBe(0);
  expect(await getQueue()).toHaveLength(1);
});
it("validates every row and chosen templates before changing the queue", async () => {
  await expect(submitJobBatch(input([job, { ...job, companyName: "" }]))).rejects.toThrow();
  localStorage.setItem("fd_resume_templates", "[]");
  expect((await submitJobBatch(input([job]))).added).toBe(1);
});
it("automatically starts new bot jobs with Luna and a profile template", async () => {
  localStorage.setItem("fd_openai_api_key", "test-key");
  let headers: Headers | undefined;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    if (_url.startsWith("/api/queue")) return (await localRequest(_url, init))!;
    headers = new Headers(init.headers);
    return Response.json({ tailoredResume: "tailored resume" });
  }) as typeof fetch;
  await submitJobBatch(input([job]));
  expect(await getQueue()).toHaveLength(1);
  expect(readState().paused).toBe(false);
  expect(await processLocalQueue()).toBe(true);
  expect(headers?.get("x-ai-provider")).toBe("openai");
  expect(headers?.get("x-ai-model")).toBe("gpt-6-luna");
  expect(headers?.get("x-openai-api-key")).toBe("test-key");
  expect((await getQueue())[0]?.status).toBe("completed");
});
it("does not undo a manual pause when a bot replays only existing jobs", async () => {
  await submitJobBatch(input([job]));
  await setQueuePaused(true);
  await submitJobBatch(input([job]));
  expect(readState().paused).toBe(true);
});
it("does not save jobs or unpause the queue when browser storage is full", async () => {
  const storage = localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: storage.getItem.bind(storage),
      setItem: () => {
        throw Error("Storage quota exceeded");
      },
    },
  });
  await expect(submitJobBatch(input([job]))).rejects.toThrow("quota exceeded");
  expect(readState()).toEqual({ jobs: [], paused: true });
});
it("uses supplied templates even when legacy browser data is empty", async () => {
  localStorage.setItem("fd_profiles", "[]");
  localStorage.setItem("fd_cover_letter_templates", "[]");
  expect((await submitJobBatch(input([{ ...job, includeCoverLetter: true }]))).added).toBe(1);
});

it("rejects invalid rows and oversized direct bulk requests atomically", async () => {
  const valid = { ...job, companyUrl: job.applicationUrl };
  for (const jobs of [[valid, { ...valid, jobDescription: "" }], Array(16).fill(valid)]) {
    const response = await localRequest("/api/queue", {
      method: "PUT",
      body: JSON.stringify({ jobs }),
    });
    expect(response!.status).toBe(400);
    expect(await getQueue()).toEqual([]);
  }
});
