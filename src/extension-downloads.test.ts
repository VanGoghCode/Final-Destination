import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";

const origin = "https://final-destination-rose.vercel.app";
const pdf = btoa("%PDF-1.7\nfixture");
type DownloadOptions = { url: string; filename: string; conflictAction: string; saveAs: boolean };
type Delta = { id: number; state?: { current: string }; error?: { current: string } };

function openWorker(state = "complete") {
  let receive!: (message: object, sender: object, reply: (value: unknown) => void) => boolean;
  const listeners = new Set<(delta: Delta) => void>();
  const downloads: DownloadOptions[] = [];
  const chrome = {
    runtime: {
      id: "extension-id",
      onMessage: {
        addListener: (handler: typeof receive) => (receive = handler),
      },
    },
    storage: { local: { get: async () => ({ fd_server_url: origin }) } },
    downloads: {
      download: async (options: DownloadOptions) => {
        downloads.push(options);
        return downloads.length;
      },
      search: async () => [
        { state, error: state === "interrupted" ? "FILE_ACCESS_DENIED" : undefined },
      ],
      onChanged: {
        addListener: (handler: (delta: Delta) => void) => listeners.add(handler),
        removeListener: (handler: (delta: Delta) => void) => listeners.delete(handler),
      },
    },
  };
  runInNewContext(readFileSync("extension/downloads.js", "utf8"), {
    chrome,
    URL,
    atob,
    setTimeout,
    clearTimeout,
  });
  return {
    chrome,
    downloads,
    listeners,
    send: (message: object, url = origin, id = "extension-id") =>
      new Promise<unknown>((resolve) =>
        receive({ type: "fd-pdf-download", ...message }, { url, id }, resolve),
      ),
  };
}

it("saves both PDFs under apply with overwrite and no Save As dialog", async () => {
  const worker = openWorker();
  for (const fileName of [
    "Kirtan_Thummar_resume.pdf",
    "Kirtan_Thummar_resume.pdf",
    "Kirtan_Thummar_cover_letter.pdf",
  ]) {
    expect(await worker.send({ action: "save", fileName, pdfBase64: pdf })).toEqual({ ok: true });
    expect(worker.downloads.at(-1)).toEqual({
      url: `data:application/pdf;base64,${pdf}`,
      filename: `apply/${fileName}`,
      conflictAction: "overwrite",
      saveAs: false,
    });
  }
  expect(worker.listeners.size).toBe(0);
});

it("acknowledges a save only after the download completes", async () => {
  const worker = openWorker("in_progress");
  let finished = false;
  const saved = worker
    .send({ action: "save", fileName: "Kirtan_Thummar_resume.pdf", pdfBase64: pdf })
    .then((result) => {
      finished = true;
      return result;
    });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(finished).toBe(false);
  for (const listener of worker.listeners) listener({ id: 1, state: { current: "complete" } });
  expect(await saved).toEqual({ ok: true });
  expect(worker.listeners.size).toBe(0);
});

it("rejects other websites, extension senders, unsafe filenames and invalid PDFs", async () => {
  const worker = openWorker();
  const request = { action: "save", fileName: "Kirtan_Thummar_resume.pdf", pdfBase64: pdf };
  expect(await worker.send(request, "https://foreign.test")).toMatchObject({ ok: false });
  expect(await worker.send(request, origin, "other-extension")).toMatchObject({ ok: false });
  for (const fileName of ["../resume.pdf", "C:\\Users\\kirta\\file.pdf", "other.pdf"])
    expect(await worker.send({ ...request, fileName })).toMatchObject({ ok: false });
  expect(await worker.send({ ...request, pdfBase64: btoa("not a PDF") })).toMatchObject({
    ok: false,
  });
  expect(worker.downloads).toEqual([]);
});

it("reports interrupted downloads and removes the completion listener", async () => {
  const worker = openWorker("interrupted");
  expect(
    await worker.send({ action: "save", fileName: "Kirtan_Thummar_resume.pdf", pdfBase64: pdf }),
  ).toMatchObject({ ok: false, error: expect.stringContaining("FILE_ACCESS_DENIED") });
  expect(worker.listeners.size).toBe(0);
});

it("the actual content script forwards app saves and ignores other windows and origins", async () => {
  const worker = openWorker();
  const browser = new Window({ url: origin });
  const responses: unknown[] = [];
  browser.postMessage = (message: unknown) => responses.push(message);
  runInNewContext(readFileSync("extension/bridge.js", "utf8"), {
    window: browser,
    location: browser.location,
    chrome: {
      runtime: {
        onMessage: { addListener: () => {} },
        sendMessage: (message: object) => worker.send(message),
      },
    },
  });
  const data = {
    type: "fd-pdf-request",
    id: "save-request",
    action: "save",
    fileName: "Kirtan_Thummar_resume.pdf",
    pdfBase64: pdf,
  };
  for (const event of [
    { source: browser, origin: "https://foreign.test" },
    { source: null, origin },
  ])
    browser.dispatchEvent(new browser.MessageEvent("message", { ...event, data }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(worker.downloads).toEqual([]);
  browser.dispatchEvent(new browser.MessageEvent("message", { source: browser, origin, data }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(worker.downloads).toHaveLength(1);
  expect(responses).toEqual([{ type: "fd-pdf-response", id: "save-request", ok: true }]);
});
