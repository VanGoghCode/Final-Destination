import { NextResponse } from "next/server";
import { tailorCoverLetter } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      coverLetterLatex,
      jobDescription,
      personalDetails,
      companyInfo,
    } = body;

    if (!coverLetterLatex || !jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Generate the tailored cover letter on-demand
    const tailoredCoverLetter = await tailorCoverLetter(
      coverLetterLatex,
      jobDescription,
      personalDetails,
      companyInfo || ""
    );

    return NextResponse.json({
      tailoredCoverLetter,
    });
  } catch (error) {
    console.error("Error tailoring cover letter:", error);
    return NextResponse.json(
      {
        error:
          "Failed to tailor cover letter. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
