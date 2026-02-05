import { NextResponse } from "next/server";
import { getProfiles, setProfiles, SavedProfile } from "@/lib/db";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET() {
  try {
    const profiles = await getProfiles();
    return NextResponse.json(profiles, { headers: corsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid body, expected array of profiles" },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Map to SavedProfile to ensure clean data
    const profiles: SavedProfile[] = body.map((p: any) => ({
      id: p.id,
      name: p.name,
      firstName: p.firstName,
      lastName: p.lastName,
      color: p.color,
      avatarText: p.avatarText,
    }));

    await setProfiles(profiles);
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save profiles" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
