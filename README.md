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

## Extension

Load the extension folder unpacked in Chrome or Edge. Keep the app open in the same browser and enter its URL in the popup. The template is automatic. Add a job with the full posting text and application link. The website forwards the submission to the shared queue; retrying a lost acknowledgement keeps the same ID. Reload the extension and refresh the website after updates.

## Validation and deployment

Run npm run check and npm run build. Tests cover concurrent shared claims, conflicting writes, atomic imports, cancellation, checkpoints, stale result edits, cover-letter persistence, extension handoffs and provider failures. Deploy the existing Next.js project on Vercel after setting its environment variables. PDF previews use the existing LaTeX compiler service.
