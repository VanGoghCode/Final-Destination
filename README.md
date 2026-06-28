# Final Destination

AI-powered resume tailoring, cover letter generation, and H-1B job alert system. Built with Next.js 16, React 19, and DeepSeek.

---

## Quick Start (First-Time User)

### Step 1: Install

```bash
git clone https://github.com/VanGoghCode/Final-Destination.git
cd Final-Destination
npm install
```

### Step 2: Get a DeepSeek API Key

1. Go to [platform.deepseek.com](https://platform.deepseek.com/api_keys)
2. Sign up and create an API key
3. Add it to `.env.local`:

```bash
DEEPSEEK_API_KEY=sk-your-key-here
```

You can also enter the key directly in the app sidebar — click the "DeepSeek V4 Flash" button and paste your key. It's saved in your browser's localStorage and never sent to our servers.

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
5. Select a **Profile** (created in the app), confirm the details, click **Add to Queue**
6. The job appears in `/batch` within seconds — processing starts automatically
7. View results, apply, and log to Google Sheets — all from the tailored results page

The extension works with both `localhost` and deployed Vercel URLs — set the server URL in the popup's config bar. A green dot confirms the connection.

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
│   ├── ai-providers/          # DeepSeek AI integration
│   ├── prompts/               # AI prompt templates
│   ├── scrapers/              # ATS platform scrapers
│   ├── db.ts                  # Redis database layer
│   ├── storage.ts             # Cloud/local storage
│   ├── api-key.ts             # API key resolution (env → cookie)
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
# Required
DEEPSEEK_API_KEY=sk-your-key

# Optional — Google Sheets
GOOGLE_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Optional — Admin protection
ADMIN_API_KEY=
```

### For Vercel deployment (set in Dashboard → Settings → Environment Variables):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DEEPSEEK_API_KEY` | Yes | DeepSeek AI API key |
| `KV_REST_API_URL` | Optional | Upstash Redis URL — syncs data across devices |
| `KV_REST_API_TOKEN` | Optional | Upstash Redis token — without this, data stays in localStorage |
| `GOOGLE_SPREADSHEET_ID` | Optional | Google Sheet ID for tracking |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Optional | Google service account JSON (single line) |
| `ADMIN_API_KEY` | Optional | Protects admin/sheets/storage routes |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowed CORS origins (defaults to `*` for extension)

All other variables (scraping config, roles, keywords) have sensible defaults in `src/lib/config.ts` and don't need to be set.

---

## Deployment

```bash
npm install -g vercel
vercel
```

Add the environment variables from the table above in the Vercel dashboard.

After deploying, open your browser DevTools Console and run:

```javascript
localStorage.setItem('fd_admin_key', 'your-admin-key-from-env')
localStorage.setItem('fd_deepseek_api_key', 'sk-your-deepseek-key')
```

This stores the keys in your browser so the client can send them with API requests.

---

## Security

- API keys and credentials are **never** in source code — always in environment variables
- Admin routes (`/api/admin/*`, `/api/sheets`, `/api/storage`) require `ADMIN_API_KEY`
- Rate limiting on all API endpoints (Redis-backed in production)
- Input sanitization against prompt injection and LaTeX attacks
- CORS restricted to configured origins
- All user data (resumes, templates, profiles) stored in localStorage/Redis — not in code
- `.env.local`, `*.pem`, and credential files are gitignored

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **AI**: DeepSeek V4 Flash
- **Database**: Upstash Redis
- **Auth**: Admin API key (x-api-key / Bearer)
- **Testing**: Bun test
- **CI/CD**: GitHub Actions, Husky pre-commit hooks
- **Deploy**: Vercel

---

## License

MIT — see [LICENSE](LICENSE) for details.
