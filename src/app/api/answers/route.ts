import { NextResponse } from "next/server";
import { generateAnswers } from "@/lib/gemini";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeForAI, sanitizeLatex, sanitizeJobDescription } from "@/lib/sanitize";

interface QuestionInput {
  question: string;
  limitType?: "words" | "characters";
  limitValue?: number;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`answers_${clientId}`, RATE_LIMITS.AI_GENERATION);
    
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
          let questionText = `Question ${index + 1}: ${sanitizeForAI(q.question)}`;
          if (q.limitType && q.limitValue) {
            questionText += ` [LIMIT: ${q.limitValue} ${q.limitType}]`;
          }
          return questionText;
        })
        .join("\n\n");
    } else {
      formattedQuestions = sanitizeForAI(questions);
    }

    // Sanitize other inputs
    const sanitizedResume = sanitizeLatex(tailoredResume);
    const sanitizedCoverLetter = tailoredCoverLetter ? sanitizeLatex(tailoredCoverLetter) : "";
    const sanitizedJobDescription = sanitizeJobDescription(jobDescription || "");
    const sanitizedCompanyInfo = sanitizeForAI(companyInfo || "");

    const answers = await generateAnswers(
      formattedQuestions,
      sanitizedResume,
      sanitizedCoverLetter,
      sanitizedJobDescription,
      sanitizedCompanyInfo,
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
