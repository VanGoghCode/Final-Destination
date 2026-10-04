import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as ai from "@/lib/ai";
import * as keys from "@/lib/api-key";
import { getProfiles, getQueue, updateJobInQueue, setRedisInstance } from "@/lib/db";
import { fakeRedis, job } from "@/lib/__tests__/redis";
import { POST as saveProfiles } from "../profiles/route";
import {
  GET as readContext,
  POST as saveContext,
  DELETE as deleteContext,
} from "../master-context/route";
import { POST as processQueue } from "../process-queue/route";
import { POST as regenerate } from "../regenerate/route";

let fixture: ReturnType<typeof fakeRedis>;
const spies: Array<ReturnType<typeof spyOn>> = [];
const request = (body: object) =>
  new Request("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  fixture = fakeRedis();
  spies.push(
    spyOn(keys, "getApiKey").mockResolvedValue("fixture"),
    spyOn(keys, "getAISelection").mockResolvedValue({ provider: "openai", modelId: "gpt-6-luna" }),
  );
});
afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  setRedisInstance(null);
});
describe("actual API regressions", () => {
  it("preserves profile template IDs", async () => {
    const profile = {
      id: "me",
      name: "Me",
      firstName: "A",
      lastName: "B",
      color: "blue",
      defaultResumeId: "resume",
      defaultCoverLetterId: "cover",
    };
    expect((await saveProfiles(request([profile]))).status).toBe(200);
    expect((await getProfiles())[0]).toMatchObject(profile);
  });
  it("persists and deletes master context on the server", async () => {
    expect((await saveContext(request({ content: "My experience" }))).status).toBe(200);
    expect(await (await readContext()).json()).toEqual({ content: "My experience" });
    await deleteContext(request({}));
    expect(await (await readContext()).json()).toEqual({ content: null });
  });
  it("processes each pending job once under concurrency", async () => {
    fixture.store.set("data:queue", [job("job", { resumeLatex: "template" })]);
    const resume = spyOn(ai, "tailorResume").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "tailored";
    });
    spies.push(
      resume,
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "US", workMode: "Remote" }),
    );
    await Promise.all([processQueue(), processQueue()]);
    expect(resume).toHaveBeenCalledTimes(1);
    expect((fixture.store.get("data:queue") as Array<{ status: string }>)[0]?.status).toBe(
      "completed",
    );
  });
  it("resolves assigned profile templates in background processing", async () => {
    fixture.store.set("data:profiles", [{ id: "me", name: "Me", defaultResumeId: "resume" }]);
    fixture.store.set("fd:fd_resume_templates", [{ id: "resume", content: "profile template" }]);
    fixture.store.set("data:queue", [job("job", { profileId: "me" })]);
    const resume = spyOn(ai, "tailorResume").mockResolvedValue("tailored");
    spies.push(
      resume,
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "", workMode: "" }),
    );
    await processQueue();
    expect(resume.mock.calls[0]?.[0]).toBe("profile template");
  });
  it("regenerates resume-only answers", async () => {
    spies.push(spyOn(ai, "regenerateAnswers").mockResolvedValue("revised"));
    const response = await regenerate(
      request({
        type: "answers",
        tailoredResume: "resume",
        questions: "Why?",
        currentContent: "answer",
        comment: "shorter",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ regeneratedContent: "revised" });
  });
  it("processes a specific extension job without a global default", async () => {
    fixture.store.set("data:profiles", [{ id: "me", name: "Me", defaultResumeId: "resume" }]);
    fixture.store.set("fd:fd_resume_templates", [{ id: "resume", content: "assigned" }]);
    fixture.store.set("data:queue", [
      job("first", { resumeLatex: "other" }),
      job("extension", { profileId: "me" }),
    ]);
    const resume = spyOn(ai, "tailorResume").mockResolvedValue("tailored");
    spies.push(
      resume,
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "", workMode: "" }),
    );
    expect((await processQueue(request({ id: "extension" }))).status).toBe(200);
    expect((await getQueue()).map((j) => j.status)).toEqual(["pending", "completed"]);
    expect(resume.mock.calls[0]?.[0]).toBe("assigned");
  });
  it("does not complete or start a cover letter after cancellation", async () => {
    fixture.store.set("data:queue", [
      job("job", { resumeLatex: "resume", coverLetterLatex: "cover", includeCoverLetter: true }),
    ]);
    const cover = spyOn(ai, "tailorCoverLetter").mockResolvedValue("cover");
    spies.push(
      cover,
      spyOn(ai, "tailorResume").mockImplementation(async () => {
        await updateJobInQueue("job", { status: "cancelled" });
        return "late result";
      }),
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "", workMode: "" }),
    );
    await processQueue();
    expect(cover).not.toHaveBeenCalled();
    expect((await getQueue())[0]).toMatchObject({ status: "cancelled" });
    expect((await getQueue())[0]?.tailoredResume).toBeUndefined();
  });
  it("preserves partial resume results when the cover letter fails", async () => {
    fixture.store.set("data:queue", [
      job("job", { resumeLatex: "resume", coverLetterLatex: "cover", includeCoverLetter: true }),
    ]);
    spies.push(
      spyOn(ai, "tailorResume").mockResolvedValue("saved resume"),
      spyOn(ai, "tailorCoverLetter").mockRejectedValue(new Error("Cover failed")),
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "", workMode: "" }),
    );
    expect((await processQueue()).status).toBe(500);
    expect((await getQueue())[0]).toMatchObject({
      status: "failed",
      tailoredResume: "saved resume",
      error: "Cover failed",
    });
  });
  it("rejects missing cover templates and empty AI output", async () => {
    fixture.store.set("data:queue", [
      job("job", { resumeLatex: "resume", includeCoverLetter: true }),
    ]);
    const resume = spyOn(ai, "tailorResume").mockResolvedValue("");
    spies.push(
      resume,
      spyOn(ai, "extractJobLocationInfo").mockResolvedValue({ country: "", workMode: "" }),
    );
    await processQueue();
    expect(resume).not.toHaveBeenCalled();
    fixture.store.set("data:queue", [job("job", { resumeLatex: "resume" })]);
    await processQueue();
    expect((await getQueue())[0]?.status).toBe("failed");
    expect((await getQueue())[0]?.error).toContain("empty resume");
  });
});
