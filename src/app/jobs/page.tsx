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
  customCareerUrls?: string[];
  platform: string;
}

// Helper to get all career URLs (both scraped and custom)
function getAllCareerUrls(company: Company): string[] {
  const scraped = company.careerUrls || [];
  const custom = company.customCareerUrls || [];
  return [...new Set([...scraped, ...custom])];
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
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  // Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Link management modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalCompany, setLinkModalCompany] = useState<Company | null>(null);
  const [editingLinks, setEditingLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [savingLinks, setSavingLinks] = useState(false);
  
  // Track which companies have POC info revealed
  const [revealedPOC, setRevealedPOC] = useState<Set<string>>(new Set());
  
  // Track which company name was just copied (for visual feedback)
  const [copiedCompanyId, setCopiedCompanyId] = useState<string | null>(null);
  
  const togglePOCVisibility = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedPOC(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };
  
  const copyCompanyName = async (companyId: string, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(companyName);
      setCopiedCompanyId(companyId);
      setTimeout(() => setCopiedCompanyId(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/top-tier").then((res) => res.json()),
      fetch("/api/middle-tier").then((res) => res.json()),
      fetch("/api/lower-tier").then((res) => res.json()),
      fetch("/api/lowest-tier").then((res) => res.json()),
      fetch("/api/company-links?all=true").then((res) => res.json()).catch(() => ({ customLinks: {} })),
    ])
      .then(
        ([topTier, middleTier, lowerTier, lowestTier, customLinksData]: [
          TierData,
          TierData,
          TierData,
          TierData,
          { customLinks: Record<string, string[]> },
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

          // Merge custom links from Redis (production) into companies
          const customLinks = customLinksData.customLinks || {};
          const companiesWithCustomLinks = uniqueCompanies.map((company) => {
            if (customLinks[company.id]) {
              return {
                ...company,
                customCareerUrls: [
                  ...(company.customCareerUrls || []),
                  ...customLinks[company.id],
                ].filter((url, index, arr) => arr.indexOf(url) === index), // dedupe
              };
            }
            return company;
          });

          setCompanies(companiesWithCustomLinks);
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
    const allUrls = getAllCareerUrls(company);
    if (allUrls.length > 0) {
      allUrls.forEach((url) => {
        window.open(url, "_blank");
      });
    }
  };

  const openAllCompanyPages = () => {
    // If companies are selected, open only selected ones
    const companiesToOpen = selectedCompanies.size > 0
      ? filteredCompanies.filter((c) => selectedCompanies.has(c.id))
      : filteredCompanies;

    companiesToOpen.forEach((company) => {
      const allUrls = getAllCareerUrls(company);
      if (allUrls.length > 0) {
        allUrls.forEach((url) => {
          window.open(url, "_blank");
        });
      }
    });
  };

  // Link management functions
  const openLinkModal = (company: Company) => {
    setLinkModalCompany(company);
    setEditingLinks(company.customCareerUrls || []);
    setNewLink("");
    setLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
    setLinkModalCompany(null);
    setEditingLinks([]);
    setNewLink("");
  };

  const addNewLink = () => {
    if (newLink.trim() && !editingLinks.includes(newLink.trim())) {
      setEditingLinks([...editingLinks, newLink.trim()]);
      setNewLink("");
    }
  };

  const removeLink = (index: number) => {
    setEditingLinks(editingLinks.filter((_, i) => i !== index));
  };

  const saveLinks = async () => {
    if (!linkModalCompany) return;
    
    setSavingLinks(true);
    try {
      const response = await fetch("/api/company-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: linkModalCompany.id,
          urls: editingLinks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save links");
      }

      // Update local state
      setCompanies(companies.map((c) => 
        c.id === linkModalCompany.id 
          ? { ...c, customCareerUrls: editingLinks }
          : c
      ));
      
      closeLinkModal();
    } catch (error) {
      console.error("Failed to save links:", error);
      alert("Failed to save links. Please try again.");
    } finally {
      setSavingLinks(false);
    }
  };

  const handleCompanySelect = (company: Company, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedCompanies);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(filteredCompanies[i].id);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click (or Cmd+Click on Mac): Toggle single selection
      if (newSelected.has(company.id)) {
        newSelected.delete(company.id);
      } else {
        newSelected.add(company.id);
      }
    } else {
      // Regular click: Select only this one (or deselect if already selected)
      if (newSelected.size === 1 && newSelected.has(company.id)) {
        newSelected.clear();
      } else {
        newSelected.clear();
        newSelected.add(company.id);
      }
    }

    setSelectedCompanies(newSelected);
    setLastSelectedIndex(index);
  };

  const clearSelection = () => {
    setSelectedCompanies(new Set());
    setLastSelectedIndex(null);
  };

  const selectAll = () => {
    setSelectedCompanies(new Set(filteredCompanies.map((c) => c.id)));
  };

  // Calculate tabs count for selected or all companies
  const getTabsCount = () => {
    const companiesToCount = selectedCompanies.size > 0
      ? filteredCompanies.filter((c) => selectedCompanies.has(c.id))
      : filteredCompanies;
    return companiesToCount.reduce((acc, c) => acc + getAllCareerUrls(c).length, 0);
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
    <div className="min-h-screen flex">
      {/* Collapsible Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-full md:w-80" : "w-0"
        } transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
          isMobile ? "fixed inset-0 z-40 bg-black/50" : "sticky top-0 h-screen"
        }`}
        onClick={(e) => {
          if (isMobile && e.target === e.currentTarget) setSidebarOpen(false);
        }}
      >
        <div className={`${
          isMobile ? "w-[85%] max-w-sm" : "w-80"
        } h-full bg-white border-r border-gray-200 flex flex-col ${
          isMobile ? "shadow-2xl" : ""
        }`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-lg gradient-text">Filters & Actions</h2>
            <p className="text-xs text-muted mt-1">
              {companies.length} companies total
            </p>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Companies
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                  placeholder="Search by name, city, state..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Tier Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Tier
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedTier("all")}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedTier === "all"
                      ? "bg-primary text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTier === "all" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    All Tiers
                  </span>
                  <span className="text-xs opacity-75">{companies.length}</span>
                </button>
                <button
                  onClick={() => setSelectedTier("top")}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedTier === "top"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTier === "top" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Top Tier
                  </span>
                  <span className="text-xs opacity-75">{topCount}</span>
                </button>
                <button
                  onClick={() => setSelectedTier("middle")}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedTier === "middle"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 hover:bg-blue-100 text-blue-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTier === "middle" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Middle Tier
                  </span>
                  <span className="text-xs opacity-75">{middleCount}</span>
                </button>
                <button
                  onClick={() => setSelectedTier("lower")}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedTier === "lower"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTier === "lower" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Lower Tier
                  </span>
                  <span className="text-xs opacity-75">{lowerCount}</span>
                </button>
                <button
                  onClick={() => setSelectedTier("lowest")}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedTier === "lowest"
                      ? "bg-purple-600 text-white"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTier === "lowest" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Lowest Tier
                  </span>
                  <span className="text-xs opacity-75">{lowestCount}</span>
                </button>
              </div>
            </div>

            {/* Selection Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selection
              </label>
              <div className="space-y-2">
                <button
                  onClick={selectAll}
                  className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Select All Visible
                </button>
                {selectedCompanies.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Clear Selection ({selectedCompanies.size})
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bulk Actions
              </label>
              <div className="space-y-2">
                <button
                  onClick={openAllCompanyPages}
                  className={`w-full flex items-center justify-center gap-2 text-sm ${
                    selectedCompanies.size > 0 ? "btn-primary" : "btn-secondary"
                  }`}
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
                  {selectedCompanies.size > 0
                    ? `Open Selected (${getTabsCount()} tabs)`
                    : `Open All (${getTabsCount()} tabs)`}
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Navigation
              </label>
              <a
                href="/job-listings"
                className="w-full btn-primary inline-flex items-center justify-center gap-2 text-sm"
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
                View Scraped Jobs
              </a>
            </div>
          </div>

          {/* Sidebar Footer - Stats */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="text-sm text-muted">
              <span className="font-medium text-gray-900">
                {filteredCompanies.length}
              </span>{" "}
              of {companies.length} companies
              {selectedCompanies.size > 0 && (
                <span className="block text-primary font-medium mt-1">
                  {selectedCompanies.size} selected
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button - hidden on mobile (use header button) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`hidden md:block fixed z-20 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-r-lg p-2 shadow-md hover:bg-gray-50 transition-all ${
          sidebarOpen ? "left-80" : "left-0"
        }`}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${
            sidebarOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Sticky Header */}


        {/* Company List */}
        <div className="p-3 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {filteredCompanies.map((company, index) => (
            <div
              key={company.id}
              onClick={(e) => handleCompanySelect(company, index, e)}
              className={`relative glass-card p-4 md:p-5 hover:shadow-xl transition-all flex flex-col cursor-pointer select-none ${
                selectedCompanies.has(company.id)
                  ? "ring-2 ring-primary bg-primary/5 hover:bg-primary/20"
                  : "hover:bg-blue-50 hover:border-blue-200"
              }`}
            >
              {/* Selection checkbox indicator */}
              <div className="absolute top-3 right-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedCompanies.has(company.id)
                      ? "bg-primary border-primary"
                      : "border-gray-300 hover:border-primary"
                  }`}
                >
                  {selectedCompanies.has(company.id) && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
              {/* Company Info */}
              <div className="flex-1 min-w-0 mb-3 md:mb-4 pr-6">
                <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                  <h2 
                    className={`font-bold text-base md:text-lg leading-tight truncate max-w-48 md:max-w-56 lg:max-w-64 cursor-pointer transition-all duration-200 hover:text-primary ${
                      copiedCompanyId === company.id ? 'text-green-600 scale-105' : ''
                    }`}
                    onClick={(e) => copyCompanyName(company.id, company.name, e)}
                    title={`${company.name} (click to copy)`}
                  >
                    {copiedCompanyId === company.id ? '✓ Copied!' : company.name}
                  </h2>
                  <span className="shrink-0 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                    {company.lcaCount.toLocaleString()} LCAs
                  </span>
                  {company.customCareerUrls && company.customCareerUrls.length > 0 && (
                    <span className="shrink-0 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-medium flex items-center gap-1">
                      <svg className="w-2.5 md:w-3 h-2.5 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {company.customCareerUrls.length}
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-muted mb-2">
                  {company.city}, {company.state}
                </p>

                {/* POC Info - Hidden by default, revealed on button click */}
                {company.pocEmail && (
                  <div className="hidden sm:block mb-2">
                    {revealedPOC.has(company.id) ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium text-gray-700">
                          {company.pocFirstName} {company.pocLastName}
                        </span>
                        <a
                          href={`mailto:${company.pocEmail}`}
                          className="text-blue-600 hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.pocEmail}
                        </a>
                        <button
                          onClick={(e) => togglePOCVisibility(company.id, e)}
                          className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
                          title="Hide contact"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => togglePOCVisibility(company.id, e)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Show Contact
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Quarterly Stats - Compact */}
              <div className="flex items-center justify-between gap-1.5 md:gap-2 mb-3 md:mb-4">
                {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                  <div
                    key={q}
                    className="text-center px-2 md:px-3 py-1.5 md:py-2 bg-gray-50 rounded-lg flex-1"
                  >
                    <div className="text-[10px] md:text-xs text-muted">{q}</div>
                    <div className="font-semibold text-xs md:text-sm">
                      {(company[`lca${q}` as keyof Company] as number) || 0}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 md:gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openAllCareerPages(company)}
                  disabled={getAllCareerUrls(company).length === 0}
                  className="btn-primary text-xs md:text-sm flex items-center gap-1.5 md:gap-2 flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed py-2 md:py-3"
                  title={
                    getAllCareerUrls(company).length > 0
                      ? `Open ${getAllCareerUrls(company).length} career page(s)`
                      : "No career URLs - click + to add"
                  }
                >
                  <svg
                    className="w-3.5 md:w-4 h-3.5 md:h-4"
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
                  ({getAllCareerUrls(company).length})
                </button>
                <button
                  onClick={() => openLinkModal(company)}
                  className="btn-secondary text-xs md:text-sm flex items-center gap-1 px-2 py-2 md:py-3"
                  title="Add or manage career page links"
                >
                  <svg
                    className="w-3.5 md:w-4 h-3.5 md:h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name + " recruiter")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs md:text-sm gap-2 px-2 py-2 md:py-3 sm:inline-flex hidden"
                  title="Find recruiters on LinkedIn"
                >
                  <svg
                    className="w-3.5 md:w-4 h-3.5 md:h-4"
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
                  className="btn-secondary text-xs md:text-sm gap-2 px-2 py-2 md:py-3 sm:inline-flex hidden"
                  title="Search Google for career page"
                >
                  <svg
                    className="w-3.5 md:w-4 h-3.5 md:h-4"
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
            <p className="text-muted mb-4">Try adjusting your search or filter</p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedTier("all");
              }}
              className="btn-primary"
            >
              Clear Filters
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Link Management Modal */}
      {linkModalOpen && linkModalCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Manage Career Links
                  </h3>
                  <p className="text-sm text-muted mt-1">{linkModalCompany.name}</p>
                </div>
                <button
                  onClick={closeLinkModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[50vh]">
              {/* Existing scraped URLs (read-only) */}
              {linkModalCompany.careerUrls && linkModalCompany.careerUrls.length > 0 && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scraped URLs (auto-detected)
                  </label>
                  <div className="space-y-2">
                    {linkModalCompany.careerUrls.map((url, index) => (
                      <div
                        key={`scraped-${index}`}
                        className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate flex-1"
                        >
                          {url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom URLs (editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Custom URLs
                </label>
                {editingLinks.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {editingLinks.map((url, index) => (
                      <div
                        key={`custom-${index}`}
                        className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate flex-1"
                        >
                          {url}
                        </a>
                        <button
                          onClick={() => removeLink(index)}
                          className="p-1 hover:bg-red-100 rounded text-red-500 transition-colors"
                          title="Remove link"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted mb-3">No custom URLs added yet.</p>
                )}

                {/* Add new URL */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNewLink();
                      }
                    }}
                    placeholder="https://careers.example.com/jobs"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  />
                  <button
                    onClick={addNewLink}
                    disabled={!newLink.trim()}
                    className="btn-secondary px-4 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={closeLinkModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveLinks}
                disabled={savingLinks}
                className="btn-primary flex items-center gap-2"
              >
                {savingLinks ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Links
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
