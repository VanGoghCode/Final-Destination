import { NextResponse } from "next/server";
import { answerGeneralQuestion, answerWithInternet, answerInternetOnly } from "@/lib/ai";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`ask_${clientId}`, RATE_LIMITS.AI_GENERATION);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    const body = await request.json();
    const {
      question,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      masterContext,
      companyName,
      positionTitle,
      limitType,
      limitValue,
      searchMode = "context",
    } = body;

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    if (searchMode !== "internet" && !tailoredResume) {
      return NextResponse.json(
        { error: "Tailored resume is required for context-based answers" },
        { status: 400 },
      );
    }

    let answer: string;

    if (searchMode === "internet") {
      answer = await answerInternetOnly(
        question,
        companyName || "",
        positionTitle || "",
        limitType,
        limitValue,
      );
    } else if (searchMode === "context+internet") {
      answer = await answerWithInternet(
        question,
        tailoredResume,
        tailoredCoverLetter || "",
        jobDescription || "",
        masterContext || "",
        companyName || "",
        positionTitle || "",
        limitType,
        limitValue,
      );
    } else {
      answer = await answerGeneralQuestion(
        question,
        tailoredResume,
        tailoredCoverLetter || "",
        jobDescription || "",
        masterContext || "",
        companyName || "",
        positionTitle || "",
        limitType,
        limitValue,
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error answering question:", error);
    return NextResponse.json({ error: "Failed to answer question." }, { status: 500 });
  }
}
