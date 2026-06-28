import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";

export const runtime = "nodejs";

function h() {
  return corsHeaders("GET, OPTIONS");
}

export function OPTIONS() {
  return handleOptions("GET, OPTIONS");
}

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "0.1.0",
    },
    { headers: h() },
  );
}
