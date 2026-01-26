import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  seedAllData,
  clearAllData,
  cleanupUnusedKeys,
  getDataStats,
  isRedisConfigured,
  type TierData,
  type JobsData,
} from "@/lib/db";

/**
 * GET /api/data - Get data statistics
 */
export async function GET() {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json({
        redisConfigured: false,
        message: "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.",
      });
    }

    const stats = await getDataStats();
    
    return NextResponse.json({
      redisConfigured: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting data stats:", error);
    return NextResponse.json(
      { error: "Failed to get data stats", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data - Seed Redis with data from local JSON files
 */
export async function POST(request: NextRequest) {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action = "seed" } = body;

    if (action === "clear") {
      const success = await clearAllData();
      return NextResponse.json({
        success,
        message: success ? "All data cleared from Redis" : "Failed to clear data",
      });
    }

    if (action === "cleanup") {
      const result = await cleanupUnusedKeys();
      return NextResponse.json({
        success: result.errors.length === 0,
        message: `Cleaned up ${result.deleted.length} unused keys`,
        deleted: result.deleted,
        errors: result.errors,
      });
    }

    // Default: seed data
    const dataDir = path.join(process.cwd(), "data");
    const seedData: {
      tiers?: {
        top?: TierData;
        middle?: TierData;
        lower?: TierData;
        lowest?: TierData;
      };
      jobs?: JobsData;
    } = {};

    // Load tier files
    const tierFiles = {
      top: "top-tier.json",
      middle: "middle-tier.json",
      lower: "lower-tier.json",
      lowest: "lowest-tier.json",
    } as const;

    seedData.tiers = {};
    for (const [tier, file] of Object.entries(tierFiles)) {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        seedData.tiers[tier as keyof typeof tierFiles] = JSON.parse(
          fs.readFileSync(filePath, "utf-8")
        );
      }
    }

    // Load jobs.json
    const jobsPath = path.join(dataDir, "jobs.json");
    if (fs.existsSync(jobsPath)) {
      seedData.jobs = JSON.parse(fs.readFileSync(jobsPath, "utf-8"));
    }

    const result = await seedAllData(seedData);

    if (result.success) {
      const stats = await getDataStats();
      return NextResponse.json({
        success: true,
        message: "Data seeded successfully",
        stats,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "Some data failed to seed",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error seeding data:", error);
    return NextResponse.json(
      { error: "Failed to seed data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data - Clear all data from Redis
 */
export async function DELETE() {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables." },
        { status: 400 }
      );
    }

    const success = await clearAllData();
    
    return NextResponse.json({
      success,
      message: success ? "All data cleared from Redis" : "Failed to clear data",
    });
  } catch (error) {
    console.error("Error clearing data:", error);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}
