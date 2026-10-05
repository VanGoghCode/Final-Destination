import { apiJSON } from "./client-api";
import {
  getProfiles,
  getResumeTemplates,
  getCoverLetterTemplates,
  getDefaultResumeId,
  getDefaultCoverLetterId,
  type Profile,
} from "./storage";

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
  profiles: Profile[],
  fallbackProfileId = "",
): ImportedJob[] {
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
    const byId = profiles.find((profile) => profile.id === (raw.profileId || fallbackProfileId));
    const byName =
      typeof raw.profileName === "string" && raw.profileName.trim()
        ? profiles.filter(
            (profile) => profile.name.toLowerCase() === raw.profileName.trim().toLowerCase(),
          )
        : [];
    if (byName.length > 1 && !raw.profileId) fail("profile name is ambiguous; use profileId.");
    if (raw.profileId && raw.profileName && !byName.some((profile) => profile.id === byId?.id))
      fail("profileId and profileName disagree.");
    const profile = raw.profileId ? byId : raw.profileName ? byName[0] : byId;
    if (!profile) fail("select an existing profile or supply its profileId/profileName.");
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
  const profiles = await getProfiles();
  const jobs = parseJobBatch(input, profiles, fallbackProfileId);
  const [resumes, covers, defaultResume, defaultCover] = await Promise.all([
    getResumeTemplates(),
    getCoverLetterTemplates(),
    getDefaultResumeId(),
    getDefaultCoverLetterId(),
  ]);
  for (const job of jobs) {
    const profile = profiles.find((profile) => profile.id === job.profileId)!;
    const resumeId = profile.defaultResumeId || defaultResume || resumes[0]?.id;
    const coverId = profile.defaultCoverLetterId || defaultCover || covers[0]?.id;
    if (!resumes.some((template) => template.id === resumeId && template.content.trim()))
      throw Error(`${profile.name}: choose a resume template before importing.`);
    if (
      job.includeCoverLetter &&
      !covers.some((template) => template.id === coverId && template.content.trim())
    )
      throw Error(`${profile.name}: choose a cover letter template before importing.`);
  }
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
    body: JSON.stringify({ jobs: submitted }),
  });
  if (!result.success || result.errors?.length)
    throw Error("Batch was not saved completely. Check the queue before retrying.");
  return result;
}

export function gatewayInstructions(profiles: Profile[], origin: string) {
  return `Add 1–15 real jobs at ${origin}/batch/import. Read the available profiles and choose the best match for each job. Paste JSON in "Jobs JSON", select "Batch profile" if a job omits its profile, then click "Add jobs to queue". Verify the queue confirmation. Do not invent or summarize the JD: include the full posting text and a direct application-page link, not the company homepage. Keep the site open to process jobs.\n\nAvailable profiles:\n${profiles.map((profile) => `${profile.name}: ${profile.id}`).join("\n") || "Create a profile on the website first."}\n\nJSON format:\n{"jobs":[{"companyName":"Company","positionTitle":"Role","jobDescription":"Full JD copied from the job posting","applicationUrl":"https://example.com/apply/role","profileName":"Choose an available profile","includeCoverLetter":false}]}`;
}
