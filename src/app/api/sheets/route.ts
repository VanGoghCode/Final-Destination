import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";
const SHEET_NAME = "tracker";

// Helper to get auth
function getAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  throw new Error("No Google credentials configured");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, positionTitle, applicationLink, notes, other } = body;

    if (!companyName || !positionTitle || !applicationLink) {
      return NextResponse.json(
        { error: "Company name, position, and application link are required" },
        { status: 400 },
      );
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Get today's date in DD/MM/YYYY format (using Arizona timezone)
    const today = new Date();
    const azFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Phoenix",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const dateApplied = azFormatter.format(today);

    // Row data matching columns: Name, Position, Date Applied, Application Link, Status, Interview Date, Email Link, Notes, Other
    const rowData = [
      companyName, // Name (Company Name)
      positionTitle, // Position
      dateApplied, // Date Applied (auto-filled)
      applicationLink, // Application Link
      "Applied", // Status (default)
      "", // Interview Date (empty)
      "", // Email Link (empty)
      notes || "", // Notes (optional)
      other || "", // Other (optional)
    ];

    // Append the row to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowData],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Application logged successfully!",
      data: {
        companyName,
        positionTitle,
        dateApplied,
        status: "Applied",
      },
    });
  } catch (error) {
    console.error("Error logging to Google Sheets:", error);
    return NextResponse.json(
      {
        error:
          "Failed to log application. Please check your Google Sheets configuration.",
      },
      { status: 500 },
    );
  }
}
