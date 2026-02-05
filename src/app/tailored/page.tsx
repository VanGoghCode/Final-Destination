"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
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
    companyInfo,
    jobCountry,
    jobWorkMode,
    setTailoredResume,
    setTailoredCoverLetter,
    setCompanyName,
    setPositionTitle,
  } = useAppContext();

  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [copiedResumeDetailed, setCopiedResumeDetailed] = useState(false);
  const [copiedCoverLetterDetailed, setCopiedCoverLetterDetailed] = useState(false);

  // Regeneration state
  const [isRegeneratingResume, setIsRegeneratingResume] = useState(false);
  const [isRegeneratingCoverLetter, setIsRegeneratingCoverLetter] =
    useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

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
  const [searchMode, _setSearchMode] = useState<"context" | "context+internet" | "internet">("context");

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
  
  // Plain filenames (without company/role)
  const resumeFileNamePlain = `${fullName}_Resume`;
  const coverLetterFileNamePlain = `${fullName}_CoverLetter`;
  
  // Detailed filenames (with company and role)
  const resumeFileNameDetailed = `${fullName}_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_Resume`;
  const coverLetterFileNameDetailed = `${fullName}_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_CoverLetter`;

  const copyToClipboard = async (
    text: string,
    type: "resume" | "coverLetter" | "resumeDetailed" | "coverLetterDetailed",
  ) => {
    await navigator.clipboard.writeText(text);
    if (type === "resume") {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    } else if (type === "coverLetter") {
      setCopiedCoverLetter(true);
      setTimeout(() => setCopiedCoverLetter(false), 2000);
    } else if (type === "resumeDetailed") {
      setCopiedResumeDetailed(true);
      setTimeout(() => setCopiedResumeDetailed(false), 2000);
    } else {
      setCopiedCoverLetterDetailed(true);
      setTimeout(() => setCopiedCoverLetterDetailed(false), 2000);
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
        headers: { "Content-Type": "application/json" },
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
          companyInfo,
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
          companyInfo,
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
          companyInfo,
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
    <div className="h-screen flex overflow-hidden">
      {/* Collapsible Sidebar */}
      <Sidebar title="Step 2: Review">
        {/* Step Navigation */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
              Input
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-primary/10 border border-primary text-primary text-xs font-medium">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">2</span>
              Review
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => router.push("/questions")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-card-border text-muted flex items-center justify-center text-[10px] font-bold">3</span>
              Q&A
            </button>
          </div>
        </div>

        {/* Sidebar Header with Actions */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowLogModal(true)}
              variant="secondary"
              className="flex-1 text-xs py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              Log to Sheet
            </Button>
            <Button
              onClick={() => router.push("/jobs")}
              variant="secondary"
              className="flex-1 text-xs py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 4h4v3h-4V4z" />
              </svg>
              Companies
            </Button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 border-b border-gray-200 pb-4 mb-4">
          {/* Generate Cover Letter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cover Letter</label>
            {tailoredCoverLetter ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-xs text-green-700 font-medium">Generated</span>
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(tailoredCoverLetter);
                  }}
                  variant="secondary"
                  className="w-full text-xs py-2 border-b border-gray-200 pb-4 mb-4"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Cover Letter
                </Button>
                <Button
                  onClick={handleRegenerateCoverLetter.bind(null, "Improve it")}
                  disabled={isRegeneratingCoverLetter}
                  variant="secondary"
                  className="w-full text-xs py-2"
                >
                  {isRegeneratingCoverLetter ? (
                    <>
                      <span className="spinner-small" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Regenerate
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGenerateCoverLetter}
                disabled={isGeneratingCoverLetter || !coverLetterLatex}
                variant="primary"
                className="w-full text-sm py-2.5"
              >
                {isGeneratingCoverLetter ? (
                  <>
                    <span className="spinner" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Cover Letter
                  </>
                )}
              </Button>
            )}
            {!coverLetterLatex && !tailoredCoverLetter && (
              <p className="text-xs text-red-400 mt-2 border-b border-gray-200 pb-4 mb-4">
                Add a cover letter template first.
              </p>
            )}
          </div>

          {/* Collapsible Filenames Section */}
          <div className="border-b border-gray-200 pb-4 mb-4">
            <button
              onClick={() => setShowFilenames(!showFilenames)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-foreground py-2"
            >
              <span>📁 Filenames</span>
              <svg className={`w-4 h-4 transition-transform ${showFilenames ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFilenames && (
              <div className="space-y-4 mt-3">
                {/* Resume Filenames */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-2">Resume</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-hover px-2 py-1.5 rounded-lg text-[10px] font-mono text-foreground truncate">
                        {resumeFileNamePlain}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(resumeFileNamePlain, "resume")}
                        variant="ghost"
                        className="copy-btn shrink-0 text-xs py-1 px-2"
                      >
                        {copiedResume ? "✓" : "Copy"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-hover px-2 py-1.5 rounded-lg text-[10px] font-mono text-foreground truncate">
                        {resumeFileNameDetailed}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(resumeFileNameDetailed, "resumeDetailed")}
                        variant="ghost"
                        className="copy-btn shrink-0 text-xs py-1 px-2"
                      >
                        {copiedResumeDetailed ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Cover Letter Filenames */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-2">Cover Letter</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-hover px-2 py-1.5 rounded-lg text-[10px] font-mono text-foreground truncate">
                        {coverLetterFileNamePlain}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(coverLetterFileNamePlain, "coverLetter")}
                        variant="ghost"
                        className="copy-btn shrink-0 text-xs py-1 px-2"
                      >
                        {copiedCoverLetter ? "✓" : "Copy"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-hover px-2 py-1.5 rounded-lg text-[10px] font-mono text-foreground truncate">
                        {coverLetterFileNameDetailed}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(coverLetterFileNameDetailed, "coverLetterDetailed")}
                        variant="ghost"
                        className="copy-btn shrink-0 text-xs py-1 px-2"
                      >
                        {copiedCoverLetterDetailed ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Q&A */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Question</label>
            <textarea
              value={generalQuestion}
              onChange={(e) => setGeneralQuestion(e.target.value)}
              placeholder="Ask about salary range, required skills..."
              className="input-field text-sm mb-2"
              rows={2}
            />
            <div className="flex gap-2 mb-2">
              {[
                { value: "none", label: "No Limit" },
                { value: "words", label: "Words" },
                { value: "characters", label: "Chars" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleLimitTypeChange(opt.value as "none" | "words" | "characters")}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-all ${
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
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-card-border mb-2"
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
                      companyInfo,
                      limitType: limitType !== "none" ? limitType : undefined,
                      limitValue: limitType !== "none" ? limitValue : undefined,
                      searchMode,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setGeneralAnswer(data.answer);
                } catch (err) {
                  setGeneralAnswer("Error: " + (err instanceof Error ? err.message : "Failed to get answer"));
                } finally {
                  setIsAskingQuestion(false);
                }
              }}
              disabled={!generalQuestion.trim() || isAskingQuestion}
              variant="primary"
              className="w-full text-sm py-2"
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
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setGeneralQuestion("What is the salary range for this position?")}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-muted bg-surface-hover hover:bg-gray-200 rounded-lg transition-colors border border-card-border/50"
              >
                💰 Salary Range
              </button>
              <button
                onClick={() => setGeneralQuestion("What are the key skills required for this role?")}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-muted bg-surface-hover hover:bg-gray-200 rounded-lg transition-colors border border-card-border/50"
              >
                🎯 Key Skills
              </button>
            </div>

            {generalAnswer && (
              <div className="mt-3 p-3 bg-surface-hover rounded-lg border border-card-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted">Answer</span>
                  <Button
                    onClick={() => navigator.clipboard.writeText(generalAnswer)}
                    variant="ghost"
                    className="copy-btn text-xs py-0.5 px-1.5"
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap">{generalAnswer}</p>
              </div>
            )}
          </div>
        </div>
      </Sidebar>

      {/* Main Content - Full Screen LaTeX Editor */}
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
          <div 
            className="glass-card p-6 max-w-md w-full fade-in relative"
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
              className="absolute top-4 right-4 p-1 text-muted hover:text-foreground transition-colors rounded-lg hover:bg-surface-hover"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-foreground mb-4">
              Log Application to Sheet
            </h3>

            {logSuccess ? (
              <div className="text-center py-8">
                <svg
                  className="w-16 h-16 mx-auto text-green-500 mb-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="text-lg font-medium text-foreground">
                  Logged successfully!
                </p>
              </div>
            ) : (
              <>
                {/* Editable Company Name and Position */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-sm text-muted mb-1 block">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={editableCompanyName}
                      onChange={(e) => setEditableCompanyName(e.target.value)}
                      className="input-field text-sm"
                      placeholder="Company name..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1 block">
                      Position
                    </label>
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
                  <label className="text-sm text-muted mb-1 block">
                    Application Link{" "}
                    <span className="text-xs text-gray-400">(optional)</span>
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-muted">
                      Location & Work Mode
                    </label>
                    {(jobCountry || jobWorkMode) && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                            workMode === mode
                              ? "bg-primary text-white border-primary"
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
                  <label className="text-sm text-muted mb-1 block">
                    Notes{" "}
                    <span className="text-xs text-gray-400">(optional)</span>
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
                  <label className="text-sm text-muted mb-1 block">
                    Other{" "}
                    <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    placeholder="Any additional info..."
                    className="input-field"
                  />
                </div>

                {logError && (
                  <p className="text-red-500 text-sm mb-4">{logError}</p>
                )}

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
    </div>
  );
}
