"use client";

import { useState, useRef, useEffect, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LaTeXEditor from "@/components/LaTeXEditor";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import { getAdminHeaders } from "@/lib/client-admin";

interface BatchJobData {
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  resumeLatex?: string;
  coverLetterLatex?: string;
  companyName: string;
  companyUrl?: string;
  positionTitle: string;
  jobDescription: string;
  companyResearch?: string;
  masterContext?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  profileFirstName?: string;
  profileLastName?: string;
}

export default function TailoredCompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  // Job data from sessionStorage
  const [jobData, setJobData] = useState<BatchJobData | null>(null);
  const [tailoredResume, setTailoredResume] = useState("");
  const [tailoredCoverLetter, setTailoredCoverLetter] = useState("");

  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);

  // Regeneration state
  const [isRegeneratingResume, setIsRegeneratingResume] = useState(false);
  const [isRegeneratingCoverLetter, setIsRegeneratingCoverLetter] = useState(false);
  const [showCoverLetterPreview, setShowCoverLetterPreview] = useState(false);

  // Q&A state
  const [generalQuestion, setGeneralQuestion] = useState("");
  const [generalAnswer, setGeneralAnswer] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [limitType, setLimitType] = useState<"none" | "words" | "characters">("none");
  const [limitValue, setLimitValue] = useState<number>(10);
  const [searchMode, setSearchMode] = useState<"context" | "context+internet" | "internet">(
    "context",
  );

  // Sheet logging state
  const [showLogModal, setShowLogModal] = useState(false);
  const [applicationLink, setApplicationLink] = useState("");
  const [notes, setNotes] = useState("");
  const [other, setOther] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState<false | "ok" | "duplicate">(false);
  const [logError, setLogError] = useState("");
  const [country, setCountry] = useState("");
  const [workMode, setWorkMode] = useState<"" | "Remote" | "Hybrid" | "On-site">("");
  const [editableCompanyName, setEditableCompanyName] = useState("");
  const [editablePositionTitle, setEditablePositionTitle] = useState("");
  const applicationLinkRef = useRef<HTMLInputElement>(null);

  // Collapsible sections state
  const [showFilenames, setShowFilenames] = useState(false);

  // Delete from batch state
  const [isDeletingFromBatch, setIsDeletingFromBatch] = useState(false);

  // Load job data from sessionStorage
  useEffect(() => {
    let ignore = false;
    if (jobId) {
      const jobKey = `batch_job_${jobId}`;
      const stored = sessionStorage.getItem(jobKey);
      if (stored) {
        try {
          const data = JSON.parse(stored) as BatchJobData;
          setJobData(data);
          setTailoredResume(data.tailoredResume || "");
          setTailoredCoverLetter(data.tailoredCoverLetter || "");
          setCountry(data.jobCountry || "");
          setWorkMode(data.jobWorkMode || "");
          setEditableCompanyName(data.companyName);
          setEditablePositionTitle(data.positionTitle);
        } catch {
          console.error("Failed to parse job data");
        }
      } else {
        // Fallback: fetch from /api/queue and find job by jobId
        fetch("/api/queue", { signal: AbortSignal.timeout(10000) })
          .then((res) => res.json())
          .then((queue: unknown[]) => {
            if (ignore) return;
            const job = (queue as Record<string, unknown>[]).find((j) => j.id === jobId);
            if (job) {
              const data: BatchJobData = {
                tailoredResume: (job.tailoredResume as string) || "",
                tailoredCoverLetter: (job.tailoredCoverLetter as string) || "",
                resumeLatex: (job.resumeLatex as string) || "",
                coverLetterLatex: (job.coverLetterLatex as string) || "",
                companyName: (job.companyName as string) || "",
                companyUrl: (job.companyUrl as string) || "",
                positionTitle: (job.positionTitle as string) || "",
                jobDescription: (job.jobDescription as string) || "",
                masterContext: (job.masterContext as string) || "",
                jobCountry: (job.jobCountry as string) || "",
                jobWorkMode: (job.jobWorkMode as "" | "Remote" | "Hybrid" | "On-site") || "",
              };
              setJobData(data);
              setTailoredResume(data.tailoredResume || "");
              setTailoredCoverLetter(data.tailoredCoverLetter || "");
              setCountry(data.jobCountry || "");
              setWorkMode(data.jobWorkMode || "");
              setEditableCompanyName(data.companyName);
              setEditablePositionTitle(data.positionTitle);
            }
          })
          .catch((err) => console.error("Failed to fetch job from queue:", err));
      }
    }
    return () => {
      ignore = true;
    };
  }, [jobId]);

  // Focus on application link field after modal opens
  useEffect(() => {
    if (showLogModal) {
      // Auto-fill from the job's URL if not already set
      if (!applicationLink && jobData?.companyUrl) {
        setApplicationLink(jobData.companyUrl);
      }
      setTimeout(() => {
        applicationLinkRef.current?.focus();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogModal]);

  // Beforeunload listener - remind user to log job before closing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show warning before closing if job Data exists
      if (jobData) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [jobData]);

  // Handle delete from batch
  const handleDeleteFromBatch = useCallback(
    async (skipConfirm = false) => {
      if (!jobId) return;

      if (!skipConfirm) {
        const confirmed = window.confirm(
          "Are you sure you want to delete this job from the batch queue?",
        );
        if (!confirmed) return;
      }

      setIsDeletingFromBatch(true);
      try {
        await fetch(`/api/queue?id=${jobId}`, {
          method: "DELETE",
        });
        // Remove from sessionStorage too
        sessionStorage.removeItem(`batch_job_${jobId}`);
        // Redirect to batch page
        router.push("/batch");
      } catch (err) {
        console.error("Failed to delete job:", err);
        alert("Failed to delete job from batch");
      } finally {
        setIsDeletingFromBatch(false);
      }
    },
    [jobId, router],
  );

  // Generate formatted filenames
  const formatName = (str: string | undefined | null) =>
    (str || "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  // Use profile name if available, otherwise default to "Resume"
  const firstName = jobData?.profileFirstName || "";
  const lastName = jobData?.profileLastName || "";
  const fullName = firstName && lastName ? `${formatName(firstName)}_${formatName(lastName)}` : "";
  const companyName = jobData?.companyName || resolvedParams.company || "Company";
  const positionTitle = jobData?.positionTitle || "Position";

  // Plain filename (just name or "Resume" if no profile)
  const resumeFileNamePlain = fullName ? `${fullName}_Resume` : "Resume";

  // Detailed filenames - format: FullName_Company_Position_Resume (matches /tailored page)
  const resumeFileNameDetailed = fullName
    ? `${fullName}_${formatName(companyName)}_${formatName(positionTitle)}_Resume`
    : `${formatName(companyName)}_${formatName(positionTitle)}_Resume`;
  const coverLetterFileNameDetailed = fullName
    ? `${fullName}_${formatName(companyName)}_${formatName(positionTitle)}_CoverLetter`
    : `${formatName(companyName)}_${formatName(positionTitle)}_CoverLetter`;

  const copyToClipboard = async (text: string, type: "resume" | "coverLetter") => {
    await navigator.clipboard.writeText(text);
    if (type === "resume") {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    } else {
      setCopiedCoverLetter(true);
      setTimeout(() => setCopiedCoverLetter(false), 2000);
    }
  };

  const handleLogToSheet = async (shouldDelete = false) => {
    setLogError("");
    setIsLogging(true);
    if (!applicationLink.trim()) {
      setLogError("Application link is required — paste the URL where you applied");
      setIsLogging(false);
      return;
    }

    const noteParts: string[] = [];
    if (country) noteParts.push(`Country: ${country}`);
    if (workMode) noteParts.push(`Work Mode: ${workMode}`);
    if (notes.trim()) noteParts.push(notes.trim());
    const composedNotes = noteParts.join(" | ");

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          companyName: editableCompanyName || companyName,
          positionTitle: editablePositionTitle || positionTitle,
          applicationLink: applicationLink.trim(),
          notes: composedNotes,
          other: other.trim() || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to log application");

      setLogSuccess(data.data?.status === "duplicate" ? "duplicate" : "ok");

      if (shouldDelete) {
        // Delete from batch after logging
        try {
          await fetch(`/api/queue?id=${jobId}`, { method: "DELETE" });
          sessionStorage.removeItem(`batch_job_${jobId}`);
        } catch {
          // Log succeeded — non-critical if delete fails, job stays in queue
          console.warn("Logged to sheet but failed to delete from queue");
        }
        setTimeout(() => {
          setIsLogging(false);
          setShowLogModal(false);
          router.push("/batch");
        }, 1500);
      } else {
        setTimeout(() => {
          setShowLogModal(false);
          setLogSuccess(false);
          setApplicationLink("");
          setNotes("");
          setOther("");
        }, 2000);
      }
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLogging(false);
    }
  };

  const handleRegenerateResume = async (comment: string) => {
    setIsRegeneratingResume(true);
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          type: "resume",
          currentContent: tailoredResume,
          comment,
          resumeLatex: jobData?.resumeLatex,
          jobDescription: jobData?.jobDescription,
          masterContext: jobData?.masterContext || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTailoredResume(data.result);
    } catch (err) {
      console.error("Error regenerating resume:", err);
    } finally {
      setIsRegeneratingResume(false);
    }
  };

  const handleRegenerateCoverLetter = async (comment: string) => {
    setIsRegeneratingCoverLetter(true);
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          type: "coverLetter",
          currentContent: tailoredCoverLetter,
          comment,
          coverLetterLatex: jobData?.coverLetterLatex,
          jobDescription: jobData?.jobDescription,
          masterContext: jobData?.masterContext || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTailoredCoverLetter(data.result);
    } catch (err) {
      console.error("Error regenerating cover letter:", err);
    } finally {
      setIsRegeneratingCoverLetter(false);
    }
  };

  const handleLimitTypeChange = (newType: "none" | "words" | "characters") => {
    setLimitType(newType);
    if (newType === "words") setLimitValue(10);
    else if (newType === "characters") setLimitValue(200);
  };

  if (!jobData && jobId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-muted">Loading job data...</p>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold">Job data not found</h2>
          <p className="text-muted mb-4 text-sm">
            This page requires job data from batch processing. The data may have expired.
          </p>
          <Button onClick={() => router.push("/batch")} variant="primary">
            Go to Batch Processing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar title={companyName} subtitle={positionTitle} hideModelSelector>
        {/* Step Navigation - Breadcrumbs */}
        <div className="border-b border-gray-100 p-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                ✓
              </span>
              Input
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="bg-primary/10 border-primary text-primary flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium">
              <span className="bg-primary flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
                2
              </span>
              Review
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => window.open(`/questions?jobId=${jobId}`, "_blank")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="bg-card-border text-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                3
              </span>
              Q&A
            </button>
          </div>
        </div>

        {/* Actions Row - Swapped Order */}
        <div className="flex gap-2 border-b border-gray-100 p-4">
          <Button
            onClick={() => window.open(`/questions?jobId=${jobId}`, "_blank")}
            variant="secondary"
            className="h-10 flex-1 cursor-pointer py-2 text-xs"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mr-1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Questions
          </Button>
          <Button
            onClick={() => setShowLogModal(true)}
            variant="secondary"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center p-0"
            title="Log to Sheet"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Cover Letter Section - Refined UI */}
          {tailoredCoverLetter && (
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 transition-all hover:shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-xs font-bold tracking-tight text-green-700">
                    COVER LETTER READY
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => setShowCoverLetterPreview(true)}
                    variant="ghost"
                    className="cursor-pointer rounded-lg bg-green-100/50 px-2.5 py-1 text-[10px] font-bold text-green-700 transition-colors hover:bg-green-100"
                  >
                    PREVIEW
                  </Button>
                  <Button
                    onClick={() => navigator.clipboard.writeText(tailoredCoverLetter)}
                    variant="ghost"
                    className="cursor-pointer rounded-lg bg-green-100/50 px-2.5 py-1 text-[10px] font-bold text-green-700 transition-colors hover:bg-green-100"
                  >
                    COPY
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => handleRegenerateCoverLetter("Improve it")}
                disabled={isRegeneratingCoverLetter}
                variant="ghost"
                className="w-full cursor-pointer rounded-xl border border-green-200 bg-white py-2 text-xs text-green-700 shadow-none transition-all hover:bg-green-50"
              >
                {isRegeneratingCoverLetter ? "Regenerating..." : "Regenerate Content"}
              </Button>
            </div>
          )}

          {/* Delete from Batch - Solid Red UI */}
          {jobId && (
            <div className="cursor-default border-t border-gray-100">
              <Button
                onClick={() => handleDeleteFromBatch()}
                disabled={isDeletingFromBatch}
                className="group w-full !border-red-600 !bg-red-600 py-2.5 text-[11px] font-bold !text-white shadow-sm transition-all duration-300 hover:!border-red-700 hover:!bg-red-700"
              >
                <svg
                  className="mr-2 h-3.5 w-3.5 transition-transform group-hover:rotate-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {isDeletingFromBatch ? "Deleting..." : "Delete from Batch"}
              </Button>
            </div>
          )}

          {/* Collapsible Filenames Section */}
          <div>
            <button
              onClick={() => setShowFilenames(!showFilenames)}
              className="text-muted hover:text-foreground flex w-full items-center justify-between py-2 text-xs font-medium"
            >
              <span>Filenames</span>
              <svg
                className={`h-4 w-4 transition-transform ${showFilenames ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFilenames && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="bg-surface-hover flex-1 truncate rounded px-2 py-1 font-mono text-[10px]">
                    {resumeFileNameDetailed}
                  </code>
                  <button
                    onClick={() => copyToClipboard(resumeFileNameDetailed, "resume")}
                    className="text-muted hover:text-foreground text-xs"
                  >
                    {copiedResume ? "✓" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-surface-hover flex-1 truncate rounded px-2 py-1 font-mono text-[10px]">
                    {coverLetterFileNameDetailed}
                  </code>
                  <button
                    onClick={() => copyToClipboard(coverLetterFileNameDetailed, "coverLetter")}
                    className="text-muted hover:text-foreground text-xs"
                  >
                    {copiedCoverLetter ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Q&A */}
          <div>
            <label className="text-muted mb-2 block text-xs font-medium">Quick Question</label>
            <textarea
              value={generalQuestion}
              onChange={(e) => setGeneralQuestion(e.target.value)}
              placeholder="Ask about this job..."
              className="border-card-border w-full resize-none rounded-lg border px-3 py-2 text-sm"
              rows={2}
            />
            <div className="my-2 flex gap-1">
              {[
                { value: "context", label: "Context" },
                { value: "context+internet", label: "Web+Context" },
                { value: "internet", label: "Web Only" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setSearchMode(opt.value as "context" | "context+internet" | "internet")
                  }
                  className={`flex-1 rounded border px-1 py-1 text-[9px] font-bold transition-all ${
                    searchMode === opt.value
                      ? "bg-primary/10 text-primary border-primary"
                      : "text-muted border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="my-2 flex gap-1">
              {[
                { value: "none", label: "No Limit" },
                { value: "words", label: "Words" },
                { value: "characters", label: "Chars" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    handleLimitTypeChange(opt.value as "none" | "words" | "characters")
                  }
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-all ${
                    limitType === opt.value
                      ? "bg-primary text-white"
                      : "bg-surface-hover text-muted hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {limitType !== "none" && (
              <input
                type="number"
                value={limitValue}
                onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="border-card-border mb-2 w-full rounded-lg border px-3 py-1.5 text-xs"
                min="1"
              />
            )}
            <Button
              onClick={async () => {
                if (!generalQuestion.trim()) return;
                setIsAskingQuestion(true);
                try {
                  const response = await fetch("/api/ask", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
                    body: JSON.stringify({
                      question: generalQuestion,
                      tailoredResume,
                      tailoredCoverLetter,
                      jobDescription: jobData?.jobDescription,
                      masterContext: jobData?.masterContext || "",
                      limitType: limitType !== "none" ? limitType : undefined,
                      limitValue: limitType !== "none" ? limitValue : undefined,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setGeneralAnswer(data.answer);
                } catch (err) {
                  setGeneralAnswer("Error: " + (err instanceof Error ? err.message : "Failed"));
                } finally {
                  setIsAskingQuestion(false);
                }
              }}
              disabled={!generalQuestion.trim() || isAskingQuestion}
              variant="primary"
              className="w-full py-2 text-xs"
            >
              {isAskingQuestion ? "Thinking..." : "Ask"}
            </Button>

            {/* Quick Question Shortcuts */}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setGeneralQuestion("What is the salary range for this position?")}
                className="text-muted bg-surface-hover border-card-border/50 flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200"
              >
                Salary
              </button>
              <button
                onClick={() =>
                  setGeneralQuestion("What are the key skills required for this role?")
                }
                className="text-muted bg-surface-hover border-card-border/50 flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200"
              >
                Skills
              </button>
            </div>

            {generalAnswer && (
              <div className="bg-surface-hover border-card-border mt-3 rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted text-xs font-medium">Answer</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(generalAnswer)}
                    className="text-muted hover:text-foreground text-xs"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-foreground text-xs whitespace-pre-wrap">{generalAnswer}</p>
              </div>
            )}
          </div>
        </div>
      </Sidebar>

      {/* Main Content - LaTeX Editor */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <LaTeXEditor
          title="Tailored Resume"
          code={tailoredResume}
          onCodeChange={setTailoredResume}
          onRegenerate={handleRegenerateResume}
          isRegenerating={isRegeneratingResume}
          showPreview={true}
          fullHeight={true}
          downloadFileNames={[resumeFileNamePlain, resumeFileNameDetailed]}
          jobUrl={jobData?.companyUrl}
          onApply={() => {
            // Redirect to the job application URL
            if (jobData?.companyUrl) {
              window.open(jobData.companyUrl, "_blank");
            }
          }}
        />
      </main>

      {/* Log to Sheet Modal */}
      {showLogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 p-6">
              <h2 className="text-lg font-semibold">Log Application</h2>
              <p className="text-muted mt-1 text-sm">Record this application to your spreadsheet</p>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted mb-1 block text-xs font-medium">Company</label>
                  <input
                    type="text"
                    value={editableCompanyName}
                    onChange={(e) => setEditableCompanyName(e.target.value)}
                    className="border-card-border w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-muted mb-1 block text-xs font-medium">Position</label>
                  <input
                    type="text"
                    value={editablePositionTitle}
                    onChange={(e) => setEditablePositionTitle(e.target.value)}
                    className="border-card-border w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-medium">
                  Application Link
                </label>
                <input
                  ref={applicationLinkRef}
                  type="url"
                  value={applicationLink}
                  onChange={(e) => setApplicationLink(e.target.value)}
                  placeholder="https://..."
                  className="border-card-border w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted mb-1 block text-xs font-medium">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. USA"
                    className="border-card-border w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-muted mb-1 block text-xs font-medium">Work Mode</label>
                  <select
                    value={workMode}
                    onChange={(e) =>
                      setWorkMode(e.target.value as "" | "Remote" | "Hybrid" | "On-site")
                    }
                    className="border-card-border w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes..."
                  className="border-card-border w-full resize-none rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              {logError && <p className="text-xs text-red-500">{logError}</p>}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleLogToSheet()}
                  disabled={isLogging}
                  variant="primary"
                  className="flex-1"
                >
                  {isLogging && !logSuccess
                    ? "Logging..."
                    : logSuccess === "duplicate"
                      ? "Already Logged"
                      : logSuccess
                        ? "✓ Logged!"
                        : "Log Only"}
                </Button>
                {jobId && (
                  <Button
                    onClick={() => handleLogToSheet(true)}
                    disabled={isLogging}
                    className="flex-1 !border-red-600 !bg-red-600 !text-white hover:!border-red-700 hover:!bg-red-700"
                  >
                    {isLogging && !logSuccess
                      ? "Processing..."
                      : logSuccess === "duplicate"
                        ? "Already Logged"
                        : logSuccess
                          ? "✓ Success!"
                          : "Log & Delete"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cover Letter Preview Modal */}
      {showCoverLetterPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-8">
          <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              onClick={() => setShowCoverLetterPreview(false)}
              className="absolute top-4 right-4 z-[70] rounded-full border border-gray-100 bg-white/80 p-2 text-gray-500 shadow-md transition-all hover:bg-white hover:text-gray-800"
              title="Close Preview"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="min-h-0 flex-1">
              <LaTeXEditor
                title="Cover Letter Preview"
                code={tailoredCoverLetter}
                onCodeChange={setTailoredCoverLetter}
                onRegenerate={handleRegenerateCoverLetter}
                isRegenerating={isRegeneratingCoverLetter}
                showPreview={true}
                fullHeight={true}
                downloadFileNames={[
                  `Cover_Letter_${companyName}`,
                  `Cover_Letter_Detailed_${companyName}`,
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
