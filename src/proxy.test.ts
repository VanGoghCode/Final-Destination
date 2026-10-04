import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import * as limits from "@/lib/rate-limit";

const saved = { admin: process.env.ADMIN_API_KEY, cron: process.env.CRON_SECRET };
afterEach(() => {
  for (const [key, value] of [
    ["ADMIN_API_KEY", saved.admin],
    ["CRON_SECRET", saved.cron],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
const request = (path: string, method = "GET", headers = {}) =>
  new NextRequest(`http://localhost/api/${path}`, { method, headers });
describe("API access boundary", () => {
  it.each([
    "storage",
    "profiles",
    "queue",
    "master-context",
    "admin/users",
    "process-queue",
    "cron/process-queue",
  ])("denies anonymous %s reads", async (path) => {
    process.env.ADMIN_API_KEY = "owner";
    expect((await proxy(request(path))).status).toBe(401);
  });
  it.each([
    "data",
    "sheets",
    "queue",
    "jobs",
    "tailor",
    "answers",
    "regenerate",
    "ask",
    "emails",
    "extract-job",
  ])("denies anonymous %s writes", async (path) => {
    process.env.ADMIN_API_KEY = "owner";
    expect((await proxy(request(path, "POST"))).status).toBe(401);
  });
  it("fails closed when no key is configured", async () => {
    delete process.env.ADMIN_API_KEY;
    expect((await proxy(request("storage"))).status).toBe(401);
  });
  it("accepts an owner key and permits public health checks", async () => {
    process.env.ADMIN_API_KEY = "owner";
    expect((await proxy(request("storage", "GET", { "x-api-key": "owner" }))).status).toBe(200);
    expect((await proxy(request("health"))).status).toBe(200);
  });
  it("scopes cron credentials to the cron route", async () => {
    process.env.CRON_SECRET = "cron";
    expect(
      (await proxy(request("cron/process-queue", "GET", { authorization: "Bearer cron" }))).status,
    ).toBe(200);
    expect((await proxy(request("storage", "GET", { authorization: "Bearer cron" }))).status).toBe(
      401,
    );
  });
  it("allows authenticated extension preflight headers", async () => {
    const response = await proxy(request("queue", "OPTIONS"));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("x-api-key");
  });
  it("blocks paid requests when shared usage is exhausted or unavailable", async () => {
    process.env.ADMIN_API_KEY = "owner";
    const limiter = spyOn(limits, "checkRateLimitAsync").mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: 1,
      retryAfter: 60,
    });
    try {
      expect((await proxy(request("process-queue", "POST", { "x-api-key": "owner" }))).status).toBe(
        429,
      );
      limiter.mockRejectedValue(new Error("Redis unavailable"));
      expect((await proxy(request("process-queue", "POST", { "x-api-key": "owner" }))).status).toBe(
        503,
      );
    } finally {
      limiter.mockRestore();
    }
  });
});
