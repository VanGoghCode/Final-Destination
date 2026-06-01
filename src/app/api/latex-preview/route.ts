import { NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeLatex } from "@/lib/sanitize";

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`latex_${clientId}`, RATE_LIMITS.LATEX);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    const { latex } = await request.json();

    if (!latex || typeof latex !== "string") {
      return NextResponse.json({ error: "LaTeX code is required" }, { status: 400 });
    }

    // Sanitize LaTeX input
    const sanitizedLatex = sanitizeLatex(latex);

    // Use latex.ytotech.com free API for compilation
    // Alternative: latexonline.cc
    const response = await fetch("https://latex.ytotech.com/builds/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler: "pdflatex",
        resources: [
          {
            main: true,
            content: sanitizedLatex,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LaTeX compilation error:", errorText);

      // Try to extract meaningful error message
      let errorMessage = "LaTeX compilation failed";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.logs) {
          // Extract error lines from logs
          const errorLines = errorJson.logs
            .split("\n")
            .filter((line: string) => line.includes("!") || line.includes("Error"))
            .slice(0, 5)
            .join("\n");
          if (errorLines) {
            errorMessage = errorLines;
          }
        }
      } catch {
        // Use generic message if parsing fails
      }

      return NextResponse.json({ error: errorMessage, details: errorText }, { status: 400 });
    }

    // Get the PDF as binary data
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      contentType: "application/pdf",
    });
  } catch (error) {
    console.error("LaTeX preview error:", error);
    return NextResponse.json(
      {
        error: "Failed to compile LaTeX. Please check your syntax.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
