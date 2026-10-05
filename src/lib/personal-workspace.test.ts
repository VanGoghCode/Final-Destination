import { expect, test } from "bun:test";
import { parseJobBatch } from "./job-import";
import { buildCoverLetterPrompt } from "./prompts/index";
import { resumeTemplate, coverTemplate, masterContext } from "./personal-workspace";
test("bot additions use the single personal setup without selecting a profile", () => {
  const jobs = parseJobBatch(
    JSON.stringify({
      jobs: [
        {
          companyName: "Example",
          positionTitle: "Engineer",
          jobDescription: "Full posting",
          applicationUrl: "https://example.com/apply",
        },
      ],
    }),
    [],
  );
  expect(jobs[0]?.profileId).toBe("kirtan");
});
test("supplied templates and candidate context are always available", () => {
  expect(resumeTemplate.content).toContain("PutText");
  expect(coverTemplate.content).toContain("begin{document}");
  expect(masterContext).toContain("Critical Code Reviewer");
});
test("cover prompt uses ownership, avoids forced enthusiasm and replaces example recipient", () => {
  const prompt = buildCoverLetterPrompt({
    masterContext,
    coverLetterLatex: coverTemplate.content,
    jobDescription: "Example engineer",
    personalDetails: "",
  });
  expect(prompt.system).toContain("ownership");
  expect(prompt.system).toContain("formatting shell");
  expect(prompt.system).not.toContain("what really excites me");
  expect(prompt.user).toContain("CURRENT DATE");
});
