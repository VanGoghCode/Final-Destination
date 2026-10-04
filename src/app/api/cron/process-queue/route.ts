import { NextResponse } from "next/server";

export async function GET() {
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const response = await fetch(`${origin}/api/process-queue`, {
      method: "POST",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
