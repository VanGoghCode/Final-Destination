"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import { getAdminHeaders } from "@/lib/client-admin";
import LaTeXEditor from "@/components/LaTeXEditor";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";

export default function TailoredPage() {
  const router = useRouter();
  const {
    firstName,
    lastName,
    tailoredResume,
    tailoredCoverLetter,
    resumeLatex,
    coverLetterLatex,
    jobDescription,
    companyName,
    positionTitle,
    personalDetails,
    masterContext,
    jobCountry,
    jobWorkMode,
    setTailoredResume,
    setTailoredCoverLetter,
    setCompanyName,
    setPositionTitle,
  } = useAppContext();

  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);

  // Regeneration state
  const [isRegeneratingResume, setIsRegeneratingResume] = useState(false);
  const [isRegeneratingCoverLetter, setIsRegeneratingCoverLetter] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [showCoverLetterPreview, setShowCoverLetterPreview] = useState(false);

  // Sheet logging state
  const [showLogModal, setShowLogModal] = useState(false);
  const [applicationLink, setApplicationLink] = useState("");
  const [notes, setNotes] = useState("");
  const [other, setOther] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [logError, setLogError] = useState("");
  const [country, setCountry] = useState("");
  const [workMode, setWorkMode] = useState<"" | "Remote" | "Hybrid" | "On-site">("");
  const [editableCompanyName, setEditableCompanyName] = useState("");
  const [editablePositionTitle, setEditablePositionTitle] = useState("");
  const applicationLinkRef = useRef<HTMLInputElement>(null);

  // General Q&A state
  const [generalQuestion, setGeneralQuestion] = useState("");
  const [generalAnswer, setGeneralAnswer] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [limitType, setLimitType] = useState<"none" | "words" | "characters">("none");
  const [limitValue, setLimitValue] = useState<number>(10);
  const [searchMode] = useState<"context" | "context+internet" | "internet">("context");

  // Collapsible sections state
  const [showFilenames, setShowFilenames] = useState(false);

  // Update limit value when limit type changes to set appropriate defaults
  const handleLimitTypeChange = (newType: "none" | "words" | "characters") => {
    setLimitType(newType);
    if (newType === "words") setLimitValue(10);
    else if (newType === "characters") setLimitValue(200);
  };

  // Initialize editable fields when modal opens - pre-fill with extracted values
  useEffect(() => {
    if (showLogModal) {
      setEditableCompanyName(companyName);
      setEditablePositionTitle(positionTitle);
      // Pre-fill with extracted location info from context (extracted during tailoring)
      setCountry(jobCountry || "");
      setWorkMode(jobWorkMode || "");
      // Focus on application link field after modal opens
      setTimeout(() => {
        applicationLinkRef.current?.focus();
      }, 100);
    }
  }, [showLogModal, companyName, positionTitle, jobCountry, jobWorkMode]);

  // Generate formatted filenames
  const formatName = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  // Use firstName and lastName from context, fallback to defaults
  const fullName = `${firstName || "First"}_${lastName || "Last"}`;

  // Detailed filenames (with company and role) — used for download
  const resumeFileName = `${fullName}_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_Resume`;
  const coverLetterFileName = `${fullName}_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_CoverLetter`;

  const copyToClipboard = async (text: string, type: "resume" | "coverLetter") => {
    await navigator.clipboard.writeText(text);
    if (type === "resume") {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    } else if (type === "coverLetter") {
      setCopiedCoverLetter(true);
      setTimeout(() => setCopiedCoverLetter(false), 2000);
    }
  };

  const handleLogToSheet = async () => {
    setLogError("");
    setIsLogging(true);

    // Compose notes with country and work mode
    const noteParts: string[] = [];
    if (country) noteParts.push(`Country: ${country}`);
    if (workMode) noteParts.push(`Work Mode: ${workMode}`);
    if (notes.trim()) noteParts.push(notes.trim());
    const composedNotes = noteParts.join(" | ");

    // Use editable fields for logging
    const finalCompanyName = editableCompanyName || companyName;
    const finalPositionTitle = editablePositionTitle || positionTitle;

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          companyName: finalCompanyName,
          positionTitle: finalPositionTitle,
          applicationLink: applicationLink.trim() || "N/A",
          notes: composedNotes,
          other: other.trim() || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to log application");
      }

      // Update context with edited values
      if (editableCompanyName !== companyName) {
        setCompanyName(editableCompanyName);
      }
      if (editablePositionTitle !== positionTitle) {
        setPositionTitle(editablePositionTitle);
      }

      setLogSuccess(true);

      setTimeout(() => {
        setShowLogModal(false);
        setLogSuccess(false);
        setApplicationLink("");
        setNotes("");
        setOther("");
        setCountry("");
        setWorkMode("");
      }, 2000);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLogging(false);
    }
  };

  // Regeneration handlers
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
          resumeLatex,
          jobDescription,
          personalDetails,
          masterContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTailoredResume(data.regeneratedContent);
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
          coverLetterLatex,
          jobDescription,
          personalDetails,
          masterContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTailoredCoverLetter(data.regeneratedContent);
    } catch (err) {
      console.error("Error regenerating cover letter:", err);
    } finally {
      setIsRegeneratingCoverLetter(false);
    }
  };

  // Generate cover letter on-demand
  const handleGenerateCoverLetter = async () => {
    if (!coverLetterLatex || !jobDescription) {
      console.error("Missing cover letter template or job description");
      return;
    }

    setIsGeneratingCoverLetter(true);
    try {
      const response = await fetch("/api/tailor-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetterLatex,
          jobDescription,
          personalDetails,
          masterContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTailoredCoverLetter(data.tailoredCoverLetter);
    } catch (err) {
      console.error("Error generating cover letter:", err);
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Collapsible Sidebar */}
      <Sidebar title="Step 2: Review">
        {/* Step Navigation */}
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
              onClick={() => router.push("/questions")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="bg-card-border text-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                3
              </span>
              Q&A
            </button>
          </div>
        </div>

        {/* Sidebar Header with Actions */}
        <div className="space-y-3 border-b border-gray-100 p-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowLogModal(true)}
              variant="secondary"
              className="flex-1 py-2 text-xs"
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
              onClick={() => router.push("/jobs")}
              variant="secondary"
              className="flex-1 py-2 text-xs"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 4h4v3h-4V4z" />
              </svg>
              Companies
            </Button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="mb-4 flex-1 space-y-5 overflow-y-auto border-b border-gray-200 p-4 pb-4">
          {/* Generate Cover Letter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Cover Letter</label>
            {tailoredCoverLetter ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-xs font-medium text-green-700">Generated</span>
                </div>
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50/50 p-4">
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
                    onClick={handleRegenerateCoverLetter.bind(null, "Improve it")}
                    disabled={isRegeneratingCoverLetter}
                    variant="ghost"
                    className="w-full cursor-pointer border border-green-200 bg-white py-2 text-xs text-green-700 shadow-none transition-all hover:bg-green-50"
                  >
                    {isRegeneratingCoverLetter ? (
                      <>
                        <span className="spinner-small" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="mr-1.5"
                        >
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleGenerateCoverLetter}
                disabled={isGeneratingCoverLetter || !coverLetterLatex}
                variant="primary"
                className="w-full py-2.5 text-sm"
              >
                {isGeneratingCoverLetter ? (
                  <>
                    <span className="spinner" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Cover Letter
                  </>
                )}
              </Button>
            )}
            {!coverLetterLatex && !tailoredCoverLetter && (
              <p className="mt-2 mb-4 border-b border-gray-200 pb-4 text-xs text-red-400">
                Add a cover letter template first.
              </p>
            )}
          </div>

          {/* Collapsible Filenames Section */}
          <div className="mb-4 border-b border-gray-200 pb-4">
            <button
              onClick={() => setShowFilenames(!showFilenames)}
              className="hover:text-foreground flex w-full items-center justify-between py-2 text-sm font-medium text-gray-700"
            >
              <span>📁 Filenames</span>
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
              <div className="mt-3 space-y-4">
                {/* Resume Filenames */}
                <div>
                  <label className="text-muted mb-2 block text-xs font-medium">Resume</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-surface-hover text-foreground flex-1 truncate rounded-lg px-2 py-1.5 font-mono text-[10px]">
                        {resumeFileName}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(resumeFileName, "resume")}
                        variant="ghost"
                        className="copy-btn shrink-0 px-2 py-1 text-xs"
                      >
                        {copiedResume ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Cover Letter Filenames */}
                <div>
                  <label className="text-muted mb-2 block text-xs font-medium">Cover Letter</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-surface-hover text-foreground flex-1 truncate rounded-lg px-2 py-1.5 font-mono text-[10px]">
                        {coverLetterFileName}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(coverLetterFileName, "coverLetter")}
                        variant="ghost"
                        className="copy-btn shrink-0 px-2 py-1 text-xs"
                      >
                        {copiedCoverLetter ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Q&A */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Quick Question</label>
            <textarea
              value={generalQuestion}
              onChange={(e) => setGeneralQuestion(e.target.value)}
              placeholder="Ask about salary range, required skills..."
              className="input-field mb-2 text-sm"
              rows={2}
            />
            <div className="mb-2 flex gap-2">
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
                  className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
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
                className="border-card-border mb-2 w-full rounded-lg border px-3 py-1.5 text-sm"
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
                      jobDescription,
                      masterContext,
                      limitType: limitType !== "none" ? limitType : undefined,
                      limitValue: limitType !== "none" ? limitValue : undefined,
                      searchMode,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setGeneralAnswer(data.answer);
                } catch (err) {
                  setGeneralAnswer(
                    "Error: " + (err instanceof Error ? err.message : "Failed to get answer"),
                  );
                } finally {
                  setIsAskingQuestion(false);
                }
              }}
              disabled={!generalQuestion.trim() || isAskingQuestion}
              variant="primary"
              className="w-full py-2 text-sm"
            >
              {isAskingQuestion ? (
                <>
                  <span className="spinner-small" />
                  Thinking...
                </>
              ) : (
                "Ask"
              )}
            </Button>

            {/* Quick Question Shortcuts */}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setGeneralQuestion("What is the salary range for this position?")}
                className="text-muted bg-surface-hover border-card-border/50 flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200"
              >
                💰 Salary Range
              </button>
              <button
                onClick={() =>
                  setGeneralQuestion("What are the key skills required for this role?")
                }
                className="text-muted bg-surface-hover border-card-border/50 flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200"
              >
                🎯 Key Skills
              </button>
            </div>

            {generalAnswer && (
              <div className="bg-surface-hover border-card-border mt-3 rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted text-xs font-medium">Answer</span>
                  <Button
                    onClick={() => navigator.clipboard.writeText(generalAnswer)}
                    variant="ghost"
                    className="copy-btn px-1.5 py-0.5 text-xs"
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-foreground text-xs whitespace-pre-wrap">{generalAnswer}</p>
              </div>
            )}
          </div>
        </div>
      </Sidebar>

      {/* Main Content - Full Screen LaTeX Editor */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <LaTeXEditor
          title="Tailored Resume"
          code={tailoredResume}
          onCodeChange={setTailoredResume}
          onRegenerate={handleRegenerateResume}
          isRegenerating={isRegeneratingResume}
          showPreview={true}
          fullHeight={true}
          downloadFileName={resumeFileName}
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
          <div
            className="glass-card fade-in relative w-full max-w-md p-6"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLogging) {
                e.preventDefault();
                handleLogToSheet();
              }
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowLogModal(false)}
              className="text-muted hover:text-foreground hover:bg-surface-hover absolute top-4 right-4 rounded-lg p-1 transition-colors"
              aria-label="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="text-foreground mb-4 text-xl font-bold">Log Application to Sheet</h3>

            {logSuccess ? (
              <div className="py-8 text-center">
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="text-foreground text-lg font-medium">Logged successfully!</p>
              </div>
            ) : (
              <>
                {/* Editable Company Name and Position */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted mb-1 block text-sm">Company Name</label>
                    <input
                      type="text"
                      value={editableCompanyName}
                      onChange={(e) => setEditableCompanyName(e.target.value)}
                      className="input-field text-sm"
                      placeholder="Company name..."
                    />
                  </div>
                  <div>
                    <label className="text-muted mb-1 block text-sm">Position</label>
                    <input
                      type="text"
                      value={editablePositionTitle}
                      onChange={(e) => setEditablePositionTitle(e.target.value)}
                      className="input-field text-sm"
                      placeholder="Position title..."
                    />
                  </div>
                </div>

                {/* Application Link field */}
                <div className="mb-4">
                  <label className="text-muted mb-1 block text-sm">
                    Application Link <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    ref={applicationLinkRef}
                    type="url"
                    value={applicationLink}
                    onChange={(e) => setApplicationLink(e.target.value)}
                    placeholder="https://..."
                    className="input-field"
                  />
                </div>

                {/* Country and Work Mode */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-muted text-sm">Location & Work Mode</label>
                    {(jobCountry || jobWorkMode) && (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Auto-filled
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {/* Country Input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Country (e.g., USA, UK)"
                        className="input-field text-sm"
                      />
                    </div>
                    {/* Work Mode Buttons */}
                    <div className="flex gap-1">
                      {(["Remote", "Hybrid", "On-site"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setWorkMode(workMode === mode ? "" : mode)}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            workMode === mode
                              ? "bg-primary border-primary text-white"
                              : "bg-surface-hover text-muted border-card-border hover:border-primary/50"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes field */}
                <div className="mb-4">
                  <label className="text-muted mb-1 block text-sm">
                    Notes <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this application..."
                    className="input-field h-20"
                  />
                </div>

                {/* Other field */}
                <div className="mb-4">
                  <label className="text-muted mb-1 block text-sm">
                    Other <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    placeholder="Any additional info..."
                    className="input-field"
                  />
                </div>

                {logError && <p className="mb-4 text-sm text-red-500">{logError}</p>}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowLogModal(false)}
                    variant="secondary"
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
                    {isLogging ? (
                      <>
                        <span className="spinner" />
                        Logging...
                      </>
                    ) : (
                      "Log Application"
                    )}
                  </Button>
                </div>
              </>
            )}
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
                downloadFileName={coverLetterFileName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
