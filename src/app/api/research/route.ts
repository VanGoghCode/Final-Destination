import { NextResponse } from "next/server";
import { researchCompany } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, positionTitle, jobDescription } = body;

    if (!companyName || !positionTitle || !jobDescription) {
      return NextResponse.json(
        { error: "Company name, position title, and job description are required" },
        { status: 400 },
      );
    }

    const research = await researchCompany(companyName, positionTitle, jobDescription);

    return NextResponse.json({
      success: true,
      research,
    });
  } catch (error) {
    console.error("Error researching company:", error);
    return NextResponse.json(
      {
        error: "Failed to research company. Please try again.",
      },
      { status: 500 },
    );
  }
}
