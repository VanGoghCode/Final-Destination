# Final Destination

AI-powered resume and cover letter tailoring + H-1B job alert system.

## Features

### Resume Tailoring

- AI-tailored Resume & Cover Letter (LaTeX)
- Regenerate with feedback
- Application Q&A generation
- Cold email & referral request generation
- Google Sheets application tracking

### Job Alert System (In Progress)

- 33,682 H-1B sponsoring companies database
- 5-tier company classification (top/middle/lower/lowest/below50)
- Quarterly LCA tracking (Q1-Q4 FY2025)
- POC contact info for direct outreach
- Career page scraping (coming soon)
- Real-time job dashboard (coming soon)

---

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud account with billing enabled
- AWS account (for job scraping)

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

# Google Sheets
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# AWS (for job scraping)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-west-2

# Job Matching
TARGET_ROLES=software engineer,data scientist,ml engineer
EXCLUDED_KEYWORDS=senior director,vp,vice president

# Scraping Config
CHUNK_SIZE=200
TOP_CHUNK_SIZE=20
REGULAR_CHUNK_SIZE=180
SCRAPE_INTERVAL_MINUTES=30
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Resume tailoring homepage
│   ├── tailored/         # Tailored output page
│   ├── jobs/             # Job dashboard (coming soon)
│   └── api/              # API routes
├── components/           # React components
├── lib/
│   ├── config.ts         # Config + Company/Job interfaces
│   └── gemini.ts         # AI integration
└── scripts/
    └── parse-dol.ts      # DOL LCA parser

data/
├── companies.json        # 33,682 H-1B sponsoring companies
└── lca_filtered_2025.csv # Raw filtered LCA data (gitignored)
```

---

## Branches

| Branch                        | Description          |
| ----------------------------- | -------------------- |
| `main`                        | Stable production    |
| `feature/module-1-dol-parser` | DOL data pipeline    |
| `feature/module-2-dashboard`  | Job dashboard (next) |

---

## Data Sources

- **DOL LCA Data**: https://www.dol.gov/agencies/eta/foreign-labor/performance
- FY2025 Q1-Q4 combined data
- Filtered for H-1B/E-3 tech roles (SOC 15-xxxx)

---

## Security

- Never commit `.env.local` or service account JSON files
- Large data files (CSV, Excel) are gitignored
