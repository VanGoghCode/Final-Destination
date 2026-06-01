import { NextResponse } from "next/server";
import { generateColdEmail, generateReferenceEmail } from "@/lib/ai";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`emails_${clientId}`, RATE_LIMITS.AI_GENERATION);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    const body = await request.json();
    const {
      type,
      tailoredResume,
      tailoredCoverLetter,
      jobDescription,
      masterContext,
      positionTitle,
      companyName,
    } = body;

    if (!tailoredResume || !tailoredCoverLetter || !positionTitle || !companyName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let email: string;

    if (type === "cold") {
      email = await generateColdEmail(
        tailoredResume,
        tailoredCoverLetter,
        jobDescription,
        masterContext || "",
        positionTitle,
        companyName,
      );
    } else if (type === "reference") {
      email = await generateReferenceEmail(
        tailoredResume,
        tailoredCoverLetter,
        jobDescription,
        masterContext || "",
        positionTitle,
        companyName,
      );
    } else {
      return NextResponse.json(
        { error: "Invalid email type. Use 'cold' or 'reference'." },
        { status: 400 },
      );
    }

    return NextResponse.json({ email });
  } catch (error) {
    console.error("Error generating email:", error);
    return NextResponse.json({ error: "Failed to generate email." }, { status: 500 });
  }
}
