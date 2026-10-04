# Final Destination

AI-powered resume tailoring, cover letter generation, and H-1B job alert system. Built with Next.js 16, React 19, DeepSeek, and OpenAI Luna.

---

## Quick Start (First-Time User)

### Step 1: Install

```bash
git clone https://github.com/VanGoghCode/Final-Destination.git
cd Final-Destination
npm install
```

### Step 2: Configure an AI Provider

To use **OpenAI Luna**, create an [OpenAI API key](https://platform.openai.com/api-keys) and add the following to `.env.local`:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-6-luna
```

Luna uses a regular OpenAI API key and the model ID `gpt-6-luna`; see the [official Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna). This app uses the Responses API. You can change `OPENAI_MODEL` to another compatible model ID.

Alternatively, keep using **DeepSeek**:

1. Go to [platform.deepseek.com](https://platform.deepseek.com/api_keys)
2. Sign up and create an API key
3. Add it to `.env.local`:

```bash
DEEPSEEK_API_KEY=sk-your-key-here
```

You can also click the **AI Model** button in the app or batch sidebar, choose **OpenAI Luna** or **DeepSeek V4 Flash**, and paste your key. Keys are saved separately in browser localStorage and sent to this app's server to authenticate requests to the selected provider. Leave the key field blank to use an environment-configured key. Server keys take precedence over browser keys for the same provider and are never included in the UI.

An OpenAI-only installation automatically selects Luna. With both keys configured, DeepSeek remains the default unless `AI_PROVIDER=openai` is set. A saved browser choice overrides the server default for browser requests. Scheduled queue processing uses the environment configuration.

### Step 3: Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Use

### Profiles

Profiles store your name and link to your resume/cover letter templates. Use them to switch between different versions of your application materials.

1. Click the avatar in the sidebar header to open the Personal Details modal
2. Enter your first and last name, then save
3. The sidebar shows "Profile 1" by default — you can add more profiles from the Template Manager

### Templates

Templates are your LaTeX resume and cover letter source files. The app uses them as the base for AI tailoring.

1. On the homepage, scroll to "Templates" section
2. Click **Template Manager** to open the template modal
3. **Add a resume template**: Paste your LaTeX resume code, give it a name
4. **Add a cover letter template**: Same for cover letter
5. Set a **default** template — it auto-loads when you start
6. You can edit, rename, or delete templates anytime

Templates are saved to cloud storage (Redis) so they persist across sessions and devices.

### Tailoring a Resume

1. Ensure a resume template is loaded (the red dot disappears when all required fields are filled)
2. Paste the **job description** into the text area
3. Fill in **Company Name** and **Position Title**
4. Optionally add **Manual Research** about the company for better results
5. Click **Generate Tailored Resume**
6. View the output on the `/tailored` page — LaTeX preview, PDF download, and copy

### Generating a Cover Letter

1. After generating a resume, go to the `/tailored` page
2. Click **Generate Cover Letter** in the sidebar
3. The AI researches the company and writes a personalized cover letter
4. Preview, download, or copy the result

### Application Q&A

1. Navigate to `/questions`
2. Paste common application questions (one per line or separated by blank lines)
3. Click **Generate Answers** — the AI writes first-person responses based on your resume
4. You can set word/character limits and search modes (context only, context+internet, internet only)

### Regenerating with Feedback

On the `/tailored` page, each output has a **Regenerate** button. Click it, type your feedback (e.g., "make it more concise", "emphasize leadership"), and the AI rewrites the content.

### Cold Emails & Referral Requests

On the `/tailored` page sidebar, under **Email Generation**:
- **Cold Email**: Write an outreach email to a hiring manager
- **Reference Email**: Write a referral request to a company employee

---

### Batch Processing with the Chrome Extension

Process jobs at scale using the **batch page** (`/batch`) and the **Final Destination Chrome extension**.

1. Install the extension: open `chrome://extensions`, enable Developer mode, click **Load unpacked**, select the `extension/` folder
2. Pin the extension to your toolbar
3. Browse job listings on any site (LinkedIn, Indeed, Greenhouse, etc.)
4. Click the extension icon — it auto-extracts company name, position title, and job description from the page
5. Select a **Profile** or use default templates, confirm the details, click **Add to queue**
6. The job appears in `/batch` within seconds — processing starts while this page is open and the queue is resumed
7. View results, apply, and log to Google Sheets — all from the tailored results page

The extension works with both `localhost` and deployed Vercel URLs. Set the server URL and **app access key** in the popup; a green dot confirms authenticated access. Configure your AI provider and key in the app's model settings.

**Pause queue** persists across reloads and prevents new jobs from starting; the current job finishes. **Cancel job** stops that job. Retry, reprocess, and editing clear previous results before requeuing; editing pauses the queue until you resume. **Recover job** becomes available when an interrupted worker's claim expires. Queue card actions use icons with animated names on hover and keyboard focus; **View results** is available for completed jobs. Extension retries reuse submission IDs so a lost response does not add duplicate jobs.

Result changes are persisted by **Save edited results**. Connection and save failures stay visible; use **Reconnect / retry** after correcting access settings. Scheduled processing uses the server's AI environment configuration, rather than a browser's saved key.

## Google Sheets Integration

Track your job applications automatically in a personal Google Sheet.

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Sheets API**
3. Create a **Service Account** (IAM → Service Accounts → Create)
4. Download the JSON key file
5. Create a Google Sheet and share it with the service account email (Editor access)
6. Copy your spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
7. Stringify the service account JSON to a single line
8. Add to `.env.local` (or Vercel env vars):

```bash
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}
ADMIN_API_KEY=your-secret-admin-key
```

### Usage

1. Generate a tailored resume for a job
2. On the `/tailored` page, click **Log to Sheet**
3. Fill in the application link and any notes
4. Click **Log Application** — it appears in your Google Sheet with date, company, position, and status

### Security

- The sheets endpoint requires `ADMIN_API_KEY` (x-api-key header)
- Store your admin key in the browser: open DevTools Console and run `localStorage.setItem('fd_admin_key', 'your-admin-key')`
- Only browsers with the admin key can write to your sheet
- Your service account key lives in Vercel env vars, never in source code

---

## Companies & Job Listings

The **Companies** page (`/jobs`) shows 732+ H-1B sponsoring companies across 4 tiers:

| Tier | Companies | Description |
|------|-----------|-------------|
| Top | 33 | Highest LCA volume |
| Middle | 36 | High volume |
| Lower | 298 | Moderate volume |
| Lowest | 365 | Lower but active |

Features:
- Search and filter by tier
- Multi-select companies and bulk-open career pages
- Add custom career links per company
- Add external job portals (LinkedIn, Handshake, etc.) with logos
- Click company name to copy to clipboard

---

## Project Structure

```
extension/                    # Chrome extension — scrape & queue jobs
├── manifest.json
├── popup.html
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
src/
├── app/
│   ├── page.tsx               # Homepage — resume input & tailoring
│   ├── tailored/              # Tailored output with LaTeX preview
│   ├── questions/             # Application Q&A
│   ├── jobs/                  # H-1B company browser
│   ├── batch/                 # Batch processing
│   ├── admin/                 # Admin panel
│   ├── migrate/               # localStorage → cloud migration
│   └── api/
│       ├── tailor/            # Resume tailoring
│       ├── tailor-cover-letter/ # Cover letter generation
│       ├── answers/           # Q&A generation
│       ├── ask/               # General questions
│       ├── emails/            # Cold/referral email generation
│       ├── regenerate/        # Regenerate with feedback
│       ├── extract-job/       # Extract job info from URL
│       ├── sheets/            # Google Sheets logging
│       ├── latex-preview/     # LaTeX → PDF compilation
│       ├── queue/             # Job processing queue
│       ├── profiles/          # User profiles CRUD
│       ├── storage/           # Cloud storage (Redis)
│       ├── master-context/    # Saved research context
│       ├── admin/users/       # Admin data management
│       ├── companies/         # Company data
│       ├── company-links/     # Custom career links
│       ├── jobs/              # Discovered job listings
│       ├── top-tier/          # Top-tier companies
│       ├── middle-tier/       # Middle-tier companies
│       ├── lower-tier/        # Lower-tier companies
│       ├── lowest-tier/       # Lowest-tier companies
│       └── health/            # Health check
├── components/                # React components
├── lib/
│   ├── ai-providers/          # DeepSeek/OpenAI with shared retry and timeout handling
│   ├── prompts/               # AI prompt templates
│   ├── scrapers/              # ATS platform scrapers
│   ├── db.ts                  # Redis database layer
│   ├── storage.ts             # Cloud/local storage
│   ├── api-key.ts             # Provider/model selection and keys (env → header → cookie)
│   ├── admin-auth.ts          # Admin authentication
│   ├── client-admin.ts        # Client-side admin key management
│   ├── auth.ts                # Google service account auth
│   ├── config.ts              # Centralized config
│   ├── cors.ts                # CORS headers
│   ├── rate-limit.ts          # Rate limiting (Redis-backed)
│   └── sanitize.ts            # Input sanitization
└── scripts/
    └── seed-redis.ts          # Redis data seeding

data/
├── top-tier.json              # 33 top H-1B sponsors
├── middle-tier.json           # 36 middle-tier sponsors
├── lower-tier.json            # 298 lower-tier sponsors
├── lowest-tier.json           # 365 lowest-tier sponsors
└── jobs.json                  # Scraped job listings
```

---

## Environment Variables

### For local development (`.env.local`):

```bash
# AI — choose OpenAI Luna or DeepSeek
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-6-luna
# DEEPSEEK_API_KEY=sk-your-deepseek-key

# Optional — Google Sheets
GOOGLE_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Required — app access key (also enter in the sidebar and extension)
ADMIN_API_KEY=
# Optional — authenticated Vercel cron trigger
# CRON_SECRET=
```

### For Vercel deployment (set in Dashboard → Settings → Environment Variables):

| Variable | Required | Purpose |
|----------|----------|---------|
| `AI_PROVIDER` | Optional | `openai` or `deepseek`; selects the server default |
| `OPENAI_API_KEY` | One AI key needed | OpenAI API key for Luna |
| `OPENAI_MODEL` | Optional | OpenAI model ID; defaults to `gpt-6-luna` |
| `DEEPSEEK_API_KEY` | One AI key needed | DeepSeek AI API key |
| `KV_REST_API_URL` | Optional | Upstash Redis URL — syncs data across devices |
| `KV_REST_API_TOKEN` | Optional | Upstash Redis token — without this, data stays in localStorage |
| `GOOGLE_SPREADSHEET_ID` | Optional | Google Sheet ID for tracking |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Optional | Google service account JSON (single line) |
| `ADMIN_API_KEY` | Required for private APIs | App access key for AI, storage, queue, mutations, and admin routes |
| `CRON_SECRET` | Optional | Bearer credential accepted only for the cron trigger |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowed CORS origins (defaults to `*` for extension)

All other variables (scraping config, roles, keywords) have sensible defaults in `src/lib/config.ts` and don't need to be set.

---

## Deployment

```bash
npm install -g vercel
vercel
```

Add the environment variables from the table above in the Vercel dashboard.

After deploying, open the sidebar AI settings and enter your `ADMIN_API_KEY` as **App access key**. Enter an AI key there or use a server-configured AI key. Enter the same app access key in the extension. Public job listings and health checks remain accessible; private APIs deny access when the app key is unconfigured.

---

## Security

- API keys and credentials are **never** in source code — always in environment variables
- Private APIs and all writes require `ADMIN_API_KEY`; cron may use `CRON_SECRET`
- Paid AI requests share an atomic Redis limit when Redis is configured, with an in-memory limit otherwise
- Input sanitization against prompt injection and LaTeX attacks
- CORS restricted to configured origins
- All user data (resumes, templates, profiles) stored in localStorage/Redis — not in code
- `.env.local`, `*.pem`, and credential files are gitignored

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **AI**: DeepSeek V4 Flash or OpenAI Luna (Responses API)
- **Database**: Upstash Redis
- **Auth**: Admin API key (x-api-key / Bearer)
- **Testing**: Bun test
- **CI/CD**: GitHub Actions, Husky pre-commit hooks
- **Deploy**: Vercel

---

## License

MIT — see [LICENSE](LICENSE) for details.
