import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Only initialize Redis if configured
function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

const PREFIX = "fd:";

function getRedisKey(key: string): string {
  return `${PREFIX}${key}`;
}

function notConfigured() {
  return NextResponse.json(
    { error: "Redis not configured. Using local storage.", configured: false },
    { status: 503 },
  );
}

// GET - Retrieve a value by key, or all values
export async function GET(request: Request) {
  const redis = getRedis();
  if (!redis) return notConfigured();

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      const pattern = `${PREFIX}*`;
      const keys = await redis.keys(pattern);
      const result: Record<string, unknown> = {};

      if (keys.length > 0) {
        const values = await redis.mget<unknown[]>(...keys);
        values.forEach((value, index) => {
          const shortKey = keys[index]?.replace(PREFIX, "");
          if (shortKey) result[shortKey] = value;
        });
      }

      return NextResponse.json({ success: true, data: result });
    }

    const redisKey = getRedisKey(key);
    const value = await redis.get(redisKey);
    return NextResponse.json({ success: true, data: value });
  } catch (error) {
    console.error("Storage GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve data" }, { status: 500 });
  }
}

// POST - Store a value
export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) return notConfigured();

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const redisKey = getRedisKey(key);
    await redis.set(redisKey, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Storage POST error:", error);
    return NextResponse.json({ error: "Failed to store data" }, { status: 500 });
  }
}

// DELETE - Remove a value
export async function DELETE(request: Request) {
  const redis = getRedis();
  if (!redis) return notConfigured();

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const redisKey = getRedisKey(key);
    await redis.del(redisKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Storage DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}

// PUT - Bulk import (for migration from localStorage)
export async function PUT(request: Request) {
  const redis = getRedis();
  if (!redis) return notConfigured();

  try {
    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Data object is required" }, { status: 400 });
    }

    const results: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      try {
        const redisKey = getRedisKey(key);
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
    return NextResponse.json({ error: "Failed to import data" }, { status: 500 });
  }
}
