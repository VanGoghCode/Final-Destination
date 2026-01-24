# Module 3: Career Scraper

## Overview

Automated job scraper fetching positions from H-1B sponsoring companies using ATS platform APIs (Greenhouse, Lever, Ashby, Workday).

## Files

| File                             | Purpose                         |
| -------------------------------- | ------------------------------- |
| `src/lib/scrapers/types.ts`      | Job interface, filter utilities |
| `src/lib/scrapers/greenhouse.ts` | Greenhouse API client           |
| `src/lib/scrapers/lever.ts`      | Lever API client                |
| `src/lib/scrapers/ashby.ts`      | Ashby API client                |
| `src/lib/scrapers/workday.ts`    | Workday API client (scaffold)   |
| `src/lib/scrapers/index.ts`      | Unified scraper interface       |
| `src/app/api/jobs/route.ts`      | Jobs API endpoint               |
| `data/jobs.json`                 | Scraped jobs storage            |
| `data/*-tier.json`               | Company data with platform IDs  |

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
    "companiesScraped": 72,
    "companiesWithJobs": 45,
    "tierBreakdown": { "top": 5, "middle": 10, "lower": 20, "lowest": 10 }
  }
}
```

## Supported Platforms

| Platform   | Method   | Companies                                      |
| ---------- | -------- | ---------------------------------------------- |
| Greenhouse | REST API | Databricks, Stripe, Cloudflare, DoorDash, etc. |
| Lever      | REST API | Palantir, Spotify, Capital One, etc.           |
| Ashby      | REST API | Snowflake, Confluent, Citadel, etc.            |
| Workday    | REST API | Adobe, ServiceNow (scaffold)                   |

## Company Coverage

| Tier      | Total   | With Scrapers          |
| --------- | ------- | ---------------------- |
| Top       | 33      | Platform data enriched |
| Middle    | 36      | Platform data enriched |
| Lower     | 298     | 58 with scrapers       |
| Lowest    | 365     | 13 with scrapers       |
| **Total** | **732** | **72+ scrapable**      |

## Job Filtering

Jobs are filtered based on target roles and excluded keywords.

### Default Target Roles:

- Software Engineer, Developer, SDE, SWE
- Backend, Systems, Infrastructure, Platform
- Cloud Engineer, Cloud Architect, Solutions Architect
- DevOps, SRE, Site Reliability
- ML Engineer, AI Engineer, Data Scientist
- Full Stack, Frontend
- Technology keywords: AWS, GCP, Azure, Terraform, Kubernetes, Go, Python

### Default Exclusions:

- Executive roles: Director, VP, Chief, Head of
- Non-technical: Recruiter, Sales, Marketing

### Customization via `.env.local`:

```
TARGET_ROLES=software engineer,cloud architect,devops
EXCLUDED_KEYWORDS=director,vp,sales
```

## Usage

```bash
# Trigger scrape
curl -X POST http://localhost:3000/api/jobs

# Get jobs
curl http://localhost:3000/api/jobs?company=stripe&limit=50
```

## UI Pages

| Route           | Description                          |
| --------------- | ------------------------------------ |
| `/jobs`         | H-1B company browser (732 companies) |
| `/job-listings` | Scraped job listings with filters    |
