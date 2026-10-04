import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { Redis } from "@upstash/redis";
import {
  addJobsToQueue,
  getAllTierData,
  getCompanyFromTiers,
  setRedisInstance,
  updateCompanyInTier,
  type QueuedJob,
  type TierData,
} from "./db";

const store = new Map<string, unknown>();
let reads: string[][] = [];
let singleReads = 0;
const redis = {
  get: async (key: string) => {
    singleReads++;
    return store.get(key) ?? null;
  },
  mget: async (...keys: string[]) => {
    reads.push(keys);
    return keys.map((key) => store.get(key) ?? null);
  },
  set: async (key: string, value: unknown, options?: { nx?: boolean }) => {
    if (options?.nx && store.has(key)) return null;
    store.set(key, structuredClone(value));
    return "OK";
  },
  eval: async (_script: string, keys: string[], args: string[]) => {
    if (keys.length === 2) {
      if (store.get(keys[0]!) !== args[0]) return 0;
      store.set(keys[1]!, JSON.parse(args[1]!));
      return 1;
    }
    if (store.get(keys[0]!) === args[0]) store.delete(keys[0]!);
    return 1;
  },
} as unknown as Redis;
beforeEach(() => {
  store.clear();
  reads = [];
  singleReads = 0;
  setRedisInstance(redis);
});
afterEach(() => setRedisInstance(null));
const job = (id: string) => ({ id, companyName: "Acme", addedAt: 0 }) as QueuedJob;
const tier = (id: string, name = id): TierData => ({
  tier: "top",
  generatedAt: "now",
  count: 1,
  companies: [{ id, name } as TierData["companies"][number]],
});

describe("database performance and behavior", () => {
  it("fetches four tiers in one Redis command and preserves missing tiers", async () => {
    store.set("data:tier:top", tier("a"));
    const data = await getAllTierData();
    expect(data.top?.companies[0]?.id).toBe("a");
    expect(data.middle).toBeNull();
    expect(reads).toEqual([
      ["data:tier:top", "data:tier:middle", "data:tier:lower", "data:tier:lowest"],
    ]);
    expect(singleReads).toBe(0);
  });
  it("keeps tier precedence when the same company occurs twice", async () => {
    store.set("data:tier:top", tier("a", "Top"));
    store.set("data:tier:lowest", tier("a", "Lowest"));
    expect(await getCompanyFromTiers("a")).toMatchObject({ tier: "top", company: { name: "Top" } });
    expect(reads).toHaveLength(1);
  });
  it("updates the correct tier and keeps unrelated fields", async () => {
    store.set("data:tier:middle", tier("a", "Before"));
    expect(await updateCompanyInTier("a", { city: "Phoenix" })).toMatchObject({
      tier: "middle",
      company: { name: "Before", city: "Phoenix" },
    });
    expect((store.get("data:tier:middle") as TierData).companies[0]?.city).toBe("Phoenix");
    expect(await updateCompanyInTier("missing", { name: "x" })).toBeNull();
  });
  it("deduplicates within batches and against saved jobs without quadratic scans", async () => {
    store.set("data:queue", [job("a")]);
    const large = Array.from({ length: 2000 }, (_, i) => job(String(i)));
    const scans = spyOn(Array.prototype, "some");
    try {
      expect(await addJobsToQueue([job("a"), ...large, job("0")])).toMatchObject({
        success: true,
        added: 2000,
        duplicates: 2,
      });
      expect(scans).not.toHaveBeenCalled();
    } finally {
      scans.mockRestore();
    }
    const queue = store.get("data:queue") as QueuedJob[];
    expect(queue).toHaveLength(2001);
    expect(queue[0]?.id).toBe("a");
    expect(queue[2000]?.id).toBe("1999");
    expect(store.has("lock:queue")).toBe(false);
  });
  it("serializes concurrent batch writes without losing jobs", async () => {
    await Promise.all([addJobsToQueue([job("a")]), addJobsToQueue([job("b")])]);
    expect((store.get("data:queue") as QueuedJob[]).map((j) => j.id)).toEqual(["a", "b"]);
  });
});
