"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ModelSelector from "@/components/ModelSelector";
import {
  gatewayInstructions,
  MAX_IMPORT_JOBS,
  parseJobBatch,
  submitJobBatch,
} from "@/lib/job-import";

export default function AutomationGateway() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://final-destination-rose.vercel.app");
  const busy = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const preview = useMemo(() => {
    if (!json.trim()) return { jobs: [], error: "" };
    try {
      return { jobs: parseJobBatch(json), error: "" };
    } catch (error) {
      return { jobs: [], error: error instanceof Error ? error.message : "Invalid jobs JSON." };
    }
  }, [json]);
  const instructions = gatewayInstructions([], origin);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || !preview.jobs.length) return;
    busy.current = true;
    setAdding(true);
    setError("");
    try {
      await submitJobBatch(json);
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
        <div className="max-w-xs">
          <ModelSelector />
        </div>
        <p>
          For Muse AI, ChatGPT and other browser assistants. Add 1–{MAX_IMPORT_JOBS} jobs with a
          full JD and an application link. Your template and master context are used automatically.
        </p>
        <p className="text-sm text-gray-600">
          Your queue is shared across browsers. Keep a website tab open while the queue runs. Adding
          new jobs starts processing automatically.
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
              '{"jobs":[{"companyName":"Company","positionTitle":"Role","jobDescription":"Full job posting text","applicationUrl":"https://example.com/apply/role"}]}'
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
        <Button type="submit" disabled={adding || !preview.jobs.length} variant="primary">
          {adding ? "Saving jobs…" : "Add jobs to queue"}
        </Button>
      </form>
    </main>
  );
}
