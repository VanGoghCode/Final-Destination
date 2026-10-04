import { filterJobs, getTargetRoles, getExcludedKeywords, type Job } from "../lib/scrapers/types";
import { addJobsToQueue, setRedisInstance, type QueuedJob } from "../lib/db";
import type { Redis } from "@upstash/redis";
import { deepStrictEqual } from "node:assert";

// Offline comparison against the previous algorithms. No API keys or Redis required.
const jobs = Array.from(
  { length: 20_000 },
  (_, i) =>
    ({
      id: String(i),
      title: i % 3 === 0 ? "Director of Backend" : "Senior Backend Engineer",
    }) as Job,
);
const roles = getTargetRoles(),
  excluded = getExcludedKeywords();
function oldFilter() {
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();
    const matches = roles.some((role) => title.includes(role.toLowerCase()));
    const excludes = excluded.some((keyword) => title.includes(keyword.toLowerCase()));
    return matches && !excludes;
  });
}
const newFilter = () => filterJobs(jobs, roles, excluded);
deepStrictEqual(newFilter(), oldFilter());

async function medianMs(run: () => unknown, repeats = 7): Promise<number> {
  await run();
  const times = [];
  for (let i = 0; i < repeats; i++) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[Math.floor(repeats / 2)]!;
}

const batch = jobs.map(({ id }) => ({ id }) as QueuedJob);
let stored: QueuedJob[] = [];
setRedisInstance({
  get: async () => stored,
  set: async (key: string, value: QueuedJob[]) => {
    if (key === "data:queue") stored = value;
    return "OK";
  },
  eval: async () => 1,
} as unknown as Redis);
const oldBatch = () => {
  const queue: QueuedJob[] = [];
  for (const job of batch) if (!queue.some((saved) => saved.id === job.id)) queue.push(job);
  return queue;
};
const newBatch = async () => {
  stored = [];
  await addJobsToQueue(batch);
  return stored;
};
try {
  deepStrictEqual(await newBatch(), oldBatch());
  for (const [label, before, after] of [
    ["Filter 20,000 jobs", oldFilter, newFilter],
    ["Queue 20,000 jobs", oldBatch, newBatch],
  ] as const) {
    const baseline = await medianMs(before),
      optimized = await medianMs(after);
    console.log(
      `${label}: ${baseline.toFixed(2)}ms -> ${optimized.toFixed(2)}ms (${(baseline / optimized).toFixed(1)}x faster; median of 7)`,
    );
  }
} finally {
  setRedisInstance(null);
}
