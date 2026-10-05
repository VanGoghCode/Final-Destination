import { afterEach, beforeEach, expect, it } from "bun:test";
import { act, type ContextType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { openBrowser } from "@/lib/__tests__/browser";
import { getQueue } from "@/lib/browser-queue";
import AutomationGateway from "@/app/batch/import/page";

let root: Root, container: HTMLDivElement, close: () => void, navigated: string;
beforeEach(async () => {
  close = openBrowser().close;
  navigated = "";
  localStorage.setItem(
    "fd_profiles",
    JSON.stringify([
      {
        id: "profile",
        name: "Engineer",
        defaultResumeId: "resume",
        defaultCoverLetterId: null,
        color: "blue",
      },
      {
        id: "cloud",
        name: "Cloud",
        defaultResumeId: "resume",
        defaultCoverLetterId: null,
        color: "green",
      },
    ]),
  );
  localStorage.setItem(
    "fd_resume_templates",
    JSON.stringify([{ id: "resume", content: "resume source" }]),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const router = {
    push: (path: string) => {
      navigated = path;
    },
  } as NonNullable<ContextType<typeof AppRouterContext>>;
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router}>
        <AutomationGateway />
      </AppRouterContext.Provider>,
    ),
  );
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  close();
});
const paste = async (value: unknown) =>
  act(async () =>
    fireEvent.input(container.querySelector("textarea")!, {
      target: { value: JSON.stringify({ jobs: value }) },
    }),
  );
const jobs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    companyName: `Company ${index}`,
    positionTitle: "Engineer",
    jobDescription: "Full JD with required skills and responsibilities.",
    applicationUrl: `https://example.com/apply/${index}`,
  }));

it("uses the personal template automatically and exposes labeled bot controls", async () => {
  expect(container.querySelector("select")).toBeNull();
  expect(container.querySelector('label[for="jobs-json"]')?.textContent).toBe("Jobs JSON");
  await paste(jobs(1));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
});
it("adds 15 jobs once with chosen profiles, full JDs and working application links", async () => {
  await paste(jobs(15));
  expect(container.querySelectorAll('a[target="_blank"]')).toHaveLength(15);
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.submit(container.querySelector("form")!);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const saved = await getQueue();
  expect(saved).toHaveLength(15);
  expect(
    saved.every(
      (job) =>
        job.profileId === "kirtan" && job.companyUrl.includes("/apply/") && job.jobDescription,
    ),
  ).toBe(true);
  expect(navigated).toBe("/batch");
});
it("rejects 16 jobs and exposes the batch limit", async () => {
  await paste(jobs(16));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("1–15");
  expect(await getQueue()).toEqual([]);
});
it("legacy profile input does not expose a selector", async () => {
  await paste([{ ...jobs(1)[0], profileName: "Engineer" }]);
  expect(container.querySelector("select")).toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
