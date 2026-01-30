"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import CodeBlock from "@/components/CodeBlock";
import Button from "@/components/Button";

export default function TailoredPage() {
  const router = useRouter();
  const {
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

  // Regeneration state
  const [isRegeneratingResume, setIsRegeneratingResume] = useState(false);
  const [isRegeneratingCoverLetter, setIsRegeneratingCoverLetter] =
    useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  // Sheet logging state
  const [showLogModal, setShowLogModal] = useState(false);
  const [applicationLink, setApplicationLink] = useState("");
  const [notes, setNotes] = useState("");
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
  const [limitValue, setLimitValue] = useState<number>(100);
  const [searchMode, setSearchMode] = useState<"context" | "context+internet" | "internet">("context");

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

  const resumeFileName = `Kirtankumar_Thummar_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_Resume`;
  const coverLetterFileName = `Kirtankumar_Thummar_${formatName(companyName || "Company")}_${formatName(positionTitle || "Position")}_CoverLetter`;

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
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={2} />

      <div className="max-w-6xl mx-auto">
        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center mb-6 fade-in">
          <Button
            onClick={() => router.push("/")}
            variant="secondary"
            className="text-sm py-2.5"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Inputs
          </Button>

          <Button
            onClick={() => setShowLogModal(true)}
            variant="secondary"
            className="text-sm py-2.5"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Log to Sheet
          </Button>
        </div>

        {/* Filename Copy Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-5">
          <div
            className="glass-card p-4 fade-in"
            style={{ animationDelay: "0.02s" }}
          >
            <label className="section-label text-sm">Resume Filename</label>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 bg-surface-hover px-3 py-2 rounded-lg text-sm font-mono text-foreground truncate">
                {resumeFileName}
              </code>
              <Button
                onClick={() => copyToClipboard(resumeFileName, "resume")}
                variant="ghost"
                className="copy-btn shrink-0"
              >
                {copiedResume ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div
            className="glass-card p-4 fade-in"
            style={{ animationDelay: "0.04s" }}
          >
            <label className="section-label text-sm">
              Cover Letter Filename
            </label>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 bg-surface-hover px-3 py-2 rounded-lg text-sm font-mono text-foreground truncate">
                {coverLetterFileName}
              </code>
              <Button
                onClick={() =>
                  copyToClipboard(coverLetterFileName, "coverLetter")
                }
                variant="ghost"
                className="copy-btn shrink-0"
              >
                {copiedCoverLetter ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <div className="fade-in" style={{ animationDelay: "0.05s" }}>
            <CodeBlock
              title="Tailored Resume"
              code={tailoredResume}
              onRegenerate={handleRegenerateResume}
              isRegenerating={isRegeneratingResume}
            />
          </div>

          <div className="fade-in" style={{ animationDelay: "0.1s" }}>
            {tailoredCoverLetter ? (
              <CodeBlock
                title="Tailored Cover Letter"
                code={tailoredCoverLetter}
                onRegenerate={handleRegenerateCoverLetter}
                isRegenerating={isRegeneratingCoverLetter}
              />
            ) : (
              <div className="glass-card p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tailored Cover Letter
                  </h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted mb-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <p className="text-muted text-sm mb-4">
                    Cover letter not generated yet.
                  </p>
                  <Button
                    onClick={handleGenerateCoverLetter}
                    disabled={isGeneratingCoverLetter || !coverLetterLatex}
                    variant="primary"
                    className="text-sm py-2.5 px-5"
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
                  {!coverLetterLatex && (
                    <p className="text-xs text-red-400 mt-2">
                      Please add a cover letter template on the home page first.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* General Q&A Section */}
        <div
          className="mt-8 glass-card p-4 sm:p-5 fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className="text-base font-semibold text-foreground">
              Ask About Your Application
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <textarea
              value={generalQuestion}
              onChange={(e) => setGeneralQuestion(e.target.value)}
              placeholder="Ask any question about your tailored documents..."
              className="input-field flex-1 min-h-15 text-sm"
              rows={2}
            />
          </div>

          {/* Combined Options Row - Modern UI */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            {/* Answer Limit */}
            <div className="flex-1 p-3 bg-gradient-to-r from-surface-hover to-transparent rounded-xl border border-card-border/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M4 7V4h16v3" />
                    <path d="M9 20h6" />
                    <path d="M12 4v16" />
                  </svg>
                  <span className="text-xs font-semibold text-foreground">Limit</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { value: "none", label: "None" },
                    { value: "words", label: "Words" },
                    { value: "characters", label: "Chars" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLimitType(opt.value as typeof limitType)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        limitType === opt.value
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {limitType !== "none" && (
                    <input
                      type="number"
                      value={limitValue}
                      onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-card-border bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Knowledge Source */}
            <div className="flex-1 p-3 bg-gradient-to-r from-surface-hover to-transparent rounded-xl border border-card-border/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-xs font-semibold text-foreground">Source</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { value: "context", label: "Context" },
                    { value: "context+internet", label: "Context + Web" },
                    { value: "internet", label: "Web Only" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSearchMode(opt.value as typeof searchMode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        searchMode === opt.value
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions and Generate Button */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() =>
                  setGeneralQuestion(
                    "Give me a list of skills from my current tailored resume, separated by commas. no extra text or formatting.",
                  )
                }
                variant="secondary"
                className="text-xs py-2 px-3"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
                List Skills
              </Button>
              <Button
                onClick={() =>
                  setGeneralQuestion(
                    "Based on my resume, what is my expected salary range for this position? Consider my experience level, skills, and the job market. Give me a range in USD.",
                  )
                }
                variant="secondary"
                className="text-xs py-2 px-3"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Salary Range
              </Button>
            </div>
            <div className="flex-1" />
            <Button
              onClick={async () => {
                if (!generalQuestion.trim()) return;
                setIsAskingQuestion(true);
                setGeneralAnswer("");
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
                      companyName,
                      positionTitle,
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
                    "Error: " +
                      (err instanceof Error
                        ? err.message
                        : "Failed to get answer"),
                  );
                } finally {
                  setIsAskingQuestion(false);
                }
              }}
              disabled={!generalQuestion.trim() || isAskingQuestion}
              variant="primary"
              className="text-sm py-2 px-4"
            >
              {isAskingQuestion ? (
                <>
                  <span className="spinner" />
                  Thinking...
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
                  Generate Answer
                </>
              )}
            </Button>
          </div>

          {generalAnswer && (
            <div className="bg-surface-hover rounded-lg p-4 border border-card-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted">Answer</span>
                <Button
                  onClick={() => navigator.clipboard.writeText(generalAnswer)}
                  variant="ghost"
                  className="copy-btn text-xs py-1 px-2"
                >
                  Copy
                </Button>
              </div>
              <div className="prose max-w-none text-sm whitespace-pre-wrap">
                {generalAnswer}
              </div>
            </div>
          )}
        </div>
      </div>

              {/* Navigation */}
        <div
          className="mt-6 sm:mt-8 flex justify-center fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          <Button
            onClick={() => router.push("/questions")}
            variant="primary"
            className="text-sm py-2.5"
          >
            Continue to Q&A
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Button>
        </div>


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
              📊 Log Application to Sheet
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
                          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
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

                {/* Optional field */}
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
    </main>
  );
}
