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

  // Test simple set/get
  await redis.set("test:key", { hello: "world" });

  const companies = await redis.get("data:companies");

  if (
    companies &&
    typeof companies === "object" &&
    "totalCompanies" in companies
  ) {
  }
  const topTier = await redis.get("data:tier:top");
  if (topTier && typeof topTier === "object" && "count" in topTier) {
  }
}

test().catch(console.error);
