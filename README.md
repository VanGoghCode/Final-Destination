# Final Destination

AI-powered resume and cover letter tailoring + H-1B job alert system.

## Features

### Resume Tailoring

- AI-tailored Resume & Cover Letter (LaTeX)
- Separate cover letter generation with company research
- Regenerate with feedback
- Application Q&A generation with first-person answers
- Word/character limits and human-written tone for Q&A
- Cold email & referral request generation
- Google Sheets application tracking

### Job Alert System

- **732 H-1B sponsoring companies** across 4 tiers
- **72+ companies** with automated job scraping
- **Custom career page links** - Save your own discovered career URLs
- **External Job Portals** - Add links to Handshake, LinkedIn, Indeed, etc. with logos
- Compact collapsible sidebar with search and tier filters
- Multi-select companies with bulk actions
- Quarterly LCA tracking (Q1-Q4) from FY2025 DOL data
- POC contact info for direct outreach
- Multi-platform scraping: Greenhouse, Lever, Ashby, Workday

### External Job Portals

- Add custom job portal links (Handshake, LinkedIn Jobs, Indeed, Glassdoor, etc.)
- Support for portal logos/icons
- Quick-add suggestions for popular job boards
- Edit and delete portals anytime
- Persisted in localStorage (works on deployed sites)

### Mobile Responsive

- **Fully responsive design** for all screen sizes
- Mobile-optimized sidebar with overlay navigation
- Touch-friendly buttons and cards
- Adaptive grid layouts (1-4 columns)
- Collapsible filters for mobile screens

### UI/UX Improvements

- **Compact sidebar layout** - Tier filters in 2-column grid
- **Quick Actions** - Combined Selection, Bulk Actions, and Navigation
- **Flex button layout** - 1/4 icon, 3/4 text for better alignment
- Click company name to copy to clipboard

---

## Setup

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** or **yarn** - Package manager (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)
- **Google Cloud Account** - For Gemini AI API (billing enabled)
- **Upstash Redis** (optional) - For persisting custom career links on Vercel deployment
- **Google Service Account** (optional) - For Google Sheets integration

### Required Accounts & Services

| Service | Purpose | Required? |
|---------|---------|-----------|
| [Google AI Studio](https://aistudio.google.com/) | Gemini API key for AI features | ✅ Required |
| [Upstash](https://upstash.com/) | Redis database for career links (production) | ⚠️ For Vercel deployment |
| [Google Cloud Console](https://console.cloud.google.com/) | Service account for Sheets API | ⚠️ Optional |
| [Vercel](https://vercel.com/) | Deployment platform | ⚠️ Optional |

### 1. Install

```bash
git clone https://github.com/VanGoghCode/Final-Destination.git
cd Final-Destination
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```bash
# ============================================
# REQUIRED - AI Features
# ============================================
# Get from: https://aistudio.google.com/apikey
GOOGLE_GENAI_API_KEY=your-gemini-api-key

# ============================================
# OPTIONAL - Google Sheets Integration
# ============================================
# For tracking job applications in Google Sheets
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
# Service account JSON (stringify it to single line)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}

# ============================================
# OPTIONAL - Job Filtering
# ============================================
# Comma-separated roles to include in scraped jobs
TARGET_ROLES=software engineer,cloud architect,devops,backend,frontend,full stack
# Keywords to exclude from job listings
EXCLUDED_KEYWORDS=director,vp,sales,senior director,principal

# ============================================
# OPTIONAL - Upstash Redis (for Vercel deployment)
# ============================================
# Required only if deploying to Vercel and want to persist custom career links
# Get from: https://console.upstash.com/
KV_REST_API_URL=https://your-redis-instance.upstash.io
KV_REST_API_TOKEN=your-upstash-token
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel (Optional)

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard under Project Settings → Environment Variables.

---

## Pages

| Route           | Description                                      |
| --------------- | ------------------------------------------------ |
| `/`             | Resume tailoring homepage                        |
| `/tailored`     | Tailored resume/cover letter output              |
| `/questions`    | Application Q&A generation                       |
| `/jobs`         | H-1B company browser with collapsible sidebar    |
| `/job-listings` | Scraped job listings                             |

---

## Custom Career Links

For companies without auto-detected career pages, you can manually save career URLs:

1. Navigate to `/jobs` page
2. Find the company card
3. Click the **"+"** button next to the Jobs button
4. Paste the career page URL and click **"Add"**
5. Click **"Save Links"** to persist

**Storage:**
- **Local development**: Saved to JSON files in `/data/`
- **Vercel production**: Saved to Upstash Redis (requires env vars)

---

## External Job Portals

Add quick-access links to external job boards like Handshake, LinkedIn, etc.:

1. Navigate to `/jobs` page
2. In the sidebar, find **"External Portals"** section
3. Click **"Add"** to open the portal management modal
4. Manually add custom portals with name, URL, and optional logo
5. Click portal buttons in sidebar to open them in new tabs

**Features:**
- Custom logo support for each portal
- Edit existing portals (click pencil icon)
- Delete portals (click trash icon)
- Data persisted in browser localStorage

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Resume tailoring homepage
│   ├── tailored/         # Tailored output page
│   ├── questions/        # Application Q&A page
│   ├── jobs/             # H-1B company browser
│   ├── job-listings/     # Scraped job listings
│   └── api/
│       ├── jobs/         # Jobs scraping API
│       ├── company-links/# Custom career links API
│       ├── tailor/       # Resume tailoring API
│       ├── tailor-cover-letter/  # Cover letter API
│       ├── research/     # Company research API
│       ├── answers/      # Q&A generation API
│       ├── top-tier/     # Top-tier companies API
│       ├── middle-tier/  # Middle-tier companies API
│       ├── lower-tier/   # Lower-tier companies API
│       └── lowest-tier/  # Lowest-tier companies API
├── components/           # React components
├── lib/
│   ├── scrapers/         # ATS platform scrapers
│   └── gemini.ts         # AI integration
└── scripts/
    └── parse-dol.ts      # DOL LCA parser

data/
├── top-tier.json         # 33 top H-1B sponsors
├── middle-tier.json      # 36 middle-tier sponsors
├── lower-tier.json       # 298 lower-tier sponsors
├── lowest-tier.json      # 365 lowest-tier sponsors
└── jobs.json             # Scraped job listings

docs/
├── module-1-dol-parser.md  # DOL preprocessing guide
├── module-2-dashboard.md   # Dashboard documentation
└── module-3-scraper.md     # Scraper documentation
```

---

## Branches

| Branch                        | Status   | Description       |
| ----------------------------- | -------- | ----------------- |
| `main`                        | Stable   | Production        |
| `feature/module-1-dol-parser` | Complete | DOL data pipeline |
| `feature/module-2-dashboard`  | Complete | Job dashboard     |
| `feature/module-3-scraper`    | Complete | Career scraper    |

---

## Data Sources

- **DOL LCA Data**: https://www.dol.gov/agencies/eta/foreign-labor/performance
- FY2025 Q1-Q4 combined (H-1B/E-3 tech roles only)

---

## Recent Updates (January 2026)

### External Job Portals
- Added ability to save external job portal links (Handshake, LinkedIn, Indeed, etc.)
- Logo/icon support for portals
- Edit and delete functionality for saved portals

### Compact Sidebar UI
- Tier filter buttons now in 2-column grid layout
- Combined Selection, Bulk Actions, and Navigation into "Quick Actions"
- Buttons use flex layout with 1/4 icon and 3/4 text
- Reduced vertical space usage for better UX

### Copy Company Name
- Click on company name to copy to clipboard
- Visual feedback on successful copy

---

## Security

- Never commit `.env.local` or service account JSON files
- Large data files (CSV, Excel) are gitignored
