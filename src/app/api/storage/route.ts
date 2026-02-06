import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Storage keys prefix
const PREFIX = "fd:";

// Keys that are user-specific (require passcode prefix)
// These match the keys in storage.ts STORAGE_KEYS
const USER_SPECIFIC_KEYS = [
  "fd_personal_details",
  "fd_resume_templates",
  "fd_cover_letter_templates",
  "fd_default_resume_id",
  "fd_default_cover_letter_id",
  "fd_profiles",
  "fd_active_profile_id",
];

// Check if a key is user-specific
function isUserSpecificKey(key: string): boolean {
  return USER_SPECIFIC_KEYS.some(
    (userKey) => key === userKey || key.startsWith(`${userKey}:`),
  );
}

// Get the actual Redis key with proper prefixing
// IMPORTANT: For user-specific keys, if no passcode is provided, return null to block access
function getRedisKey(key: string, passcode: string | null): string | null {
  if (isUserSpecificKey(key)) {
    if (!passcode) {
      // No passcode = no access to user-specific data
      return null;
    }
    return `user:${passcode}:${PREFIX}${key}`;
  }
  return `${PREFIX}${key}`;
}

// Extract passcode from request headers
function getPasscode(request: Request): string | null {
  return request.headers.get("x-passcode");
}

// GET - Retrieve a value by key
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const passcode = getPasscode(request);

    if (!key) {
      // Return all keys and values for migration/export
      // For user-specific data, we need the passcode
      const patterns = passcode
        ? [`user:${passcode}:${PREFIX}*`, `${PREFIX}*`]
        : [`${PREFIX}*`];

      const result: Record<string, unknown> = {};

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        for (const fullKey of keys) {
          // Extract the short key
          let shortKey = fullKey;
          if (passcode && fullKey.startsWith(`user:${passcode}:${PREFIX}`)) {
            shortKey = fullKey.replace(`user:${passcode}:${PREFIX}`, "");
          } else if (fullKey.startsWith(PREFIX)) {
            shortKey = fullKey.replace(PREFIX, "");
          }

          // Skip user-specific keys from other users
          if (
            fullKey.startsWith("user:") &&
            !fullKey.startsWith(`user:${passcode}:`)
          ) {
            continue;
          }

          const value = await redis.get(fullKey);
          result[shortKey] = value;
        }
      }

      return NextResponse.json({ success: true, data: result });
    }

    const redisKey = getRedisKey(key, passcode);
    if (!redisKey) {
      return NextResponse.json(
        { error: "Unauthorized: Passcode required for this data" },
        { status: 401 },
      );
    }

    const value = await redis.get(redisKey);
    return NextResponse.json({ success: true, data: value });
  } catch (error) {
    console.error("Storage GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve data" },
      { status: 500 },
    );
  }
}

// POST - Store a value
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;
    const passcode = getPasscode(request);

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const redisKey = getRedisKey(key, passcode);
    if (!redisKey) {
      return NextResponse.json(
        { error: "Unauthorized: Passcode required for this data" },
        { status: 401 },
      );
    }

    await redis.set(redisKey, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Storage POST error:", error);
    return NextResponse.json(
      { error: "Failed to store data" },
      { status: 500 },
    );
  }
}

// DELETE - Remove a value
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const passcode = getPasscode(request);

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const redisKey = getRedisKey(key, passcode);
    if (!redisKey) {
      return NextResponse.json(
        { error: "Unauthorized: Passcode required for this data" },
        { status: 401 },
      );
    }

    await redis.del(redisKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Storage DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 },
    );
  }
}

// PUT - Bulk import (for migration from localStorage)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { data } = body;
    const passcode = getPasscode(request);

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Data object is required" },
        { status: 400 },
      );
    }

    // Import all key-value pairs
    const results: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      try {
        const redisKey = getRedisKey(key, passcode);
        if (!redisKey) {
          results[key] = false;
          continue;
        }
        await redis.set(redisKey, value);
        results[key] = true;
      } catch {
        results[key] = false;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${Object.keys(results).length} keys`,
      results,
    });
  } catch (error) {
    console.error("Storage PUT error:", error);
    return NextResponse.json(
      { error: "Failed to import data" },
      { status: 500 },
    );
  }
}
