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
  const [questionsCompanyInfo, setQuestionsCompanyInfo] = useState(
    masterContext || "",
  );
  const [coldEmail, setColdEmail] = useState("");
  const [referenceEmail, setReferenceEmail] = useState("");
  const [isGeneratingColdEmail, setIsGeneratingColdEmail] = useState(false);
  const [isGeneratingReferenceEmail, setIsGeneratingReferenceEmail] =
    useState(false);
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
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar title="Step 3: Q&A">
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
            <button
              onClick={() => router.push("/tailored")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
              Review
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-primary/10 border border-primary text-primary text-xs font-medium">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">3</span>
              Q&A
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <Button
            onClick={() => router.push("/jobs")}
            variant="secondary"
            className="w-full text-xs py-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 4h4v3h-4V4z" />
            </svg>
            View Companies
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Context Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Context Loaded</label>
            <div className="flex flex-wrap gap-2">
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
              {(masterContext || questionsCompanyInfo) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-medium">
                  Company Info
                </span>
              )}
            </div>
          </div>

          {/* Company Info Config */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Company Info</label>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-primary hover:underline"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Outreach Emails</label>
            <div className="space-y-2">
              <Button
                onClick={() => handleGenerateEmail("cold")}
                disabled={isGeneratingColdEmail}
                variant={coldEmail ? "secondary" : "primary"}
                className="w-full text-xs py-2"
              >
                {isGeneratingColdEmail ? (
                  <>
                    <span className="spinner-small" />
                    Generating...
                  </>
                ) : coldEmail ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Regenerate Cold Email
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                className="w-full text-xs py-2"
              >
                {isGeneratingReferenceEmail ? (
                  <>
                    <span className="spinner-small" />
                    Generating...
                  </>
                ) : referenceEmail ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Regenerate Reference Ask
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <div className="p-3 bg-surface-hover rounded-lg border border-card-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Cold Email</span>
                    <CopyButton text={coldEmail} label="Copy" />
                  </div>
                  <p className="text-xs text-foreground line-clamp-3">{coldEmail.slice(0, 150)}...</p>
                </div>
              )}
              {referenceEmail && (
                <div className="p-3 bg-surface-hover rounded-lg border border-card-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Reference Ask</span>
                    <CopyButton text={referenceEmail} label="Copy" />
                  </div>
                  <p className="text-xs text-foreground line-clamp-3">{referenceEmail.slice(0, 150)}...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Questions */}
          <div className="w-1/2 flex flex-col overflow-hidden border-r border-card-border">
            <div className="p-4 border-b border-card-border bg-surface-hover/30">
              <div className="flex items-center justify-between">
                <label className="section-label m-0">Your Questions</label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <div className="flex items-start gap-3">
                    <textarea
                      className="input-field flex-1 font-sans text-sm"
                      placeholder="Enter your question..."
                      value={field.question}
                      onChange={(e) => updateQuestionField(field.id, "question", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[
                      { value: "none", label: "No Limit" },
                      { value: "words", label: "Words" },
                      { value: "characters", label: "Chars" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateQuestionField(field.id, "limitType", opt.value)}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-all ${
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
                        updateQuestionField(field.id, "limitValue", Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-full mt-2 px-3 py-1.5 text-sm rounded-lg border border-card-border focus:border-primary outline-none"
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
                  className="text-xs py-4 px-4 border-2 border-card-border hover:border-primary/50 text-muted hover:text-primary rounded-xl"
                >
                  + Add Question
                </Button>
              </div>
            </div>

            <div className="p-4 border-t border-card-border bg-surface-hover/30">
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
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-card-border bg-surface-hover/30">
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
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
                    const answerBlocks = generatedAnswers.split(/(?=Answer\s*\d+[:\.])/i).filter(block => block.trim());
                    
                    if (answerBlocks.length <= 1) {
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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted mb-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-muted-light italic">
                    Your answers will appear here...
                  </p>
                </div>
              )}
            </div>

            {/* Answers Regenerate Feedback */}
            {showAnswersFeedback && generatedAnswers && (
              <div className="p-4 border-t border-card-border bg-surface-hover/30">
                <label className="text-xs font-medium text-muted mb-2 block">
                  What changes would you like?
                </label>
                <textarea
                  value={answersComment}
                  onChange={(e) => setAnswersComment(e.target.value)}
                  placeholder="e.g., Make the answers more concise..."
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
      </main>

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
    </div>
  );
}
