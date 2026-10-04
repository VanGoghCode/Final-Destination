import { describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Window, type HTMLInputElement as Input, type HTMLElement as Element } from "happy-dom";

async function openPopup(
  url: string,
  saved: Record<string, unknown> = {},
  respond?: (input: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const browser = new Window({ url: "http://localhost" });
  browser.document.write(readFileSync("extension/popup.html", "utf8"));
  let ready: () => Promise<void> = async () => {};
  const add = browser.document.addEventListener.bind(browser.document);
  const listener = spyOn(browser.document, "addEventListener").mockImplementation(((
    type: string,
    handler: () => Promise<void>,
  ) => {
    if (type === "DOMContentLoaded") ready = handler;
    else add(type, handler);
  }) as typeof browser.document.addEventListener);
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const chrome = {
    tabs: { query: async () => [{ url, title: "Engineer at Acme" }] },
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, saved[key]])),
        set: async (values: object) => Object.assign(saved, values),
        remove: async (key: string) => {
          delete saved[key];
        },
      },
    },
  };
  runInNewContext(readFileSync("extension/popup.js", "utf8"), {
    document: browser.document,
    window: browser,
    navigator: browser.navigator,
    chrome,
    URL,
    AbortSignal,
    crypto,
    btoa,
    unescape,
    encodeURIComponent,
    setTimeout: () => 1,
    clearTimeout: () => {},
    console,
    fetch: async (input: string, init?: RequestInit) => {
      calls.push({ url: input, init });
      if (respond) return respond(input, init);
      return Response.json(
        input.includes("profiles")
          ? [{ id: "profile", name: "Me", firstName: "A" }]
          : { success: true },
      );
    },
  });
  await ready();
  listener.mockRestore();
  return { browser, saved, calls };
}
describe("actual extension popup", () => {
  it("keeps drafts separate for jobs sharing a URL prefix", async () => {
    const saved = {};
    for (const id of ["123", "456"]) {
      const { browser } = await openPopup("https://boards.greenhouse.io/company/jobs/" + id, saved);
      const input = browser.document.querySelector("#jobDescription") as Input;
      input.value = id;
      input.dispatchEvent(new browser.Event("input", { bubbles: true }));
    }
    expect(Object.keys(saved).filter((key) => key.startsWith("form_data_"))).toHaveLength(2);
  });
  it("sends the saved access key when loading profiles and submitting jobs", async () => {
    const { browser, calls } = await openPopup("https://example.com/job", {
      fd_server_key: "owner",
    });
    expect(
      new Headers(calls.find((call) => call.url.includes("profiles"))?.init?.headers).get(
        "x-api-key",
      ),
    ).toBe("owner");
    (browser.document.querySelector(".profile") as Element).click();
    for (const id of ["companyName", "positionTitle", "jobDescription"])
      (browser.document.querySelector("#" + id) as Input).value = "filled";
    (browser.document.querySelector("#addBtn") as Element).click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      new Headers(calls.find((call) => call.url.includes("queue"))?.init?.headers).get("x-api-key"),
    ).toBe("owner");
  });
  it("reuses a persisted submission ID after a lost response and popup reopen", async () => {
    const saved = { fd_server_key: "owner" };
    const ids: string[] = [];
    let attempts = 0;
    const respond = (url: string, init?: RequestInit) => {
      if (url.includes("profiles")) return Response.json([{ id: "profile", name: "Me" }]);
      ids.push(JSON.parse(String(init?.body)).id);
      if (++attempts === 1) throw new Error("Connection lost after save");
      return Response.json({ success: true, duplicate: true });
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const { browser } = await openPopup("https://example.com/job", saved, respond);
      for (const id of ["companyName", "positionTitle", "jobDescription"])
        (browser.document.querySelector("#" + id) as Input).value = "filled";
      (browser.document.querySelector("#addBtn") as Element).click();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(browser.document.querySelector("#status")?.textContent).toContain(
        attempt ? "Saved to queue" : "Connection lost",
      );
    }
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toBeTruthy();
  });
  it("allows default templates without requiring a profile and prevents double submissions", async () => {
    const { browser, calls } = await openPopup("https://example.com/job", {}, () =>
      Response.json([]),
    );
    for (const id of ["companyName", "positionTitle", "jobDescription"])
      (browser.document.querySelector("#" + id) as Input).value = "filled";
    const button = browser.document.querySelector("#addBtn") as Element;
    button.click();
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const submissions = calls.filter((r) => r.url.includes("queue"));
    expect(submissions).toHaveLength(1);
    expect(JSON.parse(String(submissions[0]?.init?.body)).profileId).toBeUndefined();
  });
  it("shows authentication failures as a disconnected state", async () => {
    const { browser } = await openPopup("https://example.com/job", {}, () =>
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect(browser.document.querySelector("#connectionDot")?.className).toContain("offline");
    expect(browser.document.querySelector("#profileContainer")?.textContent).toContain(
      "access key",
    );
  });
});
