"use client";

import { useState } from "react";
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
    setTailoredResume,
    setTailoredCoverLetter,
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

  // General Q&A state
  const [generalQuestion, setGeneralQuestion] = useState("");
  const [generalAnswer, setGeneralAnswer] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [limitType, setLimitType] = useState<"none" | "words" | "characters">("none");
  const [limitValue, setLimitValue] = useState<number>(100);

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

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          positionTitle,
          applicationLink: applicationLink.trim() || "N/A",
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to log application");
      }

      setLogSuccess(true);
      setTimeout(() => {
        setShowLogModal(false);
        setLogSuccess(false);
        setApplicationLink("");
        setNotes("");
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

        {/* Header */}
        <div className="text-center mb-10 fade-in">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tailored Documents
          </h1>
          <p className="text-muted text-base">
            Your resume and cover letter customized for this role
          </p>
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

          {/* Limit Options */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-surface-hover rounded-lg border border-card-border">
            <span className="text-xs font-medium text-muted">Answer Limit:</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="limitType"
                  value="none"
                  checked={limitType === "none"}
                  onChange={() => setLimitType("none")}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-foreground">No Limit</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="limitType"
                  value="words"
                  checked={limitType === "words"}
                  onChange={() => setLimitType("words")}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-foreground">Word Limit</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="limitType"
                  value="characters"
                  checked={limitType === "characters"}
                  onChange={() => setLimitType("characters")}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-foreground">Character Limit</span>
              </label>
            </div>
            {limitType !== "none" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={limitValue}
                  onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="input-field w-20 text-xs py-1.5 text-center"
                />
                <span className="text-xs text-muted">{limitType}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button
              onClick={() =>
                setGeneralQuestion(
                  "Give me a list of skills from my current tailored resume, separated by commas. no extra text or formatting.",
                )
              }
              variant="secondary"
              className="text-xs py-2 px-3 shrink-0"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3v18" />
                <path d="M5 10l7 7 7-7" />
              </svg>
              Quick: List Skills
            </Button>
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

      {/* Log to Sheet Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full fade-in">
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
                {/* Auto-filled fields (read-only) */}
                <div className="mb-4">
                  <label className="text-sm text-muted mb-1 block">
                    Company Name{" "}
                    <span className="text-xs text-green-600">
                      (auto-filled)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    readOnly
                    className="input-field bg-gray-50 cursor-not-allowed"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-sm text-muted mb-1 block">
                    Position{" "}
                    <span className="text-xs text-green-600">
                      (auto-filled)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={positionTitle}
                    readOnly
                    className="input-field bg-gray-50 cursor-not-allowed"
                  />
                </div>

                {/* Application Link field */}
                <div className="mb-4">
                  <label className="text-sm text-muted mb-1 block">
                    Application Link{" "}
                    <span className="text-xs text-gray-400">(optional - defaults to N/A)</span>
                  </label>
                  <input
                    type="url"
                    value={applicationLink}
                    onChange={(e) => setApplicationLink(e.target.value)}
                    placeholder="https://..."
                    className="input-field"
                  />
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
