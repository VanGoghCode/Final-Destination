import { NextResponse } from "next/server";
import { answerGeneralQuestion } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      question,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      companyInfo,
      companyName,
      positionTitle,
    } = body;

    if (!question || !tailoredResume) {
      return NextResponse.json(
        { error: "Question and tailored resume are required" },
        { status: 400 },
      );
    }

    const answer = await answerGeneralQuestion(
      question,
      tailoredResume,
      tailoredCoverLetter || "",
      jobDescription || "",
      companyInfo || "",
      companyName || "",
      positionTitle || "",
    );

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error answering question:", error);
    return NextResponse.json(
      {
        error:
          "Failed to answer question. Please check your API key and try again.",
      },
      { status: 500 },
    );
  }
}
