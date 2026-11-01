import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { openBrowser } from "@/lib/__tests__/browser";
import { mockPdfExtension } from "@/lib/__tests__/pdf-extension";
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

it("waits for the extension to save the PDF before opening the job", async () => {
  let finish!: () => void;
  let written = "";
  const bridge = mockPdfExtension(async (_name, base64) => {
    written = atob(base64);
    await new Promise<void>((resolve) => (finish = resolve));
  });
  globalThis.fetch = (async () => Response.json({ pdf })) as unknown as typeof fetch;
  const navigated: string[] = [];
  const open = spyOn(window, "open").mockReturnValue({
    opener: null,
    location: { replace: (url: string) => navigated.push(url) },
  } as unknown as Window);
  try {
    await act(async () =>
      root.render(<LaTeXEditor code="source" title="Resume" jobUrl="https://example.test/apply" />),
    );
    const apply = container.querySelector<HTMLButtonElement>(
      '[title="Download resume and apply"]',
    )!;
    expect(apply.textContent).toContain("Apply");
    expect(container.textContent).not.toContain("Choose folder");
    await act(async () => fireEvent.click(apply));
    expect(written).toBe(atob(pdf));
    expect(apply.disabled).toBe(true);
    expect(navigated).toEqual([]);
    await act(async () => finish());
    expect(navigated).toEqual(["https://example.test/apply"]);
    expect(apply.disabled).toBe(false);
  } finally {
    bridge.mockRestore();
    open.mockRestore();
  }
});

it("closes the reserved application tab and shows save failures", async () => {
  const bridge = mockPdfExtension(async () => {
    throw new Error("Could not save PDF");
  });
  globalThis.fetch = (async () => Response.json({ pdf })) as unknown as typeof fetch;
  let closed = false;
  const navigated: string[] = [];
  const open = spyOn(window, "open").mockReturnValue({
    opener: null,
    location: { replace: (url: string) => navigated.push(url) },
    close: () => {
      closed = true;
    },
  } as unknown as Window);
  try {
    await act(async () =>
      root.render(<LaTeXEditor code="source" title="Resume" jobUrl="https://example.test/apply" />),
    );
    await act(async () =>
      fireEvent.click(container.querySelector('[title="Download resume and apply"]')!),
    );
    expect(closed).toBe(true);
    expect(navigated).toEqual([]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not save PDF");
  } finally {
    bridge.mockRestore();
    open.mockRestore();
  }
});
