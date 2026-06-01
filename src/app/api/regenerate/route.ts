import { NextResponse } from "next/server";
import {
  regenerateResume,
  regenerateCoverLetter,
  regenerateAnswers,
  regenerateEmail,
} from "@/lib/ai";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

export type RegenerateType = "resume" | "coverLetter" | "answers" | "coldEmail" | "referenceEmail";

interface RegenerateRequest {
  type: RegenerateType;
  currentContent: string;
  comment: string;
  // Context for regeneration
  resumeLatex?: string;
  coverLetterLatex?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  jobDescription?: string;
  personalDetails?: string;
  masterContext?: string;
  companyName?: string;
  positionTitle?: string;
  questions?: string;
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`regenerate_${clientId}`, RATE_LIMITS.AI_GENERATION);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body: RegenerateRequest = await request.json();
    const {
      type,
      currentContent,
      comment,
      resumeLatex,
      coverLetterLatex,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      personalDetails,
      masterContext,
      companyName,
      positionTitle,
      questions,
    } = body;

    if (!currentContent || !comment) {
      return NextResponse.json(
        { error: "Current content and comment are required" },
        { status: 400 },
      );
    }

    let regeneratedContent: string;

    switch (type) {
      case "resume":
        if (!resumeLatex || !jobDescription) {
          return NextResponse.json(
            { error: "Resume LaTeX and job description are required for resume regeneration" },
            { status: 400 },
          );
        }
        regeneratedContent = await regenerateResume(
          currentContent,
          comment,
          resumeLatex,
          jobDescription,
          personalDetails || "",
          masterContext || "",
        );
        break;

      case "coverLetter":
        if (!coverLetterLatex || !jobDescription) {
          return NextResponse.json(
            { error: "Cover letter LaTeX and job description are required" },
            { status: 400 },
          );
        }
        regeneratedContent = await regenerateCoverLetter(
          currentContent,
          comment,
          coverLetterLatex,
          jobDescription,
          personalDetails || "",
          masterContext || "",
        );
        break;

      case "answers":
        if (!tailoredResume || !tailoredCoverLetter || !questions) {
          return NextResponse.json(
            { error: "Tailored resume, cover letter, and questions are required" },
            { status: 400 },
          );
        }
        regeneratedContent = await regenerateAnswers(
          currentContent,
          comment,
          questions,
          tailoredResume,
          tailoredCoverLetter,
          jobDescription || "",
          masterContext || "",
        );
        break;

      case "coldEmail":
      case "referenceEmail":
        if (!tailoredResume || !tailoredCoverLetter) {
          return NextResponse.json(
            { error: "Tailored resume and cover letter are required" },
            { status: 400 },
          );
        }
        regeneratedContent = await regenerateEmail(
          type,
          currentContent,
          comment,
          tailoredResume,
          tailoredCoverLetter,
          jobDescription || "",
          masterContext || "",
          positionTitle || "",
          companyName || "",
        );
        break;

      default:
        return NextResponse.json({ error: "Invalid regeneration type" }, { status: 400 });
    }

    return NextResponse.json({ regeneratedContent });
  } catch (error) {
    console.error("Error regenerating content:", error);
    return NextResponse.json(
      {
        error: "Failed to regenerate content. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
