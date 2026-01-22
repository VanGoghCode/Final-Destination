"use client";

import { useState, useEffect, useMemo } from "react";
import type { Company } from "@/lib/config";

interface CompaniesData {
  generatedAt: string;
  totalCompanies: number;
  tierCounts: {
    top: number;
    middle: number;
    lower: number;
    lowest: number;
    below50: number;
  };
  companies: Company[];
}

const TIER_COLORS = {
  top: "bg-emerald-100 text-emerald-800 border-emerald-300",
  middle: "bg-blue-100 text-blue-800 border-blue-300",
  lower: "bg-amber-100 text-amber-800 border-amber-300",
  lowest: "bg-gray-100 text-gray-700 border-gray-300",
  below50: "bg-gray-50 text-gray-500 border-gray-200",
};

const TIER_LABELS = {
  top: "Top (≥1000)",
  middle: "Middle (501-999)",
  lower: "Lower (101-500)",
  lowest: "Lowest (51-100)",
  below50: "Below 50",
};

const SORT_OPTIONS = [
  { value: "score-desc", label: "Score (High to Low)" },
  { value: "score-asc", label: "Score (Low to High)" },
  { value: "lca-desc", label: "LCAs (High to Low)" },
  { value: "lca-asc", label: "LCAs (Low to High)" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
];

const PER_PAGE_OPTIONS = [12, 24, 48, 96];

export default function JobsPage() {
  const [data, setData] = useState<CompaniesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [sortBy, setSortBy] = useState("score-desc");
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load companies:", err);
        setLoading(false);
      });
  }, []);

  // Get unique states
  const states = useMemo(() => {
    if (!data) return [];
    const stateSet = new Set(
      data.companies.map((c) => c.state).filter(Boolean),
    );
    return Array.from(stateSet).sort();
  }, [data]);

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    if (!data) return [];

    let result = data.companies.filter((company) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const nameMatch = String(company.name || "")
          .toLowerCase()
          .includes(searchLower);
        const cityMatch = String(company.city || "")
          .toLowerCase()
          .includes(searchLower);
        const stateMatch = String(company.state || "")
          .toLowerCase()
          .includes(searchLower);
        if (!nameMatch && !cityMatch && !stateMatch) {
          return false;
        }
      }

      // Tier filter
      if (selectedTier !== "all" && company.tier !== selectedTier) {
        return false;
      }

      // State filter
      if (selectedState !== "all" && company.state !== selectedState) {
        return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "score-desc":
          return b.priorityScore - a.priorityScore;
        case "score-asc":
          return a.priorityScore - b.priorityScore;
        case "lca-desc":
          return b.lcaCount - a.lcaCount;
        case "lca-asc":
          return a.lcaCount - b.lcaCount;
        case "name-asc":
          return String(a.name).localeCompare(String(b.name));
        case "name-desc":
          return String(b.name).localeCompare(String(a.name));
        default:
          return 0;
      }
    });

    return result;
  }, [data, search, selectedTier, selectedState, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedTier, selectedState, sortBy, itemsPerPage]);

  // Pagination
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedTier("all");
    setSelectedState("all");
    setSortBy("score-desc");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search || selectedTier !== "all" || selectedState !== "all";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large mx-auto mb-4"></div>
          <p className="text-muted">Loading companies...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Failed to load companies data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 lg:py-8">
      <div className="responsive-container">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold gradient-text mb-2">
            H-1B Sponsoring Companies
          </h1>
          <p className="text-muted text-sm lg:text-base">
            {data.totalCompanies.toLocaleString()} companies from FY2025 LCA
            data
          </p>
        </div>

        {/* Tier Stats - Clickable Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
          {Object.entries(data.tierCounts).map(([tier, count]) => (
            <button
              key={tier}
              onClick={() =>
                setSelectedTier(selectedTier === tier ? "all" : tier)
              }
              className={`glass-card p-3 lg:p-4 text-left transition-all hover:scale-[1.02] ${
                selectedTier === tier
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md"
              }`}
            >
              <div className="text-xl lg:text-2xl font-bold">
                {count.toLocaleString()}
              </div>
              <div className="text-xs lg:text-sm text-muted">
                {TIER_LABELS[tier as keyof typeof TIER_LABELS]}
              </div>
            </button>
          ))}
        </div>

        {/* Filters Section */}
        <div className="glass-card p-4 lg:p-5 mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
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
              placeholder="Search by company name, city, or state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Tier Filter */}
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            >
              <option value="all">All Tiers</option>
              {Object.entries(TIER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* State Filter */}
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            >
              <option value="all">All States</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            {/* Items Per Page */}
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            >
              {PER_PAGE_OPTIONS.map((num) => (
                <option key={num} value={num}>
                  {num} per page
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">
              Showing{" "}
              <strong>{filteredCompanies.length.toLocaleString()}</strong>{" "}
              companies
            </span>
            {totalPages > 1 && (
              <span className="text-muted">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
        </div>

        {/* Company Grid */}
        {paginatedCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            {paginatedCompanies.map((company, index) => (
              <CompanyCard
                key={`${company.id}-${index}`}
                company={company}
                isExpanded={expandedId === company.id}
                onToggle={() =>
                  setExpandedId(expandedId === company.id ? null : company.id)
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">
              <svg
                className="w-16 h-16 mx-auto text-gray-300"
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
            </div>
            <h3 className="text-lg font-medium mb-2">No companies found</h3>
            <p className="text-muted mb-4">
              Try adjusting your filters or search term
            </p>
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>

              {/* Page Numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        currentPage === page
                          ? "bg-primary text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                Last
              </button>
            </div>

            {/* Jump to page */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className="w-16 px-2 py-1 rounded border border-gray-200 text-center"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CompanyCardProps {
  company: Company;
  isExpanded: boolean;
  onToggle: () => void;
}

function CompanyCard({ company, isExpanded, onToggle }: CompanyCardProps) {
  const tierClass = TIER_COLORS[company.tier] || TIER_COLORS.below50;

  return (
    <div
      className={`glass-card p-4 lg:p-5 transition-all hover:shadow-lg ${
        isExpanded ? "ring-2 ring-primary/30" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base lg:text-lg truncate mb-1">
            {company.name}
          </h3>
          <p className="text-sm text-muted">
            {company.city}, {company.state}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${tierClass}`}
        >
          {company.tier}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg lg:text-xl font-bold text-gray-800">
            {company.lcaCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted">Total LCAs</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg lg:text-xl font-bold text-primary">
            {company.priorityScore.toFixed(0)}
          </div>
          <div className="text-xs text-muted">Priority Score</div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isExpanded ? (
          <>
            <span>Hide Details</span>
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
                d="M5 15l7-7 7 7"
              />
            </svg>
          </>
        ) : (
          <>
            <span>View Details</span>
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          {/* Quarterly Breakdown */}
          <div>
            <h4 className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">
              Quarterly LCAs (FY2025)
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <div key={q} className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-muted">{q}</div>
                  <div className="font-semibold">
                    {company[`lca${q}` as keyof Company] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* POC Contact */}
          {company.pocEmail && (
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-blue-800 mb-2 uppercase tracking-wide">
                Point of Contact
              </h4>
              <p className="font-medium text-sm">
                {company.pocFirstName} {company.pocLastName}
              </p>
              <a
                href={`mailto:${company.pocEmail}`}
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {company.pocEmail}
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(company.name + " careers")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 btn-primary text-sm text-center"
            >
              Search Careers
            </a>
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name + " recruiter")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 btn-secondary text-sm text-center"
            >
              Find Recruiters
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
