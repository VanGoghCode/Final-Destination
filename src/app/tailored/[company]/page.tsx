"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LaTeXEditor from "@/components/LaTeXEditor";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";

interface BatchJobData {
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  companyName: string;
  companyUrl?: string;
  positionTitle: string;
  jobDescription: string;
  companyResearch?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
}

export default function TailoredCompanyPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
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
  const [isRegeneratingCoverLetter, setIsRegeneratingCoverLetter] =
    useState(false);

  // Sheet logging state
  const [showLogModal, setShowLogModal] = useState(false);
  const [applicationLink, setApplicationLink] = useState("");
  const [notes, setNotes] = useState("");
  const [other, setOther] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [logError, setLogError] = useState("");
  const [country, setCountry] = useState("");
  const [workMode, setWorkMode] = useState<
    "" | "Remote" | "Hybrid" | "On-site"
  >("");
  const [editableCompanyName, setEditableCompanyName] = useState("");
  const [editablePositionTitle, setEditablePositionTitle] = useState("");
  const applicationLinkRef = useRef<HTMLInputElement>(null);

  // Q&A state
  const [generalQuestion, setGeneralQuestion] = useState("");
  const [generalAnswer, setGeneralAnswer] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [limitType, setLimitType] = useState<"none" | "words" | "characters">(
    "none",
  );
  const [limitValue, setLimitValue] = useState<number>(10);

  // Collapsible sections state
  const [showFilenames, setShowFilenames] = useState(false);

  // Load job data from sessionStorage
  useEffect(() => {
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
      }
    }
  }, [jobId]);

  // Generate formatted filenames
  const formatName = (str: string | undefined | null) =>
    (str || "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  const fullName = "Resume";
  const companyName =
    jobData?.companyName || resolvedParams.company || "Company";
  const positionTitle = jobData?.positionTitle || "Position";

  const resumeFileNamePlain = `${fullName}`;
  const resumeFileNameDetailed = `${formatName(companyName)}_${formatName(positionTitle)}_Resume`;
  const coverLetterFileNameDetailed = `${formatName(companyName)}_${formatName(positionTitle)}_CoverLetter`;

  const copyToClipboard = async (
    text: string,
    type: "resume" | "coverLetter",
  ) => {
    await navigator.clipboard.writeText(text);
    if (type === "resume") {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    } else {
      setCopiedCoverLetter(true);
      setTimeout(() => setCopiedCoverLetter(false), 2000);
    }
  };

  const handleLogToSheet = async () => {
    setLogError("");
    setIsLogging(true);

    const noteParts: string[] = [];
    if (country) noteParts.push(`Country: ${country}`);
    if (workMode) noteParts.push(`Work Mode: ${workMode}`);
    if (notes.trim()) noteParts.push(notes.trim());
    const composedNotes = noteParts.join(" | ");

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: editableCompanyName || companyName,
          positionTitle: editablePositionTitle || positionTitle,
          applicationLink: applicationLink.trim() || "N/A",
          notes: composedNotes,
          other: other.trim() || "",
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to log application");

      setLogSuccess(true);
      setTimeout(() => {
        setShowLogModal(false);
        setLogSuccess(false);
        setApplicationLink("");
        setNotes("");
        setOther("");
      }, 2000);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "resume",
          currentContent: tailoredResume,
          comment,
          jobDescription: jobData?.jobDescription,
          companyInfo: jobData?.companyResearch,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "coverLetter",
          currentContent: tailoredCoverLetter,
          comment,
          jobDescription: jobData?.jobDescription,
          companyInfo: jobData?.companyResearch,
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
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center animate-pulse">
            <svg
              className="w-8 h-8 text-gray-400"
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
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
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
          <h2 className="text-lg font-semibold mb-2">Job data not found</h2>
          <p className="text-sm text-muted mb-4">
            This page requires job data from batch processing. The data may have
            expired.
          </p>
          <Button onClick={() => router.push("/batch")} variant="primary">
            Go to Batch Processing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar title={companyName} subtitle={positionTitle}>
        {/* Step Navigation - Breadcrumbs */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">
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
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-primary/10 border border-primary text-primary text-xs font-medium">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
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
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-card-border text-muted flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              Q&A
            </button>
          </div>
        </div>

        {/* Job Info Header */}
        <div className="p-4 border-b border-gray-100 bg-purple-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {companyName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{companyName}</h3>
              <p className="text-xs text-muted truncate">{positionTitle}</p>
            </div>
          </div>
          {jobData?.companyUrl && (
            <a
              href={jobData.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors w-full"
            >
              <svg
                className="w-3 h-3 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span className="truncate">{jobData.companyUrl}</span>
            </a>
          )}
          {!jobData?.companyUrl && (
            <p className="text-[10px] text-purple-600">From Batch Processing</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-gray-100 space-y-2">
          <Button
            onClick={() => setShowLogModal(true)}
            variant="secondary"
            className="w-full text-xs py-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Log to Sheet
          </Button>
          <Button
            onClick={() => window.open(`/questions?jobId=${jobId}`, "_blank")}
            variant="secondary"
            className="w-full text-xs py-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Answer Questions
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Cover Letter Section */}
          {tailoredCoverLetter && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-700">
                  Cover Letter Ready
                </span>
                <Button
                  onClick={() =>
                    navigator.clipboard.writeText(tailoredCoverLetter)
                  }
                  variant="ghost"
                  className="text-xs py-1 px-2"
                >
                  Copy
                </Button>
              </div>
              <Button
                onClick={() => handleRegenerateCoverLetter("Improve it")}
                disabled={isRegeneratingCoverLetter}
                variant="ghost"
                className="w-full text-xs py-1.5 border border-green-300"
              >
                {isRegeneratingCoverLetter ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
          )}

          {/* Collapsible Filenames Section */}
          <div>
            <button
              onClick={() => setShowFilenames(!showFilenames)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted hover:text-foreground py-2"
            >
              <span>Filenames</span>
              <svg
                className={`w-4 h-4 transition-transform ${showFilenames ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFilenames && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-hover px-2 py-1 rounded text-[10px] font-mono truncate">
                    {resumeFileNameDetailed}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(resumeFileNameDetailed, "resume")
                    }
                    className="text-xs text-muted hover:text-foreground"
                  >
                    {copiedResume ? "✓" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-hover px-2 py-1 rounded text-[10px] font-mono truncate">
                    {coverLetterFileNameDetailed}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        coverLetterFileNameDetailed,
                        "coverLetter",
                      )
                    }
                    className="text-xs text-muted hover:text-foreground"
                  >
                    {copiedCoverLetter ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Q&A */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Quick Question
            </label>
            <textarea
              value={generalQuestion}
              onChange={(e) => setGeneralQuestion(e.target.value)}
              placeholder="Ask about this job..."
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-1 my-2">
              {[
                { value: "none", label: "No Limit" },
                { value: "words", label: "Words" },
                { value: "characters", label: "Chars" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    handleLimitTypeChange(
                      opt.value as "none" | "words" | "characters",
                    )
                  }
                  className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
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
                onChange={(e) =>
                  setLimitValue(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-card-border mb-2"
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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      question: generalQuestion,
                      tailoredResume,
                      tailoredCoverLetter,
                      jobDescription: jobData?.jobDescription,
                      companyInfo: jobData?.companyResearch,
                      limitType: limitType !== "none" ? limitType : undefined,
                      limitValue: limitType !== "none" ? limitValue : undefined,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setGeneralAnswer(data.answer);
                } catch (err) {
                  setGeneralAnswer(
                    "Error: " + (err instanceof Error ? err.message : "Failed"),
                  );
                } finally {
                  setIsAskingQuestion(false);
                }
              }}
              disabled={!generalQuestion.trim() || isAskingQuestion}
              variant="primary"
              className="w-full text-xs py-2"
            >
              {isAskingQuestion ? "Thinking..." : "Ask"}
            </Button>

            {/* Quick Question Shortcuts */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  setGeneralQuestion(
                    "What is the salary range for this position?",
                  )
                }
                className="flex-1 px-2 py-1.5 text-xs font-medium text-muted bg-surface-hover hover:bg-gray-200 rounded-lg transition-colors border border-card-border/50"
              >
                💰 Salary
              </button>
              <button
                onClick={() =>
                  setGeneralQuestion(
                    "What are the key skills required for this role?",
                  )
                }
                className="flex-1 px-2 py-1.5 text-xs font-medium text-muted bg-surface-hover hover:bg-gray-200 rounded-lg transition-colors border border-card-border/50"
              >
                🎯 Skills
              </button>
            </div>

            {generalAnswer && (
              <div className="mt-3 p-3 bg-surface-hover rounded-lg border border-card-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted">Answer</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(generalAnswer)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {generalAnswer}
                </p>
              </div>
            )}
          </div>
        </div>
      </Sidebar>

      {/* Main Content - LaTeX Editor */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <LaTeXEditor
          title="Tailored Resume"
          code={tailoredResume}
          onCodeChange={setTailoredResume}
          onRegenerate={handleRegenerateResume}
          isRegenerating={isRegeneratingResume}
          showPreview={true}
          fullHeight={true}
          downloadFileNames={[resumeFileNamePlain, resumeFileNameDetailed]}
        />
      </main>

      {/* Log to Sheet Modal */}
      {showLogModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Log Application</h2>
              <p className="text-sm text-muted mt-1">
                Record this application to your spreadsheet
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={editableCompanyName}
                    onChange={(e) => setEditableCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-card-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Position
                  </label>
                  <input
                    type="text"
                    value={editablePositionTitle}
                    onChange={(e) => setEditablePositionTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-card-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Application Link
                </label>
                <input
                  ref={applicationLinkRef}
                  type="url"
                  value={applicationLink}
                  onChange={(e) => setApplicationLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. USA"
                    className="w-full px-3 py-2 border border-card-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Work Mode
                  </label>
                  <select
                    value={workMode}
                    onChange={(e) =>
                      setWorkMode(
                        e.target.value as "" | "Remote" | "Hybrid" | "On-site",
                      )
                    }
                    className="w-full px-3 py-2 border border-card-border rounded-lg text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes..."
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm resize-none"
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
                  onClick={handleLogToSheet}
                  disabled={isLogging}
                  variant="primary"
                  className="flex-1"
                >
                  {isLogging
                    ? "Logging..."
                    : logSuccess
                      ? "✓ Logged!"
                      : "Log Application"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
