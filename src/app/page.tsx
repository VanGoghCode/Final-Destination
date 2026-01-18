"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import Navbar from "@/components/Navbar";

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
    positionTitle,
    setPositionTitle,
    setTailoredResume,
    setTailoredCoverLetter,
    tailoredResume,
    tailoredCoverLetter,
    isGeneratingTailored,
    setIsGeneratingTailored,
  } = useAppContext();

  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!resumeLatex || !coverLetterLatex || !jobDescription) {
      setError(
        "Please fill in your resume, cover letter, and job description.",
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
          coverLetterLatex,
          jobDescription,
          personalDetails,
          companyInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate tailored documents");
      }

      setTailoredResume(data.tailoredResume);
      setTailoredCoverLetter(data.tailoredCoverLetter);
      router.push("/tailored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGeneratingTailored(false);
    }
  };

  const handleLoadTemplate = async () => {
    try {
      // Try custom templates first, then fall back to example templates
      let resumeRes = await fetch("/templates/resume.tex");
      if (!resumeRes.ok) {
        resumeRes = await fetch("/templates/resume.example.tex");
      }

      let coverLetterRes = await fetch("/templates/cover-letter.tex");
      if (!coverLetterRes.ok) {
        coverLetterRes = await fetch("/templates/cover-letter.example.tex");
      }

      if (!resumeRes.ok || !coverLetterRes.ok) {
        throw new Error("Failed to load templates");
      }

      const resumeTemplate = await resumeRes.text();
      const coverLetterTemplate = await coverLetterRes.text();

      setResumeLatex(resumeTemplate);
      setCoverLetterLatex(coverLetterTemplate);
    } catch (err) {
      console.error("Error loading templates:", err);
      alert("Failed to load templates. Make sure template files exist.");
    }
  };

  const isValid =
    resumeLatex &&
    coverLetterLatex &&
    jobDescription &&
    companyName &&
    positionTitle;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Navbar currentStep={1} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 fade-in">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tailor Your Application
          </h1>
          <p className="text-muted text-base">
            Customize your resume and cover letter for any job with AI
          </p>
        </div>

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

          {/* Company Name and Position Title */}
          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.18s" }}
          >
            <label className="section-label">Company Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Google, Microsoft, Amazon..."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div
            className="glass-card p-5 fade-in"
            style={{ animationDelay: "0.18s" }}
          >
            <label className="section-label">Position Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Software Engineer, Product Manager..."
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
            />
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
                (optional)
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
          <button
            onClick={handleLoadTemplate}
            className="btn-secondary text-base px-6 py-3"
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
          </button>

          {tailoredResume && tailoredCoverLetter && (
            <button
              onClick={() => router.push("/tailored")}
              className="btn-secondary text-sm px-6 py-3"
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
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={!isValid || isGeneratingTailored}
            className="btn-primary text-base px-8 py-3"
          >
            {isGeneratingTailored ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                Generate Tailored Documents
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
          </button>
        </div>
        {!isValid && (
          <p className="text-muted text-sm mt-3 text-center">
            Fill in resume, cover letter, and job description to continue
          </p>
        )}
      </div>
    </main>
  );
}
