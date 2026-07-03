/**
 * validate-ats-companies.ts
 *
 * Downloads company slug lists from Feashliaa/job-board-aggregator,
 * validates each against the actual ATS API, extracts company names,
 * checks if they have job postings matching target roles,
 * and outputs clean JSON files for use by the scraper.
 *
 * Run: npx tsx src/scripts/validate-ats-companies.ts
 *
 * Output (written to data/):
 *   - greenhouse-expanded.json
 *   - lever-expanded.json
 *   - ashby-expanded.json
 *
 * Environment variables:
 *   VALIDATE_TIMEOUT_MS  — per-request timeout (default 10000)
 *   VALIDATE_DELAY_MS    — delay between requests (default 100)
 *   VALIDATE_CONCURRENCY — max concurrent requests (default 5)
 */

import { getTargetRoles, getExcludedKeywords } from "@/lib/scrapers/types";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "data");

const GITHUB_RAW = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";

const SOURCES = [
  {
    platform: "greenhouse" as const,
    url: `${GITHUB_RAW}/greenhouse_companies.json`,
    apiFn: validateGreenhouse,
    outputFile: "greenhouse-expanded.json",
  },
  {
    platform: "lever" as const,
    url: `${GITHUB_RAW}/lever_companies.json`,
    apiFn: validateLever,
    outputFile: "lever-expanded.json",
  },
  {
    platform: "ashby" as const,
    url: `${GITHUB_RAW}/ashby_companies.json`,
    apiFn: validateAshby,
    outputFile: "ashby-expanded.json",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidatedCompany {
  token: string;
  id: string;
  name: string;
}

interface ValidationResult {
  success: true;
  name: string;
  id: string;
}

interface ValidationError {
  success: false;
  error: string;
  category:
    | "timeout"
    | "http-4xx"
    | "http-5xx"
    | "http-other"
    | "invalid-json"
    | "empty-response"
    | "network-error";
}

type ValidationOutcome = ValidationResult | ValidationError;

interface SourceStats {
  platform: string;
  total: number;
  valid: number;
  invalid: number;
  categories: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Slug → human-readable company name (for Lever/Ashby which don't return it) */
function slugToName(slug: string): string {
  // Remove trailing hyphens/underscores/numbers that look like disambiguation suffixes
  const cleaned = slug.replace(/[-_]\d+$/, "").replace(/[-_]+$/, "");

  // Split on hyphens, underscores, or camelCase boundaries
  const words: string[] = [];
  let current = "";

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    const prev = i > 0 ? cleaned[i - 1]! : "";

    if (ch === "-" || ch === "_") {
      if (current) words.push(current);
      current = "";
    } else if (/[A-Z]/.test(ch) && /[a-z]/.test(prev) && current.length > 0) {
      // camelCase boundary: "andurilIndustries" → "Anduril" + "Industries"
      words.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) words.push(current);

  // Title-case each word
  const named = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  return named || slug;
}

/** Slug → company ID (e.g. "airbnb" → "AIRBNB_INC") */
function slugToId(slug: string): string {
  const upper = slug
    .replace(/[-_]/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase();
  // Strip trailing _INC if slug already ends with "inc"
  const base = upper.replace(/_I_N_C$/, "_INC");
  return base.endsWith("_INC") ? base : `${base}_INC`;
}

/**
 * Check if a job title is relevant based on target roles and excluded keywords.
 * Uses the same logic as the scraper's filterJobs().
 */
function isJobTitleRelevant(title: string): boolean {
  const titleLower = title.toLowerCase();
  const targetRoles = getTargetRoles();
  const excludedKeywords = getExcludedKeywords();

  const matchesRole = targetRoles.some((role) => titleLower.includes(role.toLowerCase()));
  const hasExcluded = excludedKeywords.some((keyword) =>
    titleLower.includes(keyword.toLowerCase()),
  );

  return matchesRole && !hasExcluded;
}

/** Fetch with timeout and response-size limit */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: string; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    // Limit body to 512KB to avoid memory issues
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    const MAX_BODY = 524_288; // 512KB

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLength += value.length;
          if (totalLength > MAX_BODY) {
            reader.cancel();
            break;
          }
        }
      } catch {
        // Stream error — still try to use what we got
      }
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    return {
      ok: response.ok,
      status: response.status,
      body,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── API Validators ──────────────────────────────────────────────────────────

async function validateGreenhouse(slug: string, timeoutMs: number): Promise<ValidationOutcome> {
  try {
    // First fetch metadata to get company name
    const metaUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`;
    const meta = await fetchWithTimeout(metaUrl, timeoutMs);

    if (!meta.ok) {
      const cat =
        meta.status >= 400 && meta.status < 500
          ? "http-4xx"
          : meta.status >= 500
            ? "http-5xx"
            : "http-other";
      return {
        success: false,
        error: `HTTP ${meta.status}`,
        category: cat,
      };
    }

    if (!meta.body || meta.body.trim().length < 10) {
      return {
        success: false,
        error: "Empty or near-empty response body",
        category: "empty-response",
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(meta.body);
    } catch {
      return {
        success: false,
        error: "Non-JSON response body",
        category: "invalid-json",
      };
    }

    // Fetch jobs to check relevance
    const jobsUrl = `${metaUrl}/jobs`;
    const jobsRes = await fetchWithTimeout(jobsUrl, timeoutMs);

    if (!jobsRes.ok) {
      return {
        success: false,
        error: `Jobs endpoint HTTP ${jobsRes.status}`,
        category: jobsRes.status >= 400 && jobsRes.status < 500 ? "http-4xx" : "http-5xx",
      };
    }

    if (!jobsRes.body || jobsRes.body.trim().length < 10) {
      return {
        success: false,
        error: "Empty jobs response body",
        category: "empty-response",
      };
    }

    let jobsParsed: { jobs?: Array<{ title?: string }> };
    try {
      jobsParsed = JSON.parse(jobsRes.body);
    } catch {
      return {
        success: false,
        error: "Non-JSON in jobs response",
        category: "invalid-json",
      };
    }

    const jobs = jobsParsed.jobs;
    if (!Array.isArray(jobs)) {
      return {
        success: false,
        error: "Jobs response missing 'jobs' array",
        category: "invalid-json",
      };
    }

    // Check if any job title matches target roles
    const hasRelevantJob = jobs.some(
      (j) => typeof j.title === "string" && isJobTitleRelevant(j.title),
    );

    if (!hasRelevantJob) {
      return {
        success: false,
        error: "No jobs matching target roles",
        category: "empty-response",
      };
    }

    const name =
      typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : slugToName(slug);

    return {
      success: true,
      name,
      id: slugToId(slug),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request timed out", category: "timeout" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      category: "network-error",
    };
  }
}

async function validateLever(slug: string, timeoutMs: number): Promise<ValidationOutcome> {
  try {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
    const res = await fetchWithTimeout(url, timeoutMs);

    if (!res.ok) {
      const cat =
        res.status >= 400 && res.status < 500
          ? "http-4xx"
          : res.status >= 500
            ? "http-5xx"
            : "http-other";
      return { success: false, error: `HTTP ${res.status}`, category: cat };
    }

    if (!res.body || res.body.trim().length < 5) {
      return {
        success: false,
        error: "Empty response body",
        category: "empty-response",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return {
        success: false,
        error: "Non-JSON response body",
        category: "invalid-json",
      };
    }

    // Lever returns a JSON array of jobs
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        error: "Response is not a JSON array",
        category: "invalid-json",
      };
    }

    if (parsed.length === 0) {
      return {
        success: false,
        error: "Empty jobs array (no active postings)",
        category: "empty-response",
      };
    }

    // Check if any job title matches target roles
    const hasRelevantJob = (parsed as Array<{ text?: string }>).some(
      (j) => typeof j.text === "string" && isJobTitleRelevant(j.text),
    );

    if (!hasRelevantJob) {
      return {
        success: false,
        error: "No jobs matching target roles",
        category: "empty-response",
      };
    }

    const name = slugToName(slug);

    return { success: true, name, id: slugToId(slug) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request timed out", category: "timeout" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      category: "network-error",
    };
  }
}

async function validateAshby(slug: string, timeoutMs: number): Promise<ValidationOutcome> {
  try {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
    const res = await fetchWithTimeout(url, timeoutMs);

    if (!res.ok) {
      const cat =
        res.status >= 400 && res.status < 500
          ? "http-4xx"
          : res.status >= 500
            ? "http-5xx"
            : "http-other";
      return { success: false, error: `HTTP ${res.status}`, category: cat };
    }

    if (!res.body || res.body.trim().length < 10) {
      return {
        success: false,
        error: "Empty response body",
        category: "empty-response",
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return {
        success: false,
        error: "Non-JSON response body",
        category: "invalid-json",
      };
    }

    // Ashby returns { jobs: [...], apiVersion: "..." }
    const jobs = parsed.jobs;
    if (!Array.isArray(jobs)) {
      return {
        success: false,
        error: "Response missing 'jobs' array",
        category: "invalid-json",
      };
    }

    // Check if any job title matches target roles
    const hasRelevantJob = (jobs as Array<{ title?: string }>).some(
      (j) => typeof j.title === "string" && isJobTitleRelevant(j.title),
    );

    if (!hasRelevantJob) {
      return {
        success: false,
        error: "No jobs matching target roles",
        category: "empty-response",
      };
    }

    const name = slugToName(slug);

    return { success: true, name, id: slugToId(slug) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request timed out", category: "timeout" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      category: "network-error",
    };
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

async function fetchSlugs(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array from ${url}, got ${typeof parsed}`);
  }
  // Validate all entries are strings
  for (const item of parsed) {
    if (typeof item !== "string") {
      throw new Error(`Expected string array from ${url}, found non-string: ${typeof item}`);
    }
  }
  return parsed as string[];
}

async function processPlatform(
  source: (typeof SOURCES)[number],
  timeoutMs: number,
  delayMs: number,
  concurrency: number,
): Promise<{
  companies: ValidatedCompany[];
  stats: SourceStats;
}> {
  console.log(`\n📥 Fetching ${source.platform} slugs...`);
  const slugs = await fetchSlugs(source.url);
  console.log(`   Received ${slugs.length} slugs. Validating...`);

  const valid: ValidatedCompany[] = [];
  const stats: SourceStats = {
    platform: source.platform,
    total: slugs.length,
    valid: 0,
    invalid: 0,
    categories: {},
  };

  // Process in batches with limited concurrency
  for (let i = 0; i < slugs.length; i += concurrency) {
    const batch = slugs.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((slug) => source.apiFn(slug, timeoutMs)));

    for (let j = 0; j < batch.length; j++) {
      const slug = batch[j]!;
      const outcome = results[j]!;
      const idx = i + j + 1;

      if (outcome.success) {
        valid.push({
          token: slug,
          id: outcome.id,
          name: outcome.name,
        });
        stats.valid++;
        process.stdout.write(`✅`);
      } else {
        stats.invalid++;
        stats.categories[outcome.category] = (stats.categories[outcome.category] || 0) + 1;
        process.stdout.write(`❌`);
      }

      // Progress every 100 entries
      if (idx % 100 === 0 || idx === slugs.length) {
        process.stdout.write(
          ` ${idx}/${slugs.length} (${stats.valid} valid, ${stats.invalid} invalid)\n`,
        );
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < slugs.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { companies: valid, stats };
}

// ─── Slug-to-Name edge-case tests ───────────────────────────────────────────

function testSlugToName(): void {
  const tests: [string, string][] = [
    ["airbnb", "Airbnb"],
    ["andurilindustries", "Andurilindustries"], // will be "Andurilindustries" since no capital boundary
    ["anduril-industries", "Anduril Industries"],
    ["anduril_industries", "Anduril Industries"],
    ["a16z", "A16z"],
    ["1password", "1password"],
    ["10xgenomics", "10xgenomics"],
    ["openai", "Openai"],
    ["perplexity", "Perplexity"],
    ["18c78c4427514cebaa7039bbf8a8c249", "18c78c4427514cebaa7039bbf8a8c249"], // UUID-like
    ["10up-2", "10up"],
    ["playgig", "Playgig"],
    ["pocket-worlds", "Pocket Worlds"],
  ];

  console.log("\n🧪 Slug-to-Name conversion tests:");
  for (const [slug, expected] of tests) {
    const result = slugToName(slug);
    const pass = result === expected;
    console.log(
      `   ${pass ? "✅" : "❌"} "${slug}" → "${result}"${pass ? "" : ` (expected "${expected}")`}`,
    );
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     ATS Company Validation & Enrichment Tool     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Run converter tests
  testSlugToName();

  // Config
  const timeoutMs = Math.max(1000, parseInt(process.env.VALIDATE_TIMEOUT_MS || "") || 10000);
  const delayMs = Math.max(0, parseInt(process.env.VALIDATE_DELAY_MS || "") || 100);
  const concurrency = Math.max(
    1,
    Math.min(20, parseInt(process.env.VALIDATE_CONCURRENCY || "") || 5),
  );

  console.log(
    `\n⚙️  Config: timeout=${timeoutMs}ms, delay=${delayMs}ms, concurrency=${concurrency}`,
  );

  // Ensure data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const allStats: SourceStats[] = [];

  for (const source of SOURCES) {
    try {
      const { companies, stats } = await processPlatform(source, timeoutMs, delayMs, concurrency);

      allStats.push(stats);

      // Write output
      const outputPath = path.join(DATA_DIR, source.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(companies, null, 2), "utf-8");

      console.log(
        `\n📝 Wrote ${companies.length} valid ${source.platform} companies to ${source.outputFile}`,
      );
    } catch (err) {
      console.error(`\n❌ Fatal error processing ${source.platform}:`, err);
      allStats.push({
        platform: source.platform,
        total: 0,
        valid: 0,
        invalid: 0,
        categories: { "fatal-error": 1 },
      });
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                    SUMMARY                      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  let grandTotal = 0;
  let grandValid = 0;

  for (const s of allStats) {
    const pct = s.total > 0 ? ((s.valid / s.total) * 100).toFixed(1) : "N/A";
    console.log(`  ${s.platform.padEnd(12)} ${s.valid}/${s.total} valid (${pct}%)`);

    // Show error category breakdown if there are failures
    if (s.invalid > 0) {
      const sortedCats = Object.entries(s.categories).sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of sortedCats) {
        const pct = ((count / s.invalid) * 100).toFixed(1);
        console.log(`    ${cat.padEnd(16)} ${count} (${pct}%)`);
      }
    }

    grandTotal += s.total;
    grandValid += s.valid;
  }

  const grandPct = grandTotal > 0 ? ((grandValid / grandTotal) * 100).toFixed(1) : "N/A";
  console.log(`\n  ${"TOTAL".padEnd(12)} ${grandValid}/${grandTotal} valid (${grandPct}%)`);
  console.log("\n✅ Done!");
}

main().catch((err) => {
  console.error("\n❌ Script failed:", err);
  process.exit(1);
});
