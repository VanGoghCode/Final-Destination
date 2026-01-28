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
    { id: 1, question: "", limitType: "none", limitValue: 100 },
    { id: 2, question: "", limitType: "none", limitValue: 100 },
    { id: 3, question: "", limitType: "none", limitValue: 100 },
  ]);
  const [nextId, setNextId] = useState(4);

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
      { id: nextId, question: "", limitType: "none", limitValue: 100 },
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
      questionFields.map((q) =>
        q.id === id ? { ...q, [field]: value } : q
      )
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
      setError(err instanceof Error ? err.message : "An error occurred");
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
      setError(err instanceof Error ? err.message : "An error occurred");
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
      setError(err instanceof Error ? err.message : "An error occurred");
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
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={3} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 fade-in">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Application Questions
          </h1>
          <p className="text-muted text-base">
            Get answers aligned with the company&apos;s values and your
            experience
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Questions Input */}
          <div
            className="glass-card p-5 fade-in flex flex-col h-full"
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

            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: "400px" }}>
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
                  <textarea
                    className="input-field min-h-16 mb-2 font-sans text-sm"
                    placeholder="Enter your question..."
                    value={field.question}
                    onChange={(e) => updateQuestionField(field.id, "question", e.target.value)}
                    rows={2}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Limit:</label>
                      <select
                        value={field.limitType}
                        onChange={(e) =>
                          updateQuestionField(field.id, "limitType", e.target.value)
                        }
                        className="input-field text-xs py-1 px-2 w-auto"
                      >
                        <option value="none">No limit</option>
                        <option value="words">Words</option>
                        <option value="characters">Characters</option>
                      </select>
                    </div>
                    {field.limitType !== "none" && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted">Max:</label>
                        <input
                          type="number"
                          value={field.limitValue}
                          onChange={(e) =>
                            updateQuestionField(field.id, "limitValue", parseInt(e.target.value) || 0)
                          }
                          className="input-field text-xs py-1 px-2 w-20"
                          min="1"
                          placeholder="100"
                        />
                        <span className="text-xs text-muted-light">{field.limitType}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={addQuestionField}
              variant="ghost"
              className="w-full mb-3 text-sm border border-dashed border-card-border hover:border-primary/50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Another Question
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
            className="glass-card p-4 sm:p-5 fade-in flex flex-col h-full"
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

            <div className="flex-1 output-panel p-4 sm:p-5 overflow-y-auto whitespace-pre-wrap min-h-64 sm:min-h-80">
              {generatedAnswers ? (
                <div className="prose max-w-none text-sm font-sans">
                  {generatedAnswers}
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

      {/* Simplified Error Notification */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-xs glass-card p-4 border-red-200 bg-red-50 shadow-lg fade-in z-50">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}
    </main>
  );
}
