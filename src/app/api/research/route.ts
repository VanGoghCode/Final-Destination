import { NextResponse } from "next/server";
import { researchCompany } from "@/lib/gemini";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeCompanyName, sanitizeUrl, sanitizeJobDescription, sanitizeForAI } from "@/lib/sanitize";

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`research_${clientId}`, RATE_LIMITS.RESEARCH);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          }
        },
      );
    }

    const body = await request.json();
    const { companyName, companyUrl, positionTitle, jobDescription } = body;

    if (!companyName || !positionTitle || !jobDescription) {
      return NextResponse.json(
        { error: "Company name, position title, and job description are required" },
        { status: 400 },
      );
    }

    // Sanitize inputs
    const sanitizedCompanyName = sanitizeCompanyName(companyName);
    const sanitizedCompanyUrl = sanitizeUrl(companyUrl || "");
    const sanitizedPositionTitle = sanitizeForAI(positionTitle);
    const sanitizedJobDescription = sanitizeJobDescription(jobDescription);

    const research = await researchCompany(
      sanitizedCompanyName, 
      sanitizedCompanyUrl || undefined, 
      sanitizedPositionTitle, 
      sanitizedJobDescription
    );

    return NextResponse.json({
      success: true,
      research,
    });
  } catch (error) {
    console.error("Error researching company:", error);
    return NextResponse.json(
      {
        error: "Failed to research company. Please try again.",
      },
      { status: 500 },
    );
  }
}
