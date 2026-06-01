import { NextResponse } from "next/server";
import { getProfiles } from "@/lib/db";
import { getQueue } from "@/lib/db";
import { isRedisConfigured } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { validateAdminRequest, adminUnauthorizedResponse } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!validateAdminRequest(request)) return adminUnauthorizedResponse();

  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`admin_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json({
        redisConnected: false,
        message: "Redis not configured. Data is stored locally.",
      });
    }

    const profiles = await getProfiles();
    const queue = await getQueue();

    return NextResponse.json({
      redisConnected: true,
      profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name || `${p.firstName} ${p.lastName}`.trim(),
        color: p.color,
      })),
      queueStats: {
        total: queue.length,
        pending: queue.filter((j) => j.status === "pending").length,
        processing: queue.filter((j) =>
          ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
        ).length,
        completed: queue.filter((j) => j.status === "completed").length,
        failed: queue.filter((j) => j.status === "failed").length,
        cancelled: queue.filter((j) => j.status === "cancelled").length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin data:", error);
    return NextResponse.json({ error: "Failed to fetch admin data" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validateAdminRequest(request)) return adminUnauthorizedResponse();

  const clientId = getClientIdentifier(request);
  const rl = checkRateLimit(`admin_${clientId}`, RATE_LIMITS.GENERAL);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 400 });
    }

    const { clearAllData } = await import("@/lib/db");
    await clearAllData();

    return NextResponse.json({ success: true, message: "All data cleared" });
  } catch (error) {
    console.error("Failed to clear data:", error);
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 });
  }
}
