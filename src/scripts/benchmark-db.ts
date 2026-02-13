
import { Company, TierData } from "../lib/db";

// Mock data
const mockCompany: Company = {
  id: "c1",
  name: "Company 1",
  city: "City",
  state: "State",
  lcaCount: 10,
  lcaQ1: 2,
  lcaQ2: 2,
  lcaQ3: 3,
  lcaQ4: 3,
  approvalRate: 0.9,
  priorityScore: 100,
  tier: "top",
};

const mockTierData: TierData = {
  generatedAt: new Date().toISOString(),
  count: 1,
  tier: "top",
  companies: [mockCompany],
};

// Mock getTierData with delay
async function getTierDataMock(tier: string, delayMs = 50): Promise<TierData | null> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (tier === "top") return mockTierData;
  return { ...mockTierData, tier, companies: [] };
}

// Original implementation
async function getCompanyFromTiersSequential(companyId: string): Promise<{ company: Company; tier: string } | null> {
  const tiers = ["top", "middle", "lower", "lowest"] as const;

  for (const tier of tiers) {
    const data = await getTierDataMock(tier);
    if (data) {
      const company = data.companies.find((c) => c.id === companyId);
      if (company) {
        return { company, tier };
      }
    }
  }

  return null;
}

// Optimized implementation
async function getCompanyFromTiersParallel(companyId: string): Promise<{ company: Company; tier: string } | null> {
  const tiers = ["top", "middle", "lower", "lowest"] as const;

  // Fetch all concurrently
  const results = await Promise.all(tiers.map(async (tier) => {
    const data = await getTierDataMock(tier);
    return { tier, data };
  }));

  for (const { tier, data } of results) {
    if (data) {
      const company = data.companies.find((c) => c.id === companyId);
      if (company) {
        return { company, tier };
      }
    }
  }

  return null;
}

async function runBenchmark() {
  console.log("Starting benchmark...");

  const iterations = 5;
  const companyId = "c1"; // Exists in "top"

  const companyIdNotFound = "not-found";

  console.log("\n--- Case 1: Company Not Found (Worst Case for Sequential) ---");

  let start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await getCompanyFromTiersSequential(companyIdNotFound);
  }
  let end = performance.now();
  console.log(`Original (Sequential) Average: ${((end - start) / iterations).toFixed(2)}ms`);

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await getCompanyFromTiersParallel(companyIdNotFound);
  }
  end = performance.now();
  console.log(`Optimized (Parallel) Average: ${((end - start) / iterations).toFixed(2)}ms`);


  console.log("\n--- Case 2: Company in Top Tier (Best Case for Sequential) ---");

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await getCompanyFromTiersSequential(companyId);
  }
  end = performance.now();
  console.log(`Original (Sequential) Average: ${((end - start) / iterations).toFixed(2)}ms`);

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await getCompanyFromTiersParallel(companyId);
  }
  end = performance.now();
  console.log(`Optimized (Parallel) Average: ${((end - start) / iterations).toFixed(2)}ms`);
}

runBenchmark();
