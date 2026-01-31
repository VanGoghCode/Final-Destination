"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import CopyButton from "@/components/CopyButton";
import Button from "@/components/Button";

interface QuestionField {
  id: number;
  question: string;
  limitType: "none" | "words" | "characters";
  limitValue: number;
}

export default function QuestionsPage() {
  const router = useRouter();
  const {
    tailoredResume,
    tailoredCoverLetter,
    jobDescription,
    companyInfo,
    companyName,
    positionTitle,
    applicationQuestions,
    setApplicationQuestions,
    generatedAnswers,
    setGeneratedAnswers,
    isGeneratingAnswers,
    setIsGeneratingAnswers,
  } = useAppContext();

  // Individual question fields state
  const [questionFields, setQuestionFields] = useState<QuestionField[]>([
    { id: 1, question: "", limitType: "none", limitValue: 10 },
  ]);
  const [nextId, setNextId] = useState(2);

  const [error, setError] = useState<string | null>(null);
  const [questionsCompanyInfo, setQuestionsCompanyInfo] = useState(
    companyInfo || "",
  );
  const [coldEmail, setColdEmail] = useState("");
  const [referenceEmail, setReferenceEmail] = useState("");
  const [isGeneratingColdEmail, setIsGeneratingColdEmail] = useState(false);
  const [isGeneratingReferenceEmail, setIsGeneratingReferenceEmail] =
    useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Regeneration state
  const [isRegeneratingAnswers, setIsRegeneratingAnswers] = useState(false);
  const [isRegeneratingColdEmail, setIsRegeneratingColdEmail] = useState(false);
  const [isRegeneratingReferenceEmail, setIsRegeneratingReferenceEmail] =
    useState(false);
  const [answersComment, setAnswersComment] = useState("");
  const [coldEmailComment, setColdEmailComment] = useState("");
  const [referenceEmailComment, setReferenceEmailComment] = useState("");
  const [showAnswersFeedback, setShowAnswersFeedback] = useState(false);
  const [showColdEmailFeedback, setShowColdEmailFeedback] = useState(false);
  const [showReferenceEmailFeedback, setShowReferenceEmailFeedback] =
    useState(false);

  // Redirect removed - allow free navigation between pages
  // useEffect(() => {
  //   if (!tailoredResume || !tailoredCoverLetter) {
  //     router.push("/");
  //   }
  // }, [tailoredResume, tailoredCoverLetter, router]);

  // Question field handlers
  const addQuestionField = () => {
    setQuestionFields([
      ...questionFields,
      { id: nextId, question: "", limitType: "none", limitValue: 10 },
    ]);
    setNextId(nextId + 1);
  };

  const removeQuestionField = (id: number) => {
    if (questionFields.length > 1) {
      setQuestionFields(questionFields.filter((q) => q.id !== id));
    }
  };

  const updateQuestionField = (
    id: number,
    field: keyof QuestionField,
    value: string | number
  ) => {
    setQuestionFields(
      questionFields.map((q) => {
        if (q.id !== id) return q;
        // Set default values when changing limit type
        if (field === "limitType") {
          const limitType = value as QuestionField["limitType"];
          const newLimitValue = limitType === "words" ? 10 : limitType === "characters" ? 200 : q.limitValue;
          return { ...q, limitType, limitValue: newLimitValue };
        }
        if (field === "limitValue") {
          return { ...q, limitValue: value as number };
        }
        return { ...q, [field]: value };
      })
    );
  };

  const handleGenerateAnswers = async () => {
    const filledQuestions = questionFields.filter((q) => q.question.trim());
    if (filledQuestions.length === 0) {
      setError("Please enter at least one question.");
      return;
    }

    // Store combined questions for context/regeneration
    const combinedQuestions = filledQuestions
      .map((q) => q.question)
      .join("\n\n");
    setApplicationQuestions(combinedQuestions);

    setError(null);
    setIsGeneratingAnswers(true);

    try {
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: filledQuestions.map((q) => ({
            question: q.question,
            limitType: q.limitType !== "none" ? q.limitType : undefined,
            limitValue: q.limitType !== "none" ? q.limitValue : undefined,
          })),
          tailoredResume,
          tailoredCoverLetter,
          jobDescription,
          companyInfo: questionsCompanyInfo || companyInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate answers");
      }

      setGeneratedAnswers(data.answers);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to generate answers: ${message}. Please check your inputs and try again.`);
    } finally {
      setIsGeneratingAnswers(false);
    }
  };

  const handleGenerateEmail = async (type: "cold" | "reference") => {
    const setLoading =
      type === "cold"
        ? setIsGeneratingColdEmail
        : setIsGeneratingReferenceEmail;
    const setEmail = type === "cold" ? setColdEmail : setReferenceEmail;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          tailoredResume,
          tailoredCoverLetter,
          jobDescription,
          companyInfo: questionsCompanyInfo || companyInfo,
          positionTitle,
          companyName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate ${type} email`);
      }

      setEmail(data.email);
    } catch (err) {
      const emailType = type === "cold" ? "cold email" : "reference email";
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to generate ${emailType}: ${message}. Please ensure you have loaded your resume and cover letter.`);
    } finally {
      setLoading(false);
    }
  };

  // Regeneration handlers
  const handleRegenerateAnswers = async () => {
    if (!answersComment.trim()) return;
    setIsRegeneratingAnswers(true);
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "answers",
          currentContent: generatedAnswers,
          comment: answersComment,
          questions: applicationQuestions,
          tailoredResume,
          tailoredCoverLetter,
          jobDescription,
          companyInfo: questionsCompanyInfo || companyInfo,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGeneratedAnswers(data.regeneratedContent);
      setAnswersComment("");
      setShowAnswersFeedback(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to regenerate answers: ${message}. Please try rephrasing your feedback.`);
    } finally {
      setIsRegeneratingAnswers(false);
    }
  };

  const handleRegenerateEmailContent = async (type: "cold" | "reference") => {
    const comment = type === "cold" ? coldEmailComment : referenceEmailComment;
    if (!comment.trim()) return;

    const setLoading =
      type === "cold"
        ? setIsRegeneratingColdEmail
        : setIsRegeneratingReferenceEmail;
    const setEmailContent = type === "cold" ? setColdEmail : setReferenceEmail;
    const setComment =
      type === "cold" ? setColdEmailComment : setReferenceEmailComment;
    const setShowFeedback =
      type === "cold"
        ? setShowColdEmailFeedback
        : setShowReferenceEmailFeedback;
    const currentEmail = type === "cold" ? coldEmail : referenceEmail;

    setLoading(true);
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type === "cold" ? "coldEmail" : "referenceEmail",
          currentContent: currentEmail,
          comment,
          tailoredResume,
          tailoredCoverLetter,
          jobDescription,
          companyInfo: questionsCompanyInfo || companyInfo,
          positionTitle,
          companyName,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmailContent(data.regeneratedContent);
      setComment("");
      setShowFeedback(false);
    } catch (err) {
      const emailType = type === "cold" ? "cold email" : "reference email";
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to regenerate ${emailType}: ${message}. Please try rephrasing your feedback.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={3} />

      <div className="max-w-6xl mx-auto">

        {/* Main content - column layout */}
        <div className="flex flex-col gap-4 sm:gap-6 mb-6">
          {/* Questions Input */}
          <div
            className="glass-card p-5 fade-in flex flex-col"
            style={{ animationDelay: "0.05s" }}
          >
            <div className="flex items-center justify-between mb-4">
              <label className="section-label m-0">Your Questions</label>
              <Button
                onClick={() => setShowConfig(!showConfig)}
                variant="ghost"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {showConfig ? "Hide Config" : "Show Config"}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1" style={{ maxHeight: "400px" }}>
              {questionFields.map((field, index) => (
                <div key={field.id} className="p-3 bg-background/50 rounded-lg border border-card-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Question {index + 1}</span>
                    {questionFields.length > 1 && (
                      <button
                        onClick={() => removeQuestionField(field.id)}
                        className="text-muted hover:text-red-400 transition-colors p-1"
                        title="Remove question"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Question input and Limit in the same row */}
                  <div className="flex items-start gap-3">
                    <textarea
                      className="input-field flex-1 max-h-14 font-sans text-sm"
                      placeholder="Enter your question..."
                      value={field.question}
                      onChange={(e) => updateQuestionField(field.id, "question", e.target.value)}
                      rows={2}
                    />
                    {/* Modern Limit Selector */}
                    <div className="flex items-center min-h-14 gap-1 flex-wrap p-4 bg-surface-hover rounded-xl border border-card-border/50 shrink-0">
                      {[
                        { value: "none", label: "None" },
                        { value: "words", label: "Words" },
                        { value: "characters", label: "Chars" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateQuestionField(field.id, "limitType", opt.value)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                            field.limitType === opt.value
                              ? "bg-primary text-white shadow-sm"
                              : "text-muted hover:text-foreground hover:bg-background"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {field.limitType !== "none" && (
                        <input
                          type="number"
                          value={field.limitValue}
                          onChange={(e) =>
                            updateQuestionField(field.id, "limitValue", Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-card-border bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                          min="1"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={addQuestionField}
              variant="ghost"
              className="w-fit mx-auto mb-3 p-4 text-sm border rounded-2xl border-card-border hover:border-primary/50"
            >
              + Add Question
            </Button>

            <Button
              onClick={handleGenerateAnswers}
              disabled={!questionFields.some((q) => q.question.trim()) || isGeneratingAnswers}
              variant="primary"
              className="w-full"
            >
              {isGeneratingAnswers ? (
                <>
                  <span className="spinner" />
                  Generating...
                </>
              ) : (
                "Generate Answers"
              )}
            </Button>
          </div>

          {/* Generated Answers */}
          <div
            className="glass-card p-4 sm:p-5 fade-in flex flex-col"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-center justify-between mb-4 gap-2">
              <label className="section-label m-0">Generated Answers</label>
              <div className="flex items-center gap-2">
                {generatedAnswers && (
                  <>
                    <CopyButton text={generatedAnswers} label="Copy All" />
                    <Button
                      onClick={() =>
                        setShowAnswersFeedback(!showAnswersFeedback)
                      }
                      variant="ghost"
                      className="copy-btn"
                      title="Regenerate with feedback"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span className="hidden sm:inline">Regenerate</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 output-panel p-4 sm:p-5 overflow-y-auto min-h-64 sm:min-h-80">
              {generatedAnswers ? (
                <div className="space-y-4">
                  {(() => {
                    // Parse answers by splitting on "Answer X:" or similar patterns
                    const answerBlocks = generatedAnswers.split(/(?=Answer\s*\d+[:\.])/i).filter(block => block.trim());
                    
                    if (answerBlocks.length <= 1) {
                      // If no clear separation found, try splitting by double newlines or numbered patterns
                      const altBlocks = generatedAnswers.split(/\n\n(?=\d+[\.\):]|\*\*)/);
                      if (altBlocks.length > 1) {
                        return altBlocks.map((block, index) => (
                          <div key={index} className="p-4 bg-background/50 rounded-lg border border-card-border/50">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <span className="text-xs font-semibold text-primary">Answer {index + 1}</span>
                              <CopyButton text={block.trim()} label="Copy" />
                            </div>
                            <div className="prose max-w-none text-sm font-sans whitespace-pre-wrap">
                              {block.trim()}
                            </div>
                          </div>
                        ));
                      }
                      // Fallback: show as single block
                      return (
                        <div className="p-4 bg-background/50 rounded-lg border border-card-border/50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="text-xs font-semibold text-primary">Answer</span>
                            <CopyButton text={generatedAnswers.trim()} label="Copy" />
                          </div>
                          <div className="prose max-w-none text-sm font-sans whitespace-pre-wrap">
                            {generatedAnswers}
                          </div>
                        </div>
                      );
                    }
                    
                    return answerBlocks.map((block, index) => {
                      // Remove "Answer X:" prefix for cleaner display
                      const cleanBlock = block.replace(/^Answer\s*\d+[:\.]?\s*/i, '').trim();
                      return (
                        <div key={index} className="p-4 bg-background/50 rounded-lg border border-card-border/50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="text-xs font-semibold text-primary">Answer {index + 1}</span>
                            <CopyButton text={cleanBlock} label="Copy" />
                          </div>
                          <div className="prose max-w-none text-sm font-sans whitespace-pre-wrap">
                            {cleanBlock}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-muted-light italic">
                  Your answers will appear here...
                </p>
              )}
            </div>

            {/* Answers Regenerate Feedback */}
            {showAnswersFeedback && generatedAnswers && (
              <div className="regenerate-section fade-in">
                <label className="text-xs font-medium text-muted mb-2 block">
                  What changes would you like?
                </label>
                <textarea
                  value={answersComment}
                  onChange={(e) => setAnswersComment(e.target.value)}
                  placeholder="e.g., Make the answers more concise, add more specific examples..."
                  className="regenerate-input mb-3"
                  rows={2}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => {
                      setShowAnswersFeedback(false);
                      setAnswersComment("");
                    }}
                    variant="secondary"
                    className="text-xs py-2 px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegenerateAnswers}
                    disabled={!answersComment.trim() || isRegeneratingAnswers}
                    variant="regenerate"
                  >
                    {isRegeneratingAnswers ? (
                      <>
                        <span className="spinner-small" /> Regenerating...
                      </>
                    ) : (
                      <>Apply Changes</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optional Context Config (Collapsible) */}
        {showConfig && (
          <div className="glass-card p-5 mb-6 fade-in border-dashed">
            <label className="section-label">
              Company Info for Q&A{" "}
              <span className="text-muted-light font-normal normal-case">
                (optional)
              </span>
            </label>
            <textarea
              className="input-field h-24 mt-2"
              placeholder="Add specific company info, mission, or values..."
              value={questionsCompanyInfo}
              onChange={(e) => setQuestionsCompanyInfo(e.target.value)}
            />
          </div>
        )}

        {/* Outreach Section */}
        <div className="space-y-6 mb-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              Outreach Emails
            </h2>
            <div className="flex-1 h-px bg-card-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Cold Email */}
            <div
              className="glass-card p-4 sm:p-5 flex flex-col fade-in shadow-sm hover:shadow-md"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="font-bold text-foreground">Cold Email</h3>
                <Button
                  onClick={() => handleGenerateEmail("cold")}
                  disabled={isGeneratingColdEmail}
                  variant="secondary"
                  className="text-xs px-3 sm:px-4 py-1.5"
                >
                  {isGeneratingColdEmail ? (
                    <span className="spinner scale-75" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
              <div className="flex-1 output-panel p-3 sm:p-4 text-sm text-muted min-h-40 sm:min-h-44">
                {coldEmail ? (
                  <>
                    <div className="whitespace-pre-wrap">{coldEmail}</div>
                    <div className="mt-4 pt-4 border-t border-card-border flex justify-end gap-2">
                      <CopyButton text={coldEmail} label="Copy" />
                      <Button
                        onClick={() =>
                          setShowColdEmailFeedback(!showColdEmailFeedback)
                        }
                        variant="ghost"
                        className="copy-btn"
                        title="Regenerate with feedback"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-light italic">
                    Awaiting generation...
                  </p>
                )}
              </div>
              {/* Cold Email Regenerate Feedback */}
              {showColdEmailFeedback && coldEmail && (
                <div className="regenerate-section fade-in">
                  <textarea
                    value={coldEmailComment}
                    onChange={(e) => setColdEmailComment(e.target.value)}
                    placeholder="What changes would you like?"
                    className="regenerate-input mb-3"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => {
                        setShowColdEmailFeedback(false);
                        setColdEmailComment("");
                      }}
                      variant="secondary"
                      className="text-xs py-2 px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleRegenerateEmailContent("cold")}
                      disabled={
                        !coldEmailComment.trim() || isRegeneratingColdEmail
                      }
                      variant="regenerate"
                    >
                      {isRegeneratingColdEmail ? (
                        <>
                          <span className="spinner-small" /> Regenerating...
                        </>
                      ) : (
                        <>Apply</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Reference Email */}
            <div
              className="glass-card p-4 sm:p-5 flex flex-col fade-in shadow-sm hover:shadow-md"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="font-bold text-foreground">Reference Ask</h3>
                <Button
                  onClick={() => handleGenerateEmail("reference")}
                  disabled={isGeneratingReferenceEmail}
                  variant="secondary"
                  className="text-xs px-3 sm:px-4 py-1.5"
                >
                  {isGeneratingReferenceEmail ? (
                    <span className="spinner scale-75" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
              <div className="flex-1 output-panel p-3 sm:p-4 text-sm text-muted min-h-40 sm:min-h-44">
                {referenceEmail ? (
                  <>
                    <div className="whitespace-pre-wrap">{referenceEmail}</div>
                    <div className="mt-4 pt-4 border-t border-card-border flex justify-end gap-2">
                      <CopyButton text={referenceEmail} label="Copy" />
                      <Button
                        onClick={() =>
                          setShowReferenceEmailFeedback(
                            !showReferenceEmailFeedback,
                          )
                        }
                        variant="ghost"
                        className="copy-btn"
                        title="Regenerate with feedback"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-light italic">
                    Awaiting generation...
                  </p>
                )}
              </div>
              {/* Reference Email Regenerate Feedback */}
              {showReferenceEmailFeedback && referenceEmail && (
                <div className="regenerate-section fade-in">
                  <textarea
                    value={referenceEmailComment}
                    onChange={(e) => setReferenceEmailComment(e.target.value)}
                    placeholder="What changes would you like?"
                    className="regenerate-input mb-3"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => {
                        setShowReferenceEmailFeedback(false);
                        setReferenceEmailComment("");
                      }}
                      variant="secondary"
                      className="text-xs py-2 px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleRegenerateEmailContent("reference")}
                      disabled={
                        !referenceEmailComment.trim() ||
                        isRegeneratingReferenceEmail
                      }
                      variant="regenerate"
                    >
                      {isRegeneratingReferenceEmail ? (
                        <>
                          <span className="spinner-small" /> Regenerating...
                        </>
                      ) : (
                        <>Apply</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-card-border fade-in"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/tailored")}
              variant="secondary"
              className="py-2.5 px-5 text-sm"
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
              Back to Documents
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              className="py-2.5 px-5 text-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Start New
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <span className="text-xs font-medium text-muted-light">
              Context Loaded:
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              {tailoredResume && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                  Resume
                </span>
              )}
              {tailoredCoverLetter && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                  Cover Letter
                </span>
              )}
              {jobDescription && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                  Job Desc
                </span>
              )}
              {(companyInfo || questionsCompanyInfo) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-medium">
                  Company Info
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm glass-card p-4 border-2 border-red-300 bg-red-50 shadow-xl fade-in z-50">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="shrink-0 p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
              title="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
