"use client";

import { useState, useCallback } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-800"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

const PROMPT_TEMPLATE = `I need you to find job listings and return them as structured JSON. Do NOT include the full copyrighted job description text — instead extract key details into structured fields.

Return ONLY this JSON structure — nothing before or after:

{
  "jobs": [
    {
      "companyName": "Company name (required)",
      "positionTitle": "Exact job title (required)",
      "companyUrl": "Direct URL to the job posting page (required)",
      "companyWebsite": "Company's main website (optional)",
      "includeCoverLetter": true,
      "jobDescriptionSummary": "Comprehensive paragraph summarizing the full job description — write this cohesively like a real JD (required)",
      "extractedRequirements": ["Requirement 1", "Requirement 2"],
      "extractedResponsibilities": ["Responsibility 1", "Responsibility 2"],
      "techStack": ["Technology 1", "Technology 2"],
      "jobLocation": "City, State or Remote",
      "compensation": "Salary range if listed",
      "whyMatch": "Why this role fits the candidate's profile"
    }
  ]
}

Rules:
1. Every job MUST have companyName, positionTitle, companyUrl, and jobDescriptionSummary
2. jobDescriptionSummary must be detailed and comprehensive
3. Return ONLY the JSON object, no commentary before or after
4. Only include jobs posted within the last 24 hours
5. Aim for quality matches over quantity

My criteria:
[Replace with: job titles, companies, locations, remote preference, etc.]`;

const JSON_SCHEMA = `{
  "jobs": [
    {
      "companyName": "Stripe",
      "positionTitle": "Software Engineer, Infrastructure",
      "companyUrl": "https://stripe.com/jobs/swe-infrastructure/abc123",
      "companyWebsite": "https://stripe.com",
      "includeCoverLetter": true,
      "jobDescriptionSummary": "Stripe is looking for a software engineer to join our infrastructure team...",
      "extractedRequirements": [
        "5+ years of software engineering experience",
        "Strong systems design skills",
        "Experience with distributed systems"
      ],
      "extractedResponsibilities": [
        "Design and build reliable infrastructure",
        "Improve system observability",
        "Mentor junior engineers"
      ],
      "techStack": ["Go", "Kubernetes", "Redis", "PostgreSQL"],
      "jobLocation": "Remote - US",
      "compensation": "$180k - $250k",
      "whyMatch": "Kirtan's infrastructure experience across AWS/GCP and AI orchestration aligns with building reliable distributed systems. Startup-like autonomy at scale."
    }
  ]
}`;

const FIELD_DESCRIPTIONS = [
  {
    field: "companyName",
    type: "string",
    required: true,
    desc: "Full legal company name as it appears on the job listing.",
  },
  {
    field: "positionTitle",
    type: "string",
    required: true,
    desc: "Exact job title from the listing (e.g., &ldquo;Senior Software Engineer&rdquo;).",
  },
  {
    field: "companyUrl",
    type: "string",
    required: true,
    desc: "Direct URL to the specific job posting page. Used as the source link.",
  },
  {
    field: "companyWebsite",
    type: "string",
    optional: true,
    desc: "Company's main website URL (e.g., https://stripe.com). Used for company research.",
  },
  {
    field: "includeCoverLetter",
    type: "boolean",
    optional: true,
    desc: "Set to true if you want a tailored cover letter generated for this job.",
  },
  {
    field: "jobDescriptionSummary",
    type: "string",
    required: true,
    desc: "Comprehensive paragraph summarizing the full job description. Must be detailed — this gets synthesized into the jobDescription used for resume tailoring. Either this OR jobDescription is required.",
  },
  {
    field: "extractedRequirements",
    type: "string[]",
    optional: true,
    desc: "All requirements listed in the job posting (experience, education, skills).",
  },
  {
    field: "extractedResponsibilities",
    type: "string[]",
    optional: true,
    desc: "Day-to-day responsibilities and projects listed in the posting.",
  },
  {
    field: "techStack",
    type: "string[]",
    optional: true,
    desc: "Technologies, frameworks, and tools mentioned in the posting.",
  },
  {
    field: "jobLocation",
    type: "string",
    optional: true,
    desc: "Location or remote status from the posting.",
  },
  {
    field: "compensation",
    type: "string",
    optional: true,
    desc: "Salary range or compensation details if listed.",
  },
  {
    field: "whyMatch",
    type: "string",
    optional: true,
    desc: "Brief explanation of why this job fits the candidate's profile and skills.",
  },
];

export default function AIImportDocs() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <a
              href="/batch/import"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Import
            </a>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-lg font-bold">AI Import Guide</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-10 p-6">
        {/* How It Works */}
        <section>
          <h2 className="text-xl font-bold">How It Works</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              { step: "1", title: "Copy Prompt", desc: "Copy the prompt template below." },
              {
                step: "2",
                title: "Ask AI",
                desc: "Paste into ChatGPT/Claude and tell it what jobs to find.",
              },
              { step: "3", title: "Copy Result", desc: "AI returns a JSON array of jobs." },
              { step: "4", title: "Import", desc: "Paste JSON at /batch/import and add to queue." },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {s.step}
                </div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Prompt Template */}
        <section>
          <h2 className="text-xl font-bold">Prompt Template</h2>
          <p className="mt-1 text-sm text-gray-500">
            Copy this prompt and paste it into any AI chat. Replace the criteria at the bottom with
            what you&apos;re looking for.
          </p>
          <div className="relative mt-3">
            <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-gray-900 p-4 font-mono text-xs leading-relaxed text-gray-100">
              <pre className="whitespace-pre-wrap">{PROMPT_TEMPLATE}</pre>
            </div>
            <CopyButton text={PROMPT_TEMPLATE} />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            <strong>Tip:</strong> Be specific about your criteria — job titles, companies,
            locations, remote preference, etc. The more specific, the better the results.
          </p>
        </section>

        {/* Expected JSON Format */}
        <section>
          <h2 className="text-xl font-bold">Expected JSON Format</h2>
          <p className="mt-1 text-sm text-gray-500">
            The AI must return a JSON object with a{" "}
            <code className="rounded bg-gray-100 px-1">jobs</code> array. Each job object has these
            fields:
          </p>
          <div className="relative mt-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap">{JSON_SCHEMA}</pre>
            </div>
            <CopyButton text={JSON_SCHEMA} />
          </div>
        </section>

        {/* Field Reference */}
        <section>
          <h2 className="text-xl font-bold">Field Reference</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Required</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FIELD_DESCRIPTIONS.map((f) => (
                  <tr key={f.field}>
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{f.field}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.type}</td>
                    <td className="px-4 py-2.5">
                      {f.required ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          Required
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                          Optional
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs text-gray-600"
                      dangerouslySetInnerHTML={{ __html: f.desc }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-bold text-yellow-800">Notes</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-yellow-700">
            <li>
              <strong>Structured fields are preferred</strong> — the import page accepts EITHER a
              full <code className="rounded bg-yellow-100 px-1">jobDescription</code> OR structured
              fields like <code className="rounded bg-yellow-100 px-1">jobDescriptionSummary</code>,{" "}
              <code className="rounded bg-yellow-100 px-1">extractedRequirements</code>, etc. If
              structured fields are provided, they are synthesized into a full job description
              automatically.
            </li>
            <li>
              <strong>Full jobDescription works too</strong> — if the AI provides raw JD text, it
              passes through as-is. Both formats are supported.
            </li>
            <li>
              <strong>Maximum 50 jobs</strong> per import batch. Split larger batches into multiple
              imports.
            </li>
            <li>
              <strong>Valid URLs required</strong> — companyUrl must be a real job posting URL.
              It&apos;s used as the source link in your application records.
            </li>
            <li>
              <strong>Processing auto-starts</strong> when you add jobs — the import page fires
              processing immediately, and the batch page processes jobs as long as it&apos;s open.
            </li>
            <li>
              <strong>Resume template</strong> is baked into each job during import. You don&apos;t
              need to keep the browser open for server-side processing to work.
            </li>
            <li>
              <strong>No Vercel Pro?</strong> Set up a <strong>free external cron service</strong>{" "}
              to ping <code className="rounded bg-yellow-100 px-1">/api/cron/process-queue</code>{" "}
              every 5-10 minutes. It will process one job per call automatically.
            </li>
          </ul>
        </section>

        {/* Free Cron Services */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold">Free External Cron Services</h3>
          <p className="mt-1 text-xs text-gray-500">
            These free services will call your processing endpoint periodically — no Vercel Pro
            needed.
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold">cron-job.org</p>
              <p className="mt-0.5 text-xs text-gray-500">Free: 120 jobs, 1-min intervals.</p>
              <code className="mt-1 block rounded bg-gray-200 px-2 py-1 text-[11px]">
                GET https://final-destination-rose.vercel.app/api/cron/process-queue
              </code>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold">UptimeRobot</p>
              <p className="mt-0.5 text-xs text-gray-500">Free: 50 monitors, 5-min intervals.</p>
              <code className="mt-1 block rounded bg-gray-200 px-2 py-1 text-[11px]">
                GET https://final-destination-rose.vercel.app/api/cron/process-queue
              </code>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold">EasyCron</p>
              <p className="mt-0.5 text-xs text-gray-500">Free: 100 crons, 10-min intervals.</p>
              <code className="mt-1 block rounded bg-gray-200 px-2 py-1 text-[11px]">
                GET https://final-destination-rose.vercel.app/api/cron/process-queue
              </code>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            <strong>Tip for Hermes agents:</strong> Call{" "}
            <code className="rounded bg-gray-100 px-1">PUT /api/queue</code> to add jobs, then call{" "}
            <code className="rounded bg-gray-100 px-1">POST /api/process-queue</code> in a loop
            until <code className="rounded bg-gray-100 px-1">morePending</code> is false.
          </p>
        </section>
      </div>
    </div>
  );
}
