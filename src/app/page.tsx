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

  const handleLoadTemplate = () => {
    const defaultResume = `% ===== One-Page ATS-Optimized Cloud Solutions Architect Resume =====
\\documentclass[11pt]{article}

% --- Layout & spacing ---
\\usepackage[margin=0.3in]{geometry}
\\usepackage{parskip} % space between paragraphs, no indents
\\setlength{\\parskip}{0.35em}

% --- Encoding & links (better URL breaking with xurl) ---
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{xurl}
\\usepackage[unicode]{hyperref}
\\hypersetup{hidelinks}
\\setlength{\\emergencystretch}{2em} % help avoid overfull lines
\\usepackage[final]{microtype}      % gentler justification/hyphenation

% --- Font selection (ATS-safe): Times New Roman if Xe/LuaLaTeX, else TeX Gyre Termes ---
\\usepackage{ifxetex,ifluatex}
\\newif\\ifxetexorluatex
\\ifxetex\\xetexorluatextrue\\else\\ifluatex\\xetexorluatextrue\\else\\xetexorluatexfalse\\fi\\fi
\\ifxetexorluatex
  \\usepackage{fontspec}
  \\setmainfont{Times New Roman}
\\else
  \\usepackage{tgtermes}
\\fi

% --- Lists (compact, simple bullets) ---
\\usepackage{enumitem}
\\setlist[itemize]{itemsep=0pt, topsep=2pt, parsep=0pt, leftmargin=*, label=\\textbullet}

% --- Tables that wrap nicely ---
\\usepackage{tabularx}
\\setlength{\\tabcolsep}{4pt}

% --- Section & entry helpers ---
\\newcommand{\\sect}[1]{\\vspace{0.45em}\\textbf{\\large #1}\\vspace{0.15em}\\hrule\\vspace{0.1em}}
\\newcommand{\\roleentry}[4]{% Role, Org, Dates, Location
  \\textbf{#1} - #2 \\hfill \\textit{#3}\\\\%
  #4\\par
}

\\newcommand{\\eduentry}[4]{% Degree, School, Date, GPA
  \\textbf{#1} --- #2\\ [#4] \\hfill \\textit{#3}\\par
}

\\setlist[itemize]{itemsep=0pt, topsep=2pt, parsep=0pt,
  label=\\textbullet, labelsep=0.6em, leftmargin=1.6em}

\\begin{document}
\\pagestyle{empty}

% =======================
% Name & Contact (no header/footer)
% =======================
{\\Large \\textbf{KIRTANKUMAR THUMMAR}}\\par
Tempe, AZ \\,|\\, +1 (602) 804-1264 \\,|\\, \\href{mailto:kthumma5@asu.edu}{kthumma5@asu.edu} \\,|\\,
\\href{https://www.linkedin.com/in/kirtankumar-thummar/}{linkedin.com/in/kirtankumar-thummar} \\,|\\,
\\href{https://vctrx.cloud}{vctrx.cloud}

% =======================
% Summary
% =======================
\\sect{Summary}
Cloud Solutions Architect (3 years) delivering secure, cost-efficient, and resilient AWS architectures. Proven results in serverless and containers with Well-Architected practices and IaC that drive lower cost, higher reliability, and faster delivery.

% =======================
% Education
% =======================
\\sect{Education}
\\eduentry{M.S., Information Technology}{Arizona State University}{05/2026}{GPA: 4.00/4.00}
\\eduentry{B.E., Information Technology}{Gujarat Technological University}{04/2023}{GPA: 7.76/10.00}

% =======================
% Skills
% =======================
\\sect{Skills}
\\textbf{AWS:} Lambda, API Gateway, ECS Fargate, EC2, S3 (Lifecycle/Replication), DynamoDB, RDS/Aurora, VPC, CloudFront, Route~53, WAF, KMS, IAM, Organizations/Control Tower \\\\
\\textbf{DevOps/IaC:} Terraform, AWS CDK, CloudFormation, CodeBuild/CodePipeline, GitHub Actions, Docker \\\\
\\textbf{Data/Integration:} EventBridge, Step Functions, SQS/SNS, Glue, Athena \\\\
\\textbf{Languages:} Go, Python, TypeScript/Node.js, SQL

% =======================
% Experience
% =======================
\\sect{Work Experience}

\\roleentry{Founder \\& Principal Cloud Architect}{Vctrx}{11/2024 -- Present}{Tempe, AZ}
\\begin{itemize}
    \\item \\textbf{No-expert AWS platform}: Organizations/Control Tower, Identity Center, SCPs, VPC, centralized CloudTrail/Config; \\textit{target time-to-env $<$ 1h}.
    \\item \\textbf{GenAI infra copilot (in progress)}: Bedrock turns natural language into reviewed Terraform/CDK change sets with guardrails, plan/approve/rollback.
    \\item \\textbf{Self-service catalog}: serverless API, event pipeline, static edge; observability (CloudWatch\\slash{} X-Ray), FinOps (CUR\\ \\textrightarrow{}\\ Athena\\ \\textrightarrow{}\\ QuickSight), secure-by-default (KMS, WAF, Secrets).
\\end{itemize}

\\roleentry{Cloud Solutions Team Lead}{Braincuber}{02/2024 -- 08/2024}{Greater Surat Area}
\\begin{itemize}
  \\item Modernized services to \\textbf{ECS on Fargate} with ALB and blue/green deploys (CodeDeploy/CodePipeline); p95 latency improved \\textbf{45\\%}, error rate down \\textbf{70\\%}.
  \\item Delivered serverless APIs (API Gateway + Lambda + DynamoDB with GSIs, Step Functions, DLQs); handled \\textbf{6M+ events/month} with idempotency.
  \\item Ran Well-Architected Reviews across 4 workloads; closed \\textbf{35+} high-risk issues in 45 days (IAM least privilege, KMS-by-default, private subnets).
  \\item Reduced monthly AWS spend by \\textbf{28\\%} via S3 Lifecycle/Intelligent-Tiering, EBS gp3, Savings Plans.
\\end{itemize}

\\roleentry{Cloud Solutions Engineer}{Braincuber}{01/2023 -- 01/2024}{Greater Surat Area}
\\begin{itemize}
  \\item Implemented CI/CD (GitHub Actions $\\rightarrow$ CodeBuild/CodePipeline) and IaC (Terraform/CDK); environment provisioning time cut to \\textbf{under 2 hours}.
  \\item Deployed CloudFront + S3 static sites and API edge patterns; APAC TTFB reduced \\textbf{25\\%}.
  \\item Automated observability (CloudWatch dashboards/alarms, X-Ray tracing); MTTR reduced by \\textbf{~40\\%}.
\\end{itemize}

\\roleentry{Early Experience (Internships)}{Webito}{06/2021 -- 08/2022}{Remote / Greater Surat Area}
\\begin{itemize}
  \\item AI \\& Cloud Engineering Intern; Software Engineer Intern. Containerized Python/Node services; contributed to a serverless POC (API Gateway + Lambda + DynamoDB).
\\end{itemize}

\\end{document}`;

    const defaultCoverLetter = `% Digital Cover Letter - Minimalistic Design
\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{xcolor}

% Remove page numbers
\\pagestyle{empty}

% Hyperlink setup - black and white
\\hypersetup{
    colorlinks=true,
    linkcolor=black,
    urlcolor=black,
    pdfborder={0 0 0}
}

% Font settings
\\usepackage{lmodern}
\\renewcommand{\\familydefault}{\\sfdefault}

% Custom spacing
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.8em}

% Section formatting
\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries}
  {}{0em}{}[\\titlerule]

\\titlespacing*{\\section}{0pt}{1.5em}{0.5em}

\\begin{document}

% Header - Left Aligned
{\\Huge\\bfseries Kirtankumar Thummar}

\\vspace{0.3em}

{\\large
+1 (602) 804-1264 \\quad $\\cdot$ \\quad 
\\href{mailto:kthumma5@asu.edu}{kthumma5@asu.edu} \\quad $\\cdot$ \\quad
\\href{https://linkedin.com/in/kirtankumar-thummar}{linkedin.com/in/kirtankumar-thummar}
}

\\vspace{0.5em}
\\noindent\\rule{\\textwidth}{0.5pt}

\\vspace{1em}

% Recipient
\\textbf{Hiring Manager} \\\\
Lubrizol Corporation \\\\
29400 Lakeland Blvd \\\\
Wickliffe, OH 44092

\\vspace{1em}

% Subject line
\\textbf{RE:} Cloud Security Engineer Application

\\vspace{1.5em}

% Body
Lubrizol transforms industries through science and sustainability, and protecting the infrastructure that powers this innovation is a challenge I am eager to accept. As a security professional who understands that modern protection must be woven into the fabric of development rather than applied as a bandage, I am excited to apply for the Cloud Security Engineer role. My background in securing cloud-native environments and embedding resilience into the software lifecycle aligns perfectly with Lubrizol's mission to shape a safer future.

In my recent work, I have focused on strengthening global security postures across hybrid and cloud environments (AWS and Azure). I specialize in DevSecOps methodologies - collaborating closely with DevOps and application teams to integrate automated vulnerability assessments and security gates directly into CI/CD pipelines. By shifting security left, I have helped organizations reduce production vulnerabilities and accelerate remediation timelines. My experience extends to designing robust IAM policies, managing keys/secrets, and ensuring that infrastructure is "secure by design" before it ever reaches deployment.

I am deeply familiar with the rigor required to maintain compliance with international frameworks such as NIST, ISO 27001, and GDPR. I have successfully conducted risk evaluations and internal technical audits to identify blind spots, proactively mitigating threats before they impact business continuity. I combine this technical acumen with strong communication skills, allowing me to translate complex security risks into actionable insights for stakeholders and foster a culture where security is viewed as a shared responsibility.

I am eager to bring my expertise in threat monitoring, cloud architecture protection, and incident response to your team in Wickliffe. I am confident that my proactive approach to cybersecurity will help Lubrizol continue to deliver innovative solutions safely and reliably.

I would value the chance to discuss how I can help fortify Lubrizol's digital assets and contribute to your global security resilience. Thank you for your time and consideration.

\\vspace{1.5em}

% Signature
Sincerely,

\\vspace{0.5em}

\\textbf{Kirtankumar Thummar}

\\end{document}`;

    setResumeLatex(defaultResume);
    setCoverLetterLatex(defaultCoverLetter);
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
