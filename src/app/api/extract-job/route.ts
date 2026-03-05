import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.1-pro-preview";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const { pageTitle, pageUrl, pageContent } = await request.json();

    if (!pageTitle && !pageUrl) {
      return NextResponse.json(
        { error: "Page title or URL required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500, headers: corsHeaders() },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a job listing analyzer with web search capabilities. Extract accurate information from this job page.

## PAGE INFORMATION:
- Title: ${pageTitle || "Not provided"}
- URL: ${pageUrl || "Not provided"}
${pageContent ? `- Page Content (first 2000 chars): ${pageContent.slice(0, 2000)}` : ""}

## EXTRACTION RULES:
1. **companyName**: Extract the ACTUAL company name, NOT the job portal name.
   - Remove suffixes like "Careers", "Jobs", "Hiring", "– Work with us"
   - Extract from the URL domain structure
   - NEVER return portal names like "LinkedIn", "Indeed", "Glassdoor", "Lever", "Greenhouse"

2. **positionTitle**: Extract the exact job title/position
   - Clean up any extra text like "| LinkedIn" or "- Apply Now"
   - Keep the full role title

3. **companyUrl**: Find the company's MAIN website (for research purposes)
   - NOT the job posting URL
   - Use web search to confirm the correct company website if unsure

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

Use web search to verify company information. Be accurate and truthful.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";

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
          { headers: corsHeaders() },
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
        confidence: {
          companyName: "low",
          positionTitle: "low",
          companyUrl: "low",
        },
      },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error("[extract-job] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract job info" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
