import { afterEach, describe, expect, it } from "bun:test";
import { GET } from "./route";

const saved = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = saved;
});

describe("scheduled queue processing without an app key", () => {
  it("forwards to the processor without an admin credential", async () => {
    let init: RequestInit | undefined;
    globalThis.fetch = (async (_input: unknown, options?: RequestInit) => {
      init = options;
      return Response.json({ processed: false, reason: "paused" });
    }) as unknown as typeof fetch;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: false, reason: "paused" });
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("x-api-key")).toBeNull();
  });
  it("preserves processor errors for missing AI keys", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { error: "Configure an AI API key" },
        { status: 503 },
      )) as unknown as typeof fetch;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Configure an AI API key" });
  });
  it("reports a failed connection", async () => {
    globalThis.fetch = (async () => {
      throw new Error("Connection lost");
    }) as unknown as typeof fetch;
    const response = await GET();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("Connection lost");
  });
});
