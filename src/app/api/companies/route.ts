import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "companies.json");

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        { error: "Companies data not found" },
        { status: 404 },
      );
    }

    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Deduplicate companies by ID (keep highest priority score)
    const seenIds = new Map();
    const uniqueCompanies = [];

    for (const company of data.companies) {
      const existing = seenIds.get(company.id);
      if (!existing || company.priorityScore > existing.priorityScore) {
        if (existing) {
          const idx = uniqueCompanies.indexOf(existing);
          if (idx > -1) uniqueCompanies.splice(idx, 1);
        }
        seenIds.set(company.id, company);
        uniqueCompanies.push(company);
      }
    }

    // Re-sort by priority
    uniqueCompanies.sort((a, b) => b.priorityScore - a.priorityScore);

    // Recalculate tier counts after deduplication
    const tierCounts = {
      top: 0,
      middle: 0,
      lower: 0,
      lowest: 0,
      below50: 0,
    };

    for (const company of uniqueCompanies) {
      if (company.tier && tierCounts.hasOwnProperty(company.tier)) {
        tierCounts[company.tier as keyof typeof tierCounts]++;
      }
    }

    return NextResponse.json({
      generatedAt: data.generatedAt,
      totalCompanies: uniqueCompanies.length,
      tierCounts,
      companies: uniqueCompanies,
    });
  } catch (error) {
    console.error("Error loading companies:", error);
    return NextResponse.json(
      { error: "Failed to load companies" },
      { status: 500 },
    );
  }
}
