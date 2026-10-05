import Link from "next/link";

const example = JSON.stringify(
  {
    jobs: [
      {
        companyName: "Example",
        positionTitle: "Software Engineer",
        companyUrl: "https://example.com/careers/engineer",
        jobDescription: "Build and maintain software services.",
        includeCoverLetter: false,
      },
    ],
  },
  null,
  2,
);

export default function ImportGuide() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <Link href="/batch" className="text-sm underline">
        Back to queue
      </Link>
      <h1 className="text-2xl font-bold">Import jobs into your queue</h1>
      <p>
        Paste JSON into the import screen, review each entry, select templates, and add the jobs.
        Entries need a company name, role, posting URL, and description. A detailed
        jobDescriptionSummary is also accepted instead of jobDescription.
      </p>
      <pre className="overflow-auto rounded-xl bg-gray-100 p-4 text-sm">{example}</pre>
      <Link href="/batch/import" className="inline-block rounded-lg bg-black px-4 py-2 text-white">
        Open import
      </Link>
      <p className="text-sm text-gray-600">
        Jobs and results stay in this browser. Resume the queue and keep the website open while
        processing. There is no server queue, database, external scheduler, or remote import
        endpoint. Use the Chrome or Edge extension to send jobs to the open website tab.
      </p>
    </main>
  );
}
