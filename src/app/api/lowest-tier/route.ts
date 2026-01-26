import { NextResponse } from "next/server";
import { getTierData } from "@/lib/db";

export async function GET() {
  try {
    const data = await getTierData("lowest");

    if (!data) {
      return NextResponse.json(
        { error: "Lowest-tier data not found. Please seed the database first." },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load lowest-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load lowest-tier company data" },
      { status: 500 },
    );
  }
}
