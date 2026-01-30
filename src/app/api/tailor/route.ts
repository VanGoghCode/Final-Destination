import { NextResponse } from "next/server";
import { tailorResume, extractJobLocationInfo } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      resumeLatex,
      jobDescription,
      personalDetails,
      companyInfo,
      companyName,
    } = body;

    if (!resumeLatex || !jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Run resume tailoring and location extraction in parallel
    const [tailoredResume, locationInfo] = await Promise.all([
      tailorResume(
        resumeLatex,
        jobDescription,
        personalDetails,
        companyInfo || ""
      ),
      extractJobLocationInfo(jobDescription, companyName || ""),
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
