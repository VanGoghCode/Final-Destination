import { useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { apiJSON } from "./client-api";
import { getMasterContext } from "./storage";
import type { QueuedJob } from "./browser-queue";

export function useJobContext(onError: (message: string) => void) {
  const { loadJob } = useAppContext();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("jobId");
    if (!id) return;
    const controller = new AbortController();
    void Promise.all([
      apiJSON<QueuedJob[]>("/api/queue", { signal: controller.signal }),
      getMasterContext(),
    ])
      .then(([jobs, context]) => {
        if (controller.signal.aborted) return;
        const job = jobs.find((job) => job.id === id);
        if (!job) throw new Error("Job not found. Open a completed job from the queue.");
        loadJob({
          tailoredResume: job.tailoredResume || "",
          tailoredCoverLetter: job.tailoredCoverLetter || "",
          jobDescription: job.jobDescription,
          companyName: job.companyName,
          positionTitle: job.positionTitle,
          companyUrl: job.companyUrl,
          resumeLatex: job.resumeLatex || "",
          coverLetterLatex: job.coverLetterLatex || "",
          personalDetails: job.personalDetails,
          masterContext: context || "",
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          onError(error instanceof Error ? error.message : "Failed to load job");
      });
    return () => controller.abort();
  }, [loadJob, onError]);
}
