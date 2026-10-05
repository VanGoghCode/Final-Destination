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
        Tell Muse AI, ChatGPT or another browser assistant to open the gateway in its own browser.
        Your template and master context are automatic, and the queue is shared through your private
        GitHub repository. Add up to 15 jobs at once; each needs its full JD and a direct
        application-page URL.
      </p>
      <pre className="overflow-auto rounded-xl bg-gray-100 p-4 text-sm whitespace-pre-wrap">
        {gatewayInstructions([], "https://final-destination-rose.vercel.app")}
      </pre>
      <Link href="/batch/import" className="inline-block rounded-lg bg-black px-4 py-2 text-white">
        Open automation gateway
      </Link>
      <p className="text-sm text-gray-600">
        The form validates the entire batch before saving. Repeating the same submission does not
        create duplicate jobs. Adding new jobs starts the queue automatically; you can pause it from
        the queue. Keep the site open to process jobs. Browser assistants can use the labeled form
        directly, using their own browser or computer.
      </p>
    </main>
  );
}
