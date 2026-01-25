# Final Destination

AI-powered resume and cover letter tailoring + H-1B job alert system.

## Features

### Resume Tailoring

- AI-tailored Resume & Cover Letter (LaTeX)
- Regenerate with feedback
- Application Q&A generation
- Cold email & referral request generation
- Google Sheets application tracking

### Job Alert System

- **732 H-1B sponsoring companies** across 4 tiers
- **72+ companies** with automated job scraping
- Quarterly LCA tracking (Q1-Q4) from FY2025 DOL data
- POC contact info for direct outreach
- Multi-platform scraping: Greenhouse, Lever, Ashby, Workday
- Responsive job dashboard with tier filters

---

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud account with billing enabled

### 1. Install

```bash
git clone https://github.com/VanGoghCode/Final-Destination.git
cd Final-Destination
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```bash
# Google GenAI
GOOGLE_GENAI_API_KEY=your-api-key

# Google Sheets (optional)
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Job Filtering (optional)
TARGET_ROLES=software engineer,cloud architect,devops
EXCLUDED_KEYWORDS=director,vp,sales
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Pages

| Route           | Description                          |
| --------------- | ------------------------------------ |
| `/`             | Resume tailoring homepage            |
| `/tailored`     | Tailored resume/cover letter output  |
| `/jobs`         | H-1B company browser (732 companies) |
| `/job-listings` | Scraped job listings                 |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Resume tailoring homepage
│   ├── tailored/         # Tailored output page
│   ├── jobs/             # H-1B company browser
│   ├── job-listings/     # Scraped job listings
│   └── api/
│       ├── jobs/         # Jobs scraping API
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

## Security

- Never commit `.env.local` or service account JSON files
- Large data files (CSV, Excel) are gitignored
