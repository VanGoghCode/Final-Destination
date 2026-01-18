import { NextResponse } from "next/server";
import { generateAnswers } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      questions,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      companyInfo,
    } = body;

    if (!questions || !tailoredResume || !tailoredCoverLetter) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const answers = await generateAnswers(
      questions,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      companyInfo,
    );

    return NextResponse.json({ answers });
  } catch (error) {
    console.error("Error generating answers:", error);
    return NextResponse.json(
      {
        error:
          "Failed to generate answers. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
