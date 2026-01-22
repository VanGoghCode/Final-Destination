# Module 3: Career Scraper

## Overview

Automated job scraper using ATS platform APIs (Greenhouse, Lever) to fetch jobs from H-1B sponsoring companies.

## Files

| File                             | Purpose                         |
| -------------------------------- | ------------------------------- |
| `src/lib/scrapers/types.ts`      | Job interface, filter utilities |
| `src/lib/scrapers/greenhouse.ts` | Greenhouse API client           |
| `src/lib/scrapers/lever.ts`      | Lever API client                |
| `src/lib/scrapers/index.ts`      | Unified scraper interface       |
| `src/app/api/jobs/route.ts`      | Jobs API endpoint               |
| `data/jobs.json`                 | Scraped jobs storage            |
| `data/career-urls.json`          | Top company career URLs         |

## API Endpoints

### GET /api/jobs

Returns scraped jobs with optional filters.

**Query params:**

- `company` - Filter by company name
- `location` - Filter by location
- `limit` - Max results (default: 100)

### POST /api/jobs

Triggers a new scrape across all configured companies.

**Response:**

```json
{
  "success": true,
  "summary": {
    "totalJobs": 2500,
    "filteredJobs": 577,
    "companiesScraped": 11,
    "errors": []
  }
}
```

## Supported Platforms

| Platform   | Method   | Companies                                     |
| ---------- | -------- | --------------------------------------------- |
| Greenhouse | REST API | Stripe, Coinbase, Netflix, Uber, Airbnb, etc. |
| Lever      | REST API | OpenAI, Anthropic, Scale AI, etc.             |

## Job Filtering

Jobs are filtered based on:

- **Target roles**: software engineer, data scientist, ML engineer, etc.
- **Excluded keywords**: senior director, VP, intern, etc.

Configure in `.env.local`:

```
TARGET_ROLES=software engineer,data scientist,ml engineer
EXCLUDED_KEYWORDS=senior director,vp,intern
```

## Usage

```bash
# Trigger scrape
curl -X POST http://localhost:3000/api/jobs

# Get jobs
curl http://localhost:3000/api/jobs?company=stripe&limit=50
```
