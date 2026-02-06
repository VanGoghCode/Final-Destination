import { NextResponse } from "next/server";
import { tailorResume, extractJobLocationInfo } from "@/lib/gemini";
import {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  sanitizeLatex,
  sanitizeJobDescription,
  sanitizePersonalDetails,
  sanitizeForAI,
} from "@/lib/sanitize";
import type { AIProvider } from "@/lib/ai-providers/types";

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(
      `tailor_${clientId}`,
      RATE_LIMITS.AI_GENERATION,
    );

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
      resumeLatex,
      jobDescription,
      personalDetails,
      companyInfo,
      companyName,
      tailoringProvider,
    } = body;

    if (!resumeLatex || !jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate tailoringProvider (default to claude)
    const provider: AIProvider =
      tailoringProvider === "claude" || tailoringProvider === "gemini"
        ? tailoringProvider
        : "claude";

    // Sanitize inputs
    const sanitizedResume = sanitizeLatex(resumeLatex);
    const sanitizedJobDescription = sanitizeJobDescription(jobDescription);
    const sanitizedPersonalDetails = sanitizePersonalDetails(
      personalDetails || "",
    );
    const sanitizedCompanyInfo = sanitizeForAI(companyInfo || "");

    // Run resume tailoring and location extraction in parallel
    const [tailoredResume, locationInfo] = await Promise.all([
      tailorResume(
        sanitizedResume,
        sanitizedJobDescription,
        sanitizedPersonalDetails,
        sanitizedCompanyInfo,
        provider,
      ),
      extractJobLocationInfo(sanitizedJobDescription, companyName || ""),
    ]);

    return NextResponse.json({
      tailoredResume,
      jobCountry: locationInfo.country,
      jobWorkMode: locationInfo.workMode,
    });
  } catch (error) {
    console.error("Error tailoring resume:", error);
    return NextResponse.json(
      {
        error:
          "Failed to tailor resume. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
