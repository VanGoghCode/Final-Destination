import { NextResponse } from "next/server";
import { tailorCoverLetter } from "@/lib/ai";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import {
  sanitizeLatex,
  sanitizeJobDescription,
  sanitizePersonalDetails,
  sanitizeForAI,
} from "@/lib/sanitize";

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`tailor_cl_${clientId}`, RATE_LIMITS.AI_GENERATION);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    const body = await request.json();
    const {
      coverLetterLatex,
      jobDescription,
      personalDetails,
      masterContext,
      manualResearch,
      tailoredResume,
    } = body;

    if (!coverLetterLatex || !jobDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tailoredCoverLetter = await tailorCoverLetter(
      sanitizeLatex(coverLetterLatex),
      sanitizeJobDescription(jobDescription),
      sanitizePersonalDetails(personalDetails || ""),
      sanitizeForAI(masterContext || ""),
      manualResearch ? sanitizeForAI(manualResearch) : undefined,
      tailoredResume ? sanitizeLatex(tailoredResume) : undefined,
    );

    return NextResponse.json({ tailoredCoverLetter });
  } catch (error) {
    console.error("Error tailoring cover letter:", error);

    if (error instanceof Error) {
      if (error.message.includes("429") || error.message.includes("rate")) {
        return NextResponse.json(
          { error: "AI service is busy. Please try again in a moment." },
          { status: 429 },
        );
      }
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "The AI service took too long to respond. Please try again." },
          { status: 504 },
        );
      }
      if (error.message.includes("Invalid input")) {
        return NextResponse.json(
          { error: "The cover letter or job description contains invalid content." },
          { status: 400 },
        );
      }
      console.error("[CoverLetter] Full error:", error.message, error.stack);
    }

    return NextResponse.json({ error: "Failed to tailor cover letter." }, { status: 500 });
  }
}
