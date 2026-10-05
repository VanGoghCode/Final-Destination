import type { QueuedJob } from "../browser-queue";
export const job = (id = "job", updates: Partial<QueuedJob> = {}): QueuedJob => ({
  id,
  companyName: "Acme",
  companyUrl: "https://example.com/job",
  positionTitle: "Engineer",
  jobDescription: "Build software",
  personalDetails: "",
  includeCoverLetter: false,
  status: "pending",
  progress: 0,
  addedAt: 1,
  ...updates,
});
