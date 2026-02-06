import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Key for storing registered passcodes
const PASSCODE_PREFIX = "passcode:";

// POST - Verify or register a passcode
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode } = body;

    if (!passcode || passcode.length !== 8) {
      return NextResponse.json(
        { error: "Invalid passcode format" },
        { status: 400 },
      );
    }

    // Check if passcode exists in Redis
    const existingUser = await redis.get(`${PASSCODE_PREFIX}${passcode}`);

    if (existingUser) {
      // Existing user - passcode verified
      return NextResponse.json({
        success: true,
        isNewUser: false,
        message: "Passcode verified",
      });
    } else {
      // New user - register the passcode
      await redis.set(`${PASSCODE_PREFIX}${passcode}`, {
        createdAt: Date.now(),
        lastLogin: Date.now(),
      });

      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: "New user registered",
      });
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}

// GET - Check if Redis is configured (for health check)
export async function GET() {
  try {
    // Ping Redis to check connection
    await redis.ping();
    return NextResponse.json({ success: true, message: "Auth service ready" });
  } catch (error) {
    console.error("Auth health check error:", error);
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 },
    );
  }
}
