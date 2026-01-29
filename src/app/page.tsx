"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import Button from "@/components/Button";

const RESUME_TEMPLATE_KEY = "resume_template_latex";
const COVER_LETTER_TEMPLATE_KEY = "cover_letter_template_latex";

export default function Home() {
  const router = useRouter();
  const {
    resumeLatex,
    setResumeLatex,
    coverLetterLatex,
    setCoverLetterLatex,
    jobDescription,
    setJobDescription,
    personalDetails,
    setPersonalDetails,
    companyInfo,
    setCompanyInfo,
    companyName,
    setCompanyName,
    companyUrl,
    setCompanyUrl,
    positionTitle,
    setPositionTitle,
    isResearching,
    setIsResearching,
    setTailoredResume,
    setTailoredCoverLetter,
    tailoredResume,
    tailoredCoverLetter,
    isGeneratingTailored,
    setIsGeneratingTailored,
  } = useAppContext();

  const [error, setError] = useState<string | null>(null);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [tempResumeTemplate, setTempResumeTemplate] = useState("");
  const [tempCoverLetterTemplate, setTempCoverLetterTemplate] = useState("");

  const handleResearch = async () => {
    if (!companyName || !positionTitle || !jobDescription) {
      setError("Please fill in company name, position title, and job description to research.");
      return;
    }

    setError(null);

    // If company info is already filled, skip research and go directly to generation
    if (companyInfo.trim()) {
      if (resumeLatex && jobDescription) {
        await triggerGenerate(companyInfo);
      }
      return;
    }

    setIsResearching(true);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyUrl,
          positionTitle,
          jobDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to research company");
      }

      // Save research to Company Information field
      setCompanyInfo(data.research);
      
      // Stop researching state before starting generation
      setIsResearching(false);
      
      // Auto-trigger generation after research is complete, passing research directly
      // All fields should be valid since we already validated companyName, positionTitle, jobDescription above
      if (resumeLatex && jobDescription) {
        await triggerGenerate(data.research);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during research");
      setIsResearching(false);
    }
  };

  const triggerGenerate = async (research?: string) => {
    if (!resumeLatex || !jobDescription) {
      setError(
        "Please fill in your resume and job description.",
      );
      return;
    }

    setError(null);
    setIsGeneratingTailored(true);

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeLatex,
          jobDescription,
          personalDetails,
          companyInfo: research ?? companyInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate tailored documents");
      }

      setTailoredResume(data.tailoredResume);
      setTailoredCoverLetter(""); // Clear any previous cover letter - will be generated on-demand
      router.push("/tailored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGeneratingTailored(false);
    }
  };

  const handleLoadTemplate = () => {
    // Try to load templates from localStorage
    const savedResume = localStorage.getItem(RESUME_TEMPLATE_KEY);
    const savedCoverLetter = localStorage.getItem(COVER_LETTER_TEMPLATE_KEY);

    if (savedResume && savedCoverLetter) {
      setResumeLatex(savedResume);
      setCoverLetterLatex(savedCoverLetter);
    } else {
      // Show upload modal if templates not found in localStorage
      setShowTemplateUpload(true);
    }
  };

  const handleSaveTemplates = () => {
    if (!tempResumeTemplate.trim() || !tempCoverLetterTemplate.trim()) {
      alert("Please provide both Resume and Cover Letter LaTeX templates.");
      return;
    }

    // Save to localStorage
    localStorage.setItem(RESUME_TEMPLATE_KEY, tempResumeTemplate);
    localStorage.setItem(COVER_LETTER_TEMPLATE_KEY, tempCoverLetterTemplate);

    // Load into current form
    setResumeLatex(tempResumeTemplate);
    setCoverLetterLatex(tempCoverLetterTemplate);

    // Clear temp and close modal
    setTempResumeTemplate("");
    setTempCoverLetterTemplate("");
    setShowTemplateUpload(false);
  };

  const handleClearStoredTemplates = () => {
    localStorage.removeItem(RESUME_TEMPLATE_KEY);
    localStorage.removeItem(COVER_LETTER_TEMPLATE_KEY);
    alert("Stored templates have been cleared.");
  };

  const isValid =
    resumeLatex &&
    jobDescription &&
    companyName &&
    positionTitle;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={1} />

      <div className="max-w-6xl mx-auto">

        {/* Form */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Resume LaTeX */}
          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.05s" }}
          >
            <label className="section-label">Resume (LaTeX)</label>
            <textarea
              className="input-field h-56 font-mono text-sm"
              placeholder="Paste your resume LaTeX code here..."
              value={resumeLatex}
              onChange={(e) => setResumeLatex(e.target.value)}
            />
          </div>

          {/* Cover Letter LaTeX */}
          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <label className="section-label">Cover Letter (LaTeX)</label>
            <textarea
              className="input-field h-56 font-mono text-sm"
              placeholder="Paste your cover letter LaTeX code here..."
              value={coverLetterLatex}
              onChange={(e) => setCoverLetterLatex(e.target.value)}
            />
          </div>

          {/* Job Description */}
          <div
            className="glass-card p-5 fade-in lg:col-span-2"
            style={{ animationDelay: "0.15s" }}
          >
            <label className="section-label">Job Description</label>
            <textarea
              className="input-field h-40"
              placeholder="Paste the full job description including title, responsibilities, and requirements..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          {/* Company Name, URL, and Position Title - Single Row */}
          <div
            className="glass-card p-5 fade-in lg:col-span-2"
            style={{ animationDelay: "0.18s" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="section-label">Company Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Google, Microsoft, Amazon..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="section-label">
                  Company URL{" "}
                  <span className="text-muted-light font-normal normal-case">
                    (for accurate research)
                  </span>
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="e.g., https://www.google.com"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="section-label">Position Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Software Engineer, Product Manager..."
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <label className="section-label">
              Personal Details{" "}
              <span className="text-muted-light font-normal normal-case">
                (optional)
              </span>
            </label>
            <textarea
              className="input-field h-32"
              placeholder="Key achievements, certifications, or specific experience to highlight..."
              value={personalDetails}
              onChange={(e) => setPersonalDetails(e.target.value)}
            />
          </div>

          {/* Company Info */}
          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.25s" }}
          >
            <label className="section-label">
              Company Information{" "}
              <span className="text-muted-light font-normal normal-case">
                (Research will auto-fill this)
              </span>
            </label>
            <textarea
              className="input-field h-32"
              placeholder="Company mission, values, recent news, or why you want to work there..."
              value={companyInfo}
              onChange={(e) => setCompanyInfo(e.target.value)}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="glass-card p-4 mt-5 border-red-200 bg-red-50 fade-in">
            <p className="text-red-600 text-center text-sm">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div
          className="mt-8 flex flex-col sm:flex-row justify-center gap-3 fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <Button
            onClick={handleLoadTemplate}
            variant="secondary"
            className="text-base px-6 py-3"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Load Template
          </Button>

          {tailoredResume && tailoredCoverLetter && (
            <Button
              onClick={() => router.push("/tailored")}
              variant="secondary"
              className="text-sm px-6 py-3"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View Existing
            </Button>
          )}

          <Button
            onClick={handleResearch}
            disabled={!isValid || isResearching || isGeneratingTailored}
            variant="primary"
            className="text-base px-8 py-3"
            title="Research the company and generate tailored documents"
          >
            {isResearching ? (
              <>
                <span className="spinner" />
                Researching...
              </>
            ) : isGeneratingTailored ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                Research &amp; Generate
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </Button>
        </div>
        {!isValid && (
          <p className="text-muted text-sm mt-3 text-center">
            Fill in resume, cover letter, and job description to continue
          </p>
        )}
      </div>

      {/* Template Upload Modal */}
      {showTemplateUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Upload LaTeX Templates</h2>
              <Button
                onClick={() => setShowTemplateUpload(false)}
                variant="ghost"
                className="text-muted hover:text-foreground"
                aria-label="Close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
            
            <p className="text-muted mb-4">
              No saved templates found in your browser. Please paste your Resume and Cover Letter LaTeX templates below. 
              These will be saved locally in your browser for future use.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="section-label">Resume Template (LaTeX)</label>
                <textarea
                  className="input-field h-64 font-mono text-sm"
                  placeholder="Paste your resume LaTeX template here..."
                  value={tempResumeTemplate}
                  onChange={(e) => setTempResumeTemplate(e.target.value)}
                />
              </div>
              <div>
                <label className="section-label">Cover Letter Template (LaTeX)</label>
                <textarea
                  className="input-field h-64 font-mono text-sm"
                  placeholder="Paste your cover letter LaTeX template here..."
                  value={tempCoverLetterTemplate}
                  onChange={(e) => setTempCoverLetterTemplate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowTemplateUpload(false)}
                variant="secondary"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplates}
                variant="primary"
                className="px-4 py-2"
                disabled={!tempResumeTemplate.trim() || !tempCoverLetterTemplate.trim()}
              >
                Save &amp; Load Templates
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
