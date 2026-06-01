import { NextResponse } from "next/server";
import { tailorResume, extractJobLocationInfo } from "@/lib/ai";
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
    const rateLimitResult = checkRateLimit(`tailor_${clientId}`, RATE_LIMITS.AI_GENERATION);

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
      masterContext,
      manualResearch,
      companyName,
    } = body;

    if (!resumeLatex || !jobDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sanitizedResume = sanitizeLatex(resumeLatex);
    const sanitizedJobDescription = sanitizeJobDescription(jobDescription);
    const sanitizedPersonalDetails = sanitizePersonalDetails(personalDetails || "");
    const sanitizedMasterContext = sanitizeForAI(masterContext || "");
    const sanitizedManualResearch = manualResearch ? sanitizeForAI(manualResearch) : undefined;

    const [tailoredResume, locationInfo] = await Promise.all([
      tailorResume(
        sanitizedResume,
        sanitizedJobDescription,
        sanitizedPersonalDetails,
        sanitizedMasterContext,
        sanitizedManualResearch,
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
      { error: "Failed to tailor resume. Please try again." },
      { status: 500 },
    );
  }
}
