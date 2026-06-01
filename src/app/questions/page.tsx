"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
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
    masterContext,
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
  const [questionsCompanyInfo, setQuestionsCompanyInfo] = useState(masterContext || "");
  const [coldEmail, setColdEmail] = useState("");
  const [referenceEmail, setReferenceEmail] = useState("");
  const [isGeneratingColdEmail, setIsGeneratingColdEmail] = useState(false);
  const [isGeneratingReferenceEmail, setIsGeneratingReferenceEmail] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Regeneration state
  const [isRegeneratingAnswers, setIsRegeneratingAnswers] = useState(false);
  const [answersComment, setAnswersComment] = useState("");
  const [showAnswersFeedback, setShowAnswersFeedback] = useState(false);

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

  const updateQuestionField = (id: number, field: keyof QuestionField, value: string | number) => {
    setQuestionFields(
      questionFields.map((q) => {
        if (q.id !== id) return q;
        // Set default values when changing limit type
        if (field === "limitType") {
          const limitType = value as QuestionField["limitType"];
          const newLimitValue =
            limitType === "words" ? 10 : limitType === "characters" ? 200 : q.limitValue;
          return { ...q, limitType, limitValue: newLimitValue };
        }
        if (field === "limitValue") {
          return { ...q, limitValue: value as number };
        }
        return { ...q, [field]: value };
      }),
    );
  };

  const handleGenerateAnswers = async () => {
    const filledQuestions = questionFields.filter((q) => q.question.trim());
    if (filledQuestions.length === 0) {
      setError("Please enter at least one question.");
      return;
    }

    // Store combined questions for context/regeneration
    const combinedQuestions = filledQuestions.map((q) => q.question).join("\n\n");
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
          masterContext: masterContext,
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
    const setLoading = type === "cold" ? setIsGeneratingColdEmail : setIsGeneratingReferenceEmail;
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
          masterContext: masterContext,
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
      setError(
        `Failed to generate ${emailType}: ${message}. Please ensure you have loaded your resume and cover letter.`,
      );
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
          masterContext: masterContext,
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar title="Step 3: Q&A">
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
            <button
              onClick={() => router.push("/tailored")}
              className="hover:bg-surface-hover text-muted hover:text-foreground flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                ✓
              </span>
              Review
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
                3
              </span>
              Q&A
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="space-y-3 border-b border-gray-100 p-4">
          <Button
            onClick={() => router.push("/jobs")}
            variant="secondary"
            className="w-full py-2 text-xs"
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
            View Companies
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Context Status */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Context Loaded</label>
            <div className="flex flex-wrap gap-2">
              {tailoredResume && (
                <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  Resume
                </span>
              )}
              {tailoredCoverLetter && (
                <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  Cover Letter
                </span>
              )}
              {jobDescription && (
                <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Job Desc
                </span>
              )}
              {(masterContext || questionsCompanyInfo) && (
                <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                  Company Info
                </span>
              )}
            </div>
          </div>

          {/* Company Info Config */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Company Info</label>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-primary text-xs hover:underline"
              >
                {showConfig ? "Hide" : "Edit"}
              </button>
            </div>
            {showConfig && (
              <textarea
                className="input-field text-sm"
                placeholder="Add company info, mission, values..."
                value={questionsCompanyInfo}
                onChange={(e) => setQuestionsCompanyInfo(e.target.value)}
                rows={3}
              />
            )}
          </div>

          {/* Email Generation */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Outreach Emails</label>
            <div className="space-y-2">
              <Button
                onClick={() => handleGenerateEmail("cold")}
                disabled={isGeneratingColdEmail}
                variant={coldEmail ? "secondary" : "primary"}
                className="w-full py-2 text-xs"
              >
                {isGeneratingColdEmail ? (
                  <>
                    <span className="spinner-small" />
                    Generating...
                  </>
                ) : coldEmail ? (
                  <>
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
                    Regenerate Cold Email
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
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Cold Email
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleGenerateEmail("reference")}
                disabled={isGeneratingReferenceEmail}
                variant={referenceEmail ? "secondary" : "primary"}
                className="w-full py-2 text-xs"
              >
                {isGeneratingReferenceEmail ? (
                  <>
                    <span className="spinner-small" />
                    Generating...
                  </>
                ) : referenceEmail ? (
                  <>
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
                    Regenerate Reference Ask
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
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Reference Ask
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Generated Emails Preview */}
          {(coldEmail || referenceEmail) && (
            <div className="space-y-3">
              {coldEmail && (
                <div className="bg-surface-hover border-card-border rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted text-xs font-medium">Cold Email</span>
                    <CopyButton text={coldEmail} label="Copy" />
                  </div>
                  <p className="text-foreground line-clamp-3 text-xs">
                    {coldEmail.slice(0, 150)}...
                  </p>
                </div>
              )}
              {referenceEmail && (
                <div className="bg-surface-hover border-card-border rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted text-xs font-medium">Reference Ask</span>
                    <CopyButton text={referenceEmail} label="Copy" />
                  </div>
                  <p className="text-foreground line-clamp-3 text-xs">
                    {referenceEmail.slice(0, 150)}...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Sidebar>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Questions */}
          <div className="border-card-border flex w-1/2 flex-col overflow-hidden border-r">
            <div className="border-card-border bg-surface-hover/30 border-b p-4">
              <div className="flex items-center justify-between">
                <label className="section-label m-0">Your Questions</label>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {questionFields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-background/50 border-card-border/50 rounded-lg border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted text-xs font-medium">Question {index + 1}</span>
                    {questionFields.length > 1 && (
                      <button
                        onClick={() => removeQuestionField(field.id)}
                        className="text-muted p-1 transition-colors hover:text-red-400"
                        title="Remove question"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex items-start gap-3">
                    <textarea
                      className="input-field flex-1 font-sans text-sm"
                      placeholder="Enter your question..."
                      value={field.question}
                      onChange={(e) => updateQuestionField(field.id, "question", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    {[
                      { value: "none", label: "No Limit" },
                      { value: "words", label: "Words" },
                      { value: "characters", label: "Chars" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateQuestionField(field.id, "limitType", opt.value)}
                        className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                          field.limitType === opt.value
                            ? "bg-primary text-white"
                            : "bg-surface-hover text-muted hover:bg-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {field.limitType !== "none" && (
                    <input
                      type="number"
                      value={field.limitValue}
                      onChange={(e) =>
                        updateQuestionField(
                          field.id,
                          "limitValue",
                          Math.max(1, parseInt(e.target.value) || 1),
                        )
                      }
                      className="border-card-border focus:border-primary mt-2 w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
                      min="1"
                    />
                  )}
                </div>
              ))}

              {/* Add Question Button - Centered */}
              <div className="flex justify-center pt-2">
                <Button
                  onClick={addQuestionField}
                  variant="ghost"
                  className="border-card-border hover:border-primary/50 text-muted hover:text-primary rounded-xl border-2 px-4 py-4 text-xs"
                >
                  + Add Question
                </Button>
              </div>
            </div>

            <div className="border-card-border bg-surface-hover/30 border-t p-4">
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
          </div>

          {/* Right Panel - Answers */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <div className="border-card-border bg-surface-hover/30 border-b p-4">
              <div className="flex items-center justify-between">
                <label className="section-label m-0">Generated Answers</label>
                <div className="flex items-center gap-2">
                  {generatedAnswers && (
                    <>
                      <CopyButton text={generatedAnswers} label="Copy All" />
                      <Button
                        onClick={() => setShowAnswersFeedback(!showAnswersFeedback)}
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
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {generatedAnswers ? (
                <div className="space-y-4">
                  {(() => {
                    const answerBlocks = generatedAnswers
                      .split(/(?=Answer\s*\d+[:\.])/i)
                      .filter((block) => block.trim());

                    if (answerBlocks.length <= 1) {
                      const altBlocks = generatedAnswers.split(/\n\n(?=\d+[\.\):]|\*\*)/);
                      if (altBlocks.length > 1) {
                        return altBlocks.map((block, index) => (
                          <div
                            key={index}
                            className="bg-background/50 border-card-border/50 rounded-lg border p-4"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <span className="text-primary text-xs font-semibold">
                                Answer {index + 1}
                              </span>
                              <CopyButton text={block.trim()} label="Copy" />
                            </div>
                            <div className="prose max-w-none font-sans text-sm whitespace-pre-wrap">
                              {block.trim()}
                            </div>
                          </div>
                        ));
                      }
                      return (
                        <div className="bg-background/50 border-card-border/50 rounded-lg border p-4">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <span className="text-primary text-xs font-semibold">Answer</span>
                            <CopyButton text={generatedAnswers.trim()} label="Copy" />
                          </div>
                          <div className="prose max-w-none font-sans text-sm whitespace-pre-wrap">
                            {generatedAnswers}
                          </div>
                        </div>
                      );
                    }

                    return answerBlocks.map((block, index) => {
                      const cleanBlock = block.replace(/^Answer\s*\d+[:\.]?\s*/i, "").trim();
                      return (
                        <div
                          key={index}
                          className="bg-background/50 border-card-border/50 rounded-lg border p-4"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <span className="text-primary text-xs font-semibold">
                              Answer {index + 1}
                            </span>
                            <CopyButton text={cleanBlock} label="Copy" />
                          </div>
                          <div className="prose max-w-none font-sans text-sm whitespace-pre-wrap">
                            {cleanBlock}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted mb-4"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-muted-light italic">Your answers will appear here...</p>
                </div>
              )}
            </div>

            {/* Answers Regenerate Feedback */}
            {showAnswersFeedback && generatedAnswers && (
              <div className="border-card-border bg-surface-hover/30 border-t p-4">
                <label className="text-muted mb-2 block text-xs font-medium">
                  What changes would you like?
                </label>
                <textarea
                  value={answersComment}
                  onChange={(e) => setAnswersComment(e.target.value)}
                  placeholder="e.g., Make the answers more concise..."
                  className="regenerate-input mb-3"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setShowAnswersFeedback(false);
                      setAnswersComment("");
                    }}
                    variant="secondary"
                    className="px-3 py-2 text-xs"
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
      </main>

      {/* Error Notification */}
      {error && (
        <div className="glass-card fade-in fixed right-6 bottom-6 z-50 max-w-sm border-2 border-red-300 bg-red-50 p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-semibold text-red-700">Error</p>
              <p className="text-xs leading-relaxed text-red-600">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="shrink-0 rounded p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              title="Dismiss"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
