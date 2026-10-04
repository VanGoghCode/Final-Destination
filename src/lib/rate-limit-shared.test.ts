import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { checkRateLimitAsync } from "./rate-limit";
import { fakeRedis } from "./__tests__/redis";
import { setRedisInstance } from "./db";
const saved = { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
afterEach(() => {
  setRedisInstance(null);
  for (const [key, value] of [
    ["KV_REST_API_URL", saved.url],
    ["KV_REST_API_TOKEN", saved.token],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
describe("shared rate limits", () => {
  it("increments concurrent requests using one atomic Redis operation", async () => {
    const { redis } = fakeRedis();
    let count = 0;
    process.env.KV_REST_API_URL = "https://mock.invalid";
    process.env.KV_REST_API_TOKEN = "mock";
    const evalSpy = spyOn(redis, "eval").mockImplementation(
      async <TArgs extends unknown[], TData>(script: string, keys: string[], args: TArgs) => {
        expect(script).toContain("PEXPIRE");
        expect(keys).toHaveLength(1);
        expect(args[0]).toBeGreaterThan(0);
        return ++count as TData;
      },
    );
    try {
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          checkRateLimitAsync("owner", { maxRequests: 2, windowMs: 60_000 }),
        ),
      );
      expect(results.filter((result) => result.success)).toHaveLength(2);
      expect(evalSpy).toHaveBeenCalledTimes(3);
      expect(evalSpy.mock.calls[0]?.[0]).toContain("INCR");
    } finally {
      evalSpy.mockRestore();
    }
  });
});
