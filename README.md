# Final Destination

AI-powered resume and cover letter tailoring using Google Vertex AI.

## Features

- AI-tailored Resume & Cover Letter (LaTeX)
- Regenerate with feedback
- Application Q&A generation
- Cold email & referral request generation
- Google Sheets application tracking
- General Q&A about your application

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

### 2. Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Vertex AI API**
3. Create a Service Account with **Vertex AI User** role
4. Download the JSON key file and place it in the project root

### 3. Environment Variables

Create `.env.local` in the project root:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account-key.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
```

| Variable                         | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON file                    |
| `GOOGLE_CLOUD_PROJECT`           | Your Google Cloud Project ID                         |
| `GOOGLE_CLOUD_LOCATION`          | Vertex AI region (default: `global`)                 |
| `GOOGLE_SPREADSHEET_ID`          | Google Sheets ID for application tracking (optional) |

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Google Sheets Integration (Optional)

1. Create a Google Sheet with columns: `Name, Position, Date Applied, Application Link, Status, Interview Date, Email Link, Notes`
2. Share the sheet with your service account email (from JSON file)
3. Update `src/app/api/sheets/route.ts` line 4 with your Spreadsheet ID

---

## Security

- Never commit `.env.local` or service account JSON files
- Both are in `.gitignore` by default
