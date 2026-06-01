import { NextResponse } from "next/server";
import { getMasterContext, saveMasterContext, deleteMasterContext } from "@/lib/storage";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId query parameter required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const content = await getMasterContext(profileId);
    return NextResponse.json({ profileId, content }, { headers: corsHeaders() });
  } catch (error) {
    console.error("Master context GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch master context" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profileId, content } = await request.json();

    if (!profileId || typeof content !== "string") {
      return NextResponse.json(
        { error: "profileId and content (string) required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    if (content.length > 100_000) {
      return NextResponse.json(
        { error: "Content too long. Maximum 100KB." },
        { status: 400, headers: corsHeaders() },
      );
    }

    await saveMasterContext(profileId, content);
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error("Master context POST error:", error);
    return NextResponse.json(
      { error: "Failed to save master context" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId query parameter required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    await deleteMasterContext(profileId);
    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error("Master context DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete master context" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
