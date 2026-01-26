import { NextRequest, NextResponse } from "next/server";
import { 
  getCompanyCareerUrls,
  addCompanyCareerUrl,
  removeCompanyCareerUrl,
  setCompanyCareerUrls,
  getCompanyFromTiers,
} from "@/lib/db";

// GET - Get career URLs for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const result = await getCompanyFromTiers(companyId);
    if (!result) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      companyId,
      careerUrls: result.company.careerUrls || [],
      tier: result.tier,
    });
  } catch (error) {
    console.error("Failed to get company links:", error);
    return NextResponse.json(
      { error: "Failed to get company links" },
      { status: 500 }
    );
  }
}

// POST - Add a career URL to a company
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, url, urls } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Support both single url and array of urls
    if (urls && Array.isArray(urls)) {
      // Set all URLs at once
      const filteredUrls = urls.filter((u: string) => u.trim() !== "");
      const result = await setCompanyCareerUrls(companyId, filteredUrls);
      
      if (!result.success) {
        return NextResponse.json(
          { error: "Company not found or failed to update" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        companyId,
        careerUrls: result.urls,
      });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const result = await addCompanyCareerUrl(companyId, url.trim());
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Company not found or failed to add URL" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      careerUrls: result.urls,
    });
  } catch (error) {
    console.error("Failed to add company link:", error);
    return NextResponse.json(
      { error: "Failed to add company link" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a career URL from a company
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const url = searchParams.get("url");

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const result = await removeCompanyCareerUrl(companyId, url);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Company not found or failed to remove URL" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      careerUrls: result.urls,
    });
  } catch (error) {
    console.error("Failed to remove company link:", error);
    return NextResponse.json(
      { error: "Failed to remove company link" },
      { status: 500 }
    );
  }
}
