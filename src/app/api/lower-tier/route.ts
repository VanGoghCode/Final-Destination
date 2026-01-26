import { NextResponse } from "next/server";
import { getTierData } from "@/lib/db";

export async function GET() {
  try {
    const data = await getTierData("lower");

    if (!data) {
      return NextResponse.json(
        { error: "Lower-tier data not found. Please seed the database first." },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load lower-tier data:", error);
    return NextResponse.json(
      { error: "Failed to load lower-tier company data" },
      { status: 500 },
    );
  }
}
