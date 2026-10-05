import { expect, it } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { openBrowser } from "@/lib/__tests__/browser";
import Sidebar from "../Sidebar";

it("provides a visible close control on mobile", async () => {
  const { browser, close } = openBrowser();
  Object.defineProperty(browser, "innerWidth", { value: 390 });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <Sidebar title="Templates" hideModelSelector>
          Background
        </Sidebar>,
      ),
    );
    const button = container.querySelector<HTMLButtonElement>('button[title="Close sidebar"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    expect(container.querySelector('button[aria-label="Open sidebar"]')).not.toBeNull();
  } finally {
    await act(() => root.unmount());
    container.remove();
    close();
  }
});
