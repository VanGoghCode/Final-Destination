# Module 2: Job Dashboard

## Overview

A responsive dashboard to browse and filter H-1B sponsoring companies from FY2025 LCA data.

## Files

| File                             | Purpose                             |
| -------------------------------- | ----------------------------------- |
| `src/app/jobs/page.tsx`          | Main dashboard page                 |
| `src/app/api/companies/route.ts` | API endpoint serving companies.json |

## Features

### Responsive Grid Layout

- **Mobile**: 1 column
- **Tablet**: 2 columns
- **Desktop**: 3 columns

### Filters

| Filter   | Type     | Description                     |
| -------- | -------- | ------------------------------- |
| Search   | Text     | Search by name, city, state     |
| Tier     | Dropdown | Top/Middle/Lower/Lowest/Below50 |
| State    | Dropdown | All 50 US states                |
| Sort     | Dropdown | Score/LCAs/Name (asc/desc)      |
| Per Page | Dropdown | 12, 24, 48, or 96               |

### Company Cards

Each card displays:

- Company name and location
- Tier badge (color-coded)
- Total LCAs filed
- Priority Score

**Expanded details:**

- Quarterly LCA breakdown (Q1-Q4)
- POC contact info (name, email)
- Quick action links:
  - Google search for careers page
  - LinkedIn search for recruiters

### Pagination

- First/Prev/Next/Last buttons
- Page number buttons (5 visible at a time)
- Jump to page input

## API

### GET /api/companies

Returns:

```json
{
  "generatedAt": "2026-01-22T00:55:06",
  "totalCompanies": 32619,
  "tierCounts": {
    "top": 29,
    "middle": 38,
    "lower": 295,
    "lowest": 338,
    "below50": 31919
  },
  "companies": [...]
}
```

**Notes:**

- Deduplicates companies by ID (keeps highest priority score)
- Recalculates tier counts after deduplication
- Pre-sorted by priority score (descending)

## Usage

1. Navigate to `/jobs`
2. Use tier cards or dropdown to filter by tier
3. Search by company name, city, or state
4. Click "View Details" to expand company card
5. Use "Search Careers" or "Find Recruiters" for quick actions
