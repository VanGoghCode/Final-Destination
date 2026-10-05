"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import JobForm from "@/components/JobForm";
import { useAppContext } from "@/context/AppContext";
import { apiJSON } from "@/lib/client-api";
import { resumeTemplate, coverTemplate, masterContext } from "@/lib/personal-workspace";

export default function Home() {
  const router = useRouter();
  const app = useAppContext();
  const [error, setError] = useState("");
  return (
    <div className="flex min-h-screen">
      <Sidebar title="Kirtan's workspace">
        <nav className="space-y-3 p-4">
          <Link href="/batch" className="block underline">
            Job queue
          </Link>
          <Link href="/batch/import" className="block underline">
            Automation gateway
          </Link>
          {app.tailoredResume && (
            <Link href="/tailored" className="block underline">
              Current resume
            </Link>
          )}
          <p className="text-sm text-gray-600">
            Your resume, cover-letter template and master context are ready in every browser.
          </p>
        </nav>
      </Sidebar>
      <main className="mx-auto w-full max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Tailor your resume</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add the job details. We&apos;ll make minimal changes using your experience and preserve
          your one-page format.
        </p>
        <JobForm
          profiles={[]}
          initialValues={{
            companyName: app.companyName,
            companyUrl: app.companyUrl,
            positionTitle: app.positionTitle,
            jobDescription: app.jobDescription,
            personalDetails: app.personalDetails,
            profileId: "kirtan",
            includeCoverLetter: false,
          }}
          submitLabel="Generate resume"
          onCancel={() => router.push("/batch")}
          onSubmit={async (job) => {
            setError("");
            app.setIsGeneratingTailored(true);
            try {
              const result = await apiJSON<{
                tailoredResume: string;
                tailoredCoverLetter?: string;
                jobCountry?: string;
                jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
              }>("/api/tailor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...job,
                  resumeLatex: resumeTemplate.content,
                  masterContext,
                }),
                signal: AbortSignal.timeout(300_000),
              });
              if (!result.tailoredResume?.trim())
                throw new Error("AI returned an empty resume. Try again.");
              let cover = "";
              app.loadJob({
                ...job,
                resumeLatex: resumeTemplate.content,
                coverLetterLatex: coverTemplate.content,
                masterContext,
                tailoredResume: result.tailoredResume,
                tailoredCoverLetter: "",
                jobCountry: result.jobCountry || "",
                jobWorkMode: result.jobWorkMode || "",
              });
              if (job.includeCoverLetter) {
                const generated = await apiJSON<{ tailoredCoverLetter: string }>(
                  "/api/tailor-cover-letter",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ...job,
                      coverLetterLatex: coverTemplate.content,
                      masterContext,
                      tailoredResume: result.tailoredResume,
                    }),
                    signal: AbortSignal.timeout(300_000),
                  },
                );
                if (!generated.tailoredCoverLetter?.trim())
                  throw new Error(
                    "Resume is ready. Cover letter generation failed; open Current resume to retry.",
                  );
                cover = generated.tailoredCoverLetter;
              }
              app.setTailoredCoverLetter(cover);
              router.push("/tailored");
              return true;
            } catch (error) {
              setError(error instanceof Error ? error.message : "Generation failed");
              return false;
            } finally {
              app.setIsGeneratingTailored(false);
            }
          }}
        />
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <details className="mt-6 rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">Your background</summary>
          <p className="mt-3 text-sm whitespace-pre-wrap">{masterContext}</p>
        </details>
        <details className="mt-4 rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">Resume template</summary>
          <pre className="mt-3 max-h-96 overflow-auto text-xs">{resumeTemplate.content}</pre>
        </details>
        <Button className="mt-4" variant="secondary" onClick={() => router.push("/batch")}>
          Open queue
        </Button>
      </main>
    </div>
  );
}
