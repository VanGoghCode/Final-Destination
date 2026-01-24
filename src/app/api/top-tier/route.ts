import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "top-tier.json");

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        { error: "Top-tier data not found" },
        { status: 404 },
      );
    }

    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error loading top-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load top-tier data" },
      { status: 500 },
    );
  }
}
