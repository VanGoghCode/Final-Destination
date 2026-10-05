import Link from "next/link";
import { gatewayInstructions } from "@/lib/job-import";

export default function ImportGuide() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <Link href="/batch" className="text-sm underline">
        Back to queue
      </Link>
      <h1 className="text-2xl font-bold">Add jobs with your AI assistant</h1>
      <p>
        Tell Muse AI, ChatGPT or another browser assistant to open the gateway in the browser where
        your templates and profiles are saved. Choose matching profiles from the live form. Add up
        to 15 jobs at once; each needs its full JD and a direct application-page URL.
      </p>
      <pre className="overflow-auto rounded-xl bg-gray-100 p-4 text-sm whitespace-pre-wrap">
        {gatewayInstructions([], "https://final-destination-rose.vercel.app")}
      </pre>
      <Link href="/batch/import" className="inline-block rounded-lg bg-black px-4 py-2 text-white">
        Open automation gateway
      </Link>
      <p className="text-sm text-gray-600">
        The form validates the entire batch before saving. Repeating the same submission does not
        create duplicate jobs. New jobs follow your queue&apos;s current pause setting. Resume the
        queue and keep the site open to process them. Browser assistants can use the labeled form
        directly; bots without access to your browser can provide JSON for you to paste.
      </p>
    </main>
  );
}
