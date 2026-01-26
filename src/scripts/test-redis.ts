/**
 * Simple Redis test script
 */

import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

async function test() {
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  console.log("Testing Redis connection...\n");

  // Test simple set/get
  await redis.set("test:key", { hello: "world" });
  const result = await redis.get("test:key");
  console.log("Test set/get result:", result);

  // Check what keys exist
  const keys = await redis.keys("*");
  console.log("\nAll existing keys:", keys);

  // Check specific keys
  console.log("\n--- Checking data keys ---");
  
  const companies = await redis.get("data:companies");
  console.log("data:companies exists:", companies !== null);
  if (companies && typeof companies === 'object' && 'totalCompanies' in companies) {
    console.log("  totalCompanies:", (companies as any).totalCompanies);
  }

  const topTier = await redis.get("data:tier:top");
  console.log("data:tier:top exists:", topTier !== null);
  if (topTier && typeof topTier === 'object' && 'count' in topTier) {
    console.log("  count:", (topTier as any).count);
  }

  const middleTier = await redis.get("data:tier:middle");
  console.log("data:tier:middle exists:", middleTier !== null);

  const lowerTier = await redis.get("data:tier:lower");
  console.log("data:tier:lower exists:", lowerTier !== null);

  const lowestTier = await redis.get("data:tier:lowest");
  console.log("data:tier:lowest exists:", lowestTier !== null);

  const jobs = await redis.get("data:jobs");
  console.log("data:jobs exists:", jobs !== null);
}

test().catch(console.error);
