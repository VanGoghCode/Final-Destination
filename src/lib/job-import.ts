import { apiJSON } from "./client-api";
import type { Profile } from "./storage";
import { personalProfile } from "./personal-workspace";

export const MAX_IMPORT_JOBS = 15;
export interface ImportedJob {
  companyName: string;
  positionTitle: string;
  jobDescription: string;
  companyUrl: string;
  profileId: string;
  profileName: string;
  profileColor: string;
  includeCoverLetter: boolean;
}
export function parseJobBatch(
  input: string,
  _profiles: Profile[] = [],
  _fallbackProfileId = "",
): ImportedJob[] {
  void _profiles;
  void _fallbackProfileId;
  let value;
  try {
    value = JSON.parse(
      input
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw Error("Paste valid JSON containing a jobs array.");
  }
  const jobs = Array.isArray(value) ? value : value?.jobs;
  if (!Array.isArray(jobs) || !jobs.length || jobs.length > MAX_IMPORT_JOBS)
    throw Error(`Submit 1–${MAX_IMPORT_JOBS} jobs at a time.`);
  return jobs.map((raw, index) => {
    const fail = (message: string): never => {
      throw Error(`Job ${index + 1}: ${message}`);
    };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("expected a job object.");
    const text = (key: string) => {
      if (typeof raw[key] !== "string" || !raw[key].trim() || raw[key].length > 200_000)
        fail(`${key} is required and must be text.`);
      return raw[key].trim() as string;
    };
    const companyName = text("companyName"),
      positionTitle = text("positionTitle"),
      jobDescription = text("jobDescription");
    let url: URL;
    try {
      url = new URL(raw.applicationUrl ?? raw.jobUrl ?? raw.companyUrl);
    } catch {
      return fail("applicationUrl must be a complete application-page link.");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      fail("applicationUrl must be an HTTP(S) link without credentials.");
    const profile = personalProfile;
    if (raw.includeCoverLetter !== undefined && typeof raw.includeCoverLetter !== "boolean")
      fail("includeCoverLetter must be true or false.");
    return {
      companyName,
      positionTitle,
      jobDescription,
      companyUrl: url.href,
      profileId: profile!.id,
      profileName: profile!.name,
      profileColor: profile!.color,
      includeCoverLetter: raw.includeCoverLetter === true,
    };
  });
}

export async function submitJobBatch(input: string, fallbackProfileId = "") {
  const jobs = parseJobBatch(input, [], fallbackProfileId);
  const submitted = await Promise.all(
    jobs.map(async (job) => {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify([
            job.companyName,
            job.positionTitle,
            job.companyUrl,
            job.jobDescription,
            job.profileId,
            job.includeCoverLetter,
          ]),
        ),
      );
      return {
        ...job,
        id: `import-${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      };
    }),
  );
  const result = await apiJSON<{
    success: boolean;
    added: number;
    duplicates?: number;
    errors?: unknown[];
  }>("/api/queue", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobs: submitted, startQueue: true }),
  });
  if (!result.success || result.errors?.length)
    throw Error("Batch was not saved completely. Check the queue before retrying.");
  return result;
}

export function gatewayInstructions(profiles: Profile[], origin: string) {
  void profiles;
  return `Add 1–15 real jobs at ${origin}/batch/import. Paste JSON in "Jobs JSON" and click "Add jobs to queue". Verify the queue confirmation. Include the full JD and a direct application-page link, not a company homepage. Kirtan's resume template and background are automatic; do not select a profile. New jobs start processing automatically. The shared queue appears in every browser. Keep a website tab open until processing finishes.\n\nJSON format:\n{"jobs":[{"companyName":"Company","positionTitle":"Role","jobDescription":"Full job posting text","applicationUrl":"https://example.com/apply/role","includeCoverLetter":false}]}`;
}
