import { beforeEach, afterEach, expect, test } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { getQueue, setQueue } from "./browser-queue";
import { generateQueueCoverLetter, saveQueueResult } from "./queue-results";
import { localRequest } from "./local-api";
import { job } from "./__tests__/job";
import { coverTemplate, masterContext } from "./personal-workspace";
let close: () => void;
beforeEach(async () => {
  close = openBrowser().close;
  await setQueue([
    job("job", { status: "completed", tailoredResume: "saved resume", completedAt: 10 }),
  ]);
});
afterEach(() => close());
function respond(ai: (body: Record<string, unknown>) => Promise<Response>) {
  globalThis.fetch = (async (url: string, init?: RequestInit) =>
    url.startsWith("/api/queue")
      ? (await localRequest(url, init))!
      : ai(JSON.parse(String(init?.body)))) as typeof fetch;
}
test("on-demand cover letters use candidate defaults, the edited resume and persist for another browser", async () => {
  respond(async (body) => {
    expect(body.coverLetterLatex).toBe(coverTemplate.content);
    expect(body.masterContext).toBe(masterContext);
    expect(body.tailoredResume).toBe("edited resume");
    return Response.json({ tailoredCoverLetter: "new letter" });
  });
  const result = await generateQueueCoverLetter("job", "edited resume", 10);
  expect(result).toMatchObject({
    tailoredResume: "edited resume",
    tailoredCoverLetter: "new letter",
    includeCoverLetter: true,
  });
  expect((await getQueue())[0]?.tailoredCoverLetter).toBe("new letter");
});
test("a newer edit during generation wins and the stale letter cannot overwrite it", async () => {
  respond(async () => {
    await saveQueueResult("job", { tailoredResume: "newer resume" }, 10);
    return Response.json({ tailoredCoverLetter: "stale letter" });
  });
  await expect(generateQueueCoverLetter("job", "old resume", 10)).rejects.toThrow(
    "results changed",
  );
  expect((await getQueue())[0]?.tailoredResume).toBe("newer resume");
  expect((await getQueue())[0]?.tailoredCoverLetter).toBeUndefined();
});
test("empty or failed AI output leaves the existing resume intact", async () => {
  for (const response of [
    Response.json({ tailoredCoverLetter: " " }),
    Response.json({ error: "quota" }, { status: 429 }),
  ]) {
    respond(async () => response);
    await expect(generateQueueCoverLetter("job", "saved resume", 10)).rejects.toThrow();
    expect((await getQueue())[0]).toMatchObject({
      tailoredResume: "saved resume",
      completedAt: 10,
    });
  }
});
