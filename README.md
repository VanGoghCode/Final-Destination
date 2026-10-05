# Final Destination

Single-user resume and cover letter tailoring with OpenAI Luna or DeepSeek. Templates, personal background, master context, and queue results live in this website's browser storage. The server only handles AI requests and document previews; it has no database.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Add your resume and optional cover letter templates, save your master context, and choose an AI provider in the sidebar. Paste the provider's API key there. No app access key or database configuration is needed.

Optional server defaults are listed in `.env.example`. Browser settings select the provider and model; a server-configured key for that provider takes precedence over a browser key.

## Queue

Add jobs directly, import job JSON at `/batch/import`, or use the extension. The queue starts paused. Resume it when ready. Pause lets the current job finish and holds waiting jobs; cancel stops the selected job. Failed and cancelled jobs can be edited or retried, and completed results can be edited, regenerated, saved, or exported.

Keep the website open while processing. Closing every app tab interrupts processing; reopening resumes an unpaused queue and reuses saved resume work. A browser lock prevents simultaneous tabs from processing a job twice. Browser storage errors remain visible instead of reporting a successful save.

Data survives refreshes and browser restarts on the same origin. Localhost, production, different browsers, and browser profiles have separate workspaces. Use Export backup to download templates, background and queue results without API keys. Restore backup replaces the current workspace and pauses the imported queue. Clearing site data removes templates, background, jobs, and saved API keys. There is no remote sync or unattended scheduler.

## Chrome / Edge extension

1. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the `extension` folder unpacked.
2. Keep the app open in the same browser. Enter its full URL in the extension popup. A green dot confirms the app tab is available.
3. Open a job posting, fill its details, and add it to the queue. Select a profile or use the default templates.

After updating extension files, reload the extension and refresh the website. The extension communicates with the open website tab; it does not submit jobs to a server-side queue. Retrying an interrupted submission uses the same ID to avoid duplicates.

## Validation

```bash
npm run check
npm run build
```

Tests cover browser persistence, queue locking, cancellation, retries, partial results, stale edits, extension acknowledgments, queue action visibility, AI headers, and provider errors. Provider calls use fixtures in tests.

## Deployment

Connect this repository to Vercel and deploy the Next.js application. No Redis, Google Sheets, admin key, cron, or company catalog setup is required. Old database environment variables are unused and can be removed. Configure your AI key through the deployed site's sidebar, then connect the extension to that same URL.

PDF previews optionally call the existing LaTeX compilation service. AI requests use the selected provider; those services do not store the app's queue or templates.
