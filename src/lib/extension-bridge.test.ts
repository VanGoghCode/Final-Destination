import { beforeEach, afterEach, describe, it, expect, spyOn } from "bun:test";
import { installExtensionBridge } from "./extension-bridge";
import { openBrowser } from "./__tests__/browser";
import { getQueue } from "./browser-queue";
import { job } from "./__tests__/job";

let close: () => void, remove: () => void;
beforeEach(() => {
  close = openBrowser().close;
  remove = installExtensionBridge();
});
afterEach(() => {
  remove();
  close();
});
const send = async (
  data: object,
  origin = window.location.origin,
  source: Window | null = window,
) => {
  window.dispatchEvent(new window.MessageEvent("message", { data, origin, source }));
  await new Promise((resolve) => setTimeout(resolve, 5));
};
describe("website extension handoff", () => {
  it("forwards extension additions to the shared server, not browser storage", async () => {
    let sent = "";
    globalThis.fetch = (async (url: string) => {
      sent = url;
      return Response.json({ success: true });
    }) as typeof fetch;
    await send({
      type: "fd-extension-request",
      id: "remote",
      path: "/api/queue",
      method: "POST",
      body: job(),
    });
    expect(sent).toBe("/api/queue");
    expect(await getQueue()).toEqual([]);
  });
  it("saves and acknowledges a submission without any network storage", async () => {
    const reply = spyOn(window, "postMessage").mockImplementation(() => {});
    try {
      const message = {
        type: "fd-extension-request",
        id: "request",
        path: "/api/queue",
        method: "POST",
        body: job(),
      };
      await send(message);
      await send(message);
      expect(await getQueue()).toHaveLength(1);
      expect(reply.mock.calls[1]?.[0]).toMatchObject({
        type: "fd-extension-response",
        id: "request",
        status: 200,
        body: { success: true, duplicate: true },
      });
    } finally {
      reply.mockRestore();
    }
  });
  it("ignores foreign origins, frames and unsupported actions", async () => {
    const message = {
      type: "fd-extension-request",
      id: "request",
      path: "/api/queue",
      method: "POST",
      body: job(),
    };
    await send(message, "https://foreign.test");
    await send(message, window.location.origin, null);
    await send({ ...message, method: "DELETE" });
    await send({ ...message, path: "https://foreign.test/api/queue" });
    expect(await getQueue()).toEqual([]);
  });
  it("acknowledges validation failure without saving an invalid job", async () => {
    const reply = spyOn(window, "postMessage").mockImplementation(() => {});
    try {
      await send({
        type: "fd-extension-request",
        id: "request",
        path: "/api/queue",
        method: "POST",
        body: {},
      });
      expect(reply.mock.calls[0]?.[0]).toMatchObject({ status: 400 });
      expect(await getQueue()).toHaveLength(0);
    } finally {
      reply.mockRestore();
    }
  });
  it("removes the listener on unmount", async () => {
    remove();
    await send({
      type: "fd-extension-request",
      id: "request",
      path: "/api/queue",
      method: "POST",
      body: job(),
    });
    expect(await getQueue()).toHaveLength(0);
  });
});
