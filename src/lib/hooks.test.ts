import { beforeEach, afterEach, describe, it, expect } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { openBrowser } from "./__tests__/browser";
import { useAutoSave, useDebouncedCallback } from "./hooks";

let root: Root, close: () => void;
beforeEach(() => {
  close = openBrowser().close;
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(() => root.unmount());
  close();
});
const wait = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 25)));
describe("browser draft hooks", () => {
  it("does not overwrite existing data on first render and saves the latest edit", async () => {
    localStorage.setItem("draft", JSON.stringify("existing"));
    function Draft({ value }: { value: string }) {
      useAutoSave("draft", value, 5);
      return null;
    }
    await act(async () => root.render(createElement(Draft, { value: "initial" })));
    await wait();
    expect(JSON.parse(localStorage.getItem("draft")!)).toBe("existing");
    await act(async () => root.render(createElement(Draft, { value: "edit" })));
    await wait();
    expect(JSON.parse(localStorage.getItem("draft")!)).toBe("edit");
  });
  it("flushes an unsaved draft when leaving the page", async () => {
    function Draft({ value }: { value: string }) {
      useAutoSave("draft", value, 1000);
      return null;
    }
    await act(async () => root.render(createElement(Draft, { value: "initial" })));
    await act(async () => root.render(createElement(Draft, { value: "latest edit" })));
    await act(() => root.unmount());
    expect(localStorage.getItem("draft")).toBe(JSON.stringify("latest edit"));
  });
  it("debounces callbacks and cancels them when leaving the page", async () => {
    let callback!: () => void,
      calls = 0;
    function Probe() {
      callback = useDebouncedCallback(() => {
        calls++;
      }, 5);
      return null;
    }
    await act(async () => root.render(createElement(Probe)));
    callback();
    callback();
    await wait();
    expect(calls).toBe(1);
    callback();
    await act(() => root.unmount());
    await wait();
    expect(calls).toBe(1);
  });
});
