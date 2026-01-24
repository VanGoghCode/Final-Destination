import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "lower-tier.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load lower-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load lower-tier company data" },
      { status: 500 },
    );
  }
}
