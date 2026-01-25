import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "middle-tier.json");

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        { error: "Middle-tier data not found" },
        { status: 404 },
      );
    }

    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error loading middle-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load middle-tier data" },
      { status: 500 },
    );
  }
}
