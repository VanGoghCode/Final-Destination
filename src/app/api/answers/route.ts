import { NextResponse } from "next/server";
import { generateAnswers } from "@/lib/gemini";

interface QuestionInput {
  question: string;
  limitType?: "words" | "characters";
  limitValue?: number;
}

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

    if (!questions || !tailoredResume) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Handle both old format (string) and new format (array of objects)
    let formattedQuestions: string;
    if (Array.isArray(questions)) {
      formattedQuestions = (questions as QuestionInput[])
        .map((q, index) => {
          let questionText = `Question ${index + 1}: ${q.question}`;
          if (q.limitType && q.limitValue) {
            questionText += ` [LIMIT: ${q.limitValue} ${q.limitType}]`;
          }
          return questionText;
        })
        .join("\n\n");
    } else {
      formattedQuestions = questions;
    }

    const answers = await generateAnswers(
      formattedQuestions,
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
