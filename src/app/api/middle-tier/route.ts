import { NextResponse } from "next/server";
import { getTierData } from "@/lib/db";

export async function GET() {
  try {
    const data = await getTierData("middle");

    if (!data) {
      return NextResponse.json(
        { error: "Middle-tier data not found. Please seed the database first." },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error loading middle-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load middle-tier data" },
      { status: 500 },
    );
  }
}
