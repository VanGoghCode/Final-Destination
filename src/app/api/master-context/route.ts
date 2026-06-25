import { NextResponse } from "next/server";
import { getMasterContext, saveMasterContext, deleteMasterContext } from "@/lib/storage";
import { corsHeaders } from "@/lib/cors";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

function h() {
  return corsHeaders("GET, POST, DELETE, OPTIONS");
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: h() });
}

export async function GET() {
  try {
    const content = await getMasterContext();
    return NextResponse.json({ content }, { headers: h() });
  } catch (error) {
    console.error("Master context GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch master context" },
      { status: 500, headers: h() },
    );
  }
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`master_context_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const { content } = await request.json();

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "content (string) required" },
        { status: 400, headers: h() },
      );
    }

    if (content.length > 100_000) {
      return NextResponse.json(
        { error: "Content too long. Maximum 100KB." },
        { status: 400, headers: h() },
      );
    }

    await saveMasterContext(content);
    return NextResponse.json({ success: true }, { headers: h() });
  } catch (error) {
    console.error("Master context POST error:", error);
    return NextResponse.json(
      { error: "Failed to save master context" },
      { status: 500, headers: h() },
    );
  }
}

export async function DELETE(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`master_context_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    await deleteMasterContext();
    return NextResponse.json({ success: true }, { headers: h() });
  } catch (error) {
    console.error("Master context DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete master context" },
      { status: 500, headers: h() },
    );
  }
}
