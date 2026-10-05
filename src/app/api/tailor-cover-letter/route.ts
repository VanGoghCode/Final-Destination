import { aiErrorResponse } from "@/lib/api-error";
import { withAIBudget } from "@/lib/ai-providers/http";
import { NextResponse } from "next/server";
import { tailorCoverLetter } from "@/lib/ai";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import {
  sanitizeLatex,
  sanitizeJobDescription,
  sanitizePersonalDetails,
  sanitizeForAI,
} from "@/lib/sanitize";

export const maxDuration = 300;
export function POST(request: Request) {
  return withAIBudget(285_000, () => generate(request), request.signal);
}
async function generate(request: Request) {
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
    return aiErrorResponse(error, "Failed to tailor cover letter. Please try again.");
  }
}
