"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { getProfiles, type Profile } from "@/lib/storage";
import {
  gatewayInstructions,
  MAX_IMPORT_JOBS,
  parseJobBatch,
  submitJobBatch,
} from "@/lib/job-import";

export default function AutomationGateway() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [json, setJson] = useState("");
  const [profileId, setProfileId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://final-destination-rose.vercel.app");
  const busy = useRef(false);

  useEffect(() => {
    let mounted = true;
    setOrigin(window.location.origin);
    const load = async () => {
      try {
        const profiles = await getProfiles();
        if (mounted) setProfiles(profiles);
      } catch (error) {
        if (mounted)
          setError(error instanceof Error ? error.message : "Profiles could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => {
      mounted = false;
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const preview = useMemo(() => {
    if (!json.trim()) return { jobs: [], error: "" };
    try {
      return { jobs: parseJobBatch(json, profiles, profileId), error: "" };
    } catch (error) {
      return { jobs: [], error: error instanceof Error ? error.message : "Invalid jobs JSON." };
    }
  }, [json, profiles, profileId]);
  const instructions = gatewayInstructions(profiles, origin);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || !preview.jobs.length) return;
    busy.current = true;
    setAdding(true);
    setError("");
    try {
      await submitJobBatch(json, profileId);
      router.push("/batch");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Jobs were not saved. Retry the import.");
    } finally {
      busy.current = false;
      setAdding(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8">
      <nav className="flex items-center justify-between text-sm">
        <a href="/batch" className="underline">
          Back to queue
        </a>
        <a href="/docs/ai-import" className="underline">
          Bot instructions
        </a>
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Automation gateway</h1>
        <p>
          For Muse AI, ChatGPT and other browser assistants. Add 1–{MAX_IMPORT_JOBS} jobs with a
          full JD, an application link and an explicitly chosen profile.
        </p>
        <p className="text-sm text-gray-600">
          Jobs stay in this browser. Use the same browser as your templates, and keep the website
          open while the queue runs.
        </p>
      </header>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">Instructions for your bot</summary>
        <pre className="my-3 overflow-auto text-sm whitespace-pre-wrap">{instructions}</pre>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(instructions);
              setCopied(true);
            } catch {
              setError("Clipboard unavailable. Copy the instructions above.");
            }
          }}
        >
          {copied ? "Instructions copied" : "Copy bot instructions"}
        </Button>
      </details>
      <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
        <div className="space-y-1">
          <label htmlFor="batch-profile" className="block font-medium">
            Batch profile
          </label>
          <select
            id="batch-profile"
            value={profileId}
            disabled={loading || adding}
            onChange={(event) => {
              setProfileId(event.target.value);
              setError("");
            }}
            className="w-full rounded-lg border p-2"
          >
            <option value="">Select a profile, or specify one in every job</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600">
            Per-job profileId or profileName takes priority. No profile is chosen automatically.
          </p>
          {!loading && !profiles.length && (
            <p role="alert">
              Create a profile in Templates &amp; background before importing jobs.
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="jobs-json" className="block font-medium">
            Jobs JSON
          </label>
          <textarea
            id="jobs-json"
            data-testid="gateway-jobs"
            rows={10}
            value={json}
            disabled={adding}
            spellCheck={false}
            aria-describedby="json-help"
            aria-invalid={Boolean(preview.error)}
            onInput={(event) => {
              setJson(event.currentTarget.value);
              setError("");
            }}
            placeholder={
              '{"jobs":[{"companyName":"Company","positionTitle":"Role","jobDescription":"Full job posting text","applicationUrl":"https://example.com/apply/role","profileName":"Your profile"}]}'
            }
            className="w-full rounded-lg border p-3 font-mono text-sm"
          />
          <p id="json-help" className="text-sm text-gray-600">
            An array or {'{"jobs": [...]}'} is accepted. Every row must be valid; a batch is saved
            together.
          </p>
        </div>
        {(preview.error || error) && (
          <p role="alert" className="text-sm text-red-600">
            {error || preview.error}
          </p>
        )}
        {preview.jobs.length > 0 && (
          <section aria-label="Jobs ready to import" className="space-y-3">
            <h2 className="font-semibold">{preview.jobs.length} jobs ready</h2>
            {preview.jobs.map((job, index) => (
              <article key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">
                    {index + 1}. {job.companyName} — {job.positionTitle}
                  </h3>
                  <select
                    aria-label={`Profile for job ${index + 1}`}
                    value={job.profileId}
                    disabled={adding}
                    onChange={(event) => {
                      const jobs = preview.jobs.map(({ companyUrl, ...job }, i) => ({
                        ...job,
                        applicationUrl: companyUrl,
                        profileId: i === index ? event.target.value : job.profileId,
                        profileName: undefined,
                      }));
                      setJson(JSON.stringify({ jobs }, null, 2));
                      setError("");
                    }}
                    className="rounded-lg border p-1.5 text-sm"
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
                <a
                  href={job.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm underline"
                >
                  Application link: {job.companyUrl}
                </a>
                <details>
                  <summary className="cursor-pointer text-sm">
                    Full JD ({job.jobDescription.length} characters)
                    {job.includeCoverLetter ? " · Cover letter requested" : ""}
                  </summary>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{job.jobDescription}</p>
                </details>
              </article>
            ))}
          </section>
        )}
        <Button
          type="submit"
          disabled={adding || loading || !preview.jobs.length}
          variant="primary"
        >
          {adding ? "Saving jobs…" : "Add jobs to queue"}
        </Button>
      </form>
    </main>
  );
}
