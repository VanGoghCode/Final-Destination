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
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const headerLine = lines[0];
  if (!headerLine) {
    console.error("Empty CSV file");
    return new Map();
  }
  const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""));

  const cols: Record<string, number> = {};
  headers.forEach((h, i) => (cols[h] = i));

  const getCol = (name: string): number => cols[name] ?? -1;

  const companies = new Map<string, CompanyData>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;

    const fields = parseCSVLine(line.trim());

    const employerNameCol = getCol("EMPLOYER_NAME");
    const employerName = (
      employerNameCol >= 0 ? (fields[employerNameCol] ?? "") : ""
    )
      .trim()
      .toUpperCase();
    if (!employerName) continue;

    const caseStatusCol = getCol("CASE_STATUS");
    const status = (
      caseStatusCol >= 0 ? (fields[caseStatusCol] ?? "") : ""
    ).toUpperCase();
    const isCertified = status.includes("CERTIFIED");
    const quarterCol = getCol("QUARTER");
    const quarter = (
      quarterCol >= 0 ? (fields[quarterCol] ?? "") : ""
    ).toUpperCase();

    if (!companies.has(employerName)) {
      const cityCol = getCol("EMPLOYER_CITY");
      const stateCol = getCol("EMPLOYER_STATE");
      const pocFirstCol = getCol("EMPLOYER_POC_FIRST_NAME");
      const pocLastCol = getCol("EMPLOYER_POC_LAST_NAME");
      const pocEmailCol = getCol("EMPLOYER_POC_EMAIL");
      const pocPhoneCol = getCol("EMPLOYER_POC_PHONE");
      companies.set(employerName, {
        name:
          (employerNameCol >= 0 ? fields[employerNameCol] : "")?.trim() || "",
        city: (cityCol >= 0 ? fields[cityCol] : "")?.trim() || "",
        state: (stateCol >= 0 ? fields[stateCol] : "")?.trim() || "",
        lcaCount: 0,
        certifiedCount: 0,
        lcaQ1: 0,
        lcaQ2: 0,
        lcaQ3: 0,
        lcaQ4: 0,
        pocFirstName:
          (pocFirstCol >= 0 ? fields[pocFirstCol] : "")?.trim() || "",
        pocLastName: (pocLastCol >= 0 ? fields[pocLastCol] : "")?.trim() || "",
        pocEmail: (pocEmailCol >= 0 ? fields[pocEmailCol] : "")?.trim() || "",
        pocPhone: (pocPhoneCol >= 0 ? fields[pocPhoneCol] : "")?.trim() || "",
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
      tier: data.lcaCount >= TOP_COMPANY_THRESHOLD ? "top" : "below50",
      pocFirstName: data.pocFirstName,
      pocLastName: data.pocLastName,
      pocEmail: data.pocEmail,
      pocPhone: data.pocPhone,
    });
  }

  companies.sort((a, b) => b.priorityScore - a.priorityScore);
  return companies;
}

function main(): void {
  const dataDir = path.join(process.cwd(), "data");

  // Try 2025 full year file first, fallback to Q4 only
  let inputFile = path.join(dataDir, "lca_filtered_2025.csv");
  if (!fs.existsSync(inputFile)) {
    inputFile = path.join(dataDir, "lca_filtered.csv");
  } else {
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
      topCompanies: companies.filter((c) => c.tier === "top").length,
      regularCompanies: companies.filter((c) => c.tier !== "top").length,
      companies,
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
