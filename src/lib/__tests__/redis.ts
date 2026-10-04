import type { Redis } from "@upstash/redis";
import { setRedisInstance, type QueuedJob } from "../db";

export const job = (id = "job", updates: Partial<QueuedJob> = {}): QueuedJob => ({
  id,
  companyName: "Acme",
  companyUrl: "https://example.com/job",
  positionTitle: "Engineer",
  jobDescription: "Build software",
  personalDetails: "",
  includeCoverLetter: false,
  status: "pending",
  progress: 0,
  addedAt: 1,
  ...updates,
});
export function fakeRedis() {
  const store = new Map<string, unknown>();
  const faults = { read: false, write: false };
  const redis = {
    get: async (key: string) => {
      if (faults.read) throw new Error("Redis read failed");
      return structuredClone(store.get(key) ?? null);
    },
    set: async (key: string, value: unknown, options?: { nx?: boolean }) => {
      if (faults.write && key !== "lock:queue") throw new Error("Redis write failed");
      if (options?.nx && store.has(key)) return null;
      store.set(key, structuredClone(value));
      return "OK";
    },
    del: async (...keys: string[]) => keys.filter((key) => store.delete(key)).length,
    keys: async (pattern: string) =>
      [...store.keys()].filter((key) => key.startsWith(pattern.replace("*", ""))),
    mget: async (...keys: string[]) => keys.map((key) => store.get(key) ?? null),
    eval: async (_: string, keys: string[], args: string[]) => {
      if (keys.length === 2) {
        if (faults.write) throw new Error("Redis write failed");
        if (store.get(keys[0]!) !== args[0]) return 0;
        store.set(keys[1]!, JSON.parse(args[1]!));
        return 1;
      }
      if (store.get(keys[0]!) === args[0]) store.delete(keys[0]!);
      return 1;
    },
  } as unknown as Redis;
  setRedisInstance(redis);
  return { store, faults, redis };
}
