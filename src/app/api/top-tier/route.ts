import { NextResponse } from "next/server";
import { getTierData } from "@/lib/db";

export async function GET() {
  try {
    const data = await getTierData("top");

    if (!data) {
      return NextResponse.json(
        { error: "Top-tier data not found. Please seed the database first." },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error loading top-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load top-tier data" },
      { status: 500 },
    );
  }
}
