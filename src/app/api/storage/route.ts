import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Storage keys prefix to avoid collisions
const PREFIX = "fd:";

// GET - Retrieve a value by key
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      // Return all keys and values for migration/export
      const keys = await redis.keys(`${PREFIX}*`);
      const result: Record<string, unknown> = {};

      for (const fullKey of keys) {
        const shortKey = fullKey.replace(PREFIX, "");
        const value = await redis.get(fullKey);
        result[shortKey] = value;
      }

      return NextResponse.json({ success: true, data: result });
    }

    const value = await redis.get(`${PREFIX}${key}`);
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

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    await redis.set(`${PREFIX}${key}`, value);
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

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    await redis.del(`${PREFIX}${key}`);
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
        await redis.set(`${PREFIX}${key}`, value);
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
