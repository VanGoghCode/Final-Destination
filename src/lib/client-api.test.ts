import { afterEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { apiFetch, apiJSON } from "./client-api";
const keys = ["window", "document", "localStorage", "fetch"] as const;
const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
afterEach(() =>
  keys.forEach((key, i) => {
    if (descriptors[i]) Object.defineProperty(globalThis, key, descriptors[i]!);
    else Reflect.deleteProperty(globalThis, key);
  }),
);
describe("browser AI requests", () => {
  it("adds only selected provider headers without dropping custom headers", async () => {
    const browser = new Window({ url: "http://localhost" });
    Object.assign(globalThis, {
      window: browser,
      document: browser.document,
      localStorage: browser.localStorage,
    });
    localStorage.setItem("fd_admin_key", "owner");
    localStorage.setItem("fd_ai_provider", "openai");
    localStorage.setItem("fd_openai_api_key", "ai");
    let sent: Headers;
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      sent = new Headers(init?.headers);
      return Response.json({ success: true });
    }) as typeof fetch;
    await apiFetch("/api/tailor", { headers: { "Content-Type": "application/json" } });
    expect(sent!.get("x-api-key")).toBeNull();
    expect(sent!.get("x-openai-api-key")).toBe("ai");
    expect(sent!.get("Content-Type")).toBe("application/json");
  });
  it("throws on HTTP errors instead of silently accepting them", async () => {
    globalThis.fetch = (async () =>
      Response.json({ error: "Unauthorized" }, { status: 401 })) as unknown as typeof fetch;
    await expect(apiJSON("/api/tailor")).rejects.toThrow("Unauthorized");
  });
  it("never forwards the saved AI key to another origin", async () => {
    const browser = new Window({ url: "https://example.test" });
    Object.assign(globalThis, {
      window: browser,
      document: browser.document,
      localStorage: browser.localStorage,
    });
    localStorage.setItem("fd_ai_provider", "openai");
    localStorage.setItem("fd_openai_api_key", "fixture");
    let sent!: Headers;
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      sent = new Headers(init?.headers);
      return Response.json({});
    }) as typeof fetch;
    await apiFetch("https://another.test/api/tailor");
    expect(sent.get("x-openai-api-key")).toBeNull();
  });
});
