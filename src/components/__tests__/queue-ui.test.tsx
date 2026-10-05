import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import JobQueueCard from "../JobQueueCard";
import JobForm from "../JobForm";
import QueueProgress from "../QueueProgress";
import { job } from "@/lib/__tests__/job";
const names = [
  "window",
  "document",
  "localStorage",
  "HTMLElement",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;
let saved: Array<PropertyDescriptor | undefined>, root: Root;
beforeEach(() => {
  saved = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const browser = new Window({ url: "http://localhost:3000" });
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    HTMLElement: browser.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  names.forEach((name, i) => {
    if (saved[i]) Object.defineProperty(globalThis, name, saved[i]!);
    else Reflect.deleteProperty(globalThis, name);
  });
});
const buttons = () =>
  [...document.querySelectorAll("button")].map(
    (b) => b.getAttribute("aria-label") || b.textContent,
  );
describe("queue action visibility and behavior", () => {
  for (const status of [
    "pending",
    "researching",
    "tailoring-resume",
    "tailoring-cover-letter",
    "completed",
    "failed",
    "cancelled",
  ] as const) {
    it(`offers appropriate actions for ${status}`, async () => {
      let calls = 0;
      const action = () => {
        calls++;
      };
      await act(() =>
        root.render(
          <JobQueueCard
            job={job("job", {
              status,
              startedAt: Date.now(),
              tailoredResume: "resume",
            })}
            onRemove={action}
            onCancel={action}
            onEdit={action}
            onRetry={action}
            onView={action}
          />,
        ),
      );
      const active = ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(status);
      expect(buttons()).toContain("Remove job");
      expect(buttons().includes("Edit job")).toBe(!active);
      expect(buttons().includes("Cancel job")).toBe(active || status === "pending");
      expect(buttons().includes("View results")).toBe(status === "completed");
      expect(buttons()).not.toContain("View partial results");
      for (const control of document.querySelectorAll("button, a")) {
        expect(control.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
        expect(control.className).toContain("after:content-[attr(aria-label)]");
        expect(control.className).toContain("focus-visible:after:opacity-100");
        expect(control.className).toContain("hover:after:opacity-100");
      }
      if (status === "failed" || status === "cancelled")
        expect(buttons().filter((label) => label === "Retry job")).toHaveLength(1);
      for (const button of document.querySelectorAll("button")) await act(() => button.click());
      expect(calls).toBe(buttons().length);
    });
  }
  it("offers recovery without a partial-results action for interrupted jobs", async () => {
    await act(() =>
      root.render(
        <JobQueueCard
          job={job("job", {
            status: "tailoring-cover-letter",
            leaseExpiresAt: 1,
            tailoredResume: "resume",
          })}
          onRemove={() => {}}
          onRetry={() => {}}
          onView={() => {}}
        />,
      ),
    );
    expect(buttons()).toContain("Recover job");
    expect(buttons()).not.toContain("View partial results");
    expect(document.body.textContent).not.toContain(
      "Partial results are saved and available below",
    );
  });
  it("disables actions while saving and shows saved progress without fabricating percentages", async () => {
    await act(() =>
      root.render(
        <JobQueueCard
          busy
          job={job("job", { status: "tailoring-resume", progress: 5, startedAt: Date.now() })}
          onRemove={() => {}}
          onCancel={() => {}}
        />,
      ),
    );
    expect([...document.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("5");
  });
  it("keeps edits in the form after a failed save", async () => {
    await act(() =>
      root.render(
        <JobForm
          profiles={[]}
          initialValues={{
            companyName: "Acme",
            companyUrl: "https://example.com/job",
            positionTitle: "Engineer",
            jobDescription: "Build",
            personalDetails: "",
            profileId: "",
            includeCoverLetter: true,
          }}
          onCancel={() => {}}
          onSubmit={async () => false}
          submitLabel="Save & requeue"
        />,
      ),
    );
    await act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "changes are still here",
    );
    expect((document.querySelector("input") as HTMLInputElement).value).toBe("Acme");
    expect(buttons()).toContain("Save & requeue");
    expect(
      [...document.querySelectorAll("input[required], textarea[required]")].every(
        (field) => field.id && document.querySelector(`label[for="${field.id}"]`),
      ),
    ).toBe(true);
  });
  it("counts cancelled jobs in the overview", async () => {
    await act(() =>
      root.render(
        <QueueProgress
          total={3}
          completed={1}
          failed={0}
          pending={1}
          cancelled={1}
          isProcessing={false}
        />,
      ),
    );
    expect(document.body.textContent).toContain("1 cancelled");
    expect(document.body.textContent).toContain("0 active");
  });
});
