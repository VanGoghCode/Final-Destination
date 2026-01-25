"use client";

import { useState, useEffect, useMemo } from "react";

interface Company {
  id: string;
  name: string;
  city: string;
  state: string;
  lcaCount: number;
  lcaQ1: number;
  lcaQ2: number;
  lcaQ3: number;
  lcaQ4: number;
  approvalRate: number;
  tier: string;
  pocFirstName?: string;
  pocLastName?: string;
  pocEmail?: string;
  pocPhone?: string;
  careerUrls: string[];
  platform: string;
}

interface TierData {
  generatedAt: string;
  count: number;
  tier: string;
  companies: Company[];
}

export default function JobsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/top-tier").then((res) => res.json()),
      fetch("/api/middle-tier").then((res) => res.json()),
      fetch("/api/lower-tier").then((res) => res.json()),
      fetch("/api/lowest-tier").then((res) => res.json()),
    ])
      .then(
        ([topTier, middleTier, lowerTier, lowestTier]: [
          TierData,
          TierData,
          TierData,
          TierData,
        ]) => {
          // Combine all companies, with higher tiers first (priority order)
          const allCompanies = [
            ...topTier.companies,
            ...middleTier.companies,
            ...lowerTier.companies,
            ...lowestTier.companies,
          ];

          // Deduplicate by company ID (keep first occurrence = higher tier)
          const seen = new Set<string>();
          const uniqueCompanies = allCompanies.filter((company) => {
            if (seen.has(company.id)) {
              return false;
            }
            seen.add(company.id);
            return true;
          });

          setCompanies(uniqueCompanies);
          setLoading(false);
        },
      )
      .catch((err) => {
        console.error("Failed to load companies:", err);
        setLoading(false);
      });
  }, []);
  // Filter companies by search and tier
  const filteredCompanies = useMemo(() => {
    if (!companies.length) return [];

    let result = companies;

    // Filter by tier
    if (selectedTier !== "all") {
      result = result.filter((company) => company.tier === selectedTier);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((company) => {
        return (
          company.name.toLowerCase().includes(searchLower) ||
          company.city.toLowerCase().includes(searchLower) ||
          company.state.toLowerCase().includes(searchLower)
        );
      });
    }

    return result;
  }, [companies, search, selectedTier]);

  const openAllCareerPages = (company: Company) => {
    if (company.careerUrls && company.careerUrls.length > 0) {
      company.careerUrls.forEach((url) => {
        window.open(url, "_blank");
      });
    }
  };

  const openAllCompanyPages = () => {
    filteredCompanies.forEach((company) => {
      if (company.careerUrls && company.careerUrls.length > 0) {
        company.careerUrls.forEach((url) => {
          window.open(url, "_blank");
        });
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large mx-auto mb-4"></div>
          <p className="text-muted">Loading H-1B companies...</p>
        </div>
      </div>
    );
  }

  if (!companies.length && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Failed to load companies data</p>
      </div>
    );
  }

  const topCount = companies.filter((c) => c.tier === "top").length;
  const middleCount = companies.filter((c) => c.tier === "middle").length;
  const lowerCount = companies.filter((c) => c.tier === "lower").length;
  const lowestCount = companies.filter((c) => c.tier === "lowest").length;

  return (
    <div className="min-h-screen py-6 lg:py-8">
      <div className="responsive-container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold gradient-text mb-2">
              H-1B Sponsoring Companies
            </h1>
            <p className="text-muted text-sm">
              {companies.length} companies ({topCount} top, {middleCount}{" "}
              middle, {lowerCount} lower, {lowestCount} lowest)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openAllCompanyPages}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Open all career pages for all companies"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Open All (
              {filteredCompanies.reduce(
                (acc, c) => acc + (c.careerUrls?.length || 0),
                0,
              )}{" "}
              tabs)
            </button>
            <a
              href="/job-listings"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Scraped Jobs
            </a>
          </div>
        </div>

        {/* Search and Tier Filter */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTier("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTier === "all"
                    ? "bg-primary text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                All ({companies.length})
              </button>
              <button
                onClick={() => setSelectedTier("top")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTier === "top"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                }`}
              >
                Top ({topCount})
              </button>
              <button
                onClick={() => setSelectedTier("middle")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTier === "middle"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-800"
                }`}
              >
                Middle ({middleCount})
              </button>
              <button
                onClick={() => setSelectedTier("lower")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTier === "lower"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800"
                }`}
              >
                Lower ({lowerCount})
              </button>
              <button
                onClick={() => setSelectedTier("lowest")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTier === "lowest"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 hover:bg-purple-100 text-purple-800"
                }`}
              >
                Lowest ({lowestCount})
              </button>
            </div>
          </div>
          <div className="mt-3 text-sm text-muted">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
        </div>

        {/* Company List */}
        <div className="space-y-4">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="glass-card p-5 hover:shadow-lg transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Company Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-bold text-lg truncate">
                      {company.name}
                    </h2>
                    <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                      {company.lcaCount.toLocaleString()} LCAs
                    </span>
                  </div>
                  <p className="text-sm text-muted mb-2">
                    {company.city}, {company.state}
                  </p>

                  {/* POC Info - Inline */}
                  {company.pocEmail && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium text-gray-700">
                        {company.pocFirstName} {company.pocLastName}
                      </span>
                      <a
                        href={`mailto:${company.pocEmail}`}
                        className="text-blue-600 hover:underline"
                      >
                        {company.pocEmail}
                      </a>
                    </div>
                  )}
                </div>

                {/* Quarterly Stats - Compact */}
                <div className="flex items-center gap-2">
                  {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                    <div
                      key={q}
                      className="text-center px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <div className="text-xs text-muted">{q}</div>
                      <div className="font-semibold text-sm">
                        {(company[`lca${q}` as keyof Company] as number) || 0}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAllCareerPages(company)}
                    disabled={
                      !company.careerUrls || company.careerUrls.length === 0
                    }
                    className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      company.careerUrls?.length > 0
                        ? `Open ${company.careerUrls.length} career page(s)`
                        : "No career URLs configured"
                    }
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open Jobs ({company.careerUrls?.length || 0})
                  </button>
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name + " recruiter")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm flex items-center gap-2"
                    title="Find recruiters on LinkedIn"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(company.name + " careers jobs")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm flex items-center gap-2"
                    title="Search Google for career page"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCompanies.length === 0 && (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="text-lg font-medium mb-2">No companies found</h3>
            <p className="text-muted mb-4">Try adjusting your search term</p>
            <button onClick={() => setSearch("")} className="btn-primary">
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
