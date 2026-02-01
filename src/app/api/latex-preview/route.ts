import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { latex } = await request.json();

    if (!latex || typeof latex !== "string") {
      return NextResponse.json(
        { error: "LaTeX code is required" },
        { status: 400 }
      );
    }

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
            content: latex,
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
      
      return NextResponse.json(
        { error: errorMessage, details: errorText },
        { status: 400 }
      );
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
      { status: 500 }
    );
  }
}
