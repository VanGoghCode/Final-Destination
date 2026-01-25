import { NextResponse } from "next/server";
import { tailorResume, tailorCoverLetter } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      resumeLatex,
      coverLetterLatex,
      jobDescription,
      personalDetails,
      companyInfo,
    } = body;

    if (!resumeLatex || !coverLetterLatex || !jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Generate both tailored documents in parallel
    // companyInfo now contains the research data
    const [tailoredResume, tailoredCoverLetter] = await Promise.all([
      tailorResume(resumeLatex, jobDescription, personalDetails, companyInfo || ""),
      tailorCoverLetter(
        coverLetterLatex,
        jobDescription,
        personalDetails,
        companyInfo || "",
      ),
    ]);

    return NextResponse.json({
      tailoredResume,
      tailoredCoverLetter,
    });
  } catch (error) {
    console.error("Error tailoring documents:", error);
    return NextResponse.json(
      {
        error:
          "Failed to tailor documents. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
