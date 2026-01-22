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

- **32,619 H-1B sponsoring companies** from FY2025 LCA data
- 5-tier classification (top/middle/lower/lowest/below50)
- Quarterly LCA tracking (Q1-Q4)
- POC contact info for direct outreach
- Responsive job dashboard with filters
- Career page scraping (coming soon)

---

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud account with billing enabled
- AWS account (for job scraping - optional)

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

# AWS (optional - for job scraping)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-west-2
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Pages

| Route       | Description                         |
| ----------- | ----------------------------------- |
| `/`         | Resume tailoring homepage           |
| `/tailored` | Tailored resume/cover letter output |
| `/jobs`     | H-1B company dashboard              |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Resume tailoring homepage
│   ├── tailored/         # Tailored output page
│   ├── jobs/             # H-1B company dashboard
│   └── api/
│       └── companies/    # Companies API
├── components/           # React components
├── lib/
│   ├── config.ts         # Config + Company/Job interfaces
│   └── gemini.ts         # AI integration
└── scripts/
    └── parse-dol.ts      # DOL LCA parser

data/
└── companies.json        # 32,619 H-1B sponsoring companies

docs/
├── module-1-dol-parser.md  # DOL preprocessing guide
└── module-2-dashboard.md   # Dashboard documentation
```

---

## Branches

| Branch                        | Status   | Description       |
| ----------------------------- | -------- | ----------------- |
| `main`                        | Stable   | Production        |
| `feature/module-1-dol-parser` | Complete | DOL data pipeline |
| `feature/module-2-dashboard`  | Complete | Job dashboard     |

---

## Data Sources

- **DOL LCA Data**: https://www.dol.gov/agencies/eta/foreign-labor/performance
- FY2025 Q1-Q4 combined (H-1B/E-3 tech roles only)

---

## Security

- Never commit `.env.local` or service account JSON files
- Large data files (CSV, Excel) are gitignored
