import { NextResponse } from "next/server";
import { getProfiles, setProfiles, SavedProfile } from "@/lib/db";
import { corsHeaders } from "@/lib/cors";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

function h() {
  return corsHeaders("GET, POST, OPTIONS");
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: h() });
}

export async function GET() {
  try {
    const profiles = await getProfiles();
    return NextResponse.json(profiles, { headers: h() });
  } catch (error) {
    console.error("Profiles GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500, headers: h() });
  }
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`profiles_write_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...h(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid body, expected array of profiles" },
        { status: 400, headers: h() },
      );
    }

    const profiles: SavedProfile[] = body.map((p: SavedProfile) => ({
      id: p.id,
      name: p.name,
      firstName: p.firstName,
      lastName: p.lastName,
      color: p.color,
      avatarText: p.avatarText,
    }));

    await setProfiles(profiles);
    return NextResponse.json({ success: true }, { headers: h() });
  } catch (error) {
    console.error("Profiles POST error:", error);
    return NextResponse.json({ error: "Failed to save profiles" }, { status: 500, headers: h() });
  }
}
