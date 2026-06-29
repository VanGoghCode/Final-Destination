import { NextResponse } from "next/server";

/**
 * GET /api/cron/process-queue
 *
 * Vercel Cron Job trigger. Runs every minute.
 * Delegates to /api/process-queue via internal fetch.
 *
 * Add to vercel.json:
 *   "crons": [
 *     { "path": "/api/cron/process-queue", "schedule": "* * * * *" }
 *   ]
 *
 * Note: Vercel Cron Jobs require Pro plan or above.
 * On Hobby plan, use an external cron service (cron-job.org, etc.)
 * to GET this endpoint periodically.
 */
export async function GET() {
  try {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const res = await fetch(`${origin}/api/process-queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();

    return NextResponse.json({
      triggered: true,
      result: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/process-queue] Error:", error);
    return NextResponse.json(
      { triggered: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
