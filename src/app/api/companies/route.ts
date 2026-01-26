import { NextResponse } from "next/server";
import { getAllTierData, type Company } from "@/lib/db";

// Helper to deduplicate companies
function deduplicateCompanies(companies: Company[]): Company[] {
  // Deduplicate by ID (keep highest priority score)
  const seenIds = new Map<string, Company>();
  const uniqueCompanies: Company[] = [];

  for (const company of companies) {
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

  // Second pass: deduplicate by normalized company name
  const seenNames = new Map<string, Company>();
  const nameDeduped: Company[] = [];

  for (const company of uniqueCompanies) {
    const normalizedName = (company.name || "").toLowerCase().trim();
    const existing = seenNames.get(normalizedName);
    if (!existing || company.priorityScore > existing.priorityScore) {
      if (existing) {
        const idx = nameDeduped.indexOf(existing);
        if (idx > -1) nameDeduped.splice(idx, 1);
      }
      seenNames.set(normalizedName, company);
      nameDeduped.push(company);
    }
  }

  // Sort by priority
  nameDeduped.sort((a, b) => b.priorityScore - a.priorityScore);

  return nameDeduped;
}

// Helper to calculate tier counts
function calculateTierCounts(companies: Company[]) {
  const tierCounts = {
    top: 0,
    middle: 0,
    lower: 0,
    lowest: 0,
    below50: 0,
  };

  for (const company of companies) {
    if (company.tier && tierCounts.hasOwnProperty(company.tier)) {
      tierCounts[company.tier as keyof typeof tierCounts]++;
    }
  }

  return tierCounts;
}

export async function GET() {
  try {
    const tierData = await getAllTierData();

    // Combine all companies from tiers
    const allCompanies: Company[] = [];
    let latestGeneratedAt = "";
    
    for (const tier of ["top", "middle", "lower", "lowest"] as const) {
      const data = tierData[tier];
      if (data) {
        allCompanies.push(...data.companies);
        if (!latestGeneratedAt || data.generatedAt > latestGeneratedAt) {
          latestGeneratedAt = data.generatedAt;
        }
      }
    }

    if (allCompanies.length === 0) {
      return NextResponse.json(
        { error: "Companies data not found. Please seed the database first." },
        { status: 404 },
      );
    }

    const uniqueCompanies = deduplicateCompanies(allCompanies);
    const tierCounts = calculateTierCounts(uniqueCompanies);

    return NextResponse.json({
      generatedAt: latestGeneratedAt,
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
