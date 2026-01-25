import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

interface Company {
  id: string;
  name: string;
  careerUrls: string[];
  customCareerUrls?: string[];
  [key: string]: unknown;
}

interface TierData {
  generatedAt: string;
  count: number;
  tier: string;
  companies: Company[];
}

const TIER_FILES = ["top-tier.json", "middle-tier.json", "lower-tier.json", "lowest-tier.json"];

// Initialize Redis client only if environment variables are set (production)
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

// Helper to check if we're in production (Vercel)
const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// Key prefix for storing custom links in Redis
const REDIS_KEY_PREFIX = "company-links:";

async function getCustomLinksFromRedis(companyId: string): Promise<string[]> {
  if (!redis) return [];
  try {
    const links = await redis.get<string[]>(`${REDIS_KEY_PREFIX}${companyId}`);
    return links || [];
  } catch (error) {
    console.error("Failed to get links from Redis:", error);
    return [];
  }
}

async function saveCustomLinksToRedis(companyId: string, urls: string[]): Promise<boolean> {
  if (!redis) return false;
  try {
    if (urls.length === 0) {
      await redis.del(`${REDIS_KEY_PREFIX}${companyId}`);
    } else {
      await redis.set(`${REDIS_KEY_PREFIX}${companyId}`, urls);
    }
    return true;
  } catch (error) {
    console.error("Failed to save links to Redis:", error);
    return false;
  }
}

// Get all custom links from Redis (for bulk operations)
async function getAllCustomLinksFromRedis(): Promise<Record<string, string[]>> {
  if (!redis) return {};
  try {
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
    if (keys.length === 0) return {};
    
    const result: Record<string, string[]> = {};
    for (const key of keys) {
      const companyId = key.replace(REDIS_KEY_PREFIX, "");
      const links = await redis.get<string[]>(key);
      if (links && links.length > 0) {
        result[companyId] = links;
      }
    }
    return result;
  } catch (error) {
    console.error("Failed to get all links from Redis:", error);
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, urls } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(urls)) {
      return NextResponse.json(
        { error: "URLs must be an array" },
        { status: 400 }
      );
    }

    const filteredUrls = urls.filter((url: string) => url.trim() !== "");

    // In production (Vercel), use Redis
    if (isProduction && redis) {
      const success = await saveCustomLinksToRedis(companyId, filteredUrls);
      if (!success) {
        return NextResponse.json(
          { error: "Failed to save links to database" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        company: { id: companyId, customCareerUrls: filteredUrls },
      });
    }

    // In development, use file system
    const dataDir = path.join(process.cwd(), "data");
    let updated = false;
    let updatedCompany: Company | null = null;

    for (const tierFile of TIER_FILES) {
      const filePath = path.join(dataDir, tierFile);
      
      if (!fs.existsSync(filePath)) continue;

      const data: TierData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const companyIndex = data.companies.findIndex((c) => c.id === companyId);

      if (companyIndex !== -1) {
        // Update the company's custom career URLs
        data.companies[companyIndex].customCareerUrls = filteredUrls;
        
        // Write back to file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
        
        updatedCompany = data.companies[companyIndex];
        updated = true;
        break;
      }
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Failed to save company links:", error);
    return NextResponse.json(
      { error: "Failed to save company links" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const all = searchParams.get("all"); // Get all custom links

    // Return all custom links (for loading into frontend)
    if (all === "true") {
      if (isProduction && redis) {
        const allLinks = await getAllCustomLinksFromRedis();
        return NextResponse.json({ customLinks: allLinks });
      }
      // In development, custom links are already in the JSON files
      return NextResponse.json({ customLinks: {} });
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // In production (Vercel), check Redis first
    if (isProduction && redis) {
      const customUrls = await getCustomLinksFromRedis(companyId);
      return NextResponse.json({
        companyId,
        careerUrls: [],
        customCareerUrls: customUrls,
      });
    }

    // In development, use file system
    const dataDir = path.join(process.cwd(), "data");

    for (const tierFile of TIER_FILES) {
      const filePath = path.join(dataDir, tierFile);
      
      if (!fs.existsSync(filePath)) continue;

      const data: TierData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const company = data.companies.find((c) => c.id === companyId);

      if (company) {
        return NextResponse.json({
          companyId: company.id,
          careerUrls: company.careerUrls || [],
          customCareerUrls: company.customCareerUrls || [],
        });
      }
    }

    return NextResponse.json(
      { error: "Company not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Failed to get company links:", error);
    return NextResponse.json(
      { error: "Failed to get company links" },
      { status: 500 }
    );
  }
}
