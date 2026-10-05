"use client";

import { apiFetch } from "@/lib/client-api";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import {
  getDefaultResumeTemplate,
  getDefaultCoverLetterTemplate,
  getResumeTemplates,
  getCoverLetterTemplates,
  getProfiles,
  Profile,
} from "@/lib/storage";
import { sanitizeUrl } from "@/lib/sanitize";

interface ImportedJob {
  companyName: string;
  positionTitle: string;
  jobDescription: string;
  companyUrl: string;
  companyWebsite?: string;
  includeCoverLetter?: boolean;
}

interface PreviewJob extends ImportedJob {
  _index: number;
  _valid: boolean;
  _errors: string[];
  _source: "full" | "structured";
}

interface ProfileData {
  resumeLatex: string;
  coverLetterLatex: string | null;
}

const queueSubmissionIds = new Map<string, string>();
const profileCacheRef = { current: {} as Record<string, ProfileData> };

/** Synthesize a job description from structured extraction fields */
function synthesizeJobDescription(job: {
  positionTitle: string;
  companyName: string;
  jobDescriptionSummary?: string;
  extractedRequirements?: string[];
  extractedResponsibilities?: string[];
  techStack?: string[];
  jobLocation?: string;
  compensation?: string;
  whyMatch?: string;
}): string {
  const parts: string[] = [];

  parts.push(`Position: ${job.positionTitle}`);
  parts.push(`Company: ${job.companyName}`);
  if (job.jobLocation) parts.push(`Location: ${job.jobLocation}`);
  if (job.compensation) parts.push(`Compensation: ${job.compensation}`);
  parts.push("");

  if (job.jobDescriptionSummary) {
    parts.push("=== Job Description ===");
    parts.push(job.jobDescriptionSummary);
    parts.push("");
  }

  if (job.extractedResponsibilities && job.extractedResponsibilities.length > 0) {
    parts.push("=== Responsibilities ===");
    job.extractedResponsibilities.forEach((r) => parts.push(`- ${r}`));
    parts.push("");
  }

  if (job.extractedRequirements && job.extractedRequirements.length > 0) {
    parts.push("=== Requirements ===");
    job.extractedRequirements.forEach((r) => parts.push(`- ${r}`));
    parts.push("");
  }

  if (job.techStack && job.techStack.length > 0) {
    parts.push("=== Tech Stack ===");
    parts.push(job.techStack.join(", "));
    parts.push("");
  }

  if (job.whyMatch) {
    parts.push("=== Why This Candidate Matches ===");
    parts.push(job.whyMatch);
  }

  return parts.join("\n");
}

function buildPrompt(days: number) {
  return `Find job postings from the last ${days} day${days > 1 ? "s" : ""} that match my background and preferences below. Return only JSON:
{"jobs":[{"companyName":"Company","positionTitle":"Role","companyUrl":"https://example.com/job","jobDescriptionSummary":"Detailed description of the role and requirements","includeCoverLetter":false}]}

Use real posting URLs and comprehensive summaries. Optional fields: extractedRequirements, extractedResponsibilities and techStack (arrays of strings); companyWebsite, jobLocation, compensation and whyMatch (strings).

My background and preferences:
[Paste your master context and preferred roles here.]`;
}

export default function AIImportPage() {
  const router = useRouter();
  const [jsonInput, setJsonInput] = useState("");
  const [parsedJobs, setParsedJobs] = useState<PreviewJob[]>([]);
  const [parseError, setParseError] = useState("");
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [promptCopied, setPromptCopied] = useState(false);
  const [templateReady, setTemplateReady] = useState<{
    resumeLatex: string;
    coverLetterLatex: string | null;
  } | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobProfiles, setJobProfiles] = useState<Record<number, string>>({});
  const [jobCoverLetters, setJobCoverLetters] = useState<Record<number, boolean>>({});
  const [freshnessDays, setFreshnessDays] = useState(1);

  // Load profiles + templates on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [allProfiles, allResumeTemplates, allCoverTemplates, resumeTmpl, coverTmpl] =
          await Promise.all([
            getProfiles(),
            getResumeTemplates(),
            getCoverLetterTemplates(),
            getDefaultResumeTemplate(),
            getDefaultCoverLetterTemplate(),
          ]);

        const profileCache: Record<string, ProfileData> = {};
        for (const p of allProfiles) {
          let rLatex = resumeTmpl?.content || "";
          let cLatex = coverTmpl?.content || null;
          if (p.defaultResumeId) {
            const t = allResumeTemplates.find((t) => t.id === p.defaultResumeId);
            if (t?.content) rLatex = t.content;
          }
          if (p.defaultCoverLetterId) {
            const t = allCoverTemplates.find((t) => t.id === p.defaultCoverLetterId);
            if (t?.content) cLatex = t.content;
          }
          profileCache[p.id] = { resumeLatex: rLatex, coverLetterLatex: cLatex };
        }
        profileCacheRef.current = profileCache;

        setProfiles(allProfiles);
        if (resumeTmpl) {
          setTemplateReady({
            resumeLatex: resumeTmpl.content,
            coverLetterLatex: coverTmpl?.content || null,
          });
        }
      } catch {
        // non-critical
      } finally {
        setTemplateLoading(false);
      }
    };
    load();
  }, []);

  const validateJob = useCallback((job: Record<string, unknown>, index: number): PreviewJob => {
    const errors: string[] = [];

    if (!job.companyName || typeof job.companyName !== "string") errors.push("Missing companyName");
    if (!job.positionTitle || typeof job.positionTitle !== "string")
      errors.push("Missing positionTitle");
    if (!job.companyUrl || typeof job.companyUrl !== "string") errors.push("Missing companyUrl");

    // Accept EITHER full jobDescription OR structured fields
    const hasFullDesc = typeof job.jobDescription === "string" && job.jobDescription.length > 0;
    const hasSummary =
      typeof job.jobDescriptionSummary === "string" && job.jobDescriptionSummary.length > 0;

    if (!hasFullDesc && !hasSummary) {
      errors.push("Missing jobDescription or jobDescriptionSummary");
    }

    return {
      companyName: (job.companyName as string) || "",
      positionTitle: (job.positionTitle as string) || "",
      jobDescription: hasFullDesc
        ? (job.jobDescription as string)
        : hasSummary
          ? synthesizeJobDescription({
              positionTitle: (job.positionTitle as string) || "",
              companyName: (job.companyName as string) || "",
              jobDescriptionSummary: (job.jobDescriptionSummary as string) || "",
              extractedRequirements: Array.isArray(job.extractedRequirements)
                ? (job.extractedRequirements as string[])
                : undefined,
              extractedResponsibilities: Array.isArray(job.extractedResponsibilities)
                ? (job.extractedResponsibilities as string[])
                : undefined,
              techStack: Array.isArray(job.techStack) ? (job.techStack as string[]) : undefined,
              jobLocation: (job.jobLocation as string) || "",
              compensation: (job.compensation as string) || "",
              whyMatch: (job.whyMatch as string) || "",
            })
          : "",
      companyUrl: sanitizeUrl((job.companyUrl as string) || ""),
      companyWebsite: sanitizeUrl((job.companyWebsite as string) || ""),
      includeCoverLetter: job.includeCoverLetter === true,
      _index: index,
      _valid: errors.length === 0,
      _errors: errors,
      _source: hasFullDesc ? "full" : "structured",
    };
  }, []);

  const handleParse = useCallback(() => {
    setParseError("");
    setAddedCount(0);

    if (!jsonInput.trim()) {
      setParseError("Paste some JSON first.");
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput.trim());

      let jobs: Record<string, unknown>[];

      if (Array.isArray(parsed)) {
        jobs = parsed;
      } else if (parsed.jobs && Array.isArray(parsed.jobs)) {
        jobs = parsed.jobs;
      } else {
        setParseError(
          'JSON must be an array of jobs or an object with a "jobs" array. e.g. { "jobs": [...] }',
        );
        return;
      }

      if (jobs.length === 0) {
        setParseError("No jobs found in the JSON.");
        return;
      }

      if (jobs.length > 50) {
        setParseError("Maximum 50 jobs per batch. Found " + jobs.length);
        return;
      }

      const validated = jobs.map((j, i) => validateJob(j, i));
      setParsedJobs(validated);
      setJobProfiles(
        profiles.length > 0
          ? Object.fromEntries(validated.map((j) => [j._index, profiles[0]!.id]))
          : {},
      );
      setJobCoverLetters({});

      const validCount = validated.filter((j) => j._valid).length;
      if (validCount === 0) {
        setParseError("No valid jobs found. Check required fields.");
      }
    } catch {
      setParseError("Invalid JSON. Check the format and try again.");
    }
  }, [jsonInput, validateJob, profiles]);

  const handleAddToQueue = useCallback(async () => {
    const valid = parsedJobs.filter((j) => j._valid);
    if (valid.length === 0) return;

    if (!templateReady) {
      setParseError("No resume template found. Set one up on the main page first.");
      return;
    }

    // Validate every valid job has a profile selected
    if (profiles.length > 0) {
      const missing = valid.filter((j) => !jobProfiles[j._index]);
      if (missing.length > 0) {
        setParseError(
          `Select a profile for ${missing.length} job${missing.length > 1 ? "s" : ""} before adding to queue.`,
        );
        return;
      }
    }

    setAdding(true);
    setParseError("");

    try {
      const jobs = valid.map((j) => {
        const pId = jobProfiles[j._index];
        const cached = pId ? profileCacheRef.current[pId] : null;
        let resumeLatex = templateReady.resumeLatex;
        let coverLetterLatex = templateReady.coverLetterLatex;
        let profileId: string | undefined;
        let profileName: string | undefined;
        let profileColor: string | undefined;

        if (pId && cached) {
          if (!cached.resumeLatex)
            throw new Error("The selected profile has no assigned resume template.");
          resumeLatex = cached.resumeLatex;
          coverLetterLatex = cached.coverLetterLatex || "";
          const p = profiles.find((p) => p.id === pId);
          if (p) {
            profileId = p.id;
            profileName = p.name;
            profileColor = p.color;
          }
        }

        return {
          companyName: j.companyName,
          positionTitle: j.positionTitle,
          jobDescription: j.jobDescription,
          companyUrl: j.companyUrl,
          companyWebsite: j.companyWebsite || "",
          includeCoverLetter: jobCoverLetters[j._index] ?? j.includeCoverLetter ?? false,
          personalDetails: "",
          resumeLatex,
          coverLetterLatex: coverLetterLatex || "",
          profileId,
          profileName,
          profileColor,
        };
      });

      const submitted = jobs.map((job) => {
        const key = JSON.stringify(job);
        const id = queueSubmissionIds.get(key) || crypto.randomUUID();
        queueSubmissionIds.set(key, id);
        return { ...job, id };
      });
      const res = await apiFetch("/api/queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: submitted }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(
          data.error || (data.details ? JSON.stringify(data.details) : "Failed to add jobs"),
        );
      }

      if (data.errors?.length)
        throw new Error(
          `${data.added ?? 0} jobs saved; some entries were rejected. Check the queue before retrying.`,
        );
      jobs.forEach((job) => queueSubmissionIds.delete(JSON.stringify(job)));
      setAddedCount(data.added ?? 0);

      // Navigate to batch page after a brief delay
      setTimeout(() => {
        router.push("/batch");
      }, 1500);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to add jobs");
      setAdding(false);
    }
  }, [parsedJobs, templateReady, router, jobProfiles, profiles, jobCoverLetters]);

  // Reset when input changes
  useEffect(() => {
    if (parsedJobs.length > 0) {
      setParsedJobs([]);
      setJobProfiles({});
      setJobCoverLetters({});
      setParseError("");
      setAddedCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonInput]);

  const handlePasteExample = useCallback(() => {
    setJsonInput(
      JSON.stringify(
        {
          jobs: [
            {
              companyName: "Stripe",
              positionTitle: "Software Engineer, Infrastructure",
              jobDescription:
                "We are looking for software engineers to build the economic infrastructure for the internet... (full JD here)",
              companyUrl: "https://stripe.com/jobs/software-engineer-infrastructure/123",
              companyWebsite: "https://stripe.com",
              includeCoverLetter: true,
            },
            {
              companyName: "Airbnb",
              positionTitle: "Senior Software Engineer",
              jobDescription:
                "Join our platform engineering team to build tools that empower our host community... (full JD here)",
              companyUrl: "https://airbnb.com/careers/senior-software-engineer/456",
              companyWebsite: "https://airbnb.com",
              includeCoverLetter: false,
            },
          ],
        },
        null,
        2,
      ),
    );
  }, []);

  const validCount = parsedJobs.filter((j) => j._valid).length;
  const invalidCount = parsedJobs.length - validCount;
  const allCoverLettersOn = useMemo(
    () => parsedJobs.every((j) => jobCoverLetters[j._index] ?? j.includeCoverLetter),
    [parsedJobs, jobCoverLetters],
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/batch")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Batch
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-lg font-bold">Import Jobs from AI</h1>
          </div>
          <a
            href="/docs/ai-import"
            className="text-sm text-gray-500 underline decoration-dotted underline-offset-4 hover:text-gray-800"
          >
            Prompt template
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Step 1: Get JSON from AI */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
              1
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold">Ask an AI to find jobs</h2>
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                  {[1, 2, 3, 4].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFreshnessDays(d)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                        freshnessDays === d
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {freshnessDays === 1 ? "24h" : `${freshnessDays * 24}h`} window
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Copy the prompt below and paste into ChatGPT, Claude, or any AI. It has your profile
                baked in — the AI will search for matching jobs and return structured JSON.
              </p>

              <div className="relative mt-3">
                <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-gray-900 p-4 font-mono text-xs leading-relaxed text-gray-100">
                  <pre className="whitespace-pre-wrap">{buildPrompt(freshnessDays)}</pre>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(buildPrompt(freshnessDays));
                    setPromptCopied(true);
                    setTimeout(() => setPromptCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-800"
                >
                  {promptCopied ? "Copied!" : "Copy prompt"}
                </button>
              </div>

              <button
                onClick={handlePasteExample}
                className="mt-2 text-xs text-gray-500 underline decoration-dotted hover:text-gray-800"
              >
                Paste example JSON (to test the parser)
              </button>
            </div>
          </div>
        </section>

        {/* Step 2: Paste JSON */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
              2
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Paste the JSON here</h2>
              <p className="mt-1 text-sm text-gray-500">
                Copy the JSON output from the AI and paste it below.
              </p>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"jobs": [{"companyName": "Stripe", ...}]}'
                rows={8}
                className="mt-3 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm focus:border-gray-400 focus:outline-none"
                spellCheck={false}
              />

              <div className="mt-3 flex items-center gap-3">
                <Button onClick={handleParse} variant="primary" disabled={!jsonInput.trim()}>
                  Parse
                </Button>
                <a
                  href="/docs/ai-import"
                  className="text-sm text-gray-500 underline decoration-dotted underline-offset-4 hover:text-gray-800"
                >
                  Don&apos;t have JSON? Get the prompt template
                </a>
              </div>

              {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
            </div>
          </div>
        </section>

        {/* Preview */}
        {parsedJobs.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                3
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Preview</h2>
                  <span className="text-xs text-gray-500">
                    {validCount} valid{invalidCount > 0 ? `, ${invalidCount} with errors` : ""}
                  </span>
                </div>

                {/* Template status */}
                {templateLoading ? (
                  <p className="mt-2 text-xs text-gray-400">Loading resume template...</p>
                ) : !templateReady ? (
                  <p className="mt-2 text-xs text-red-500">
                    No resume template found.{" "}
                    <button
                      onClick={() => router.push("/")}
                      className="underline hover:text-red-700"
                    >
                      Set one up
                    </button>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-green-600">
                    Resume template ready &mdash; will be baked into jobs for server-side
                    processing.
                  </p>
                )}

                {/* Profile selector — apply to all */}
                {profiles.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-600">
                      Profile (resume template):
                    </label>
                    <select
                      id="global-profile-select"
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select a profile…
                      </option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const sel = document.getElementById(
                          "global-profile-select",
                        ) as HTMLSelectElement;
                        if (sel && sel.value) {
                          const id = sel.value;
                          setJobProfiles((prev) => {
                            const next = { ...prev };
                            parsedJobs.forEach((j) => {
                              next[j._index] = id;
                            });
                            return next;
                          });
                        }
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    >
                      Apply to all
                    </button>
                  </div>
                )}

                {/* Cover letter toggle — apply to all */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600">Cover letter:</label>
                  <button
                    onClick={() => {
                      const newVal = !allCoverLettersOn;
                      setJobCoverLetters((prev) => {
                        const next = { ...prev };
                        parsedJobs.forEach((j) => {
                          next[j._index] = newVal;
                        });
                        return next;
                      });
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  >
                    {allCoverLettersOn ? "Disable all" : "Enable all"}
                  </button>
                </div>

                {/* Table */}
                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 font-medium">Company</th>
                        <th className="px-4 py-2 font-medium">Position</th>
                        <th className="px-4 py-2 font-medium">Cover</th>
                        {profiles.length > 0 && <th className="px-4 py-2 font-medium">Profile</th>}
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedJobs.map((job) => (
                        <tr key={job._index} className={job._valid ? "" : "bg-red-50/50"}>
                          <td className="max-w-[160px] truncate px-4 py-2.5 font-medium">
                            {job.companyName || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-gray-600">
                            {job.positionTitle || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={jobCoverLetters[job._index] ?? job.includeCoverLetter}
                                onChange={(e) =>
                                  setJobCoverLetters((prev) => ({
                                    ...prev,
                                    [job._index]: e.target.checked,
                                  }))
                                }
                              />
                              <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-indigo-600 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                              <span className="ms-2 text-[10px] font-medium text-gray-500">
                                {(jobCoverLetters[job._index] ?? job.includeCoverLetter)
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </label>
                          </td>
                          {profiles.length > 0 && (
                            <td className="px-4 py-2.5">
                              <select
                                value={jobProfiles[job._index] || ""}
                                onChange={(e) =>
                                  setJobProfiles((prev) => ({
                                    ...prev,
                                    [job._index]: e.target.value,
                                  }))
                                }
                                className="max-w-[140px] rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-gray-400 focus:outline-none"
                              >
                                {profiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            {job._valid ? (
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                OK
                              </span>
                            ) : (
                              <span
                                className="cursor-help rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                                title={job._errors.join("; ")}
                              >
                                {job._errors.length} error{job._errors.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add button */}
                {validCount > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      onClick={handleAddToQueue}
                      variant="primary"
                      disabled={adding || !templateReady}
                    >
                      {adding
                        ? "Adding..."
                        : `Add ${validCount} Job${validCount > 1 ? "s" : ""} to Queue`}
                    </Button>
                    {addedCount > 0 && (
                      <span className="text-sm text-green-600">
                        Added {addedCount} job{addedCount > 1 ? "s" : ""}! Redirecting to batch...
                      </span>
                    )}
                  </div>
                )}

                {/* Invalid details */}
                {invalidCount > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700">
                      {invalidCount} job{invalidCount > 1 ? "s" : ""} with errors &mdash; click for
                      details
                    </summary>
                    <div className="mt-2 space-y-2">
                      {parsedJobs
                        .filter((j) => !j._valid)
                        .map((job) => (
                          <div key={job._index} className="rounded-lg bg-red-50 p-3 text-xs">
                            <p className="font-medium">
                              #{job._index + 1}: {job.companyName || "(no name)"} —{" "}
                              {job.positionTitle || "(no title)"}
                            </p>
                            <ul className="mt-1 list-inside list-disc text-red-600">
                              {job._errors.map((err, ei) => (
                                <li key={ei}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
