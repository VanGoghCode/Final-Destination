import { describe, expect, it, spyOn } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import * as limits from "@/lib/rate-limit";

const request = (path: string, method = "POST") =>
  new NextRequest(`http://localhost/api/${path}`, { method });
describe("stateless AI API", () => {
  it.each([
    "tailor",
    "tailor-cover-letter",
    "answers",
    "regenerate",
    "ask",
    "emails",
    "extract-job",
  ])("allows %s with temporary controls and no app key", async (path) => {
    const limiter = spyOn(limits, "checkRateLimitAsync").mockResolvedValue({
      success: true,
      remaining: 1,
      resetTime: 1,
    });
    try {
      expect((await proxy(request(path))).status).toBe(200);
    } finally {
      limiter.mockRestore();
    }
  });
  it("keeps health checks available", async () => {
    expect((await proxy(request("health", "GET"))).status).toBe(200);
  });
  it("allows preflight AI headers", async () => {
    const response = await proxy(request("tailor", "OPTIONS"));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("x-openai-api-key");
  });
  it("blocks paid requests when the temporary limit is exhausted", async () => {
    const limiter = spyOn(limits, "checkRateLimitAsync").mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: 1,
      retryAfter: 60,
    });
    try {
      const response = await proxy(request("tailor"));
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
    } finally {
      limiter.mockRestore();
    }
  });
});
