import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "@/lib/cors";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") return handleOptions();
  const path = request.nextUrl.pathname;
  if (
    path === "/api/cron/process-queue" &&
    process.env.CRON_SECRET &&
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  if (
    request.method === "POST" &&
    /^\/api\/(process-queue|tailor|tailor-cover-letter|answers|regenerate|ask|emails|extract-job|data)$/.test(
      path,
    )
  ) {
    try {
      const limit = await checkRateLimitAsync("paid:owner", RATE_LIMITS.AI_GENERATION);
      if (!limit.success)
        return NextResponse.json(
          { error: "AI request limit exceeded" },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
        );
    } catch {
      return NextResponse.json({ error: "Usage limiter unavailable" }, { status: 503 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
