import { beforeEach, afterEach, expect, it } from "bun:test";
import { parseJobBatch, submitJobBatch } from "./job-import";
import { openBrowser } from "./__tests__/browser";
import { getQueue } from "./browser-queue";
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
  expect(jobs[0]?.profileId).toBe("p");
  expect(jobs[0]?.companyUrl).toBe(`${job.applicationUrl}/0`);
});
it.each([
  [],
  Array(16).fill(job),
  [null],
  [{ ...job, jobDescription: " " }],
  [{ ...job, applicationUrl: "javascript:alert(1)" }],
  [{ ...job, applicationUrl: "https://u:password@example.com/apply" }],
  [{ ...job, profileName: "unknown" }],
  [{ ...job, profileName: "" }],
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
  expect(jobs.map((j) => j.profileId)).toEqual(["p", "q"]);
});
it("rejects ambiguous profile names and conflicting profile identifiers", () => {
  expect(() =>
    parseJobBatch(input([job]), [...profiles, { ...profiles[0]!, id: "duplicate" }]),
  ).toThrow("ambiguous");
  expect(() => parseJobBatch(input([{ ...job, profileId: "q" }]), profiles)).toThrow("disagree");
});
it("does not duplicate a successfully saved batch after lost acknowledgement or page reload", async () => {
  expect((await submitJobBatch(input([job]))).added).toBe(1);
  expect((await submitJobBatch(input([job]))).added).toBe(0);
  expect(await getQueue()).toHaveLength(1);
});
it("validates every row and chosen templates before changing the queue", async () => {
  await expect(submitJobBatch(input([job, { ...job, companyName: "" }]))).rejects.toThrow();
  localStorage.setItem("fd_resume_templates", "[]");
  await expect(submitJobBatch(input([job]))).rejects.toThrow("resume template");
  expect(await getQueue()).toEqual([]);
});
it("preserves pause state and supports a profile template without a global default", async () => {
  await submitJobBatch(input([job]));
  expect(await getQueue()).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem("fd_queue_state")!).paused).toBe(true);
});
it("rejects a deleted profile or missing cover template without saving any job", async () => {
  localStorage.setItem("fd_profiles", "[]");
  await expect(submitJobBatch(input([job]))).rejects.toThrow("existing profile");
  localStorage.setItem("fd_profiles", JSON.stringify(profiles));
  await expect(submitJobBatch(input([job, { ...job, includeCoverLetter: true }]))).rejects.toThrow(
    "cover letter template",
  );
  expect(await getQueue()).toEqual([]);
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
