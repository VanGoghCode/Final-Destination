import type { Job, ScrapeResult } from "./types";

/**
 * Known Workday domains and their configurations
 */
export const WORKDAY_COMPANIES: Record<
  string,
  { id: string; name: string; domain: string; site: string }
> = {
  salesforce: {
    id: "SALESFORCE,_INC.",
    name: "Salesforce",
    domain: "salesforce.wd12.myworkdayjobs.com",
    site: "External_Career_Site",
  },
  adobe: {
    id: "ADOBE_INC.",
    name: "Adobe",
    domain: "adobe.wd5.myworkdayjobs.com",
    site: "external_experienced",
  },
  nvidia: {
    id: "NVIDIA_CORPORATION",
    name: "NVIDIA",
    domain: "nvidia.wd5.myworkdayjobs.com",
    site: "NVIDIAExternalCareerSite",
  },
  paypal: {
    id: "PAYPAL,_INC.",
    name: "PayPal",
    domain: "paypal.wd1.myworkdayjobs.com",
    site: "jobs",
  },
  vmware: {
    id: "VMWARE",
    name: "VMware",
    domain: "vmware.wd1.myworkdayjobs.com",
    site: "VMware_Careers",
  },
  qualcomm: {
    id: "QUALCOMM",
    name: "Qualcomm",
    domain: "qualcomm.wd5.myworkdayjobs.com",
    site: "External",
  },
  visa: {
    id: "VISA",
    name: "Visa",
    domain: "visa.wd5.myworkdayjobs.com",
    site: "Visa_Inc_External",
  },
  intuit: {
    id: "INTUIT",
    name: "Intuit",
    domain: "intuit.wd1.myworkdayjobs.com",
    site: "Jobs",
  },
  anduril: {
    id: "ANDURIL",
    name: "Anduril",
    domain: "anduril.wd1.myworkdayjobs.com",
    site: "Anduril",
  },
};

/**
 * Scrape jobs from Workday career sites
 * Uses the Workday faceted search API endpoint
 */
export async function scrapeWorkday(
  companyKey: string,
  companyId: string,
  companyName: string,
): Promise<ScrapeResult> {
  const config = WORKDAY_COMPANIES[companyKey];
  if (!config) {
    return {
      success: false,
      jobs: [],
      error: `Unknown Workday company: ${companyKey}`,
    };
  }

  try {
    const jobs: Job[] = [];
    const limit = 20;
    let offset = 0;
    let hasMore = true;
    let total = 0;

    // Extract tenant from domain (e.g., salesforce.wd12.myworkdayjobs.com -> salesforce)
    // Most Workday domains are formatted as {tenant}.{cluster}.myworkdayjobs.com
    const tenant = config.domain.split(".")[0];
    const baseUrl = `https://${config.domain}/wday/cxs/${tenant}/${config.site}/jobs`;

    while (hasMore) {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        body: JSON.stringify({
          limit,
          offset,
          searchText: "",
        }),
      });

      if (!response.ok) {
        // If we have collected some jobs, return partial success
        if (jobs.length > 0) {
          console.warn(
            `Workday scrape partial failure for ${companyName}: ${response.status}`,
          );
          hasMore = false;
          continue;
        }
        return {
          success: false,
          jobs: [],
          error: `Workday fetch failed: ${response.status}`,
        };
      }

      const data = await response.json();
      const jobPostings = data.jobPostings || [];

      // Capture total from the first request
      if (offset === 0) {
        total = data.total || 0;
      }

      for (const posting of jobPostings) {
        // Extract ID from bulletFields (usually first item) or fallback to externalPath
        const id =
          posting.bulletFields && posting.bulletFields.length > 0
            ? posting.bulletFields[0]
            : posting.externalPath.split("_").pop() || "unknown";

        jobs.push({
          id,
          companyId,
          companyName,
          title: posting.title,
          location: posting.locationsText || "Remote",
          url: `https://${config.domain}${posting.externalPath}`,
          postedAt: posting.postedOn,
          scrapedAt: new Date().toISOString(),
          platform: "workday",
        });
      }

      offset += limit;

      // Break if no more jobs returned or we've reached the total
      if (jobPostings.length === 0) {
        hasMore = false;
      } else if (total > 0 && offset >= total) {
        hasMore = false;
      }

      // Safety break to prevent infinite loops or excessive scraping
      if (offset > 2000) {
        hasMore = false;
      }
    }

    return {
      success: true,
      jobs,
    };
  } catch (error) {
    return {
      success: false,
      jobs: [],
      error: `Workday scrape failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
