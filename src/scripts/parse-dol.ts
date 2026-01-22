/**
 * DOL LCA Parser Script
 *
 * Parses lca_filtered_2025.csv and generates companies.json with rankings.
 * Tracks LCAs per quarter (Q1, Q2, Q3, Q4).
 *
 * Usage: npx tsx src/scripts/parse-dol.ts
 */

import * as fs from "fs";
import * as path from "path";
import type { Company } from "../lib/config";

// Config
const TOP_COMPANY_THRESHOLD = 50;

interface CompanyData {
  name: string;
  city: string;
  state: string;
  lcaCount: number;
  certifiedCount: number;
  lcaQ1: number;
  lcaQ2: number;
  lcaQ3: number;
  lcaQ4: number;
  pocFirstName: string;
  pocLastName: string;
  pocEmail: string;
  pocPhone: string;
}

function parseCSV(filePath: string): Map<string, CompanyData> {
  console.log(`📂 Reading CSV: ${filePath}`);

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  console.log(`📊 Total rows: ${(lines.length - 1).toLocaleString()}`);

  const cols: Record<string, number> = {};
  headers.forEach((h, i) => (cols[h] = i));

  const companies = new Map<string, CompanyData>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    const employerName = (fields[cols["EMPLOYER_NAME"]] || "")
      .trim()
      .toUpperCase();
    if (!employerName) continue;

    const status = (fields[cols["CASE_STATUS"]] || "").toUpperCase();
    const isCertified = status.includes("CERTIFIED");
    const quarter = (fields[cols["QUARTER"]] || "").toUpperCase();

    if (!companies.has(employerName)) {
      companies.set(employerName, {
        name: fields[cols["EMPLOYER_NAME"]]?.trim() || "",
        city: fields[cols["EMPLOYER_CITY"]]?.trim() || "",
        state: fields[cols["EMPLOYER_STATE"]]?.trim() || "",
        lcaCount: 0,
        certifiedCount: 0,
        lcaQ1: 0,
        lcaQ2: 0,
        lcaQ3: 0,
        lcaQ4: 0,
        pocFirstName: fields[cols["EMPLOYER_POC_FIRST_NAME"]]?.trim() || "",
        pocLastName: fields[cols["EMPLOYER_POC_LAST_NAME"]]?.trim() || "",
        pocEmail: fields[cols["EMPLOYER_POC_EMAIL"]]?.trim() || "",
        pocPhone: fields[cols["EMPLOYER_POC_PHONE"]]?.trim() || "",
      });
    }

    const company = companies.get(employerName)!;
    company.lcaCount++;
    if (isCertified) company.certifiedCount++;

    // Track by quarter
    if (quarter === "Q1") company.lcaQ1++;
    else if (quarter === "Q2") company.lcaQ2++;
    else if (quarter === "Q3") company.lcaQ3++;
    else if (quarter === "Q4") company.lcaQ4++;
  }

  console.log(`🏢 Unique companies: ${companies.size.toLocaleString()}\n`);
  return companies;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function rankCompanies(companyData: Map<string, CompanyData>): Company[] {
  const companies: Company[] = [];

  for (const [key, data] of companyData) {
    const approvalRate =
      data.lcaCount > 0 ? data.certifiedCount / data.lcaCount : 0;
    // Priority: 50% LCA count + 50% approval rate
    const priorityScore = data.lcaCount * 0.5 + approvalRate * 100 * 0.5;
    const isTop = data.lcaCount >= TOP_COMPANY_THRESHOLD;

    companies.push({
      id: key
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .substring(0, 50),
      name: data.name,
      city: data.city,
      state: data.state,
      lcaCount: data.lcaCount,
      lcaQ1: data.lcaQ1,
      lcaQ2: data.lcaQ2,
      lcaQ3: data.lcaQ3,
      lcaQ4: data.lcaQ4,
      approvalRate: Math.round(approvalRate * 100) / 100,
      priorityScore: Math.round(priorityScore * 100) / 100,
      isTop,
      pocFirstName: data.pocFirstName,
      pocLastName: data.pocLastName,
      pocEmail: data.pocEmail,
      pocPhone: data.pocPhone,
    });
  }

  companies.sort((a, b) => b.priorityScore - a.priorityScore);

  const topCount = companies.filter((c) => c.isTop).length;
  console.log(
    `⭐ Top companies (>= ${TOP_COMPANY_THRESHOLD} LCAs): ${topCount}`,
  );
  console.log(`📊 Regular companies: ${companies.length - topCount}\n`);

  return companies;
}

function main(): void {
  console.log("🚀 DOL LCA Parser (2025 Full Year)\n");
  console.log("=".repeat(50) + "\n");

  const dataDir = path.join(process.cwd(), "data");

  // Try 2025 full year file first, fallback to Q4 only
  let inputFile = path.join(dataDir, "lca_filtered_2025.csv");
  if (!fs.existsSync(inputFile)) {
    inputFile = path.join(dataDir, "lca_filtered.csv");
    console.log("⚠️ Using Q4 only (lca_filtered.csv)\n");
  } else {
    console.log("✅ Using full year data (lca_filtered_2025.csv)\n");
  }

  const outputFile = path.join(dataDir, "companies.json");

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    const companyData = parseCSV(inputFile);
    const companies = rankCompanies(companyData);

    const output = {
      generatedAt: new Date().toISOString(),
      totalCompanies: companies.length,
      topCompanies: companies.filter((c) => c.isTop).length,
      regularCompanies: companies.filter((c) => !c.isTop).length,
      companies,
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`💾 Saved to: ${outputFile}`);

    console.log("\n📊 Top 10 Companies:\n");
    console.log("| Company | Total | Q1 | Q2 | Q3 | Q4 | Score |");
    console.log("|---------|-------|----|----|----|----|-------|");
    for (let i = 0; i < Math.min(10, companies.length); i++) {
      const c = companies[i];
      console.log(
        `| ${c.name.substring(0, 25).padEnd(25)} | ${c.lcaCount.toString().padStart(5)} | ${c.lcaQ1?.toString().padStart(3) || "0"} | ${c.lcaQ2?.toString().padStart(3) || "0"} | ${c.lcaQ3?.toString().padStart(3) || "0"} | ${c.lcaQ4?.toString().padStart(3) || "0"} | ${c.priorityScore.toFixed(0).padStart(5)} |`,
      );
    }

    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
