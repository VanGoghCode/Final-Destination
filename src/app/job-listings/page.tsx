"use client";

import { useState, useEffect, useMemo } from "react";
import Button from "@/components/Button";

interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  department?: string;
  url: string;
  postedAt?: string;
  scrapedAt: string;
  platform: string;
}

interface JobsData {
  lastScraped: string | null;
  totalJobs: number;
  jobs: Job[];
}

const PLATFORM_COLORS: Record<string, string> = {
  greenhouse: "bg-green-100 text-green-800 border-green-300",
  lever: "bg-purple-100 text-purple-800 border-purple-300",
  workday: "bg-blue-100 text-blue-800 border-blue-300",
  ashby: "bg-pink-100 text-pink-800 border-pink-300",
  custom: "bg-gray-100 text-gray-700 border-gray-300",
};

const DAY_OPTIONS = [1, 2, 3, 4] as const;
type DaysFilter = (typeof DAY_OPTIONS)[number];

const EXCLUDED_TITLES = [
  "senior",
  "lead",
  "principal",
  "manager",
  "director",
  "vp",
  "vice president",
  "head of",
  "chief",
  "cto",
  "cfo",
  "ceo",
  "founder",
  "co-founder",
];

const isExcludedTitle = (title: string) =>
  EXCLUDED_TITLES.some((kw) => title.toLowerCase().includes(kw));

export default function JobListingsPage() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(1);

  useEffect(() => {
    const handlePopState = () => setSelectedCompany(null);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs?limit=10000");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/jobs?limit=10000");
        const json = await res.json();
        if (mounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      mounted = false;
    };
  }, []);

  const triggerScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/jobs", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error("Scraping failed:", err);
    }
    setScraping(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isWithinDays = (dateStr: string | undefined, days: DaysFilter): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - days * 24);
    return date >= cutoff;
  };

  // Filter all jobs by selected days window and exclude senior-level roles
  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs.filter(
      (j) => isWithinDays(j.postedAt, daysFilter) && !isExcludedTitle(j.title),
    );
  }, [data, daysFilter]);

  // Group filtered jobs by company
  const companyStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        name: string;
        totalJobs: number;
        latestJobDate: string | null;
        platform: string;
      }
    >();

    filteredJobs.forEach((job) => {
      const current = stats.get(job.companyName) || {
        name: job.companyName,
        totalJobs: 0,
        latestJobDate: null,
        platform: job.platform,
      };

      current.totalJobs += 1;

      if (
        job.postedAt &&
        (!current.latestJobDate || new Date(job.postedAt) > new Date(current.latestJobDate))
      ) {
        current.latestJobDate = job.postedAt;
      }

      stats.set(job.companyName, current);
    });

    return Array.from(stats.values()).sort((a, b) => {
      if (b.totalJobs !== a.totalJobs) return b.totalJobs - a.totalJobs;
      return a.name.localeCompare(b.name);
    });
  }, [filteredJobs]);

  // Filter jobs for selected company within the days window, sorted newest first
  const companyJobs = useMemo(() => {
    if (!data?.jobs || !selectedCompany) return [];

    const jobs = data.jobs.filter(
      (j) =>
        j.companyName === selectedCompany &&
        isWithinDays(j.postedAt, daysFilter) &&
        !isExcludedTitle(j.title),
    );

    return jobs.sort((a, b) => {
      if (!a.postedAt) return 1;
      if (!b.postedAt) return -1;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }, [data, selectedCompany, daysFilter]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner-large mx-auto mb-4"></div>
          <p className="text-muted">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 md:py-6 lg:py-8">
      <div className="responsive-container">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:mb-6 md:gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h1 className="gradient-text mb-1 text-xl font-bold md:mb-2 md:text-2xl lg:text-3xl">
                Job Listings
              </h1>
              <p className="text-muted truncate text-xs md:text-sm">
                {selectedCompany ? (
                  <>
                    Jobs for <span className="font-semibold text-gray-900">{selectedCompany}</span>
                  </>
                ) : (
                  <>
                    {filteredJobs.length} new jobs in {daysFilter}d &middot; {companyStats.length}{" "}
                    companies
                  </>
                )}
                {data?.lastScraped && (
                  <span className="ml-2 hidden sm:inline">
                    (Updated: {formatDate(data.lastScraped)})
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {selectedCompany && (
                <Button
                  onClick={() => window.history.back()}
                  variant="ghost"
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200 md:px-4 md:py-2 md:text-sm"
                >
                  &larr; Back
                </Button>
              )}
              <Button
                onClick={triggerScrape}
                disabled={scraping}
                variant="primary"
                className="flex items-center gap-1.5 text-xs md:gap-2 md:text-sm"
              >
                {scraping ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent md:h-4 md:w-4"></div>
                    <span className="hidden sm:inline">Scraping...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4 md:h-5 md:w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="hidden sm:inline">Refresh Jobs</span>
                    <span className="sm:hidden">Refresh</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Days Filter Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">Show:</span>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDaysFilter(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all md:px-3 md:py-1.5 md:text-sm ${
                    daysFilter === d
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedCompany ? (
          /* Company Detail View */
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold md:text-xl">
                Available Openings
                <span className="ml-2 text-xs font-normal text-gray-500 md:text-sm">
                  ({companyJobs.length})
                </span>
              </h2>
            </div>

            {companyJobs.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                {companyJobs.map((job) => {
                  const cardContent = (
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-start gap-2 sm:items-center">
                          <h3 className="group-hover:text-primary line-clamp-2 text-sm font-semibold transition-colors md:truncate md:text-lg">
                            {job.title}
                          </h3>
                          {isWithinDays(job.postedAt, 1) && (
                            <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 md:px-2 md:text-xs">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-muted flex flex-wrap items-center gap-1.5 text-xs md:gap-2 md:text-sm">
                          <span className="max-w-40 truncate font-medium text-gray-700 md:max-w-none">
                            {job.companyName}
                          </span>
                          <span className="hidden sm:inline">&bull;</span>
                          <span className="truncate">{job.location}</span>
                          {job.department && (
                            <>
                              <span className="hidden md:inline">&bull;</span>
                              <span className="hidden md:inline">{job.department}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2 md:mt-0 md:gap-3">
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] md:px-2 md:py-1 md:text-xs ${PLATFORM_COLORS[job.platform] || PLATFORM_COLORS.custom}`}
                        >
                          {job.platform}
                        </span>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-900 md:text-sm">
                            {formatDate(job.postedAt)}
                          </div>
                          <div className="text-muted hidden text-[10px] sm:block md:text-xs">
                            Posted
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  if (job.url) {
                    return (
                      <a
                        key={job.id}
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass-card group hover:border-l-primary block border-l-4 border-l-transparent p-3 transition-all hover:shadow-lg md:p-4 lg:p-5"
                      >
                        {cardContent}
                      </a>
                    );
                  }

                  return (
                    <div
                      key={job.id}
                      className="glass-card block border-l-4 border-l-transparent p-3 opacity-70 md:p-4 lg:p-5"
                    >
                      {cardContent}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card py-8 text-center md:py-12">
                <p className="text-base text-gray-500 md:text-lg">
                  No jobs found for this time window.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Companies Grid View */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {companyStats.length > 0 ? (
              companyStats.map((stat) => (
                <Button
                  key={stat.name}
                  onClick={() => {
                    if (selectedCompany) {
                      window.history.replaceState(null, "");
                    } else {
                      window.history.pushState(null, "");
                    }
                    setSelectedCompany(stat.name);
                  }}
                  variant="ghost"
                  className="glass-card group relative flex h-full flex-col justify-between overflow-hidden p-4 text-left transition-all hover:shadow-lg md:p-5"
                >
                  <div className="absolute top-0 right-0 p-2 opacity-10 transition-opacity group-hover:opacity-20 md:p-4">
                    <svg
                      className="text-primary h-16 w-16 md:h-24 md:w-24"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v12h16V6H4zm2 2h12v2H6V8zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
                    </svg>
                  </div>

                  <div>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="group-hover:text-primary line-clamp-2 text-base font-bold transition-colors md:text-xl">
                        {stat.name}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] md:px-2 md:py-1 md:text-xs ${PLATFORM_COLORS[stat.platform] || PLATFORM_COLORS.custom}`}
                      >
                        {stat.platform}
                      </span>
                    </div>
                    <div className="text-muted mb-3 text-xs md:mb-4 md:text-sm">
                      Last active: {formatDate(stat.latestJobDate || undefined)}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="rounded-lg bg-gray-50 p-2 md:p-3">
                      <div className="text-lg font-bold text-gray-900 md:text-xl">
                        {stat.totalJobs}
                      </div>
                      <div className="text-[10px] font-semibold text-blue-600 md:text-xs">
                        New ({daysFilter}d)
                      </div>
                    </div>
                  </div>
                </Button>
              ))
            ) : (
              <div className="glass-card col-span-full py-12 text-center">
                <p className="text-base text-gray-500 md:text-lg">
                  No jobs found in the last {daysFilter} days.
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Try a wider time window or refresh jobs.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
