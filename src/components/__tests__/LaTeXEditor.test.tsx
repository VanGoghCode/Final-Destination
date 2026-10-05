import { afterEach, beforeEach, expect, it } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { openBrowser } from "@/lib/__tests__/browser";
import LaTeXEditor from "../LaTeXEditor";

let root: Root, container: HTMLDivElement, close: () => void;
const pdf = btoa("%PDF-1.7\nfixture");
beforeEach(() => {
  close = openBrowser().close;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  close();
});

it("saves repaired source so code and downloaded PDF agree", async () => {
  const saved: string[] = [];
  globalThis.fetch = (async () =>
    Response.json({ pdf, latex: "corrected source" })) as unknown as typeof fetch;
  await act(async () =>
    root.render(
      <LaTeXEditor
        code="broken source"
        title="Resume"
        onCodeChange={(value) => saved.push(value)}
      />,
    ),
  );
  expect(saved).toEqual(["corrected source"]);
  expect(container.querySelector("textarea")?.value).toBe("corrected source");
});
it("ignores obsolete compilation results after the document changes", async () => {
  let resolve!: (response: Response) => void;
  const saved: string[] = [];
  let calls = 0;
  globalThis.fetch = (async () =>
    ++calls === 1
      ? new Promise<Response>((done) => {
          resolve = done;
        })
      : Response.json({ pdf, latex: "latest source" })) as unknown as typeof fetch;
  await act(async () =>
    root.render(
      <LaTeXEditor code="old source" title="Resume" onCodeChange={(value) => saved.push(value)} />,
    ),
  );
  await act(async () =>
    root.render(
      <LaTeXEditor
        code="latest source"
        title="Resume"
        onCodeChange={(value) => saved.push(value)}
      />,
    ),
  );
  await act(async () => resolve(Response.json({ pdf, latex: "obsolete repaired source" })));
  expect(container.querySelector("textarea")?.value).toBe("latest source");
  expect(saved).toEqual([]);
});
it("shows a readable platform failure and preserves editable source", async () => {
  globalThis.fetch = (async () =>
    new Response("Preview service temporarily unavailable", {
      status: 503,
    })) as unknown as typeof fetch;
  await act(async () => root.render(<LaTeXEditor code="saved source" title="Resume" />));
  expect(container.textContent).toContain("Preview service temporarily unavailable");
  expect(container.querySelector("textarea")?.value).toBe("saved source");
});
