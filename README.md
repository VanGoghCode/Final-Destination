# Final Destination

Personal resume tailoring with one built-in resume, cover-letter template and master context. OpenAI Luna uses high reasoning by default. Queue inputs, edits and generated results are shared across browsers through queue.json in a private GitHub repository. No database is used.

## Setup

Run npm ci and npm run dev. Configure the server variables in .env.example, or add them to the existing Vercel project:

- GITHUB_QUEUE_REPO: owner/repository for the private queue.
- GITHUB_QUEUE_TOKEN: a fine-grained token with Contents read/write for that repository only.
- OPENAI_API_KEY: your Luna API key.

Initialize queue.json with {"jobs":[],"paused":true}. Server credentials never appear in the browser or queue file. Optional browser AI credentials override server credentials for that provider.

The supplied templates and background are checked into src/lib/personal-workspace.json. Updating that file and deploying updates every browser. No profile or template selection is required.

## Queue and automation

Add jobs at /batch or paste up to 15 jobs at /batch/import. Every job needs its company, role, full JD and direct application-page URL. The gateway validates the entire batch, deduplicates repeated submissions and starts new jobs automatically. Bot instructions are available at /docs/ai-import.

Keep at least one website tab open to drive processing. It can be your browser or the bot's browser. Closing all tabs interrupts processing; expired claims recover with saved resume checkpoints after ten minutes. GitHub file revisions and job leases prevent different computers from processing the same job or overwriting newer results.

Pause holds waiting jobs while the current job finishes. Cancel stops one job; retries preserve completed resume work. Completed results support editing, regeneration, PDF previews and on-demand cover letters. Export backup downloads the shared queue without credentials; restore replaces the queue in every browser and requires it to be paused without active jobs. Legacy browser queues are not uploaded automatically.

PDF saving uses the Chrome/Edge extension. Download /final-destination-extension.zip, extract it, and load the extracted folder using Developer mode and Load unpacked on the browser extensions page. Keep the browser default download location at C:\Users\kirta\Downloads. Apply waits for the save to complete and opens the job. Resume and cover letter PDFs overwrite apply/Kirtan_Thummar_resume.pdf and apply/Kirtan_Thummar_cover_letter.pdf; the browser recreates the apply subfolder when missing. Refresh the website after installing or reloading the extension.

## Extension

Load the extension folder unpacked in Chrome or Edge. Keep the app open in the same browser and enter its URL in the popup. The template is automatic. Add a job with the full posting text and application link. The website forwards the submission to the shared queue; retrying a lost acknowledgement keeps the same ID. Reload the extension and refresh the website after updates.

## Validation and deployment

Run npm run check and npm run build. Tests cover concurrent shared claims, conflicting writes, atomic imports, cancellation, checkpoints, stale result edits, cover-letter persistence, extension handoffs and provider failures. Deploy the existing Next.js project on Vercel after setting its environment variables. PDF previews use pdfLaTeX through the existing LaTeX compiler service, including syntax repair retries. Engine hints do not override pdfLaTeX; templates requiring XeLaTeX or LuaLaTeX report a compatibility error. The built-in resume is Kirtan's supplied Roboto Serif template with reusable section, entry and bullet commands. New jobs and reprocessed jobs use it; existing generated documents remain available until reprocessed.

Completed queue cards show only the recorded generation total in USD beside the company name. Request-scoped provider usage is saved to the shared job and includes resume/location generation, cover letters, regenerations, Quick Questions, and paid LaTeX repairs opened from that job. Totals survive retries and reprocessing. Pricing currently covers direct OpenAI Luna requests, including cached input, reasoning output, service tier and long context. Rates were verified 2026-10-08 against https://developers.openai.com/api/docs/models/gpt-6-luna. Historical jobs, missing usage, and unpriced/custom models show no amount rather than a made-up total. Cost persistence uses the shared GitHub transaction flow; a storage failure is logged without discarding the generated document.

Cover-letter generation and regeneration use the app adaptation of write-kirtan-cover-letter in src/lib/prompts/kirtan-cover-letter.ts. The supplied source and application adaptation are under docs/writing-skills/write-kirtan-cover-letter. Candidate facts still come from master context and the supplied resume; the template remains the LaTeX formatting shell. Regenerate an existing letter to apply the new writing style.
