import { NextResponse } from "next/server";
import { DeepSeekProvider } from "@/lib/ai-providers/deepseek";
import { corsHeaders } from "@/lib/cors";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

function h() {
  return corsHeaders("POST, OPTIONS");
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: h() });
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`extract_job_${clientId}`, RATE_LIMITS.RESEARCH);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const { pageTitle, pageUrl, pageContent } = await request.json();

    if (!pageTitle && !pageUrl) {
      return NextResponse.json(
        { error: "Page title or URL required" },
        { status: 400, headers: h() },
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500, headers: h() });
    }

    const prompt = `You are a job listing analyzer. Extract accurate information from this job page.

## PAGE INFORMATION:
- Title: ${pageTitle || "Not provided"}
- URL: ${pageUrl || "Not provided"}
${pageContent ? `- Page Content (first 2000 chars): ${pageContent.slice(0, 2000)}` : ""}

## EXTRACTION RULES:
1. **companyName**: Extract the ACTUAL company name, NOT the job portal name.
   - Remove suffixes like "Careers", "Jobs", "Hiring", "\u2013 Work with us"
   - Extract from the URL domain structure
   - NEVER return portal names like "LinkedIn", "Indeed", "Glassdoor", "Lever", "Greenhouse"

2. **positionTitle**: Extract the exact job title/position
   - Clean up any extra text like "| LinkedIn" or "- Apply Now"
   - Keep the full role title

3. **companyUrl**: Find the company's MAIN website (for research purposes)
   - NOT the job posting URL
   - Use your training knowledge to confirm the correct company website if unsure

4. **confidence**: Rate your confidence for each field
   - "high" = certain this is correct
   - "medium" = likely correct but could verify
   - "low" = unsure, user should verify

## OUTPUT:
Return ONLY a JSON object:
{
  "companyName": "company name",
  "positionTitle": "job title",
  "companyUrl": "https://company-website.com",
  "confidence": {
    "companyName": "high|medium|low",
    "positionTitle": "high|medium|low",
    "companyUrl": "high|medium|low"
  }
}

Be accurate and truthful. Do NOT use markdown formatting. Output ONLY the JSON.`;

    // Use fast provider (no thinking needed for extraction, deterministic output)
    const fastProvider = DeepSeekProvider.createFast();
    const text = await fastProvider.generateContent(prompt);

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(
          {
            companyName: parsed.companyName || "",
            positionTitle: parsed.positionTitle || "",
            companyUrl: parsed.companyUrl || "",
            confidence: parsed.confidence || {
              companyName: "low",
              positionTitle: "low",
              companyUrl: "low",
            },
          },
          { headers: h() },
        );
      } catch {
        // JSON parse failed
      }
    }

    // Fallback
    return NextResponse.json(
      {
        companyName: "",
        positionTitle: "",
        companyUrl: "",
        confidence: { companyName: "low", positionTitle: "low", companyUrl: "low" },
      },
      { headers: h() },
    );
  } catch (error) {
    console.error("[extract-job] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract job info" },
      { status: 500, headers: h() },
    );
  }
}
