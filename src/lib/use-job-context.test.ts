import { afterEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { useJobContext } from "./use-job-context";
import { job } from "./__tests__/job";

const keys = [
  "window",
  "document",
  "localStorage",
  "HTMLElement",
  "fetch",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;
const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
afterEach(() =>
  keys.forEach((key, i) => {
    if (descriptors[i]) Object.defineProperty(globalThis, key, descriptors[i]!);
    else Reflect.deleteProperty(globalThis, key);
  }),
);
describe("questions job context", () => {
  it.each(["selected", "missing"])(
    "hydrates the requested job or reports it missing: %s",
    async (id) => {
      const browser = new Window({ url: "http://localhost/questions?jobId=" + id });
      Object.assign(globalThis, {
        window: browser,
        document: browser.document,
        localStorage: browser.localStorage,
        HTMLElement: browser.HTMLElement,
        IS_REACT_ACT_ENVIRONMENT: true,
      });
      let state: ReturnType<typeof useAppContext>,
        error = "";
      localStorage.setItem(
        "fd_queue_state",
        JSON.stringify({
          jobs: [
            job("other", { tailoredResume: "wrong" }),
            job("selected", { tailoredResume: "right", companyName: "Selected" }),
          ],
          paused: true,
        }),
      );
      localStorage.setItem("fd_master_context", JSON.stringify("master experience"));
      globalThis.fetch = (async () => {
        throw new Error("Storage should stay local");
      }) as unknown as typeof fetch;
      const onError = (message: string) => {
        error = message;
      };
      function Probe() {
        useJobContext(onError);
        const context = useAppContext();
        useEffect(() => {
          state = context;
        }, [context]);
        return null;
      }
      const root = createRoot(document.createElement("div"));
      await act(async () => {
        root.render(createElement(AppProvider, null, createElement(Probe)));
      });
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
      if (id === "selected") {
        expect(state!.tailoredResume).toBe("right");
        expect(state!.companyName).toBe("Selected");
        expect(state!.masterContext).toBe("master experience");
      } else expect(error).toContain("not found");
      await act(() => root.unmount());
    },
  );
});
